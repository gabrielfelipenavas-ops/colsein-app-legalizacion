const router = require('express').Router();
const db = require('../models');
const { auth } = require('../middleware/auth');
const { generateKilometrageExcel, generateLegalizationExcel } = require('../services/excelGenerator');
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

module.exports = router;
