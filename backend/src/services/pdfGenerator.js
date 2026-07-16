const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// ── Formato colombiano ──
const AZUL = '#004A7C';
const GRIS = '#666666';
const fmtCOP = (v) => `$${Math.round(parseFloat(v || 0)).toLocaleString('es-CO')}`;
const fmtFecha = (d) => {
  if (!d) return '';
  const date = typeof d === 'string' && d.length === 10 ? new Date(`${d}T12:00:00`) : new Date(d);
  if (Number.isNaN(date.getTime())) return String(d);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
};

const CATEGORIAS = {
  alojamiento: 'Alojamiento', alimentacion: 'Alimentación', transportes: 'Transportes',
  imprevistos: 'Imprevistos', representacion: 'Representación', peaje: 'Peaje',
  parqueadero: 'Parqueadero', taxi: 'Taxi', otro: 'Otro',
};
const ESTADOS = { borrador: 'Borrador', enviado: 'Enviado', revisado: 'Revisado', aprobado: 'Aprobado', rechazado: 'Rechazado' };

// Genera el PDF de una legalización de gastos con la firma manuscrita del
// colaborador (si la registró en su perfil). Devuelve el PDFDocument SIN
// finalizar: el llamador debe hacer doc.pipe(destino) y luego doc.end().
// opts: { revisor, aprobador } — usuarios (nombre) para las líneas de firma de revisión/aprobación.
function generateLegalizationPdf(legalization, expenses, user, travelRequest, opts = {}) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 50, left: 40, right: 40 }, bufferPages: true });
  const pageWidth = doc.page.width - 80; // 515pt útiles
  const left = 40;

  let extra = {};
  try { extra = JSON.parse(legalization.observaciones_imprevistos || '{}'); } catch {}

  // ── Encabezado ──
  doc.font('Helvetica-Bold').fontSize(16).fillColor(AZUL)
    .text('LEGALIZACIÓN DE GASTOS — COLSEIN S.A.S.', left, 40, { width: pageWidth, align: 'center' });
  doc.font('Helvetica').fontSize(8.5).fillColor(GRIS)
    .text('NIT 800.002.030 — Medición, Control y Automatización Industrial', { width: pageWidth, align: 'center' });
  doc.moveDown(0.4);
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000')
    .text(`Legalización #${legalization.id} · Estado: ${ESTADOS[legalization.estado] || legalization.estado}`, { width: pageWidth, align: 'center' });
  doc.moveDown(0.8);

  // ── Datos del colaborador y del viaje ──
  const info = [
    ['Colaborador:', user?.nombre || ''],
    ['Cédula:', user?.cedula || ''],
    ['Zona:', user?.zona || '—'],
    ['Tipo:', extra.tipo === 'local' ? 'Gasto Local' : 'Viaje'],
    ['Moneda:', legalization.moneda || 'COP'],
    ['Fecha del documento:', fmtFecha(legalization.created_at || new Date())],
  ];
  if (legalization.ciudades_visitadas) info.push(['Ciudad(es):', legalization.ciudades_visitadas]);
  if (travelRequest) {
    info.push(['Anticipo (consecutivo):', travelRequest.consecutivo || '']);
    info.push(['Destino:', travelRequest.ciudad_destino || '']);
    info.push(['Periodo:', `${fmtFecha(travelRequest.fecha_ida)} — ${fmtFecha(travelRequest.fecha_regreso)}`]);
  }
  if (extra.motivo && !travelRequest) info.push(['Motivo:', extra.motivo]);

  let y = doc.y;
  const colW = pageWidth / 2;
  info.forEach(([k, v], i) => {
    const x = left + (i % 2 === 0 ? 0 : colW);
    if (i % 2 === 0 && i > 0) y += 14;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000').text(k, x, y, { width: 105, lineBreak: false });
    doc.font('Helvetica').fontSize(8.5).text(String(v), x + 108, y, { width: colW - 112, lineBreak: false });
  });
  y += 22;

  // ── Tabla de gastos ──
  const cols = [
    { key: 'fecha', label: 'Fecha', w: 55, align: 'left' },
    { key: 'categoria', label: 'Categoría', w: 72, align: 'left' },
    { key: 'establecimiento', label: 'Establecimiento / NIT', w: 158, align: 'left' },
    { key: 'factura', label: 'N.º factura', w: 65, align: 'left' },
    { key: 'valor', label: 'Valor', w: 70, align: 'right' },
    { key: 'legalizable', label: 'V. legalizable', w: 70, align: 'right' },
    { key: 'ok', label: 'Val.', w: 25, align: 'center' },
  ];

  const drawHeader = (yy) => {
    doc.rect(left, yy, pageWidth, 16).fill(AZUL);
    let x = left;
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFF');
    cols.forEach(c => { doc.text(c.label, x + 3, yy + 4.5, { width: c.w - 6, align: c.align, lineBreak: false }); x += c.w; });
    return yy + 16;
  };

  y = drawHeader(y);
  const sorted = [...(expenses || [])].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  sorted.forEach((e, idx) => {
    if (y > doc.page.height - 150) { // salto de página dejando sitio al pie
      doc.addPage();
      y = drawHeader(50);
    }
    const rowH = 15;
    if (idx % 2 === 1) doc.rect(left, y, pageWidth, rowH).fill('#F1F5F9');
    const estab = [e.establecimiento, e.nit_establecimiento ? `NIT ${e.nit_establecimiento}` : null].filter(Boolean).join(' · ');
    const cells = {
      fecha: fmtFecha(e.fecha),
      categoria: CATEGORIAS[e.categoria] || e.categoria,
      establecimiento: estab || '—',
      factura: e.numero_factura || '—',
      valor: fmtCOP(e.valor),
      legalizable: fmtCOP(e.valor_legalizable != null ? e.valor_legalizable : e.valor),
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
  doc.moveTo(left, y).lineTo(left + pageWidth, y).lineWidth(0.5).strokeColor('#CBD5E1').stroke();
  y += 10;

  // ── Totales ──
  const gastoReal = parseFloat(legalization.gasto_real_total || 0);
  const anticipo = parseFloat(legalization.valor_anticipo || 0);
  const favorEmpresa = parseFloat(legalization.pago_favor_empresa || 0);
  const favorEmpleado = parseFloat(legalization.pago_favor_empleado || 0);
  const totales = [
    ['Gasto real total:', fmtCOP(gastoReal)],
    ['Valor del anticipo:', fmtCOP(anticipo)],
  ];
  if (favorEmpresa > 0) totales.push(['Debe devolver a la empresa:', fmtCOP(favorEmpresa)]);
  if (favorEmpleado > 0) totales.push(['Reembolsar al colaborador:', fmtCOP(favorEmpleado)]);

  const totX = left + pageWidth - 250;
  totales.forEach(([k, v], i) => {
    const bold = i >= 2;
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(bold ? AZUL : '#000').text(k, totX, y, { width: 160, align: 'right', lineBreak: false });
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).text(v, totX + 165, y, { width: 85, align: 'right', lineBreak: false });
    y += 13;
  });
  y += 25;

  // ── Bloque de firmas ──
  if (y > doc.page.height - 140) { doc.addPage(); y = 60; }
  const firmaW = 200;
  const uploadDir = process.env.UPLOAD_DIR || './uploads';

  // Firma del colaborador (imagen registrada en su perfil, si existe)
  if (user?.firma_url && user.firma_url.startsWith('/uploads/')) {
    const p = path.resolve(uploadDir, user.firma_url.replace('/uploads/', ''));
    // Solo dentro del directorio de uploads (evita path traversal) y si el archivo existe
    if (p.startsWith(path.resolve(uploadDir)) && fs.existsSync(p)) {
      try { doc.image(p, left + 10, y, { fit: [firmaW - 20, 50] }); } catch {}
    }
  }
  const lineY = y + 55;
  doc.moveTo(left, lineY).lineTo(left + firmaW, lineY).lineWidth(0.8).strokeColor('#000').stroke();
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#000').text('Firma del colaborador', left, lineY + 4, { width: firmaW });
  doc.font('Helvetica').fontSize(8).text(`${user?.nombre || ''} — C.C. ${user?.cedula || ''}`, left, lineY + 15, { width: firmaW });

  // Línea de revisión/aprobación (si ya pasó por ese estado)
  if (['revisado', 'aprobado'].includes(legalization.estado)) {
    const x2 = left + pageWidth - firmaW;
    const quien = legalization.estado === 'aprobado' ? (opts.aprobador || opts.revisor) : opts.revisor;
    doc.moveTo(x2, lineY).lineTo(x2 + firmaW, lineY).lineWidth(0.8).strokeColor('#000').stroke();
    doc.font('Helvetica-Bold').fontSize(8).text(legalization.estado === 'aprobado' ? 'Aprobado por' : 'Revisado por', x2, lineY + 4, { width: firmaW });
    doc.font('Helvetica').fontSize(8).text(quien?.nombre || '________________________', x2, lineY + 15, { width: firmaW });
  }

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
        left, doc.page.height - 35, { width: pageWidth, align: 'center', lineBreak: false });
    doc.page.margins.bottom = oldBottom;
  }

  return doc;
}

module.exports = { generateLegalizationPdf };
