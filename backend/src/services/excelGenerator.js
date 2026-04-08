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

  // Columnas: # | Fecha | Ciudad | Alojamiento | Alimentación | Transportes | Peajes | Parqueaderos | Taxis | Imprevistos | G.Representación | Otros | Total Día | Medio Pago | Establecimiento
  const CATS = [
    { key: 'alojamiento', label: 'ALOJAMIENTO', col: 4 },
    { key: 'alimentacion', label: 'ALIMENTACIÓN', col: 5 },
    { key: 'transportes', label: 'TRANSPORTES', col: 6 },
    { key: 'peaje', label: 'PEAJES', col: 7 },
    { key: 'parqueadero', label: 'PARQUEADEROS', col: 8 },
    { key: 'taxi', label: 'TAXIS', col: 9 },
    { key: 'imprevistos', label: 'IMPREVISTOS', col: 10 },
    { key: 'representacion', label: 'G. REPRESENT.', col: 11 },
    { key: 'otro', label: 'OTROS', col: 12 },
  ];

  ws.columns = [
    { width: 4 },   // A #
    { width: 13 },  // B Fecha
    { width: 16 },  // C Ciudad/Establecimiento
    { width: 14 },  // D Alojamiento
    { width: 14 },  // E Alimentación
    { width: 14 },  // F Transportes
    { width: 12 },  // G Peajes
    { width: 14 },  // H Parqueaderos
    { width: 12 },  // I Taxis
    { width: 14 },  // J Imprevistos
    { width: 14 },  // K G. Representación
    { width: 12 },  // L Otros
    { width: 15 },  // M Total Día
    { width: 13 },  // N Medio Pago
  ];

  const blue = '004A7C';
  const lightBlue = 'E8F4FD';
  const headerFont = { name: 'Arial', bold: true, size: 9, color: { argb: 'FFFFFF' } };
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: blue } };
  const borderThin = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };
  const currencyFmt = '$#,##0';

  // ── HEADER ──
  ws.mergeCells('B2:G3');
  ws.getCell('B2').value = 'LEGALIZACIÓN DE GASTOS DE VIAJE\nCOLSEIN S.A.S. — NIT 800.002.030';
  ws.getCell('B2').font = { name: 'Arial', bold: true, size: 12, color: { argb: blue } };
  ws.getCell('B2').alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  // User info
  ws.getCell('B5').value = 'NOMBRE:';
  ws.getCell('B5').font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell('C5').value = user.nombre;

  ws.getCell('B6').value = 'CÉDULA:';
  ws.getCell('B6').font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell('C6').value = user.cedula;

  ws.getCell('B7').value = 'ZONA:';
  ws.getCell('B7').font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell('C7').value = user.zona || '';

  if (travelRequest) {
    ws.getCell('H5').value = 'CONSECUTIVO:';
    ws.getCell('H5').font = { name: 'Arial', bold: true, size: 9 };
    ws.getCell('I5').value = travelRequest.consecutivo;

    ws.getCell('H6').value = 'DESTINO:';
    ws.getCell('H6').font = { name: 'Arial', bold: true, size: 9 };
    ws.getCell('I6').value = travelRequest.ciudad_destino;

    ws.getCell('H7').value = 'FECHAS:';
    ws.getCell('H7').font = { name: 'Arial', bold: true, size: 9 };
    const fIda = new Date(travelRequest.fecha_ida).toLocaleDateString('es-CO');
    const fReg = new Date(travelRequest.fecha_regreso).toLocaleDateString('es-CO');
    ws.getCell('I7').value = `${fIda} — ${fReg}`;
  }

  if (legalization.ciudades_visitadas) {
    ws.getCell('B8').value = 'CIUDADES:';
    ws.getCell('B8').font = { name: 'Arial', bold: true, size: 9 };
    ws.getCell('C8').value = legalization.ciudades_visitadas;
  }

  // ── TABLE HEADER ──
  const hRow = 10;
  const headers = ['#', 'FECHA', 'ESTABLECIM.', 'ALOJAMIENTO', 'ALIMENTACIÓN', 'TRANSPORTES', 'PEAJES', 'PARQUEADEROS', 'TAXIS', 'IMPREVISTOS', 'G. REPRESENT.', 'OTROS', 'TOTAL DÍA', 'MEDIO PAGO'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(hRow, i + 1);
    cell.value = h;
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = borderThin;
  });
  ws.getRow(hRow).height = 30;

  // ── GROUP EXPENSES BY DATE ──
  const sorted = [...expenses].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  // Group by date
  const byDate = {};
  sorted.forEach(exp => {
    const fecha = exp.fecha;
    if (!byDate[fecha]) byDate[fecha] = [];
    byDate[fecha].push(exp);
  });

  const dates = Object.keys(byDate).sort();
  let currentRow = hRow + 1;

  // For each date, create rows for each expense
  dates.forEach(fecha => {
    const dayExpenses = byDate[fecha];

    dayExpenses.forEach((exp, idx) => {
      const valor = parseFloat(exp.valor || 0);
      const cat = CATS.find(c => c.key === exp.categoria);
      const catCol = cat ? cat.col : 12; // default to "Otros"

      ws.getCell(currentRow, 1).value = currentRow - hRow;
      ws.getCell(currentRow, 1).alignment = { horizontal: 'center' };
      ws.getCell(currentRow, 2).value = new Date(fecha + 'T12:00:00');
      ws.getCell(currentRow, 2).numFmt = 'dd/mm/yyyy';
      ws.getCell(currentRow, 3).value = exp.establecimiento || '';
      ws.getCell(currentRow, 3).font = { name: 'Arial', size: 8 };

      // Put value in the correct category column
      for (const c of CATS) {
        ws.getCell(currentRow, c.col).value = 0;
        ws.getCell(currentRow, c.col).numFmt = currencyFmt;
      }
      ws.getCell(currentRow, catCol).value = valor;
      ws.getCell(currentRow, catCol).numFmt = currencyFmt;

      // Total día = sum of all category columns for this row
      const colLetters = ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
      ws.getCell(currentRow, 13).value = { formula: colLetters.map(l => `${l}${currentRow}`).join('+') };
      ws.getCell(currentRow, 13).numFmt = currencyFmt;

      // Medio de pago
      const pagoLabels = { efectivo: 'Efectivo', tarjeta_debito: 'T. Débito', tarjeta_credito: 'T. Crédito' };
      ws.getCell(currentRow, 14).value = pagoLabels[exp.medio_pago] || exp.medio_pago || '';

      // Borders and font
      for (let c = 1; c <= 14; c++) {
        ws.getCell(currentRow, c).border = borderThin;
        if (!ws.getCell(currentRow, c).font?.name) ws.getCell(currentRow, c).font = { name: 'Arial', size: 9 };
      }
      // Alternate row color
      if ((currentRow - hRow) % 2 === 0) {
        for (let c = 1; c <= 14; c++) {
          ws.getCell(currentRow, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
        }
      }

      currentRow++;
    });
  });

  // ── TOTALS ROW ──
  const totalsRow = currentRow;
  const dataStart = hRow + 1;
  const dataEnd = currentRow - 1;

  ws.getCell(totalsRow, 2).value = 'TOTALES';
  ws.getCell(totalsRow, 2).font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell(totalsRow, 2).alignment = { horizontal: 'center' };

  // Sum each category column
  const catCols = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13]; // D through M
  const colLetter = (n) => String.fromCharCode(64 + n);
  catCols.forEach(c => {
    ws.getCell(totalsRow, c).value = { formula: `SUM(${colLetter(c)}${dataStart}:${colLetter(c)}${dataEnd})` };
    ws.getCell(totalsRow, c).numFmt = currencyFmt;
  });

  for (let c = 1; c <= 14; c++) {
    ws.getCell(totalsRow, c).border = borderThin;
    ws.getCell(totalsRow, c).font = { name: 'Arial', bold: true, size: 9 };
    ws.getCell(totalsRow, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: lightBlue } };
  }

  // ── SUMMARY: Anticipo vs Gasto Real ──
  const sumRow = totalsRow + 2;
  const gastoTotal = parseFloat(legalization.gasto_real_total || 0);
  const anticipoVal = parseFloat(legalization.valor_anticipo || 0);
  const favorEmpresa = parseFloat(legalization.pago_favor_empresa || 0);
  const favorEmpleado = parseFloat(legalization.pago_favor_empleado || 0);

  const summaryItems = [
    ['GASTO REAL TOTAL', gastoTotal, blue],
    ['VALOR ANTICIPO', anticipoVal, null],
    ['A FAVOR DE LA EMPRESA', favorEmpresa, 'CC0000'],
    ['A FAVOR DEL EMPLEADO', favorEmpleado, '00802B'],
  ];

  summaryItems.forEach(([label, val, color], i) => {
    const r = sumRow + i;
    ws.mergeCells(r, 10, r, 12);
    ws.getCell(r, 10).value = label;
    ws.getCell(r, 10).font = { name: 'Arial', bold: true, size: 9 };
    ws.getCell(r, 10).alignment = { horizontal: 'right' };
    ws.getCell(r, 13).value = val;
    ws.getCell(r, 13).numFmt = currencyFmt;
    ws.getCell(r, 13).font = { name: 'Arial', bold: true, size: i === 0 ? 12 : 10, color: color ? { argb: color } : undefined };
    ws.getCell(r, 13).border = borderThin;
  });

  // ── DETAIL SHEET ──
  const ws2 = wb.addWorksheet('DETALLE GASTOS');
  ws2.columns = [
    { width: 5 }, { width: 13 }, { width: 16 }, { width: 25 }, { width: 15 }, { width: 15 }, { width: 14 }, { width: 12 }, { width: 14 }, { width: 13 },
  ];

  const dHeaders = ['#', 'FECHA', 'CATEGORÍA', 'ESTABLECIMIENTO', 'NIT', 'No. FACTURA', 'VALOR', 'IVA', 'TOTAL', 'MEDIO PAGO'];
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
    for (let c = 1; c <= 10; c++) {
      ws2.getCell(r, c).border = borderThin;
      ws2.getCell(r, c).font = { name: 'Arial', size: 9 };
    }
  });

  // ── SIGNATURES ──
  const sigRow = sumRow + 7;
  ws.getCell(sigRow, 2).value = 'FIRMA VENDEDOR:';
  ws.getCell(sigRow, 2).font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell(sigRow + 2, 2).value = 'REVISADO (LÍDER REGIONAL):';
  ws.getCell(sigRow + 2, 2).font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell(sigRow + 2, 6).value = 'NOMBRE:';
  ws.getCell(sigRow + 2, 9).value = 'FIRMA:';
  ws.getCell(sigRow + 4, 2).value = 'APROBADO (GERENTE VENTAS):';
  ws.getCell(sigRow + 4, 2).font = { name: 'Arial', bold: true, size: 9 };
  ws.getCell(sigRow + 4, 6).value = 'NOMBRE:';
  ws.getCell(sigRow + 4, 9).value = 'FIRMA:';
  ws.getCell(sigRow + 6, 2).value = 'OBSERVACIONES AUDITORIA (CONTROL INTERNO):';
  ws.getCell(sigRow + 6, 2).font = { name: 'Arial', bold: true, size: 9 };

  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  return wb;
}

module.exports = { generateKilometrageExcel, generateLegalizationExcel };
