const router = require('express').Router();
const db = require('../models');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/upload');

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
router.post('/', auth, upload.single('imagen'), async (req, res) => {
  try {
    const data = { ...req.body, user_id: req.user.id };
    if (req.file) {
      data.imagen_url = `/uploads/${req.file.path.split('/').slice(-2).join('/')}`;
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

// POST /api/expenses/ocr — process receipt with Claude Vision
router.post('/ocr', auth, upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Imagen requerida' });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key de Anthropic no configurada' });

    const fs = require('fs');
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64 = imageBuffer.toString('base64');
    const mediaType = req.file.mimetype;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: 'Analiza esta factura/recibo colombiano. Extrae en JSON puro (sin markdown, sin backticks): tipo_gasto (Alojamiento|Alimentación|Transportes|Imprevistos|Gastos de Representación), establecimiento, nit, direccion, fecha (YYYY-MM-DD), valor_total (número), iva (número o 0), numero_factura, cufe, medio_pago (Efectivo|Tarjeta Débito|Tarjeta Crédito), descripcion_items. Usa null si no puedes leer.' }
          ]
        }]
      })
    });

    const data = await response.json();
    const text = (data.content || []).map(i => i.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    const imagePath = `/uploads/${req.file.path.split('/').slice(-2).join('/')}`;

    res.json({ ocr_data: parsed, imagen_url: imagePath });
  } catch (err) {
    console.error('OCR error:', err);
    res.status(500).json({ error: 'Error al procesar la imagen' });
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
