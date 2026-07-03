const router = require('express').Router();
const db = require('../models');
const { auth } = require('../middleware/auth');
const upload = require('../middleware/upload');
const path = require('path');
const { validarFechaGasto } = require('../utils/dates');

const CATEGORIAS_VALIDAS = ['alojamiento', 'alimentacion', 'transportes', 'imprevistos', 'representacion', 'peaje', 'parqueadero', 'taxi', 'otro'];
const MEDIOS_PAGO_VALIDOS = ['efectivo', 'tarjeta_debito', 'tarjeta_credito'];

// Convierte un valor de dinero recibido del formulario a número >= 0 (o null).
// Acepta strings vacíos (multipart los manda como "") y los trata como vacío.
function toMoney(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseFloat(String(v).replace(',', '.'));
  if (Number.isNaN(n)) return null;
  return n;
}

// Construye SOLO los campos permitidos del gasto a partir del cuerpo de la
// petición. Evita la "asignación masiva" (que el usuario fije validado, user_id,
// legalization_id, etc.) y normaliza tipos para que columnas numéricas/JSON nunca
// reciban strings vacíos (causa del error 500 al guardar con multipart/form-data).
function buildExpenseData(body) {
  const text = (v) => {
    if (v === undefined || v === null) return undefined;
    const s = String(v).trim();
    return s === '' ? null : s;
  };

  const data = {};
  const categoria = text(body.categoria);
  if (categoria !== undefined) data.categoria = categoria;
  if (text(body.fecha) !== undefined) data.fecha = text(body.fecha);
  if (text(body.establecimiento) !== undefined) data.establecimiento = text(body.establecimiento);
  if (text(body.nit_establecimiento) !== undefined) data.nit_establecimiento = text(body.nit_establecimiento);
  if (text(body.direccion) !== undefined) data.direccion = text(body.direccion);
  if (text(body.numero_factura) !== undefined) data.numero_factura = text(body.numero_factura);
  if (text(body.cufe) !== undefined) data.cufe = text(body.cufe);
  if (text(body.observaciones) !== undefined) data.observaciones = text(body.observaciones);

  if (body.valor !== undefined) data.valor = toMoney(body.valor);
  if (body.iva !== undefined) data.iva = toMoney(body.iva) || 0;
  if (body.impoconsumo !== undefined) data.impoconsumo = toMoney(body.impoconsumo) || 0;
  if (body.servicio !== undefined) data.servicio = toMoney(body.servicio) || 0;
  if (body.propina !== undefined) data.propina = toMoney(body.propina) || 0;

  const mp = text(body.medio_pago);
  if (mp !== undefined && MEDIOS_PAGO_VALIDOS.includes(mp)) data.medio_pago = mp;

  return data;
}

// Valor que SÍ cuenta para la legalización/reembolso:
//  - La propina NO cuenta (se excluye por completo).
//  - El servicio cuenta hasta el 10% de la base; el excedente NO cuenta.
//  - El IVA y el impuesto al consumo (y demás impuestos) SÍ se reconocen.
function computeLegalizable({ valor, iva = 0, impoconsumo = 0, servicio = 0, propina = 0 }) {
  const v = Number(valor) || 0;
  const _iva = Number(iva) || 0;
  const _impo = Number(impoconsumo) || 0;
  const _serv = Number(servicio) || 0;
  const _prop = Number(propina) || 0;
  const base = Math.max(0, v - _iva - _impo - _serv - _prop); // consumo neto
  const servicioComputable = Math.min(_serv, base * 0.10);     // tope 10%
  const legalizable = base + _iva + _impo + servicioComputable;
  return Math.round(legalizable * 100) / 100;
}

// Guarda/actualiza el establecimiento en el catálogo compartido para autocompletar.
async function upsertEstablishment({ establecimiento, nit_establecimiento, direccion, categoria }) {
  const nombre = (establecimiento || '').trim();
  if (!nombre) return;
  const norm = nombre.toLowerCase();
  const [est, created] = await db.Establishment.findOrCreate({
    where: { nombre_norm: norm },
    defaults: { nombre, nombre_norm: norm, nit: nit_establecimiento || null, direccion: direccion || null, categoria: categoria || null, veces: 1 },
  });
  if (!created) {
    await est.update({
      veces: (est.veces || 0) + 1,
      nit: est.nit || nit_establecimiento || null,
      direccion: est.direccion || direccion || null,
      categoria: categoria || est.categoria || null,
    });
  }
}

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
    const data = buildExpenseData(req.body);
    data.user_id = req.user.id;

    // Validaciones de negocio (en el servidor, no se confía en el navegador)
    if (!data.categoria || !CATEGORIAS_VALIDAS.includes(data.categoria)) {
      return res.status(400).json({ error: 'Selecciona una categoría válida para el gasto' });
    }
    if (!data.fecha) {
      return res.status(400).json({ error: 'La fecha del gasto es obligatoria' });
    }
    // Rechaza fechas imposibles (típicamente mal leídas por el OCR): futuras o muy antiguas
    const fechaError = validarFechaGasto(data.fecha);
    if (fechaError) {
      return res.status(400).json({ error: fechaError });
    }
    if (data.valor === null || data.valor === undefined) {
      return res.status(400).json({ error: 'El valor del gasto es obligatorio' });
    }
    if (data.valor <= 0) {
      return res.status(400).json({ error: 'El valor del gasto debe ser mayor a cero' });
    }

    if (req.file) {
      await normalizeUploadedImage(req.file);
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const rel = path.relative(path.resolve(uploadDir), path.resolve(req.file.path)).replace(/\\/g, '/');
      data.imagen_url = `/uploads/${rel}`;
    }

    // datos_ocr puede llegar como string JSON; parsear con tolerancia a errores
    if (req.body.datos_ocr && typeof req.body.datos_ocr === 'string') {
      try { data.datos_ocr = JSON.parse(req.body.datos_ocr); } catch { /* ignorar OCR malformado */ }
    }

    data.valor_legalizable = computeLegalizable(data);
    const expense = await db.Expense.create(data);
    // Guardar/actualizar el establecimiento en el catálogo (para autocompletar luego)
    upsertEstablishment(data).catch(() => {});
    res.status(201).json(expense);
  } catch (err) {
    console.error('Crear gasto error:', err);
    res.status(500).json({ error: 'No se pudo guardar el gasto. Intenta de nuevo.' });
  }
});

// POST /api/expenses/ocr — process receipt with Tesseract.js (free, local OCR)
router.post('/ocr', auth, upload.single('imagen'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Imagen requerida' });

    // Preprocesar la imagen mejora MUCHO la lectura del OCR (gratis, con sharp):
    // corrige orientación, escala de grises, tamaño, contraste y nitidez.
    let ocrPath = req.file.path;
    try {
      const sharp = require('sharp');
      const processed = req.file.path + '_ocr.png';
      await sharp(req.file.path)
        .rotate()
        .grayscale()
        .resize({ width: 1600, withoutEnlargement: true })
        .normalize()
        .sharpen()
        .toFile(processed);
      ocrPath = processed;
    } catch (e) { /* si sharp falla, se usa la imagen original */ }

    const Tesseract = require('tesseract.js');
    const { data: { text } } = await Tesseract.recognize(ocrPath, 'spa', { logger: () => {} });
    if (ocrPath !== req.file.path) { try { require('fs').unlinkSync(ocrPath); } catch {} }

    const parsed = parseColombianReceipt(text);
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const rel = path.relative(path.resolve(uploadDir), path.resolve(req.file.path)).replace(/\\/g, '/');
    const imagePath = `/uploads/${rel}`;

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
    // El OCR a veces "lee" como fecha un número de resolución, un vencimiento u
    // otra cifra del recibo (ej. 2005-12-24). Si la fecha extraída está fuera
    // del rango razonable, se descarta para que el usuario la digite manualmente.
    if (validarFechaGasto(fecha)) fecha = null;
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

  // Helper: convierte el grupo capturado (formato colombiano) a número
  const numFrom = (m) => (m ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) : 0);

  // IVA
  const ivaMatch = full.match(/IVA[.:$\s]*\$?\s*([\d.,]+)/i) ||
                   full.match(/I\.?\s*V\.?\s*A\.?[.:$\s]*\$?\s*([\d.,]+)/i);
  const iva = numFrom(ivaMatch);

  // Impuesto al consumo (INC) — común en alimentación
  const impoconsumo = numFrom(full.match(/(?:IMPO?\.?\s*CONSUMO|IMPOCONSUMO|IMP\.?\s*CONSUMO|\bINC\b)[.:$%\s]*\$?\s*([\d.,]+)/i));
  // Servicio (propina sugerida que se cobra como servicio)
  const servicio = numFrom(full.match(/SERVICIO[.:$%\s]*\$?\s*([\d.,]+)/i));
  // Propina explícita
  const propina = numFrom(full.match(/PROPINA[.:$%\s]*\$?\s*([\d.,]+)/i));

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
    impoconsumo,
    servicio,
    propina,
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
      'direccion', 'valor', 'iva', 'impoconsumo', 'servicio', 'propina', 'medio_pago', 'numero_factura', 'cufe', 'observaciones'];
    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        updates[k] = ['valor', 'iva', 'impoconsumo', 'servicio', 'propina'].includes(k)
          ? (toMoney(req.body[k]) || 0)
          : req.body[k];
      }
    }

    // Si se está cambiando la fecha, validar que sea razonable (ni futura ni muy antigua)
    if (updates.fecha !== undefined) {
      const fechaError = validarFechaGasto(updates.fecha);
      if (fechaError) return res.status(400).json({ error: fechaError });
    }

    if (req.file) {
      await normalizeUploadedImage(req.file);
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const rel = path.relative(path.resolve(uploadDir), path.resolve(req.file.path)).replace(/\\/g, '/');
      updates.imagen_url = `/uploads/${rel}`;
    }

    // Recalcular el valor legalizable con los valores combinados (existentes + cambios)
    updates.valor_legalizable = computeLegalizable({
      valor: updates.valor !== undefined ? updates.valor : expense.valor,
      iva: updates.iva !== undefined ? updates.iva : expense.iva,
      impoconsumo: updates.impoconsumo !== undefined ? updates.impoconsumo : expense.impoconsumo,
      servicio: updates.servicio !== undefined ? updates.servicio : expense.servicio,
      propina: updates.propina !== undefined ? updates.propina : expense.propina,
    });

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
