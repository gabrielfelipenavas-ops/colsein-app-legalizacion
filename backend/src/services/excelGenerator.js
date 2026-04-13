const ExcelJS = require('exceljs');
const path = require('path');

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

async function generateKilometrageExcel(report, entries, user, tarifas) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('KILOMETRAJE');

  // Column widths matching original format
  ws.columns = [
    { width: 4 },   // A (row num)
    { width: 14 },  // B FECHA
    { width: 28 },  // C CLIENTE
    { width: 10 },  // D MEDIO
    { width: 12 },  // E KM INICIAL
    { width: 12 },  // F KM FINAL
    { width: 10 },  // G TOTAL KM
    { width: 16 },  // H KILOMETRAJE
    { width: 14 },  // I PEAJES
    { width: 16 },  // J PARQUEADEROS
    { width: 14 },  // K OTROS (TAXIS)
  ];

  const blue = '004A7C';
  const lightBlue = 'E8F4FD';
  const headerFont = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFF' } };
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: blue } };
  const borderThin = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  const currencyFmt = '$#,##0';

  // ── HEADER ──
  ws.mergeCells('B2:D3');
  ws.getCell('B2').value = 'REGISTRO DE MEDIOS DE TRANSPORTE\nVersión 08, 01 de junio del 2025';
  ws.getCell('B2').font = { name: 'Arial', bold: true, size: 11, color: { argb: blue } };
  ws.getCell('B2').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  // Company info
  ws.getCell('B5').value = 'EMPRESA';
  ws.getCell('B5').font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell('D5').value = 'COLSEIN S.A.S.';
  ws.getCell('D5').font = { name: 'Arial', bold: true, size: 9 };

  ws.getCell('B6').value = 'NOMBRE DEL VENDEDOR';
  ws.getCell('B6').font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell('D6').value = user.nombre;

  ws.getCell('B7').value = 'PERIODO';
  ws.getCell('B7').font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell('D7').value = MESES[report.periodo_mes - 1] + ' ' + report.periodo_anio;

  // Tariffs
  ws.getCell('B8').value = 'CARRO';
  ws.getCell('B8').font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell('C8').value = '$';
  ws.getCell('D8').value = parseFloat(tarifas.carro);
  ws.getCell('D8').numFmt = '#,##0.00';

  ws.getCell('F8').value = 'MOTO';
  ws.getCell('F8').font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell('G8').value = '$';
  ws.getCell('H8').value = parseFloat(tarifas.moto);
  ws.getCell('H8').numFmt = '#,##0.00';

  // ── TABLE HEADER ──
  const headerRow = 10;
  const headers = ['', 'FECHA', 'CLIENTE', 'MEDIO', 'KM INICIAL', 'KM FINAL', 'TOTAL KM', 'KILOMETRAJE', 'PEAJES', 'PARQUEADEROS', 'OTROS\n(TAXIS)'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(headerRow, i + 1);
    cell.value = h;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = borderThin;
  });
  ws.getRow(headerRow).height = 28;

  // ── DATA ROWS ──
  const maxRows = 36;
  for (let i = 0; i < maxRows; i++) {
    const row = headerRow + 1 + i;
    const entry = entries[i];

    if (entry) {
      const totalKm = parseFloat(entry.total_km);
      const valorKm = parseFloat(entry.valor_km);

      ws.getCell(row, 2).value = new Date(entry.fecha);
      ws.getCell(row, 2).numFmt = 'dd/mm/yyyy';
      ws.getCell(row, 3).value = entry.cliente_nombre;
      ws.getCell(row, 4).value = entry.medio;
      ws.getCell(row, 4).alignment = { horizontal: 'center' };
      ws.getCell(row, 5).value = parseFloat(entry.km_inicial);
      ws.getCell(row, 6).value = parseFloat(entry.km_final);
      ws.getCell(row, 7).value = totalKm;
      ws.getCell(row, 8).value = valorKm;
      ws.getCell(row, 8).numFmt = currencyFmt;
      ws.getCell(row, 9).value = parseFloat(entry.peajes) || 0;
      ws.getCell(row, 9).numFmt = currencyFmt;
      ws.getCell(row, 10).value = parseFloat(entry.parqueaderos) || 0;
      ws.getCell(row, 10).numFmt = currencyFmt;
      ws.getCell(row, 11).value = (parseFloat(entry.taxis) || 0) + (parseFloat(entry.otros) || 0);
      ws.getCell(row, 11).numFmt = currencyFmt;
    } else {
      ws.getCell(row, 4).value = 'CARRO';
      ws.getCell(row, 4).alignment = { horizontal: 'center' };
      ws.getCell(row, 7).value = 0;
      [8, 9, 10, 11].forEach(c => { ws.getCell(row, c).value = 0; ws.getCell(row, c).numFmt = currencyFmt; });
    }

    // Borders
    for (let c = 1; c <= 11; c++) {
      ws.getCell(row, c).border = borderThin;
      ws.getCell(row, c).font = { name: 'Arial', size: 9 };
    }

    // Alternate row color
    if (i % 2 === 0) {
      for (let c = 1; c <= 11; c++) {
        ws.getCell(row, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      }
    }
  }

  // ── TOTALS ROW ──
  const totalsRow = headerRow + 1 + maxRows;
  ws.getCell(totalsRow, 2).value = 'No. TOTAL VISITAS';
  ws.getCell(totalsRow, 2).font = { name: 'Arial', bold: true, size: 9 };
  ws.mergeCells(totalsRow, 3, totalsRow, 4);
  ws.getCell(totalsRow, 3).value = 'TOTALES';
  ws.getCell(totalsRow, 3).font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell(totalsRow, 3).alignment = { horizontal: 'center' };

  const dataStart = headerRow + 1;
  const dataEnd = headerRow + maxRows;

  ws.getCell(totalsRow, 8).value = { formula: `SUM(H${dataStart}:H${dataEnd})` };
  ws.getCell(totalsRow, 8).numFmt = currencyFmt;
  ws.getCell(totalsRow, 9).value = { formula: `SUM(I${dataStart}:I${dataEnd})` };
  ws.getCell(totalsRow, 9).numFmt = currencyFmt;
  ws.getCell(totalsRow, 10).value = { formula: `SUM(J${dataStart}:J${dataEnd})` };
  ws.getCell(totalsRow, 10).numFmt = currencyFmt;
  ws.getCell(totalsRow, 11).value = { formula: `SUM(K${dataStart}:K${dataEnd})` };
  ws.getCell(totalsRow, 11).numFmt = currencyFmt;

  for (let c = 1; c <= 11; c++) {
    ws.getCell(totalsRow, c).border = borderThin;
    ws.getCell(totalsRow, c).font = { ...ws.getCell(totalsRow, c).font, bold: true };
    ws.getCell(totalsRow, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightBlue } };
  }

  // ── VALOR A PAGAR ──
  const payRow = totalsRow + 2;
  ws.mergeCells(payRow, 7, payRow, 8);
  ws.getCell(payRow, 7).value = 'VALOR A PAGAR';
  ws.getCell(payRow, 7).font = { name: 'Arial', bold: true, size: 11 };
  ws.getCell(payRow, 7).alignment = { horizontal: 'right' };
  ws.getCell(payRow, 9).value = '$';
  ws.getCell(payRow, 10).value = { formula: `H${totalsRow}+I${totalsRow}+J${totalsRow}+K${totalsRow}` };
  ws.getCell(payRow, 10).numFmt = currencyFmt;
  ws.getCell(payRow, 10).font = { name: 'Arial', bold: true, size: 14, color: { argb: blue } };

  // ── SIGNATURES ──
  const sigRow = payRow + 3;
  ws.getCell(sigRow, 2).value = 'FIRMA VENDEDOR:';
  ws.getCell(sigRow, 2).font = { name: 'Arial', bold: true, size: 9 };

  ws.getCell(sigRow + 2, 2).value = 'REVISADO (LÍDER REGIONAL)';
  ws.getCell(sigRow + 2, 2).font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell(sigRow + 2, 5).value = 'NOMBRE:';
  ws.getCell(sigRow + 2, 8).value = 'FIRMA:';

  ws.getCell(sigRow + 4, 2).value = 'APROBADO (GERENTE VENTAS)';
  ws.getCell(sigRow + 4, 2).font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell(sigRow + 4, 5).value = 'NOMBRE:';
  ws.getCell(sigRow + 4, 8).value = 'FIRMA:';

  ws.getCell(sigRow + 6, 2).value = 'OBSERVACIONES AUDITORIA (CONTROL INTERNO)';
  ws.getCell(sigRow + 6, 2).font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell(sigRow + 6, 5).value = 'NOMBRE:';
  ws.getCell(sigRow + 6, 8).value = 'FIRMA:';

  // Print setup
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  return wb;
}

async function generateLegalizationExcel(legalization, expenses, user, travelRequest) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('LEGALIZACION');

  const blue = '004A7C';
  const lightBlue = 'E8F4FD';
  const headerFont = { name: 'Arial', bold: true, size: 9, color: { argb: 'FFFFFF' } };
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: blue } };
  const catFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
  const borderThin = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  const currencyFmt = '$#,##0';
  const boldFont9 = { name: 'Arial', bold: true, size: 9 };
  const normalFont9 = { name: 'Arial', size: 9 };

  // Category rows (transportes includes taxis, peajes, parqueaderos)
  const CAT_ROWS = [
    { key: 'alojamiento', label: 'ALOJAMIENTO' },
    { key: 'alimentacion', label: 'ALIMENTACIÓN' },
    { key: 'transportes', label: 'TRANSPORTES (Taxis, Peajes, Parqueaderos)' },
    { key: 'imprevistos', label: 'IMPREVISTOS' },
    { key: 'representacion', label: 'GASTOS DE REPRESENTACIÓN' },
  ];
  const transportKeys = ['transportes', 'peaje', 'parqueadero', 'taxi'];

  // Get unique sorted dates
  const sorted = [...expenses].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const uniqueDates = [...new Set(sorted.map(e => e.fecha))].sort();

  // Build matrix: category -> date -> sum
  const matrix = {};
  CAT_ROWS.forEach(c => { matrix[c.key] = {}; uniqueDates.forEach(d => { matrix[c.key][d] = 0; }); });

  sorted.forEach(exp => {
    const val = parseFloat(exp.valor || 0);
    let catKey = exp.categoria;
    if (transportKeys.includes(catKey)) catKey = 'transportes';
    if (!matrix[catKey]) catKey = 'imprevistos'; // fallback for 'otro'
    if (matrix[catKey]) matrix[catKey][exp.fecha] = (matrix[catKey][exp.fecha] || 0) + val;
  });

  // Check if credit card was used
  const usedTC = sorted.some(e => e.medio_pago === 'tarjeta_credito');
  const moneda = legalization.moneda || 'COP';
  let extraData = {};
  try { extraData = JSON.parse(legalization.observaciones_imprevistos || '{}'); } catch {}
  const tipo = extraData.tipo || 'viaje';
  const motivo = extraData.motivo || '';

  // ── COLUMN WIDTHS ──
  // A=label(30), B..N=dates(14 each), last=TOTAL(15)
  const totalCols = 1 + uniqueDates.length + 1; // label + dates + total
  ws.getColumn(1).width = 34;
  for (let i = 2; i <= uniqueDates.length + 1; i++) ws.getColumn(i).width = 14;
  ws.getColumn(totalCols).width = 16;

  // ── TITLE ──
  const titleEnd = Math.min(totalCols, 6);
  ws.mergeCells(1, 1, 1, titleEnd);
  ws.getCell(1, 1).value = 'LEGALIZACIÓN DE GASTOS — COLSEIN S.A.S.';
  ws.getCell(1, 1).font = { name: 'Arial', bold: true, size: 14, color: { argb: blue } };
  ws.getCell(1, 1).alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, titleEnd);
  ws.getCell(2, 1).value = 'NIT 800.002.030 — Medición, Control y Automatización Industrial';
  ws.getCell(2, 1).font = { name: 'Arial', size: 9, color: { argb: '666666' } };
  ws.getCell(2, 1).alignment = { horizontal: 'center' };

  // ── INFO BLOCK ──
  const info = [
    ['COLABORADOR:', user.nombre],
    ['CÉDULA:', user.cedula],
    ['TIPO:', tipo === 'local' ? 'Gasto Local' : 'Viaje'],
    ['MONEDA:', moneda === 'COP' ? 'Pesos Colombianos (COP)' : moneda === 'USD' ? 'Dólares (USD)' : moneda === 'EUR' ? 'Euros (EUR)' : moneda],
    ['TARJETA CRÉDITO:', usedTC ? 'Sí' : 'No'],
  ];
  if (legalization.ciudades_visitadas) info.push(['CIUDAD(ES):', legalization.ciudades_visitadas]);
  if (travelRequest) {
    info.push(['MOTIVO VIAJE:', travelRequest.motivo || '']);
    info.push(['DESTINO:', travelRequest.ciudad_destino]);
    const fIda = new Date(travelRequest.fecha_ida).toLocaleDateString('es-CO');
    const fReg = new Date(travelRequest.fecha_regreso).toLocaleDateString('es-CO');
    info.push(['PERIODO:', `${fIda} — ${fReg}`]);
    info.push(['CONSECUTIVO:', travelRequest.consecutivo]);
  }
  if (motivo && !travelRequest) info.push(['MOTIVO:', motivo]);

  let infoRow = 4;
  const midCol = Math.max(3, Math.ceil(totalCols / 2));
  info.forEach(([label, val], i) => {
    const r = infoRow + Math.floor(i / 2);
    const c = i % 2 === 0 ? 1 : midCol;
    ws.getCell(r, c).value = label;
    ws.getCell(r, c).font = boldFont9;
    ws.getCell(r, c + 1).value = val;
    ws.getCell(r, c + 1).font = normalFont9;
  });

  // ── MATRIX TABLE ──
  const matrixStart = infoRow + Math.ceil(info.length / 2) + 2;

  // Header row: "CONCEPTO" | date1 | date2 | ... | TOTAL
  ws.getCell(matrixStart, 1).value = 'CONCEPTO';
  ws.getCell(matrixStart, 1).font = headerFont;
  ws.getCell(matrixStart, 1).fill = headerFill;
  ws.getCell(matrixStart, 1).border = borderThin;
  ws.getCell(matrixStart, 1).alignment = { horizontal: 'center', vertical: 'middle' };

  uniqueDates.forEach((d, i) => {
    const cell = ws.getCell(matrixStart, i + 2);
    cell.value = new Date(d + 'T12:00:00');
    cell.numFmt = 'dd/mm';
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.border = borderThin;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  const totalCol = uniqueDates.length + 2;
  ws.getCell(matrixStart, totalCol).value = 'TOTAL';
  ws.getCell(matrixStart, totalCol).font = headerFont;
  ws.getCell(matrixStart, totalCol).fill = headerFill;
  ws.getCell(matrixStart, totalCol).border = borderThin;
  ws.getCell(matrixStart, totalCol).alignment = { horizontal: 'center' };
  ws.getRow(matrixStart).height = 24;

  // Category rows
  CAT_ROWS.forEach((cat, ci) => {
    const r = matrixStart + 1 + ci;
    ws.getCell(r, 1).value = cat.label;
    ws.getCell(r, 1).font = boldFont9;
    ws.getCell(r, 1).fill = catFill;
    ws.getCell(r, 1).border = borderThin;

    let rowTotal = 0;
    uniqueDates.forEach((d, di) => {
      const val = matrix[cat.key][d] || 0;
      rowTotal += val;
      const cell = ws.getCell(r, di + 2);
      cell.value = val;
      cell.numFmt = currencyFmt;
      cell.font = normalFont9;
      cell.border = borderThin;
      cell.alignment = { horizontal: 'right' };
      if (val > 0) cell.font = { ...normalFont9, bold: true };
    });
    // Total column
    ws.getCell(r, totalCol).value = rowTotal;
    ws.getCell(r, totalCol).numFmt = currencyFmt;
    ws.getCell(r, totalCol).font = { name: 'Arial', bold: true, size: 10 };
    ws.getCell(r, totalCol).border = borderThin;
    ws.getCell(r, totalCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E0' } };
  });

  // TOTAL DE GASTOS row
  const totalRow = matrixStart + 1 + CAT_ROWS.length;
  ws.getCell(totalRow, 1).value = 'TOTAL DE GASTOS';
  ws.getCell(totalRow, 1).font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFF' } };
  ws.getCell(totalRow, 1).fill = headerFill;
  ws.getCell(totalRow, 1).border = borderThin;

  uniqueDates.forEach((d, di) => {
    let dayTotal = 0;
    CAT_ROWS.forEach(cat => { dayTotal += matrix[cat.key][d] || 0; });
    const cell = ws.getCell(totalRow, di + 2);
    cell.value = dayTotal;
    cell.numFmt = currencyFmt;
    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFF' } };
    cell.fill = headerFill;
    cell.border = borderThin;
    cell.alignment = { horizontal: 'right' };
  });

  // Grand total
  const grandTotal = parseFloat(legalization.gasto_real_total || 0);
  ws.getCell(totalRow, totalCol).value = grandTotal;
  ws.getCell(totalRow, totalCol).numFmt = currencyFmt;
  ws.getCell(totalRow, totalCol).font = { name: 'Arial', bold: true, size: 12, color: { argb: 'FFFFFF' } };
  ws.getCell(totalRow, totalCol).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D32F2F' } };
  ws.getCell(totalRow, totalCol).border = borderThin;

  // ── ANTICIPO SUMMARY ──
  const sumRow = totalRow + 2;
  const anticipoVal = parseFloat(legalization.valor_anticipo || 0);
  const favorEmpresa = parseFloat(legalization.pago_favor_empresa || 0);
  const favorEmpleado = parseFloat(legalization.pago_favor_empleado || 0);

  const summary = [
    ['TOTAL GASTOS REALES', grandTotal, blue],
    ['VALOR ANTICIPO RECIBIDO', anticipoVal, '555555'],
    ['SALDO A FAVOR DE LA EMPRESA (Empleado debe devolver)', favorEmpresa, 'CC0000'],
    ['SALDO A FAVOR DEL EMPLEADO (Empresa debe reembolsar)', favorEmpleado, '00802B'],
  ];

  summary.forEach(([label, val, color], i) => {
    const r = sumRow + i;
    ws.mergeCells(r, 1, r, totalCol - 1);
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 1).font = { name: 'Arial', bold: true, size: i === 0 ? 10 : 9 };
    ws.getCell(r, 1).alignment = { horizontal: 'right' };
    ws.getCell(r, 1).border = borderThin;
    ws.getCell(r, totalCol).value = val;
    ws.getCell(r, totalCol).numFmt = currencyFmt;
    ws.getCell(r, totalCol).font = { name: 'Arial', bold: true, size: i === 0 ? 12 : 10, color: color ? { argb: color } : undefined };
    ws.getCell(r, totalCol).border = borderThin;
  });

  // ── SIGNATURES ──
  const sigRow = sumRow + summary.length + 2;
  ws.getCell(sigRow, 1).value = 'FIRMA COLABORADOR:';
  ws.getCell(sigRow, 1).font = boldFont9;
  ws.getCell(sigRow + 2, 1).value = 'REVISADO (LÍDER REGIONAL):';
  ws.getCell(sigRow + 2, 1).font = boldFont9;
  ws.getCell(sigRow + 2, 3).value = 'NOMBRE:';
  ws.getCell(sigRow + 2, 5).value = 'FIRMA:';
  ws.getCell(sigRow + 4, 1).value = 'APROBADO (GERENTE VENTAS):';
  ws.getCell(sigRow + 4, 1).font = boldFont9;
  ws.getCell(sigRow + 4, 3).value = 'NOMBRE:';
  ws.getCell(sigRow + 4, 5).value = 'FIRMA:';
  ws.getCell(sigRow + 6, 1).value = 'OBSERVACIONES AUDITORIA (CONTROL INTERNO):';
  ws.getCell(sigRow + 6, 1).font = boldFont9;

  // ── DETAIL SHEET ──
  const ws2 = wb.addWorksheet('DETALLE GASTOS');
  ws2.columns = [
    { width: 5 }, { width: 13 }, { width: 16 }, { width: 25 }, { width: 15 }, { width: 15 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 13 }, { width: 15 },
  ];
  const dHeaders = ['#', 'FECHA', 'CATEGORÍA', 'ESTABLECIMIENTO', 'NIT', 'No. FACTURA', 'VALOR', 'IVA', 'TOTAL', 'MEDIO PAGO', 'CIUDAD'];
  dHeaders.forEach((h, i) => {
    const cell = ws2.getCell(1, i + 1);
    cell.value = h;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderThin;
  });

  const catLabels = {
    alimentacion: 'Alimentación', alojamiento: 'Alojamiento', transportes: 'Transportes',
    imprevistos: 'Imprevistos', representacion: 'G. Representación', peaje: 'Peaje',
    parqueadero: 'Parqueadero', taxi: 'Taxi', otro: 'Otro',
  };
  const pagoLabelsMap = { efectivo: 'Efectivo', tarjeta_debito: 'T. Débito', tarjeta_credito: 'T. Crédito' };

  sorted.forEach((exp, i) => {
    const r = i + 2;
    const valor = parseFloat(exp.valor || 0);
    const iva = parseFloat(exp.iva || 0);
    ws2.getCell(r, 1).value = i + 1;
    ws2.getCell(r, 2).value = new Date(exp.fecha + 'T12:00:00');
    ws2.getCell(r, 2).numFmt = 'dd/mm/yyyy';
    ws2.getCell(r, 3).value = catLabels[exp.categoria] || exp.categoria;
    ws2.getCell(r, 4).value = exp.establecimiento || '';
    ws2.getCell(r, 5).value = exp.nit_establecimiento || '';
    ws2.getCell(r, 6).value = exp.numero_factura || '';
    ws2.getCell(r, 7).value = valor;
    ws2.getCell(r, 7).numFmt = currencyFmt;
    ws2.getCell(r, 8).value = iva;
    ws2.getCell(r, 8).numFmt = currencyFmt;
    ws2.getCell(r, 9).value = valor + iva;
    ws2.getCell(r, 9).numFmt = currencyFmt;
    ws2.getCell(r, 10).value = pagoLabelsMap[exp.medio_pago] || '';
    ws2.getCell(r, 11).value = exp.ciudad || legalization.ciudades_visitadas || '';
    for (let c = 1; c <= 11; c++) {
      ws2.getCell(r, c).border = borderThin;
      ws2.getCell(r, c).font = normalFont9;
    }
  });

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  // ── SOPORTES SHEET (Invoice photos) ──
  const fs = require('fs');
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const expensesWithImages = sorted.filter(e => e.imagen_url);

  if (expensesWithImages.length > 0) {
    const ws3 = wb.addWorksheet('SOPORTES');
    ws3.getColumn(1).width = 5;
    ws3.getColumn(2).width = 50;
    ws3.getColumn(3).width = 20;
    ws3.getColumn(4).width = 15;
    ws3.getColumn(5).width = 15;

    ws3.getCell(1, 1).value = 'EVIDENCIAS / SOPORTES DE FACTURAS';
    ws3.getCell(1, 1).font = { name: 'Arial', bold: true, size: 12, color: { argb: blue } };
    ws3.mergeCells(1, 1, 1, 5);
    ws3.getCell(1, 1).alignment = { horizontal: 'center' };

    let imgRow = 3;
    for (const exp of expensesWithImages) {
      // Header for this expense
      ws3.getCell(imgRow, 1).value = `#${sorted.indexOf(exp) + 1}`;
      ws3.getCell(imgRow, 1).font = boldFont9;
      ws3.getCell(imgRow, 2).value = `${catLabels[exp.categoria] || exp.categoria} — ${exp.establecimiento || 'Sin nombre'}`;
      ws3.getCell(imgRow, 2).font = boldFont9;
      ws3.getCell(imgRow, 3).value = new Date(exp.fecha + 'T12:00:00');
      ws3.getCell(imgRow, 3).numFmt = 'dd/mm/yyyy';
      ws3.getCell(imgRow, 4).value = parseFloat(exp.valor || 0);
      ws3.getCell(imgRow, 4).numFmt = currencyFmt;
      ws3.getCell(imgRow, 4).font = boldFont9;
      imgRow++;

      // Try to embed the image
      const imgPath = exp.imagen_url?.startsWith('/uploads/')
        ? path.resolve(uploadDir, exp.imagen_url.replace('/uploads/', ''))
        : null;

      const exists = imgPath && fs.existsSync(imgPath);
      if (!exists) {
        console.warn(`[excelGenerator] Image not found for expense ${exp.id}: ${imgPath} (imagen_url=${exp.imagen_url})`);
      }

      if (exists) {
        const ext = path.extname(imgPath).toLowerCase().replace('.', '');
        try {
          let imgBuffer;
          let extension;
          if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) {
            imgBuffer = fs.readFileSync(imgPath);
            extension = ext === 'jpg' ? 'jpeg' : ext;
          } else if (['webp', 'heic', 'heif'].includes(ext)) {
            // Convert to PNG using sharp
            const sharp = require('sharp');
            imgBuffer = await sharp(imgPath).png().toBuffer();
            extension = 'png';
          } else if (ext === 'pdf') {
            ws3.getCell(imgRow, 2).value = `[Archivo PDF: ${path.basename(imgPath)}]`;
            ws3.getCell(imgRow, 2).font = { name: 'Arial', italic: true, size: 9 };
            imgRow += 2;
            continue;
          } else {
            ws3.getCell(imgRow, 2).value = `[Formato no soportado: ${ext}]`;
            ws3.getCell(imgRow, 2).font = { name: 'Arial', italic: true, size: 9, color: { argb: '999999' } };
            imgRow += 2;
            continue;
          }

          const imgId = wb.addImage({ buffer: imgBuffer, extension });
          ws3.addImage(imgId, {
            tl: { col: 1, row: imgRow - 1 },
            ext: { width: 350, height: 250 },
          });
          for (let r = 0; r < 14; r++) ws3.getRow(imgRow + r).height = 18;
          imgRow += 15;
        } catch (imgErr) {
          console.error(`[excelGenerator] Error embedding image ${imgPath}:`, imgErr.message);
          ws3.getCell(imgRow, 2).value = `[Error al cargar imagen: ${imgErr.message}]`;
          ws3.getCell(imgRow, 2).font = { name: 'Arial', italic: true, size: 9, color: { argb: 'CC0000' } };
          imgRow += 2;
        }
      } else {
        ws3.getCell(imgRow, 2).value = exp.observaciones?.includes('[SIN SOPORTE')
          ? '[Sin soporte — ver justificación en observaciones]'
          : `[Imagen no disponible: ${exp.imagen_url || 'sin ruta'}]`;
        ws3.getCell(imgRow, 2).font = { name: 'Arial', italic: true, size: 9, color: { argb: '999999' } };
        imgRow += 2;
      }
    }
  }

  return wb;
}

module.exports = { generateKilometrageExcel, generateLegalizationExcel };
