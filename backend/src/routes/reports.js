const router = require('express').Router();
const db = require('../models');
const { Op } = require('sequelize');
const { auth } = require('../middleware/auth');
const { generateKilometrageExcel, generateLegalizationExcel } = require('../services/excelGenerator');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');

// GET /api/reports/kilometraje/:reportId/excel
router.get('/kilometraje/:reportId/excel', auth, async (req, res) => {
  try {
    const report = await db.KilometrageReport.findByPk(req.params.reportId, {
      include: [
        { model: db.KilometrageEntry, as: 'entries', order: [['fecha', 'ASC'], ['id', 'ASC']] },
        { model: db.User, attributes: ['id', 'nombre', 'cedula', 'zona', 'vehiculo_tipo', 'placa'] },
      ],
    });
    if (!report) return res.status(404).json({ error: 'Reporte no encontrado' });

    const tarifaCarro = (await db.SystemConfig.findOne({ where: { clave: 'tarifa_carro' } }))?.valor || process.env.TARIFA_CARRO || '600.65';
    const tarifaMoto = (await db.SystemConfig.findOne({ where: { clave: 'tarifa_moto' } }))?.valor || process.env.TARIFA_MOTO || '507.03';

    const wb = await generateKilometrageExcel(report, report.entries, report.User, { carro: tarifaCarro, moto: tarifaMoto });

    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const filename = `Registro_Transporte_${meses[report.periodo_mes - 1]}_${report.periodo_anio}_${report.User.nombre.replace(/\s/g, '_')}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Excel generation error:', err);
    res.status(500).json({ error: 'Error al generar Excel' });
  }
});

// GET /api/reports/legalizacion/:id/excel
router.get('/legalizacion/:id/excel', auth, async (req, res) => {
  try {
    const leg = await db.ExpenseLegalization.findByPk(req.params.id, {
      include: [
        { model: db.User, attributes: ['id', 'nombre', 'cedula', 'zona'] },
        { model: db.TravelRequest },
        { model: db.Expense, as: 'expenses' },
      ],
    });
    if (!leg) return res.status(404).json({ error: 'Legalización no encontrada' });

    const wb = await generateLegalizationExcel(leg, leg.expenses, leg.User, leg.TravelRequest);
    const filename = `Legalizacion_Gastos_${leg.User.nombre.replace(/\s/g, '_')}_${leg.id}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Legalization Excel error:', err);
    res.status(500).json({ error: 'Error al generar Excel' });
  }
});

// GET /api/reports/dashboard — summary stats
router.get('/dashboard', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const mes = now.getMonth() + 1;
    const anio = now.getFullYear();

    const currentReport = await db.KilometrageReport.findOne({
      where: { user_id: userId, periodo_mes: mes, periodo_anio: anio },
    });

    const pendingAnticipos = await db.TravelRequest.count({
      where: { user_id: userId, estado: ['enviado', 'aprobado', 'anticipo_girado'] },
    });

    const recentEntries = await db.KilometrageEntry.findAll({
      where: { user_id: userId },
      order: [['fecha', 'DESC'], ['id', 'DESC']],
      limit: 10,
    });

    const yearReports = await db.KilometrageReport.findAll({
      where: { user_id: userId, periodo_anio: anio },
      order: [['periodo_mes', 'ASC']],
    });

    res.json({
      current_report: currentReport,
      pending_anticipos: pendingAnticipos,
      recent_entries: recentEntries,
      year_reports: yearReports,
      current_period: { mes, anio },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error' });
  }
});

// GET /api/reports/diagnose-images — check expense image storage status
router.get('/diagnose-images', auth, async (req, res) => {
  try {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    const resolvedDir = path.resolve(uploadDir);
    const dirExists = fs.existsSync(resolvedDir);

    const expenses = await db.Expense.findAll({
      where: { user_id: req.user.id },
      order: [['fecha', 'DESC']],
      limit: 50,
    });

    const results = expenses.map(e => {
      const imgPath = e.imagen_url?.startsWith('/uploads/')
        ? path.resolve(uploadDir, e.imagen_url.replace('/uploads/', ''))
        : null;
      const exists = imgPath ? fs.existsSync(imgPath) : false;
      return {
        id: e.id,
        fecha: e.fecha,
        establecimiento: e.establecimiento,
        imagen_url: e.imagen_url,
        resolvedPath: imgPath,
        fileExists: exists,
      };
    });

    const totalWithUrl = results.filter(r => r.imagen_url).length;
    const totalExisting = results.filter(r => r.fileExists).length;

    res.json({
      uploadDir,
      resolvedDir,
      dirExists,
      cwd: process.cwd(),
      summary: { total: expenses.length, withImageUrl: totalWithUrl, filesFound: totalExisting },
      expenses: results,
    });
  } catch (err) {
    console.error('Diagnose error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/monthly-pack/:year/:month — download ZIP with all monthly documents
router.get('/monthly-pack/:year/:month', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const mesNombre = meses[month - 1] || 'Mes';

    const user = await db.User.findByPk(userId);
    const userName = user.nombre.replace(/\s/g, '_');

    // Set up ZIP stream
    const filename = `Paquete_${mesNombre}_${year}_${userName}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const archive = archiver('zip', { zlib: { level: 5 } });
    archive.pipe(res);

    // 1. Kilometraje Excel for the month
    const kmReport = await db.KilometrageReport.findOne({
      where: { user_id: userId, periodo_mes: month, periodo_anio: year },
      include: [
        { model: db.KilometrageEntry, as: 'entries', order: [['fecha', 'ASC'], ['id', 'ASC']] },
        { model: db.User, attributes: ['id', 'nombre', 'cedula', 'zona', 'vehiculo_tipo', 'placa'] },
      ],
    });

    if (kmReport) {
      const tarifaCarro = (await db.SystemConfig.findOne({ where: { clave: 'tarifa_carro' } }))?.valor || process.env.TARIFA_CARRO || '600.65';
      const tarifaMoto = (await db.SystemConfig.findOne({ where: { clave: 'tarifa_moto' } }))?.valor || process.env.TARIFA_MOTO || '507.03';
      const kmWb = await generateKilometrageExcel(kmReport, kmReport.entries, kmReport.User, { carro: tarifaCarro, moto: tarifaMoto });
      const kmBuffer = await kmWb.xlsx.writeBuffer();
      archive.append(kmBuffer, { name: `Movilidad/Registro_Transporte_${mesNombre}_${year}.xlsx` });
    }

    // 2. Legalization Excels for the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const legalizations = await db.ExpenseLegalization.findAll({
      where: { user_id: userId },
      include: [
        { model: db.User, attributes: ['id', 'nombre', 'cedula', 'zona'] },
        { model: db.TravelRequest },
        { model: db.Expense, as: 'expenses' },
      ],
    });

    // Filter legalizations that have expenses in the target month
    for (const leg of legalizations) {
      const hasExpensesInMonth = leg.expenses.some(e => {
        const d = new Date(e.fecha);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      });
      if (!hasExpensesInMonth) continue;

      const legWb = await generateLegalizationExcel(leg, leg.expenses, leg.User, leg.TravelRequest);
      const legBuffer = await legWb.xlsx.writeBuffer();
      archive.append(legBuffer, { name: `Legalizaciones/Legalizacion_${leg.id}.xlsx` });
    }

    // 3. Email invoice attachments (saved from matches)
    const emailMatches = await db.EmailMatch.findAll({
      where: { user_id: userId },
      include: [{ model: db.Expense, attributes: ['id', 'fecha', 'establecimiento'] }],
    });

    const monthMatches = emailMatches.filter(m => {
      if (!m.Expense?.fecha) return false;
      const d = new Date(m.Expense.fecha);
      return (d.getMonth() + 1) === month && d.getFullYear() === year;
    });

    for (const match of monthMatches) {
      if (match.attachment_paths && Array.isArray(match.attachment_paths)) {
        for (const att of match.attachment_paths) {
          if (att.path && fs.existsSync(att.path)) {
            const label = (match.Expense?.establecimiento || 'factura').replace(/[^a-zA-Z0-9 _-]/g, '').substring(0, 30);
            archive.file(att.path, { name: `Facturas_Electronicas/${label}_${att.filename}` });
          }
        }
      }
    }

    await archive.finalize();
  } catch (err) {
    console.error('Monthly pack error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Error al generar paquete mensual' });
  }
});

module.exports = router;
