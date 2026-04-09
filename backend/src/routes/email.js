const router = require('express').Router();
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');
const { auth } = require('../middleware/auth');
const db = require('../models');

const getImapConfig = () => ({
  imap: {
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASS,
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT || '993'),
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
    authTimeout: 15000,
  },
});

// GET /api/email/search — search invoices in email
router.get('/search', auth, async (req, res) => {
  try {
    if (!process.env.IMAP_USER || !process.env.IMAP_PASS) {
      return res.status(500).json({ error: 'Correo IMAP no configurado' });
    }

    const { nit, fecha, valor, establecimiento, limit: lim } = req.query;
    const maxResults = parseInt(lim) || 20;

    const connection = await imaps.connect(getImapConfig());
    await connection.openBox('INBOX');

    // Build search criteria
    const searchCriteria = ['ALL'];

    // Search by date range if provided
    if (fecha) {
      const d = new Date(fecha);
      const since = new Date(d);
      since.setDate(since.getDate() - 5); // 5 days before
      const before = new Date(d);
      before.setDate(before.getDate() + 5); // 5 days after
      searchCriteria.length = 0;
      searchCriteria.push(['SINCE', since.toISOString().split('T')[0]]);
      searchCriteria.push(['BEFORE', before.toISOString().split('T')[0]]);
    } else {
      // Default: last 30 days
      const since = new Date();
      since.setDate(since.getDate() - 30);
      searchCriteria.length = 0;
      searchCriteria.push(['SINCE', since.toISOString().split('T')[0]]);
    }

    const fetchOptions = { bodies: '', struct: true, envelope: true };
    const messages = await connection.search(searchCriteria, fetchOptions);

    const results = [];

    for (const msg of messages.slice(-maxResults * 2)) { // fetch more, filter later
      try {
        const all = msg.parts.find(p => p.which === '');
        if (!all) continue;

        const parsed = await simpleParser(all.body);
        const subject = parsed.subject || '';
        const from = parsed.from?.text || '';
        const date = parsed.date;
        const body = parsed.text || '';

        // Check if this looks like an invoice email
        const invoiceKeywords = /factura|invoice|recibo|cuenta.*cobro|nota.*cr[eé]dito|soporte|comprobante|nit|cufe/i;
        const isInvoiceEmail = invoiceKeywords.test(subject) || invoiceKeywords.test(from);

        // Check attachments for XML/PDF
        const attachments = (parsed.attachments || []).filter(att => {
          const name = (att.filename || '').toLowerCase();
          return name.endsWith('.xml') || name.endsWith('.pdf') || name.endsWith('.zip');
        });

        // Skip if not invoice-related and no relevant attachments
        if (!isInvoiceEmail && attachments.length === 0) continue;

        // Try to extract invoice data from subject/body
        const nitMatch = body.match(/NIT[.:;\s]*(\d[\d.,\-]+)/i) || subject.match(/NIT[.:;\s]*(\d[\d.,\-]+)/i);
        const valorMatch = body.match(/(?:total|valor|monto)[.:;\s$]*\$?\s*([\d.,]+)/i);
        const facturaMatch = body.match(/(?:factura|fac|fv)[.:;\s#]*([A-Z0-9\-]{2,20})/i) || subject.match(/(?:factura|fac|fv)[.:;\s#]*([A-Z0-9\-]{2,20})/i);
        const cufeMatch = body.match(/CUFE[.:;\s]*([a-f0-9\-]{20,})/i);

        const extracted = {
          nit: nitMatch ? nitMatch[1].replace(/\s/g, '') : null,
          valor: valorMatch ? parseFloat(valorMatch[1].replace(/\./g, '').replace(',', '.')) : null,
          numero_factura: facturaMatch ? facturaMatch[1] : null,
          cufe: cufeMatch ? cufeMatch[1] : null,
        };

        // Filter by NIT if provided
        if (nit && extracted.nit && !extracted.nit.includes(nit.replace(/[.\-]/g, ''))) continue;

        // Filter by establecimiento in subject/from
        if (establecimiento && !subject.toLowerCase().includes(establecimiento.toLowerCase()) && !from.toLowerCase().includes(establecimiento.toLowerCase())) continue;

        results.push({
          id: msg.attributes?.uid,
          date: date?.toISOString(),
          from,
          subject,
          extracted,
          attachments: attachments.map(a => ({
            filename: a.filename,
            contentType: a.contentType,
            size: a.size,
          })),
          hasXml: attachments.some(a => (a.filename || '').toLowerCase().endsWith('.xml')),
          hasPdf: attachments.some(a => (a.filename || '').toLowerCase().endsWith('.pdf')),
        });
      } catch (parseErr) {
        // Skip unparseable messages
        continue;
      }
    }

    connection.end();

    // Sort by date descending, limit results
    results.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(results.slice(0, maxResults));
  } catch (err) {
    console.error('IMAP search error:', err);
    res.status(500).json({ error: 'Error al conectar con el correo: ' + (err.message || err) });
  }
});

// GET /api/email/attachment/:uid/:filename — download specific attachment
router.get('/attachment/:uid/:filename', auth, async (req, res) => {
  try {
    const { uid, filename } = req.params;
    const connection = await imaps.connect(getImapConfig());
    await connection.openBox('INBOX');

    const fetchOptions = { bodies: '', struct: true };
    const messages = await connection.search([['UID', uid]], fetchOptions);

    if (messages.length === 0) {
      connection.end();
      return res.status(404).json({ error: 'Mensaje no encontrado' });
    }

    const all = messages[0].parts.find(p => p.which === '');
    const parsed = await simpleParser(all.body);
    const attachment = parsed.attachments?.find(a => a.filename === filename);

    connection.end();

    if (!attachment) return res.status(404).json({ error: 'Adjunto no encontrado' });

    res.setHeader('Content-Type', attachment.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(attachment.content);
  } catch (err) {
    console.error('Attachment error:', err);
    res.status(500).json({ error: 'Error al descargar adjunto' });
  }
});

// POST /api/email/match — auto-match email invoices with expenses
router.post('/match', auth, async (req, res) => {
  try {
    // Get user's unmatched expenses
    const expenses = await db.Expense.findAll({
      where: { user_id: req.user.id },
      order: [['fecha', 'DESC']],
    });

    if (!process.env.IMAP_USER) {
      return res.status(500).json({ error: 'Correo IMAP no configurado' });
    }

    const connection = await imaps.connect(getImapConfig());
    await connection.openBox('INBOX');

    // Search last 60 days
    const since = new Date();
    since.setDate(since.getDate() - 60);
    const fetchOptions = { bodies: '', struct: true };
    const messages = await connection.search([['SINCE', since.toISOString().split('T')[0]]], fetchOptions);

    const emailInvoices = [];
    for (const msg of messages) {
      try {
        const all = msg.parts.find(p => p.which === '');
        if (!all) continue;
        const parsed = await simpleParser(all.body);
        const body = parsed.text || '';
        const subject = parsed.subject || '';
        const from = parsed.from?.text || '';
        const fullText = `${subject} ${from} ${body}`.toLowerCase();

        const nitMatch = fullText.match(/nit[.:;\s]*(\d[\d.,\-]+)/i) || body.match(/(\d{3,}[\.\-]\d{3,}[\.\-]\d{3,})/);
        const valorMatch = body.match(/(?:total|valor|monto|neto)[.:;\s$]*\$?\s*([\d.,]+)/i);

        emailInvoices.push({
          uid: msg.attributes?.uid,
          date: parsed.date,
          from,
          subject,
          fullText,
          nit: nitMatch ? nitMatch[1].replace(/[.\s]/g, '') : null,
          valor: valorMatch ? parseFloat(valorMatch[1].replace(/\./g, '').replace(',', '.')) : null,
        });
      } catch { continue; }
    }

    connection.end();

    // Match expenses with email invoices — flexible matching
    const matches = [];
    for (const exp of expenses) {
      const expNit = (exp.nit_establecimiento || '').replace(/[.\-\s]/g, '');
      const expNombre = (exp.establecimiento || '').toLowerCase().trim();
      const expValor = parseFloat(exp.valor || 0);

      let bestMatch = null;
      let bestScore = 0;

      for (const inv of emailInvoices) {
        const invNit = (inv.nit || '').replace(/[.\-\s]/g, '');
        let score = 0;

        // Match by NIT (strongest signal)
        if (expNit && invNit && expNit.length >= 5 && (expNit.includes(invNit) || invNit.includes(expNit))) {
          score += 50;
        }

        // Match by name in subject/from/body
        if (expNombre && expNombre.length >= 3) {
          // Split name into words and check if any appear in the email
          const words = expNombre.split(/\s+/).filter(w => w.length >= 3);
          const nameMatches = words.filter(w => inv.fullText.includes(w)).length;
          if (nameMatches > 0) {
            score += Math.min(40, nameMatches * 20); // up to 40 points
          }
        }

        // Match by value (bonus, not required)
        if (inv.valor && expValor && Math.abs(inv.valor - expValor) / Math.max(expValor, 1) < 0.15) {
          score += 10;
        }

        if (score > bestScore && score >= 20) {
          bestScore = score;
          bestMatch = inv;
        }
      }

      if (bestMatch) {
        matches.push({
          expense_id: exp.id,
          expense: { id: exp.id, categoria: exp.categoria, establecimiento: exp.establecimiento, fecha: exp.fecha, valor: exp.valor, nit: exp.nit_establecimiento },
          email: { uid: bestMatch.uid, from: bestMatch.from, subject: bestMatch.subject, date: bestMatch.date, nit: bestMatch.nit, valor: bestMatch.valor },
          confidence: Math.min(100, bestScore),
        });
      }
    }

    matches.sort((a, b) => b.confidence - a.confidence);
    res.json({ total_expenses: expenses.length, total_emails: emailInvoices.length, matches });
  } catch (err) {
    console.error('Match error:', err);
    res.status(500).json({ error: 'Error al buscar coincidencias: ' + (err.message || err) });
  }
});

module.exports = router;
