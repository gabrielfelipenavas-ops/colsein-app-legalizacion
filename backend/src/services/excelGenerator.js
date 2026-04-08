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

  ws.columns = [
    { width: 5 },   // A
    { width: 14 },  // B Fecha
    { width: 18 },  // C Categoría
    { width: 25 },  // D Establecimiento
    { width: 15 },  // E NIT
    { width: 15 },  // F No. Factura
    { width: 16 },  // G Valor
    { width: 14 },  // H IVA
    { width: 16 },  // I Total
    { width: 14 },  // J Medio Pago
  ];

  const blue = '004A7C';
  const lightBlue = 'E8F4FD';
  const headerFont = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFF' } };
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: blue } };
  const borderThin = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  const currencyFmt = '$#,##0';

  // ── HEADER ──
  ws.mergeCells('B2:E3');
  ws.getCell('B2').value = 'LEGALIZACIÓN DE GASTOS DE VIAJE\nCOLSEIN S.A.S. — NIT 800.002.030';
  ws.getCell('B2').font = { name: 'Arial', bold: true, size: 12, color: { argb: blue } };
  ws.getCell('B2').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  // User info
  ws.getCell('B5').value = 'NOMBRE:';
  ws.getCell('B5').font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell('C5').value = user.nombre;
  ws.getCell('C5').font = { name: 'Arial', size: 9 };

  ws.getCell('B6').value = 'CÉDULA:';
  ws.getCell('B6').font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell('C6').value = user.cedula;

  ws.getCell('B7').value = 'ZONA:';
  ws.getCell('B7').font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell('C7').value = user.zona || '';

  if (travelRequest) {
    ws.getCell('E5').value = 'CONSECUTIVO:';
    ws.getCell('E5').font = { name: 'Arial', bold: true, size: 9 };
    ws.getCell('F5').value = travelRequest.consecutivo;

    ws.getCell('E6').value = 'DESTINO:';
    ws.getCell('E6').font = { name: 'Arial', bold: true, size: 9 };
    ws.getCell('F6').value = travelRequest.ciudad_destino;

    ws.getCell('E7').value = 'PERIODO:';
    ws.getCell('E7').font = { name: 'Arial', bold: true, size: 9 };
    const fIda = new Date(travelRequest.fecha_ida).toLocaleDateString('es-CO');
    const fReg = new Date(travelRequest.fecha_regreso).toLocaleDateString('es-CO');
    ws.getCell('F7').value = `${fIda} — ${fReg}`;
  }

  if (legalization.ciudades_visitadas) {
    ws.getCell('B8').value = 'CIUDADES:';
    ws.getCell('B8').font = { name: 'Arial', bold: true, size: 9 };
    ws.getCell('C8').value = legalization.ciudades_visitadas;
  }

  // ── TABLE HEADER ──
  const headerRow = 10;
  const headers = ['#', 'FECHA', 'CATEGORÍA', 'ESTABLECIMIENTO', 'NIT', 'No. FACTURA', 'VALOR', 'IVA', 'TOTAL', 'MEDIO PAGO'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(headerRow, i + 1);
    cell.value = h;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = borderThin;
  });
  ws.getRow(headerRow).height = 24;

  const catLabels = {
    alimentacion: 'Alimentación', alojamiento: 'Alojamiento', transportes: 'Transportes',
    imprevistos: 'Imprevistos', representacion: 'G. Representación', peaje: 'Peaje',
    parqueadero: 'Parqueadero', taxi: 'Taxi', otro: 'Otro',
  };
  const pagoLabels = {
    efectivo: 'Efectivo', tarjeta_debito: 'T. Débito', tarjeta_credito: 'T. Crédito',
  };

  // ── DATA ROWS ──
  const sorted = [...expenses].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  sorted.forEach((exp, i) => {
    const row = headerRow + 1 + i;
    const valor = parseFloat(exp.valor || 0);
    const iva = parseFloat(exp.iva || 0);

    ws.getCell(row, 1).value = i + 1;
    ws.getCell(row, 1).alignment = { horizontal: 'center' };
    ws.getCell(row, 2).value = new Date(exp.fecha);
    ws.getCell(row, 2).numFmt = 'dd/mm/yyyy';
    ws.getCell(row, 3).value = catLabels[exp.categoria] || exp.categoria;
    ws.getCell(row, 4).value = exp.establecimiento || '';
    ws.getCell(row, 5).value = exp.nit_establecimiento || '';
    ws.getCell(row, 6).value = exp.numero_factura || '';
    ws.getCell(row, 7).value = valor;
    ws.getCell(row, 7).numFmt = currencyFmt;
    ws.getCell(row, 8).value = iva;
    ws.getCell(row, 8).numFmt = currencyFmt;
    ws.getCell(row, 9).value = valor + iva;
    ws.getCell(row, 9).numFmt = currencyFmt;
    ws.getCell(row, 10).value = pagoLabels[exp.medio_pago] || exp.medio_pago || '';

    for (let c = 1; c <= 10; c++) {
      ws.getCell(row, c).border = borderThin;
      ws.getCell(row, c).font = { name: 'Arial', size: 9 };
    }
    if (i % 2 === 0) {
      for (let c = 1; c <= 10; c++) {
        ws.getCell(row, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      }
    }
  });

  // ── TOTALS ──
  const totalsRow = headerRow + 1 + sorted.length;
  ws.getCell(totalsRow, 3).value = 'TOTALES';
  ws.getCell(totalsRow, 3).font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell(totalsRow, 3).alignment = { horizontal: 'center' };

  const dataStart = headerRow + 1;
  const dataEnd = headerRow + sorted.length;
  ws.getCell(totalsRow, 7).value = { formula: `SUM(G${dataStart}:G${dataEnd})` };
  ws.getCell(totalsRow, 7).numFmt = currencyFmt;
  ws.getCell(totalsRow, 8).value = { formula: `SUM(H${dataStart}:H${dataEnd})` };
  ws.getCell(totalsRow, 8).numFmt = currencyFmt;
  ws.getCell(totalsRow, 9).value = { formula: `SUM(I${dataStart}:I${dataEnd})` };
  ws.getCell(totalsRow, 9).numFmt = currencyFmt;

  for (let c = 1; c <= 10; c++) {
    ws.getCell(totalsRow, c).border = borderThin;
    ws.getCell(totalsRow, c).font = { ...ws.getCell(totalsRow, c).font, bold: true };
    ws.getCell(totalsRow, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightBlue } };
  }

  // ── SUMMARY ──
  const sumRow = totalsRow + 2;
  const gastoTotal = parseFloat(legalization.gasto_real_total || 0);
  const anticipoVal = parseFloat(legalization.valor_anticipo || 0);
  const favorEmpresa = parseFloat(legalization.pago_favor_empresa || 0);
  const favorEmpleado = parseFloat(legalization.pago_favor_empleado || 0);

  const summaryItems = [
    ['GASTO REAL TOTAL', gastoTotal],
    ['VALOR ANTICIPO', anticipoVal],
    ['A FAVOR DE LA EMPRESA', favorEmpresa],
    ['A FAVOR DEL EMPLEADO', favorEmpleado],
  ];

  summaryItems.forEach(([label, val], i) => {
    const r = sumRow + i;
    ws.mergeCells(r, 7, r, 8);
    ws.getCell(r, 7).value = label;
    ws.getCell(r, 7).font = { name: 'Arial', bold: true, size: 9 };
    ws.getCell(r, 7).alignment = { horizontal: 'right' };
    ws.getCell(r, 9).value = val;
    ws.getCell(r, 9).numFmt = currencyFmt;
    ws.getCell(r, 9).font = { name: 'Arial', bold: true, size: i === 0 ? 12 : 10, color: i === 0 ? { argb: blue } : undefined };
  });

  // ── SIGNATURES ──
  const sigRow = sumRow + 6;
  ws.getCell(sigRow, 2).value = 'FIRMA VENDEDOR:';
  ws.getCell(sigRow, 2).font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell(sigRow + 2, 2).value = 'REVISADO (LÍDER REGIONAL):';
  ws.getCell(sigRow + 2, 2).font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell(sigRow + 4, 2).value = 'APROBADO (GERENTE VENTAS):';
  ws.getCell(sigRow + 4, 2).font = { name: 'Arial', bold: true, size: 9 };

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  return wb;
}

module.exports = { generateKilometrageExcel, generateLegalizationExcel };
