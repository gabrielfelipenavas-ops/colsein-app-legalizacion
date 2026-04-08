const router = require('express').Router();
const db = require('../models');
const { auth, requireRole } = require('../middleware/auth');
const multer = require('multer');
const ExcelJS = require('exceljs');
const uploadFile = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// GET /api/clients
router.get('/', auth, async (req, res) => {
  try {
    const where = {};
    if (req.query.activo !== 'all') where.activo = true;
    if (req.query.zona) where.zona = req.query.zona;
    if (req.query.search) where.nombre = { [db.Sequelize.Op.iLike]: `%${req.query.search}%` };

    const clients = await db.Client.findAll({ where, order: [['nombre', 'ASC']], limit: parseInt(req.query.limit || '500') });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

// POST /api/clients
router.post('/', auth, async (req, res) => {
  try {
    const client = await db.Client.create(req.body);
    res.status(201).json(client);
  } catch (err) {
    res.status(500).json({ error: 'Error al crear cliente' });
  }
});

// POST /api/clients/import — Bulk import from Excel/CSV (NetSuite format)
router.post('/import', auth, uploadFile.single('archivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se envió archivo' });

    const workbook = new ExcelJS.Workbook();
    const ext = req.file.originalname.toLowerCase();

    if (ext.endsWith('.csv')) {
      await workbook.csv.read(req.file.buffer);
    } else {
      await workbook.xlsx.load(req.file.buffer);
    }

    const sheet = workbook.worksheets[0];
    if (!sheet || sheet.rowCount < 2) {
      return res.status(400).json({ error: 'El archivo está vacío o no tiene datos' });
    }

    // Read headers from first row and normalize
    const headers = [];
    sheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber] = String(cell.value || '').trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // remove accents
    });

    // Map common NetSuite / Spanish column names to our fields
    const fieldMap = {
      nombre: ['nombre', 'name', 'company name', 'nombre de empresa', 'companyname', 'razon social', 'cliente', 'customer', 'nombre del cliente', 'company'],
      nit: ['nit', 'tax id', 'ruc', 'rfc', 'id fiscal', 'tax number', 'numero de identificacion', 'document number', 'cedula/nit', 'nit/cc'],
      direccion: ['direccion', 'address', 'dir', 'direccion principal', 'billing address', 'address 1', 'direccion 1'],
      ciudad: ['ciudad', 'city', 'municipio', 'billing city'],
      departamento: ['departamento', 'state', 'state/province', 'provincia', 'region', 'billing state'],
      zona: ['zona', 'zone', 'territory', 'territorio', 'sales territory'],
      contacto_nombre: ['contacto', 'contact', 'contact name', 'nombre contacto', 'persona de contacto', 'primary contact'],
      contacto_telefono: ['telefono', 'phone', 'tel', 'celular', 'mobile', 'phone number', 'billing phone'],
    };

    // Find column index for each field
    const colMap = {};
    for (const [field, aliases] of Object.entries(fieldMap)) {
      for (let col = 1; col < headers.length + 1; col++) {
        if (headers[col] && aliases.includes(headers[col])) {
          colMap[field] = col;
          break;
        }
      }
    }

    if (!colMap.nombre) {
      // Try to find any column that might be the name
      const nameIdx = headers.findIndex((h, i) => i > 0 && h);
      if (nameIdx > 0) colMap.nombre = nameIdx;
      else return res.status(400).json({ error: 'No se encontró la columna de nombre del cliente. Asegúrese de que la primera fila tenga encabezados.' });
    }

    const results = { created: 0, skipped: 0, errors: [] };
    const existingNames = new Set(
      (await db.Client.findAll({ attributes: ['nombre'], raw: true }))
        .map(c => c.nombre.toLowerCase().trim())
    );

    for (let i = 2; i <= sheet.rowCount; i++) {
      const row = sheet.getRow(i);
      const cellVal = (col) => {
        if (!col) return null;
        const v = row.getCell(col).value;
        if (v === null || v === undefined) return null;
        // Handle ExcelJS rich text or formula results
        if (typeof v === 'object' && v.result) return String(v.result).trim();
        if (typeof v === 'object' && v.text) return String(v.text).trim();
        return String(v).trim() || null;
      };

      const nombre = cellVal(colMap.nombre);
      if (!nombre) continue;

      if (existingNames.has(nombre.toLowerCase().trim())) {
        results.skipped++;
        continue;
      }

      try {
        await db.Client.create({
          nombre,
          nit: cellVal(colMap.nit),
          direccion: cellVal(colMap.direccion),
          ciudad: cellVal(colMap.ciudad),
          departamento: cellVal(colMap.departamento),
          zona: cellVal(colMap.zona),
          contacto_nombre: cellVal(colMap.contacto_nombre),
          contacto_telefono: cellVal(colMap.contacto_telefono),
          activo: true,
        });
        existingNames.add(nombre.toLowerCase().trim());
        results.created++;
      } catch (err) {
        results.errors.push(`Fila ${i}: ${err.message}`);
      }
    }

    res.json({
      message: `Importación completada: ${results.created} creados, ${results.skipped} ya existían`,
      ...results,
    });
  } catch (err) {
    res.status(500).json({ error: 'Error al procesar el archivo: ' + err.message });
  }
});

// PUT /api/clients/:id
router.put('/:id', auth, requireRole('lider_regional', 'gerente_ventas', 'administrador'), async (req, res) => {
  try {
    const client = await db.Client.findByPk(req.params.id);
    if (!client) return res.status(404).json({ error: 'No encontrado' });
    await client.update(req.body);
    res.json(client);
  } catch (err) {
    res.status(500).json({ error: 'Error' });
  }
});

module.exports = router;
