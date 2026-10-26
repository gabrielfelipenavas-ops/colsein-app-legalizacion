const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// ── Formato colombiano ──
const AZUL = '#004A7C';
const GRIS = '#666666';
const GRIS_FILL = '#E5E7EB';
const fmtCOP = (v) => `$${Math.round(parseFloat(v || 0)).toLocaleString('es-CO')}`;
// Valor monetario del formato oficial: "$ 319.200" / "$ 2.306.512,92" / "$ -" si es cero
const fmtMoney = (v) => {
  const n = parseFloat(v || 0);
  if (!n) return '$ -';
  return '$ ' + n.toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};
const parseFecha = (d) => {
  if (!d) return null;
  const date = typeof d === 'string' && d.length === 10 ? new Date(`${d}T12:00:00`) : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
};
const fmtFecha = (d) => {
  const date = parseFecha(d);
  if (!date) return d ? String(d) : '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
};
const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO'];
const diaSemana = (d) => { const date = parseFecha(d); return date ? DIAS[date.getDay()] : ''; };

const CATEGORIAS = {
  alojamiento: 'Alojamiento', alimentacion: 'Alimentación', transportes: 'Transportes',
  imprevistos: 'Imprevistos', representacion: 'Representación', peaje: 'Peaje',
  parqueadero: 'Parqueadero', taxi: 'Taxi', otro: 'Otro',
};
const ESTADOS = { borrador: 'Borrador', enviado: 'Enviado', revisado: 'Revisado', aprobado: 'Aprobado', rechazado: 'Rechazado' };

// Rubros del formato oficial. Taxis, peajes y parqueaderos NO son kilometraje:
// van en el rubro TRANSPORTES (y en el "Detalle de transporte").
const RUBROS = [
  { key: 'alojamiento', label: 'ALOJAMIENTO', dia: 'alojamiento_dia' },
  { key: 'alimentacion', label: 'ALIMENTACIÓN', dia: 'alimentacion_dia' },
  { key: 'transportes', label: 'TRANSPORTES', dia: 'transportes_dia' },
  { key: 'imprevistos', label: 'IMPREVISTOS', dia: 'imprevistos_dia' },
  { key: 'representacion', label: 'GASTOS DE REPRESENTACIÓN', dia: 'representacion_dia' },
];
const TRANSPORTE_KEYS = ['transportes', 'taxi', 'peaje', 'parqueadero'];
const rubroDe = (categoria) => {
  if (TRANSPORTE_KEYS.includes(categoria)) return 'transportes';
  if (RUBROS.some(r => r.key === categoria)) return categoria;
  return 'imprevistos'; // 'otro'
};
const valorLegalizable = (e) => parseFloat(e.valor_legalizable != null ? e.valor_legalizable : (e.valor || 0));

// Concepto del transporte tal como se imprime en el detalle: "TAXI CASA - AEROPUERTO"
const conceptoTransporte = (e) => {
  const est = (e.establecimiento || '').trim();
  const cat = (CATEGORIAS[e.categoria] || '').toUpperCase();
  if (!est) return cat || 'TRANSPORTE';
  // Taxi/app y "transportes": el concepto ya lo describe (TAXI CASA - AEROPUERTO, UBER HOTEL - AEROPUERTO)
  if (['transportes', 'taxi'].includes(e.categoria) || est.toUpperCase().startsWith(cat)) return est.toUpperCase();
  // Peajes y parqueaderos: se antepone el tipo para que se entienda en el detalle
  return `${cat} ${est}`.toUpperCase();
};

// ── Anexo de soportes: fotos de los comprobantes dentro del PDF ──
// Para imprimir la legalización completa sin buscar las fotos aparte. Cada
// comprobante va en un recuadro con su número (el mismo del anexo de facturas),
// fecha, categoría, establecimiento, valor y N.º de factura. Tres por página.
const SOPORTES_POR_PAGINA = 3;

// Lee y normaliza la foto de un gasto para pdfkit (que solo acepta JPEG/PNG):
// corrige la orientación EXIF del celular, convierte HEIC/WEBP/GIF/BMP y
// reduce fotos enormes para que el PDF no pese demasiado.
// tam: 'miniatura' (anexo de 3 por página) u 'original' (una factura por página,
// a tamaño completo para poder leer cada renglón del comprobante).
async function prepararSoporte(exp, uploadDir, tam = 'miniatura') {
  if (!exp.imagen_url) {
    return { texto: exp.observaciones?.includes('[SIN SOPORTE') ? 'Sin soporte: ver justificación en observaciones' : 'Sin soporte adjunto' };
  }
  if (!exp.imagen_url.startsWith('/uploads/')) return { texto: `Soporte externo: ${exp.imagen_url}` };
  const ruta = path.resolve(uploadDir, exp.imagen_url.replace('/uploads/', ''));
  if (!fs.existsSync(ruta)) return { texto: 'Imagen no disponible en el servidor (vuelve a subir el soporte)' };
  const ext = path.extname(ruta).toLowerCase();
  if (ext === '.pdf') return { texto: `Soporte en PDF: ${path.basename(ruta)}\n(se adjunta en la descarga de "Facturas")` };
  try {
    const sharp = require('sharp');
    const dim = tam === 'original' ? { width: 2400, height: 3200, quality: 90 } : { width: 1400, height: 1800, quality: 82 };
    const buffer = await sharp(ruta)
      .rotate() // aplica la orientación EXIF (fotos tomadas en vertical con el celular)
      .resize({ width: dim.width, height: dim.height, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: dim.quality })
      .toBuffer();
    const meta = await sharp(buffer).metadata();
    return { buffer, vertical: (meta.height || 0) > (meta.width || 0) };
  } catch (err) {
    console.error(`[pdfGenerator] No se pudo leer el soporte del gasto ${exp.id} (${ruta}):`, err.message);
    return { texto: `No se pudo leer la imagen (${ext.replace('.', '').toUpperCase() || 'formato desconocido'})` };
  }
}

async function anexoSoportes(doc, sorted, legalization, { left, W, bottomLimit }) {
  if (!sorted.length) return;
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const soportes = [];
  for (const e of sorted) soportes.push(await prepararSoporte(e, uploadDir));

  const GAP = 10;
  const BOX_W = (W - GAP * (SOPORTES_POR_PAGINA - 1)) / SOPORTES_POR_PAGINA;
  const CAP_H = 34;
  const TOP = 28 + 22;
  const BOX_H = bottomLimit - TOP;
  const IMG_PAD = 4;

  for (let i = 0; i < sorted.length; i += SOPORTES_POR_PAGINA) {
    doc.addPage();
    const pag = Math.floor(i / SOPORTES_POR_PAGINA) + 1;
    const totalPag = Math.ceil(sorted.length / SOPORTES_POR_PAGINA);
    doc.font('Helvetica-Bold').fontSize(11).fillColor(AZUL)
      .text(`ANEXO — SOPORTES (FOTOS DE LOS COMPROBANTES) · Legalización N.º ${legalization.id} · ${pag}/${totalPag}`, left, 28, { width: W, lineBreak: false });

    for (let k = 0; k < SOPORTES_POR_PAGINA && i + k < sorted.length; k++) {
      const e = sorted[i + k];
      const sop = soportes[i + k];
      const x = left + k * (BOX_W + GAP);
      const y = TOP;

      // Marco del comprobante
      doc.lineWidth(0.5).strokeColor('#94A3B8').rect(x, y, BOX_W, BOX_H).stroke();

      // Encabezado: número, fecha, categoría, establecimiento, valor, factura
      doc.rect(x, y, BOX_W, CAP_H).fill(GRIS_FILL);
      const estab = [e.establecimiento, e.nit_establecimiento ? `NIT ${e.nit_establecimiento}` : null].filter(Boolean).join(' · ');
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#000')
        .text(`#${i + k + 1} · ${fmtFecha(e.fecha)} · ${CATEGORIAS[e.categoria] || e.categoria} · ${fmtCOP(e.valor)}`, x + 5, y + 5, { width: BOX_W - 10, lineBreak: false, ellipsis: true });
      doc.font('Helvetica').fontSize(7).fillColor('#334155')
        .text(`${estab || '—'}${e.numero_factura ? ` · Fact. ${e.numero_factura}` : ''}${e.kilometrage_entry_id ? ' · Kilometraje' : ''}`, x + 5, y + 17, { width: BOX_W - 10, lineBreak: false, ellipsis: true });
      doc.moveTo(x, y + CAP_H).lineTo(x + BOX_W, y + CAP_H).lineWidth(0.5).strokeColor('#94A3B8').stroke();

      // Imagen ajustada al recuadro (sin deformar) o mensaje
      const ix = x + IMG_PAD, iy = y + CAP_H + IMG_PAD;
      const iw = BOX_W - IMG_PAD * 2, ih = BOX_H - CAP_H - IMG_PAD * 2;
      if (sop.buffer) {
        doc.image(sop.buffer, ix, iy, { fit: [iw, ih], align: 'center', valign: 'center' });
      } else {
        doc.font('Helvetica-Oblique').fontSize(8).fillColor(GRIS)
          .text(sop.texto, ix, iy + ih / 2 - 10, { width: iw, align: 'center' });
      }
    }
  }

  // ── Facturas originales: una por página, a tamaño completo ──
  // El anexo anterior sirve para ubicar cada comprobante; este permite leer
  // cada renglón de la factura (NIT, resolución, IVA, propina) sin lupa.
  const conFoto = sorted.map((e, idx) => ({ e, idx })).filter(({ e }) => e.imagen_url && !String(e.imagen_url).toLowerCase().endsWith('.pdf'));
  let n = 0;
  for (const { e, idx } of conFoto) {
    const sop = await prepararSoporte(e, uploadDir, 'original');
    if (!sop.buffer) continue; // sin archivo en el servidor: ya quedó el aviso en el anexo anterior
    n += 1;
    // Las fotos verticales (la mayoría de los recibos) van en hoja vertical
    // para aprovechar toda la página; las apaisadas, en hoja horizontal.
    doc.addPage({ layout: sop.vertical ? 'portrait' : 'landscape' });
    const pw = doc.page.width - 56;
    const pb = doc.page.height - 48;
    doc.font('Helvetica-Bold').fontSize(sop.vertical ? 9.5 : 11).fillColor(AZUL)
      .text(`ANEXO — FACTURA ORIGINAL · Legalización N.º ${legalization.id} · comprobante #${idx + 1} de ${sorted.length}`, left, 28, { width: pw, lineBreak: false, ellipsis: true });
    const estab = [e.establecimiento, e.nit_establecimiento ? `NIT ${e.nit_establecimiento}` : null].filter(Boolean).join(' · ');
    doc.font('Helvetica').fontSize(8).fillColor('#334155')
      .text(`${fmtFecha(e.fecha)} · ${CATEGORIAS[e.categoria] || e.categoria} · ${estab || '—'}${e.numero_factura ? ` · Fact. ${e.numero_factura}` : ''} · ${fmtCOP(e.valor)}`, left, 44, { width: pw, lineBreak: false, ellipsis: true });
    const iy = 60;
    const ih = pb - iy;
    doc.lineWidth(0.5).strokeColor('#CBD5E1').rect(left, iy, pw, ih).stroke();
    doc.image(sop.buffer, left + 3, iy + 3, { fit: [pw - 6, ih - 6], align: 'center', valign: 'center' });
  }
  if (n) console.log(`[pdfGenerator] Legalización ${legalization.id}: ${n} factura(s) original(es) a página completa`);
}

// Genera el PDF de una legalización de gastos en el formato oficial de COLSEIN
// (matriz por fechas, detalle de transporte, firmas) con la firma manuscrita
// del colaborador si la registró. Devuelve el PDFDocument SIN finalizar: el
// llamador debe hacer doc.pipe(destino) y luego doc.end(). Es async porque el
// anexo de soportes convierte las fotos (HEIC, WEBP, EXIF) con sharp.
// opts: { revisor, aprobador } — usuarios (nombre) para las líneas de firma.
async function generateLegalizationPdf(legalization, expenses, user, travelRequest, opts = {}) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margins: { top: 28, bottom: 40, left: 28, right: 28 }, bufferPages: true });
  const left = 28;
  const W = doc.page.width - 56; // 786pt útiles
  const bottomLimit = doc.page.height - 48;

  let extra = {};
  try { extra = JSON.parse(legalization.observaciones_imprevistos || '{}'); } catch {}

  // ── Helpers de dibujo ──
  const cell = (x, y, w, h, text, o = {}) => {
    doc.lineWidth(0.5).strokeColor('#000');
    if (o.fill) doc.rect(x, y, w, h).fillAndStroke(o.fill, '#000');
    else doc.rect(x, y, w, h).stroke();
    if (text === undefined || text === null || text === '') return;
    const size = o.size || 7;
    doc.font(o.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(o.color || '#000');
    const str = String(text);
    const pad = o.pad != null ? o.pad : 3;
    const th = doc.heightOfString(str, { width: w - pad * 2, lineGap: 0 });
    const ty = y + Math.max(1, (h - th) / 2);
    doc.text(str, x + pad, ty, { width: w - pad * 2, align: o.align || 'center', height: h, ellipsis: true, lineGap: 0 });
  };
  let y = 28;
  const ensure = (h) => { if (y + h > bottomLimit) { doc.addPage(); y = 28; } };

  // ── Datos base ──
  const sorted = [...(expenses || [])].sort((a, b) => new Date(a.fecha) - new Date(b.fecha) || a.id - b.id);
  const fechas = [...new Set(sorted.map(e => e.fecha))].sort();
  const moneda = legalization.moneda || 'COP';
  const tipoLocal = extra.tipo === 'local';
  const fechaIda = travelRequest?.fecha_ida || fechas[0] || null;
  const fechaRegreso = travelRequest?.fecha_regreso || fechas[fechas.length - 1] || null;
  let duracion = travelRequest?.duracion_dias;
  if (!duracion && fechaIda && fechaRegreso) {
    duracion = Math.round((parseFecha(fechaRegreso) - parseFecha(fechaIda)) / 86400000) + 1;
  }
  const destino = travelRequest
    ? (travelRequest.destino_tipo === 'INTERNACIONAL' ? 'Internacional' : 'Nacional')
    : (tipoLocal ? 'Local' : 'Nacional');
  const motivo = travelRequest?.motivo || extra.motivo || '';

  // Matriz rubro × fecha, tarjeta de crédito y gasto programado
  const matriz = {}; const tc = {}; const real = {};
  RUBROS.forEach(r => { matriz[r.key] = {}; tc[r.key] = 0; real[r.key] = 0; });
  sorted.forEach(e => {
    const k = rubroDe(e.categoria);
    const v = valorLegalizable(e);
    matriz[k][e.fecha] = (matriz[k][e.fecha] || 0) + v;
    real[k] += v;
    if (e.medio_pago === 'tarjeta_credito') tc[k] += v;
  });
  const programado = (r) => travelRequest ? parseFloat(travelRequest[r.dia] || 0) * (duracion || 0) : 0;
  const totalReal = RUBROS.reduce((s, r) => s + real[r.key], 0);

  // ── Título ──
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#000').text('LEGALIZACIÓN DE GASTOS', left, y, { width: W, align: 'center' });
  doc.font('Helvetica-Oblique').fontSize(7).fillColor(GRIS).text('COLSEIN S.A.S. — NIT 800.002.030 — Versión 07, 08 de septiembre del 2023', left, y + 17, { width: W, align: 'center' });
  // Número de legalización (recuadro superior derecho, como en el formato)
  cell(left + W - 150, y, 70, 18, 'N.º', { bold: true, size: 7 });
  cell(left + W - 80, y, 80, 18, String(legalization.id), { bold: true, size: 10, color: '#D32F2F' });
  doc.font('Helvetica').fontSize(6.5).fillColor(GRIS).text(`Estado: ${ESTADOS[legalization.estado] || legalization.estado}`, left + W - 150, y + 20, { width: 150, align: 'right' });
  y += 34;

  // ── Encabezado (datos del colaborador y del viaje) ──
  const H = 16;
  const lab = { bold: true, fill: GRIS_FILL, size: 6.5 };
  const val = { size: 7 };
  const lineaUser = user?.zona || travelRequest?.linea || '';
  const rows = [
    [['DESTINO', 70, lab], [destino, 90, val], ['NOMBRE', 70, lab], [user?.nombre || '', 256, val], ['CÉDULA', 90, lab], [user?.cedula || '', 210, val]],
    [['MOTIVO DE VIAJE', 70, lab], [motivo, 416, val], ['CIUDAD A LA QUE VIAJA', 90, lab], [legalization.ciudades_visitadas || '', 110, val], ['DURACIÓN', 50, lab], [duracion ? `${duracion} día${duracion === 1 ? '' : 's'}` : '', 50, val]],
    [['PROCESO', 70, lab], [travelRequest?.proceso || (tipoLocal ? 'Gasto local' : 'Viaje'), 160, val], ['LÍNEA', 70, lab], [lineaUser, 186, val], ['FECHA DE IDA', 90, lab], [fmtFecha(fechaIda), 60, val], ['FECHA DE REGRESO', 90, lab], [fmtFecha(fechaRegreso), 60, val]],
  ];
  rows.forEach(r => {
    let x = left;
    r.forEach(([t, w, o]) => { cell(x, y, w, H, t, o); x += w; });
    y += H;
  });
  y += 8;

  // ── Matriz de gastos por fecha ──
  const LABEL_W = 150;
  const FIXED = [['TARJETA CRÉDITO', 70], ['GASTO PROGRAMADO', 80], ['GASTO REAL', 90]];
  const FIXED_W = FIXED.reduce((s, f) => s + f[1], 0);
  const MAX_DATES = 8;
  // Más de 8 fechas no caben legibles en una fila: se reparten en bloques parejos
  const bloques = [];
  if (fechas.length === 0) bloques.push([]);
  const nBloques = Math.max(1, Math.ceil(fechas.length / MAX_DATES));
  const porBloqueFechas = Math.ceil(fechas.length / nBloques);
  for (let i = 0; i < fechas.length; i += porBloqueFechas) bloques.push(fechas.slice(i, i + porBloqueFechas));

  const RH = 14; // alto de fila de rubro
  bloques.forEach((blk, bi) => {
    const last = bi === bloques.length - 1;
    const n = Math.max(blk.length, 1);
    const datesW = W - LABEL_W - (last ? FIXED_W : 0);
    const colW = datesW / n;
    const blockH = 40 + RH * (RUBROS.length + 1);
    ensure(blockH);

    // Encabezado: CIUDAD VISITADA / MONEDA (fila A) y DÍAS SEMANA / FECHA (fila B)
    cell(left, y, LABEL_W, 20, 'CIUDAD VISITADA\nMONEDA', { bold: true, fill: GRIS_FILL });
    cell(left + LABEL_W, y, datesW, 10, legalization.ciudades_visitadas || '', { size: 6.5 });
    blk.forEach((d, i) => cell(left + LABEL_W + i * colW, y + 10, colW, 10, moneda, { size: 6.5 }));
    if (blk.length === 0) cell(left + LABEL_W, y + 10, datesW, 10, moneda, { size: 6.5 });
    cell(left, y + 20, LABEL_W, 20, 'DÍAS SEMANA\nFECHA', { bold: true, fill: GRIS_FILL });
    blk.forEach((d, i) => cell(left + LABEL_W + i * colW, y + 20, colW, 20, `${diaSemana(d)}\n${fmtFecha(d)}`, { bold: true, size: 6.5 }));
    if (blk.length === 0) cell(left + LABEL_W, y + 20, datesW, 20, '');
    if (last) {
      let fx = left + LABEL_W + datesW;
      FIXED.forEach(([t, w]) => { cell(fx, y, w, 40, t, { bold: true, fill: GRIS_FILL }); fx += w; });
    }
    y += 40;

    // Filas de rubros
    RUBROS.forEach(r => {
      cell(left, y, LABEL_W, RH, r.label, { bold: true, align: 'right', size: 7 });
      blk.forEach((d, i) => cell(left + LABEL_W + i * colW, y, colW, RH, fmtMoney(matriz[r.key][d]), { align: 'right', size: 6.5 }));
      if (blk.length === 0) cell(left + LABEL_W, y, datesW, RH, '');
      if (last) {
        let fx = left + LABEL_W + datesW;
        cell(fx, y, FIXED[0][1], RH, fmtMoney(tc[r.key]), { align: 'right', size: 6.5 }); fx += FIXED[0][1];
        cell(fx, y, FIXED[1][1], RH, fmtMoney(programado(r)), { align: 'right', size: 6.5 }); fx += FIXED[1][1];
        cell(fx, y, FIXED[2][1], RH, fmtMoney(real[r.key]), { align: 'right', bold: true, size: 7 });
      }
      y += RH;
    });

    // Fila TOTAL DE GASTOS
    cell(left, y, LABEL_W, RH, 'TOTAL DE GASTOS', { bold: true, align: 'right', fill: GRIS_FILL, size: 7.5 });
    blk.forEach((d, i) => {
      const t = RUBROS.reduce((s, r) => s + (matriz[r.key][d] || 0), 0);
      cell(left + LABEL_W + i * colW, y, colW, RH, fmtMoney(t), { align: 'right', bold: true, size: 6.5, fill: GRIS_FILL });
    });
    if (blk.length === 0) cell(left + LABEL_W, y, datesW, RH, '', { fill: GRIS_FILL });
    if (last) {
      let fx = left + LABEL_W + datesW;
      cell(fx, y, FIXED[0][1], RH, fmtMoney(RUBROS.reduce((s, r) => s + tc[r.key], 0)), { align: 'right', bold: true, size: 6.5, fill: GRIS_FILL }); fx += FIXED[0][1];
      cell(fx, y, FIXED[1][1], RH, fmtMoney(RUBROS.reduce((s, r) => s + programado(r), 0)), { align: 'right', bold: true, size: 6.5, fill: GRIS_FILL }); fx += FIXED[1][1];
      cell(fx, y, FIXED[2][1], RH, fmtMoney(totalReal), { align: 'right', bold: true, size: 7.5, fill: GRIS_FILL });
    }
    y += RH;
    if (!last) y += 4;
  });

  // ── Anticipo y saldos ──
  const anticipo = parseFloat(legalization.valor_anticipo || 0);
  const favorEmpresa = parseFloat(legalization.pago_favor_empresa || 0);
  const favorEmpleado = parseFloat(legalization.pago_favor_empleado || 0);
  const VAL_W = FIXED[2][1];
  const resumen = [
    ['VALOR ANTICIPO', anticipo, false],
    ['PAGO A FAVOR DE LA COMPAÑÍA', favorEmpresa, favorEmpresa > 0],
    ['PAGO A FAVOR DEL EMPLEADO', favorEmpleado, favorEmpleado > 0],
  ];
  ensure(RH * resumen.length + 8);
  resumen.forEach(([t, v, strong]) => {
    cell(left, y, W - VAL_W, RH, t, { bold: true, align: 'right', size: 7 });
    cell(left + W - VAL_W, y, VAL_W, RH, fmtMoney(v), { align: 'right', bold: true, size: strong ? 8 : 7, color: strong ? AZUL : '#000' });
    y += RH;
  });
  y += 8;

  // ── Observaciones imprevistos ──
  const imprevistos = sorted.filter(e => rubroDe(e.categoria) === 'imprevistos');
  const obsTexto = imprevistos.map(e => `${fmtFecha(e.fecha)} ${(e.establecimiento || CATEGORIAS[e.categoria] || '').toUpperCase()} ${fmtMoney(valorLegalizable(e))}`).join('  ·  ');
  ensure(RH * 2 + 4);
  cell(left, y, W, RH, 'OBSERVACIONES IMPREVISTOS', { bold: true, fill: GRIS_FILL, size: 7.5 });
  y += RH;
  cell(left, y, W, RH, obsTexto, { size: 6.5, align: 'left' });
  y += RH + 4;

  // ── Detalle gastos de representación ──
  const representacion = sorted.filter(e => e.categoria === 'representacion');
  const repCols = [['FECHA', 60], ['EMPRESA', 240], ['CONTACTO', 170], ['CARGO', 120], ['N° INVITADOS', 90], ['VALOR', 106]];
  const repRows = Math.max(1, representacion.length);
  ensure(RH * (2 + repRows) + 4);
  cell(left, y, W, RH, 'DETALLES GASTOS DE REPRESENTACIÓN', { bold: true, fill: GRIS_FILL, size: 7.5 });
  y += RH;
  { let x = left; repCols.forEach(([t, w]) => { cell(x, y, w, RH, t, { bold: true, size: 6.5 }); x += w; }); y += RH; }
  for (let i = 0; i < repRows; i++) {
    const e = representacion[i];
    const vals = e ? [fmtFecha(e.fecha), e.establecimiento || '', e.observaciones || '', '', '', fmtMoney(valorLegalizable(e))] : ['', '', '', '', '', ''];
    let x = left;
    repCols.forEach(([t, w], ci) => { cell(x, y, w, RH, vals[ci], { size: 6.5, align: ci === 5 ? 'right' : (ci === 0 ? 'center' : 'left') }); x += w; });
    y += RH;
  }
  y += 4;

  // ── Detalle de transporte (taxis, apps, peajes, parqueaderos) ──
  const transporte = sorted.filter(e => rubroDe(e.categoria) === 'transportes');
  const totalTransporte = transporte.reduce((s, e) => s + valorLegalizable(e), 0);
  const GW = W / 2; // dos bloques FECHA | CONCEPTO | VALOR, como en el formato
  const tCols = [['FECHA', 58], ['CONCEPTO', GW - 58 - 82], ['VALOR', 82]];
  const porBloque = Math.max(3, Math.ceil(transporte.length / 2));
  const izq = transporte.slice(0, porBloque);
  const der = transporte.slice(porBloque);
  const drawTransportHeader = () => {
    cell(left, y, W, RH, 'DETALLES DE TRANSPORTE', { bold: true, fill: GRIS_FILL, size: 7.5 });
    y += RH;
    [0, 1].forEach(g => { let x = left + g * GW; tCols.forEach(([t, w]) => { cell(x, y, w, RH, t, { bold: true, size: 6.5 }); x += w; }); });
    y += RH;
  };
  // Si la sección completa cabe en lo que queda de página, no se parte
  ensure(Math.min(RH * (3 + porBloque), bottomLimit - 28));
  drawTransportHeader();
  for (let i = 0; i < porBloque; i++) {
    if (y + RH > bottomLimit) { doc.addPage(); y = 28; drawTransportHeader(); }
    [izq[i], der[i]].forEach((e, g) => {
      const vals = e ? [fmtFecha(e.fecha), conceptoTransporte(e), fmtMoney(valorLegalizable(e))] : ['', '', ''];
      let x = left + g * GW;
      tCols.forEach(([t, w], ci) => { cell(x, y, w, RH, vals[ci], { size: 6.5, align: ci === 2 ? 'right' : (ci === 0 ? 'center' : 'left') }); x += w; });
    });
    y += RH;
  }
  ensure(RH);
  cell(left, y, W - VAL_W, RH, 'TOTAL TRANSPORTE', { bold: true, align: 'right', size: 7.5, fill: GRIS_FILL });
  cell(left + W - VAL_W, y, VAL_W, RH, fmtMoney(totalTransporte), { align: 'right', bold: true, size: 7.5, fill: GRIS_FILL });
  y += RH + 8;

  // ── Bloque de firmas ──
  const SIG_H = 56;
  ensure(SIG_H);
  const sigW = W / 3;
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const firmas = [
    ['FIRMA DEL EMPLEADO', user?.nombre || '', fmtFecha(legalization.fecha_envio || legalization.updated_at || new Date())],
    ['FIRMA DE REVISIÓN', ['revisado', 'aprobado'].includes(legalization.estado) ? (opts.revisor?.nombre || '') : '', ['revisado', 'aprobado'].includes(legalization.estado) && opts.revisor ? fmtFecha(legalization.updated_at) : ''],
    ['FIRMA DE APROBACIÓN', legalization.estado === 'aprobado' ? (opts.aprobador?.nombre || '') : '', legalization.estado === 'aprobado' ? fmtFecha(legalization.updated_at) : ''],
  ];
  firmas.forEach(([titulo, nombre, fecha], i) => {
    const x = left + i * sigW;
    cell(x, y, sigW, SIG_H, '');
    doc.font('Helvetica-Bold').fontSize(7).fillColor('#000').text(titulo, x + 4, y + 4, { width: sigW - 8, lineBreak: false });
    if (i === 0 && user?.firma_url && user.firma_url.startsWith('/uploads/')) {
      // Firma manuscrita registrada en el perfil: solo dentro de uploads (evita path traversal)
      const p = path.resolve(uploadDir, user.firma_url.replace('/uploads/', ''));
      if (p.startsWith(path.resolve(uploadDir)) && fs.existsSync(p)) {
        try { doc.image(p, x + 70, y + 8, { fit: [sigW - 150, 36] }); } catch {}
      }
    }
    doc.font('Helvetica').fontSize(6.5).fillColor('#000')
      .text(nombre, x + 4, y + SIG_H - 20, { width: sigW - 8, lineBreak: false })
      .text(`FECHA: ${fecha}`, x + 4, y + SIG_H - 10, { width: sigW - 8, lineBreak: false });
  });
  y += SIG_H;

  // ── Anexo: detalle factura por factura (para la revisión) ──
  doc.addPage();
  y = 28;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(AZUL).text(`ANEXO — DETALLE DE FACTURAS Y SOPORTES · Legalización N.º ${legalization.id}`, left, y, { width: W });
  y += 18;
  const cols = [
    { key: 'fecha', label: 'Fecha', w: 60, align: 'left' },
    { key: 'rubro', label: 'Rubro', w: 95, align: 'left' },
    { key: 'categoria', label: 'Categoría', w: 70, align: 'left' },
    { key: 'establecimiento', label: 'Establecimiento / concepto · NIT', w: 271, align: 'left' },
    { key: 'factura', label: 'N.º factura', w: 80, align: 'left' },
    { key: 'valor', label: 'Valor', w: 75, align: 'right' },
    { key: 'legalizable', label: 'V. legalizable', w: 75, align: 'right' },
    { key: 'ok', label: 'Val.', w: 30, align: 'center' },
  ];
  const drawHeader = (yy) => {
    doc.rect(left, yy, W, 16).fill(AZUL);
    let x = left;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFF');
    cols.forEach(c => { doc.text(c.label, x + 3, yy + 4.5, { width: c.w - 6, align: c.align, lineBreak: false }); x += c.w; });
    return yy + 16;
  };
  y = drawHeader(y);
  sorted.forEach((e, idx) => {
    if (y > bottomLimit - 20) { doc.addPage(); y = drawHeader(28); }
    const rowH = 15;
    if (idx % 2 === 1) doc.rect(left, y, W, rowH).fill('#F1F5F9');
    const estab = [e.establecimiento, e.nit_establecimiento ? `NIT ${e.nit_establecimiento}` : null].filter(Boolean).join(' · ');
    const rubro = RUBROS.find(r => r.key === rubroDe(e.categoria));
    const cells = {
      fecha: fmtFecha(e.fecha),
      rubro: rubro ? rubro.label : '',
      categoria: CATEGORIAS[e.categoria] || e.categoria,
      establecimiento: (estab || '—') + (e.kilometrage_entry_id ? ' (Kilometraje)' : ''),
      factura: e.numero_factura || '—',
      valor: fmtCOP(e.valor),
      legalizable: fmtCOP(valorLegalizable(e)),
      ok: e.validado ? 'Sí' : '',
    };
    let x = left;
    doc.font('Helvetica').fontSize(7.5).fillColor(e.validado ? '#047857' : '#000');
    cols.forEach(c => {
      doc.text(String(cells[c.key]), x + 3, y + 4, { width: c.w - 6, align: c.align, height: rowH, ellipsis: true, lineBreak: false });
      x += c.w;
    });
    y += rowH;
  });
  doc.moveTo(left, y).lineTo(left + W, y).lineWidth(0.5).strokeColor('#CBD5E1').stroke();
  y += 8;
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#000')
    .text(`Gasto real total: ${fmtCOP(totalReal)}   ·   Transporte (taxis, apps, peajes, parqueaderos): ${fmtCOP(totalTransporte)}`, left, y, { width: W, align: 'right' });

  // ── Anexo: fotos de los comprobantes (una o más páginas) ──
  await anexoSoportes(doc, sorted, legalization, { left, W, bottomLimit });

  // ── Pie de página con numeración ──
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // Anular temporalmente el margen inferior: escribir dentro del margen
    // haría que pdfkit agregue páginas en blanco automáticamente.
    const oldBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(7).fillColor(GRIS)
      .text(`Generado por la App de Legalizaciones COLSEIN · ${fmtFecha(new Date())} · Página ${i + 1} de ${range.count}`,
        left, doc.page.height - 28, { width: doc.page.width - 56, align: 'center', lineBreak: false });
    // Marca de agua mientras la legalización no se haya enviado: así una vista
    // previa impresa no se confunde con el documento definitivo.
    if (['borrador', 'rechazado'].includes(legalization.estado)) {
      const cx = doc.page.width / 2, cy = doc.page.height / 2;
      doc.save();
      doc.rotate(-30, { origin: [cx, cy] });
      doc.font('Helvetica-Bold').fontSize(Math.round(doc.page.width / 7)).fillColor('#94A3B8').fillOpacity(0.16)
        .text('BORRADOR', cx - doc.page.width, cy - doc.page.width / 14, { width: doc.page.width * 2, align: 'center', lineBreak: false });
      doc.restore();
    }
    doc.page.margins.bottom = oldBottom;
  }

  return doc;
}

module.exports = { generateLegalizationPdf };
