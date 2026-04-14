const router = require('express').Router();
const db = require('../models');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');

// GET /api/expenses
router.get('/', auth, async (req, res) => {
  try {
    const where = { user_id: req.user.id };
    if (req.query.legalization_id) where.legalization_id = req.query.legalization_id;
    if (req.query.categoria) where.categoria = req.query.categoria;
    if (req.query.fecha_desde) where.fecha = { [db.Sequelize.Op.gte]: req.query.fecha_desde };

    const expenses = await db.Expense.findAll({ where, order: [['fecha', 'DESC']] });
    res.json(expenses);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
});

// POST /api/expenses — create expense (with optional image)
// Helper: convert non-browser-friendly formats (HEIC/HEIF) to JPG on upload
async function normalizeUploadedImage(file) {
  if (!file) return file;
  const name = (file.originalname || '').toLowerCase();
  const mt = (file.mimetype || '').toLowerCase();
  const needsConversion =
    name.endsWith('.heic') || name.endsWith('.heif') ||
    mt === 'image/heic' || mt === 'image/heif';
  if (!needsConversion) return file;
  try {
    const sharp = require('sharp');
    const newPath = file.path.replace(/\.(heic|heif)$/i, '.jpg');
    await sharp(file.path).jpeg({ quality: 88 }).toFile(newPath);
    try { require('fs').unlinkSync(file.path); } catch {}
    file.path = newPath;
    file.mimetype = 'image/jpeg';
    file.originalname = file.originalname.replace(/\.(heic|heif)$/i, '.jpg');
  } catch (err) {
    console.warn('[normalize] HEIC conversion failed, leaving original:', err.message);
  }
  return file;
}

router.post('/', auth, upload.single('imagen'), async (req, res) => {
  try {
    const data = { ...req.body, user_id: req.user.id };
    if (req.file) {
      await normalizeUploadedImage(req.file);
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const rel = path.relative(path.resolve(uploadDir), path.resolve(req.file.path)).replace(/\\/g, '/');
      data.imagen_url = `/uploads/${rel}`;
    }
    if (data.datos_ocr && typeof data.datos_ocr === 'string') {
      data.datos_ocr = JSON.parse(data.datos_ocr);
    }
    const expense = await db.Expense.create(data);
    res.status(201).json(expense);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear gasto' });
  }
});

// POST /api/expenses/ocr — process receipt with Tesseract.js (free, local OCR)
router.post('/ocr', auth, upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Imagen requerida' });

    const Tesseract = require('tesseract.js');
    const { data: { text } } = await Tesseract.recognize(req.file.path, 'spa', { logger: () => {} });

    const parsed = parseColombianReceipt(text);
    const imagePath = `/uploads/${req.file.path.split('/').slice(-2).join('/')}`;

    res.json({ ocr_data: parsed, imagen_url: imagePath, raw_text: text });
  } catch (err) {
    console.error('OCR error:', err);
    res.status(500).json({ error: 'Error al procesar la imagen' });
  }
});

// Parse Colombian receipt text into structured data
function parseColombianReceipt(text) {
  const lines = text.replace(/\r/g, '').split('\n').map(l => l.trim()).filter(Boolean);
  const full = lines.join(' ');
  const fullLower = full.toLowerCase();

  // NIT
  const nitMatch = full.match(/NIT[.:;\s]*(\d[\d.,\-]+)/i);
  const nit = nitMatch ? nitMatch[1].replace(/\s/g, '') : null;

  // Establecimiento — usually first non-empty lines
  let establecimiento = null;
  for (const line of lines.slice(0, 5)) {
    if (line.length > 3 && !line.match(/^(NIT|TEL|DIR|FAC|FEC|RES|REG|FECHA|HORA)/i) && !line.match(/^\d/)) {
      establecimiento = line;
      break;
    }
  }

  // Dirección
  const dirMatch = full.match(/DIR(?:ECCI[OÓ]N)?[.:;\s]*([^\n]{5,80})/i) ||
                    full.match(/((?:CL|CR|KR|CALLE|CARRERA|AV|TRANS)\s*\.?\s*\d+[^\n]{3,60})/i);
  const direccion = dirMatch ? dirMatch[1].trim() : null;

  // Fecha
  const fechaMatch = full.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/) ||
                     full.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  let fecha = null;
  if (fechaMatch) {
    let [, a, b, c] = fechaMatch;
    if (a.length === 4) {
      fecha = `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    } else {
      const year = c.length === 2 ? `20${c}` : c;
      fecha = `${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    }
  }

  // Valor total
  const totalPatterns = [
    /TOTAL\s*(?:A\s*PAGAR)?[.:$\s]*\$?\s*([\d.,]+)/i,
    /VR\.\s*TOTAL[.:$\s]*\$?\s*([\d.,]+)/i,
    /VALOR\s*TOTAL[.:$\s]*\$?\s*([\d.,]+)/i,
    /TOTAL[.:$\s]*\$?\s*([\d.,]+)/i,
  ];
  let valor_total = null;
  for (const pat of totalPatterns) {
    const m = full.match(pat);
    if (m) {
      valor_total = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
      break;
    }
  }

  // IVA
  const ivaMatch = full.match(/IVA[.:$\s]*\$?\s*([\d.,]+)/i) ||
                   full.match(/I\.?\s*V\.?\s*A\.?[.:$\s]*\$?\s*([\d.,]+)/i);
  const iva = ivaMatch ? parseFloat(ivaMatch[1].replace(/\./g, '').replace(',', '.')) : 0;

  // Número de factura
  const facMatch = full.match(/(?:FACTURA|FAC|FV|No\.|NUM)[.:;\s#]*([A-Z0-9\-]{2,20})/i);
  const numero_factura = facMatch ? facMatch[1] : null;

  // CUFE
  const cufeMatch = full.match(/CUFE[.:;\s]*([a-f0-9\-]{20,})/i);
  const cufe = cufeMatch ? cufeMatch[1] : null;

  // Tipo de gasto
  let tipo_gasto = null;
  if (fullLower.match(/hotel|hospeda|alojami/)) tipo_gasto = 'Alojamiento';
  else if (fullLower.match(/restauran|comida|almuerz|cena|desayun|menú|menu|cafeter/)) tipo_gasto = 'Alimentación';
  else if (fullLower.match(/peaje|toll/)) tipo_gasto = 'Transportes';
  else if (fullLower.match(/parqu|estacion/)) tipo_gasto = 'Transportes';
  else if (fullLower.match(/taxi|uber|didi|beat|indriver|cabify/)) tipo_gasto = 'Transportes';
  else if (fullLower.match(/gasolina|combust|tanque/)) tipo_gasto = 'Transportes';

  // Medio de pago
  let medio_pago = null;
  if (fullLower.match(/tarjeta\s*(de\s*)?cr[eé]dito|visa|mastercard|amex/)) medio_pago = 'Tarjeta Crédito';
  else if (fullLower.match(/tarjeta\s*(de\s*)?d[eé]bito|nequi|daviplata/)) medio_pago = 'Tarjeta Débito';
  else if (fullLower.match(/efectivo|contado|cash/)) medio_pago = 'Efectivo';

  return {
    tipo_gasto,
    establecimiento,
    nit,
    direccion,
    fecha,
    valor_total,
    iva,
    numero_factura,
    cufe,
    medio_pago,
    descripcion_items: null,
  };
}

// GET /api/expenses/:id — get single expense
router.get('/:id', auth, async (req, res) => {
  try {
    const expense = await db.Expense.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!expense) return res.status(404).json({ error: 'No encontrado' });
    res.json(expense);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// PUT /api/expenses/:id — update expense (optionally replace image)
router.put('/:id', auth, upload.single('imagen'), async (req, res) => {
  try {
    const expense = await db.Expense.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!expense) return res.status(404).json({ error: 'No encontrado' });

    const allowed = ['categoria', 'fecha', 'establecimiento', 'nit_establecimiento',
      'direccion', 'valor', 'iva', 'medio_pago', 'numero_factura', 'cufe', 'observaciones'];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) updates[k] = req.body[k];
    }

    if (req.file) {
      await normalizeUploadedImage(req.file);
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const rel = path.relative(path.resolve(uploadDir), path.resolve(req.file.path)).replace(/\\/g, '/');
      updates.imagen_url = `/uploads/${rel}`;
    }

    await expense.update(updates);
    res.json(expense);
  } catch (err) {
    console.error('Update expense error:', err);
    res.status(500).json({ error: 'Error al actualizar gasto' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const expense = await db.Expense.findOne({ where: { id: req.params.id, user_id: req.user.id } });
    if (!expense) return res.status(404).json({ error: 'No encontrado' });
    await expense.destroy();
    res.json({ message: 'Eliminado' });
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
