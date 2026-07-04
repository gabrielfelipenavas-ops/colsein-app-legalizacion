// Genera el Manual de Uso de la app en PDF con el logo de COLSEIN y un
// formato profesional (portada, encabezados, tablas, notas y numeración de
// páginas). Se descarga desde la pestaña Reportes de la app.
//
// Nota: los fonts estándar de PDF (Helvetica) usan codificación Latin-1:
// tildes y eñes funcionan, pero NO se deben usar emojis en este contenido.
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// ── Identidad corporativa ──
const AZUL = '#189CD8';        // azul del logo COLSEIN
const AZUL_OSCURO = '#0B6EA8';
const TINTA = '#0F172A';       // texto principal
const GRIS = '#475569';        // texto secundario
const GRIS_CLARO = '#94A3B8';
const FONDO_SUAVE = '#EFF7FC'; // cajas de nota
const FONDO_TABLA = '#F1F5F9';
const LINEA = '#DCE5EC';

const LOGO = path.join(__dirname, '..', 'assets', 'logo-legalizaciones.png');

const M = 56;         // margen
const ANCHO = 595.28; // A4 vertical (pt)
const ALTO = 841.89;
const ANCHO_UTIL = ANCHO - M * 2;

// ── Contenido del manual (espejo de MANUAL_DE_USO.md, sin emojis) ──
function contenido(appUrl) {
  return [
    { h1: '1. Instalar la app en tu celular' },
    { p: `La app funciona en el navegador, pero se instala como una app nativa (sin pasar por App Store ni Google Play). Una vez instalada, se abre a pantalla completa con el ícono azul de LEGALIZACIONES COLSEIN. Necesitas el enlace de la aplicación: ${appUrl}` },
    { h2: 'En iPhone / iPad (iOS)' },
    { note: 'En iOS la instalación SOLO funciona desde Safari (el navegador de la brújula azul). No uses Chrome para este paso.' },
    { ol: [
      'Abre Safari y entra al enlace de la aplicación.',
      'Toca el botón Compartir (el cuadrito con la flecha hacia arriba, en la barra inferior).',
      'Desliza hacia abajo en el menú y toca "Añadir a pantalla de inicio" (Add to Home Screen).',
      'Verás el ícono azul y el nombre COLSEIN. Toca "Añadir" (arriba a la derecha).',
      'Listo: el ícono queda en tu pantalla de inicio, como cualquier otra app. Ábrela siempre desde ese ícono.',
    ]},
    { h2: 'En Android' },
    { ol: [
      'Abre Chrome y entra al enlace de la aplicación.',
      'Normalmente Chrome muestra un aviso "Instalar aplicación" o "Añadir COLSEIN a la pantalla principal": tócalo y confirma.',
      'Si no aparece el aviso: toca el menú de los tres puntos (arriba a la derecha), luego "Instalar aplicación" (o "Añadir a pantalla de inicio") y confirma con Instalar.',
      'El ícono de COLSEIN queda en tu pantalla de inicio y en el cajón de aplicaciones.',
    ]},
    { h2: 'Cómo saber que quedó bien instalada' },
    { ul: [
      'El ícono azul de LEGALIZACIONES aparece en tu pantalla de inicio con el nombre COLSEIN.',
      'Al abrirla desde el ícono, se ve a pantalla completa (sin la barra de direcciones del navegador).',
    ]},
    { note: 'Requisito: el enlace debe abrir con candado de seguridad (HTTPS). Si el navegador muestra advertencias de seguridad, avisa al administrador.' },

    { h1: '2. Ingresar por primera vez' },
    { ol: [
      'Cuando el administrador crea tu cuenta, te llega un correo con tu usuario (email) y tu contraseña.',
      'Abre la app, escribe tu email y contraseña, y toca Ingresar.',
      'Cambia tu contraseña apenas entres (recomendado): toca el ícono de la llave en la barra superior, escribe tu contraseña actual, la nueva (mínimo 8 caracteres) y su confirmación.',
    ]},
    { note: '¿Olvidaste tu contraseña? Pídele al administrador que te la restablezca: te llegará un correo con la nueva.' },

    { h1: '3. Conoce la pantalla' },
    { p: 'Barra superior: tu nombre y rol, campana de notificaciones, llave (cambiar contraseña) y salida de la sesión. Menú inferior (las pestañas visibles dependen de tu rol):' },
    { table: {
      header: ['Pestaña', 'Para qué sirve'],
      widths: [0.24, 0.76],
      rows: [
        ['Inicio', 'Resumen del mes: km, visitas, valor a pagar, accesos rápidos y últimas visitas'],
        ['Km', 'Registrar visitas y kilometraje del mes, y enviar el reporte mensual'],
        ['Facturas', 'Escanear/registrar facturas de gastos (con lectura automática OCR)'],
        ['Legalizar', 'Agrupar facturas en una legalización y enviarla a aprobación'],
        ['Viajes', 'Solicitar anticipos de viaje'],
        ['Reportes', 'Estadísticas del mes y descarga de documentos Excel oficiales'],
        ['Aprobar', '(Solo aprobadores) Revisar y aprobar solicitudes del equipo'],
        ['Contab.', '(Solo contabilidad/dirección) Auditoría contable y archivo plano'],
        ['Usuarios', '(Solo administración/dirección) Crear y gestionar usuarios'],
      ],
    }},

    { h1: '4. Kilometraje (pestaña Km)' },
    { h2: 'Registrar una visita' },
    { ol: [
      'Toca "Registrar Visita".',
      'Completa: fecha, cliente (escribe 2 o más letras y selecciónalo del catálogo; si no existe puedes crearlo ahí mismo), medio (CARRO o MOTO) y km inicial / km final del odómetro.',
      '¿No tienes odómetro? Usa "Estimar km en el mapa" para calcular la distancia del recorrido, o "Iniciar recorrido con GPS" para que la app estime los km mientras te desplazas.',
      'Si tuviste gastos de apoyo ese día, regístralos en la misma visita (ver tabla siguiente).',
      'Toca Guardar Registro.',
    ]},
    { table: {
      header: ['Gasto de apoyo', 'Requisitos'],
      widths: [0.3, 0.7],
      rows: [
        ['Peajes', 'Foto del tiquete OBLIGATORIA'],
        ['Parqueaderos', 'Foto del recibo OBLIGATORIA. El recibo debe tener: fecha, nombre, NIT, régimen, dirección, resolución de facturación y valor'],
        ['Taxis / apps', 'Autorización previa (botón en el formulario), tipo de servicio, origen y destino. Las apps (Uber, InDriver, DiDi...) exigen factura o captura'],
        ['Otros', 'Foto del soporte OBLIGATORIA'],
      ],
    }},
    { note: 'El km final no puede ser menor que el km inicial (la app te avisa). Sin foto de soporte no se reconoce el valor del gasto de apoyo. No se reconoce kilometraje por desplazamientos a oficinas de Colsein.' },
    { h2: 'Enviar el reporte del mes' },
    { ul: [
      'La tabla Detalle muestra cada visita con su Valor Km (km x tarifa) y sus Apoyos (peajes, parqueaderos, taxis, otros) por separado, y al final el TOTAL A PAGAR (km + apoyos).',
      'Tarifas vigentes: CARRO $600,65/km y MOTO $507,03/km.',
      'Cuando termines el mes, toca el botón de enviar (junto a "Registrar Visita"). El reporte pasa a revisión de tu líder/gerencia.',
      'Plazo: el reporte se entrega dentro de los primeros 5 días calendario del mes siguiente. No es acumulable.',
      'Puedes descargar el Excel en formato oficial con un toque.',
    ]},

    { h1: '5. Facturas (pestaña Facturas)' },
    { ol: [
      'Toca escanear/subir factura y toma la foto (o elige un PDF).',
      'La app lee automáticamente los datos con OCR: establecimiento, NIT, fecha, valor, IVA... Revisa siempre los campos y corrige lo necesario.',
      'Selecciona la categoría (alimentación, alojamiento, transportes, etc.) y el medio de pago, y toca Guardar.',
    ]},
    { note: 'Fechas: la app rechaza fechas imposibles (futuras o de más de 2 años). Si el OCR lee mal la fecha del recibo, el campo queda en rojo con una advertencia: corrígela antes de guardar. Los gastos con fecha dudosa se marcan con la etiqueta "Fecha sospechosa".' },
    { note: 'La propina y el excedente de servicio sobre el 10% NO se reconocen en la legalización; la app calcula automáticamente el valor legalizable. ¿No tienes el soporte físico? Marca "Sin soporte" y escribe la justificación (queda registrada para el aprobador).' },

    { h1: '6. Legalizar gastos (pestaña Legalizar)' },
    { h2: 'Crear y enviar una legalización' },
    { ol: [
      'Toca "Nueva Legalización".',
      'Elige el tipo: Gasto Local (gastos en tu ciudad) o Viaje (puedes vincularla a un anticipo aprobado).',
      'Completa motivo (para gastos locales) y ciudad(es): la app no te deja avanzar si faltan.',
      'Selecciona las facturas a incluir. Solo aparecen los gastos SIN legalizar (una factura ya incluida en otra legalización no se puede repetir).',
      'Toca "Crear Legalización". Queda en borrador: puedes seguir agregando o quitando facturas con el botón Editar, todas las veces que necesites.',
      'Cuando esté completa, toca Enviar. IMPORTANTE: después de enviarla ya no se puede modificar.',
    ]},
    { h2: '¿Necesitas corregir una legalización ya enviada?' },
    { ol: [
      'En la tarjeta de la legalización toca "Solicitar modificación" y escribe el motivo.',
      'La solicitud le llega a gerencia/presidencia, que la autoriza o rechaza desde la app.',
      'Si la autorizan, la legalización vuelve a borrador: podrás editarla y enviarla de nuevo.',
    ]},
    { note: 'Plazo: los anticipos se legalizan máximo 3 días después del regreso del viaje.' },

    { h1: '7. Anticipos de viaje (pestaña Viajes)' },
    { ol: [
      'Toca solicitar anticipo y completa: motivo, proceso, ciudad destino y fechas de ida y regreso.',
      'Escribe el presupuesto por día (alojamiento, alimentación, transportes, imprevistos, representación). La app calcula en vivo la duración, el presupuesto total y el anticipo solicitado (alimentación + transportes x días).',
      'Acepta el compromiso de legalización y envía.',
      'Te llegará una notificación (y correo) cuando lo aprueben o rechacen.',
    ]},

    { h1: '8. Reportes (pestaña Reportes)' },
    { ul: [
      'Resumen del mes: km totales y visitas del mes (las mismas cifras que ves en Inicio), gráfico del año y desglose de costos (kilometraje, peajes, parqueaderos, taxis, otros).',
      'Descarga de documentos oficiales en Excel: Registro de Medios de Transporte (formato oficial V.08) y Legalización de Gastos (desglose por día y categoría).',
      'Desde esta pestaña también puedes descargar este Manual de Uso en PDF.',
    ]},

    { h1: '9. Aprobaciones (pestaña Aprobar — solo aprobadores)' },
    { p: 'Ahí llegan las legalizaciones, reportes de kilometraje, anticipos y solicitudes de autorización (taxis, gastos especiales y modificaciones) pendientes por decidir. Cada elemento se puede aprobar o rechazar (el rechazo siempre exige un comentario con el motivo, que le llega al solicitante por notificación y correo).' },
    { table: {
      header: ['Quién envía', 'Quién aprueba'],
      widths: [0.45, 0.55],
      rows: [
        ['Comercial', 'Líder Regional (revisa) y Gerente de Ventas (aprueba)'],
        ['Desarrollador de Negocios AVEVA', 'Gerente AVEVA'],
        ['Administrador', 'Gerente General o Presidente'],
        ['Gerente (Ventas, General o AVEVA)', 'SOLO el Presidente'],
        ['Presidente', 'Nadie: sus envíos quedan aprobados automáticamente'],
      ],
    }},
    { note: 'Reglas fijas: nadie aprueba sus propias solicitudes, el Gerente AVEVA solo aprueba a su línea, y Control Interno / Contabilidad / Administrador ven todo para auditoría pero NO aprueban.' },

    { h1: '10. Usuarios (pestaña Usuarios — solo administración/dirección)' },
    { ol: [
      'Toca "Nuevo" y completa nombre, cédula, email, contraseña (mínimo 8 caracteres), rol, zona y vehículo.',
      'Al guardar, el sistema le envía automáticamente un correo al usuario con su email, su contraseña y el enlace de la app.',
      'Si restableces la contraseña de alguien (editar usuario y escribir nueva contraseña), también le llega el correo con los nuevos datos.',
      'Desde la misma pantalla puedes desactivar usuarios que ya no deben ingresar.',
    ]},
    { note: 'Si la app avisa que "no se pudo enviar el correo", el servidor no tiene configurado el envío de correos (SMTP): entrega las credenciales manualmente y avisa al responsable técnico.' },

    { h1: '11. Notificaciones' },
    { p: 'La campana de la barra superior muestra todo lo que te concierne: solicitudes pendientes por aprobar, aprobaciones, rechazos (con el comentario del aprobador) y autorizaciones. Los mismos avisos llegan por correo electrónico. Toca una notificación para ir directo a la sección correspondiente.' },

    { h1: '12. Problemas frecuentes' },
    { table: {
      header: ['Problema', 'Solución'],
      widths: [0.42, 0.58],
      rows: [
        ['"Credenciales incorrectas" al ingresar', 'Verifica el email y la contraseña del correo de bienvenida. Si no funciona, pide al administrador restablecer tu contraseña.'],
        ['No aparece "Añadir a pantalla de inicio" en iPhone', 'Debes usar Safari (no Chrome) y abrir el enlace directo de la app.'],
        ['No llega el correo de credenciales', 'Revisa spam/correo no deseado; si no está, pide al administrador reenviar (restableciendo la contraseña).'],
        ['La app no deja guardar un gasto', 'Revisa la fecha (no puede ser futura ni de más de 2 años) y que tenga valor y soporte (foto/PDF) o la justificación de "Sin soporte".'],
        ['No puedo editar mi legalización', 'Ya fue enviada: usa "Solicitar modificación" y espera la autorización de gerencia/presidencia.'],
        ['No veo la pestaña Aprobar / Usuarios', 'Esas pestañas solo aparecen para los roles autorizados.'],
        ['La app se ve desactualizada tras una actualización', 'Ciérrala por completo y vuelve a abrirla (desliza para cerrarla en el selector de apps).'],
      ],
    }},
  ];
}

// ── Utilidades de dibujo ──

function logoWordmark(doc, x, y, escala = 1) {
  // Marca corporativa: triángulo del logo + "COLSEIN" + lema
  const alto = 30 * escala;
  if (fs.existsSync(LOGO)) {
    // El PNG incluye la palabra LEGALIZACIONES abajo; recortamos visualmente
    // usando solo la proporción del triángulo (parte superior de la imagen).
    doc.image(LOGO, x, y - 4 * escala, { width: alto * 1.15, height: alto * 1.15 });
  }
  const tx = x + alto * 1.15 + 8 * escala;
  doc.font('Helvetica-Bold').fontSize(20 * escala).fillColor(AZUL)
    .text('COLSEIN', tx, y, { lineBreak: false });
  doc.font('Helvetica-Bold').fontSize(5.2 * escala).fillColor(GRIS)
    .text('MEDICIÓN, CONTROL Y AUTOMATIZACIÓN', tx + 1, y + 22 * escala, { characterSpacing: 0.6 * escala, lineBreak: false });
}

function portada(doc, appUrl) {
  // Banda superior azul
  doc.rect(0, 0, ANCHO, 8).fill(AZUL);

  // Logo centrado
  const logoW = 190;
  if (fs.existsSync(LOGO)) {
    doc.image(LOGO, (ANCHO - logoW) / 2, 130, { width: logoW });
  }

  doc.font('Helvetica-Bold').fontSize(34).fillColor(TINTA)
    .text('Manual de Uso', M, 360, { width: ANCHO_UTIL, align: 'center' });
  doc.font('Helvetica').fontSize(15).fillColor(GRIS)
    .text('Sistema de Legalizaciones — Gestión de Gastos y Kilometraje', M, 404, { width: ANCHO_UTIL, align: 'center' });

  // Línea decorativa
  doc.moveTo(ANCHO / 2 - 40, 440).lineTo(ANCHO / 2 + 40, 440).lineWidth(2).stroke(AZUL);

  doc.font('Helvetica-Bold').fontSize(13).fillColor(AZUL_OSCURO)
    .text('COLSEIN S.A.S.', M, 460, { width: ANCHO_UTIL, align: 'center' });
  doc.font('Helvetica').fontSize(9).fillColor(GRIS)
    .text('MEDICIÓN, CONTROL Y AUTOMATIZACIÓN  ·  NIT 800002030', M, 478, { width: ANCHO_UTIL, align: 'center' });

  // Caja con el enlace de la app
  const boxY = 540;
  doc.roundedRect(M + 60, boxY, ANCHO_UTIL - 120, 54, 8).fill(FONDO_SUAVE);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(AZUL_OSCURO)
    .text('ENLACE DE LA APLICACIÓN', M + 60, boxY + 12, { width: ANCHO_UTIL - 120, align: 'center' });
  doc.font('Helvetica').fontSize(11).fillColor(TINTA)
    .text(appUrl, M + 60, boxY + 28, { width: ANCHO_UTIL - 120, align: 'center' });

  const fecha = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.font('Helvetica').fontSize(9).fillColor(GRIS_CLARO)
    .text(`Versión 1.0  ·  ${fecha}`, M, 760, { width: ANCHO_UTIL, align: 'center' });
}

function encabezado(doc) {
  logoWordmark(doc, M, 22, 0.62);
  doc.font('Helvetica').fontSize(8).fillColor(GRIS_CLARO)
    .text('Manual de Uso — Sistema de Legalizaciones', M, 32, { width: ANCHO_UTIL, align: 'right' });
  doc.moveTo(M, 52).lineTo(ANCHO - M, 52).lineWidth(0.8).stroke(LINEA);
}

// Salta de página si no cabe `alto` puntos; devuelve la Y actual.
function asegurarEspacio(doc, alto) {
  if (doc.y + alto > ALTO - 64) {
    doc.addPage();
    doc.y = 70;
  }
  return doc.y;
}

function h1(doc, texto) {
  asegurarEspacio(doc, 60);
  doc.moveDown(1.1);
  const y = doc.y;
  doc.rect(M, y + 2, 3.5, 15).fill(AZUL);
  doc.font('Helvetica-Bold').fontSize(14.5).fillColor(AZUL_OSCURO)
    .text(texto, M + 12, y, { width: ANCHO_UTIL - 12 });
  doc.moveDown(0.35);
}

function h2(doc, texto) {
  asegurarEspacio(doc, 40);
  doc.moveDown(0.55);
  doc.font('Helvetica-Bold').fontSize(11.5).fillColor(TINTA)
    .text(texto, M, doc.y, { width: ANCHO_UTIL });
  doc.moveDown(0.25);
}

function parrafo(doc, texto) {
  asegurarEspacio(doc, 30);
  doc.font('Helvetica').fontSize(10).fillColor(TINTA)
    .text(texto, M, doc.y, { width: ANCHO_UTIL, lineGap: 2.4, align: 'justify' });
  doc.moveDown(0.35);
}

function lista(doc, items, numerada) {
  items.forEach((texto, i) => {
    const marcador = numerada ? `${i + 1}.` : '•';
    const hTexto = doc.font('Helvetica').fontSize(10).heightOfString(texto, { width: ANCHO_UTIL - 22, lineGap: 2.2 });
    asegurarEspacio(doc, hTexto + 6);
    const y = doc.y;
    doc.font(numerada ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(AZUL)
      .text(marcador, M + 2, y, { width: 16, lineBreak: false });
    doc.font('Helvetica').fontSize(10).fillColor(TINTA)
      .text(texto, M + 22, y, { width: ANCHO_UTIL - 22, lineGap: 2.2 });
    doc.moveDown(0.22);
  });
  doc.moveDown(0.25);
}

function nota(doc, texto) {
  const padX = 12, padY = 9;
  const w = ANCHO_UTIL - padX * 2 - 4;
  const hTexto = doc.font('Helvetica').fontSize(9.5).heightOfString(texto, { width: w, lineGap: 2 });
  const hCaja = hTexto + padY * 2;
  asegurarEspacio(doc, hCaja + 12);
  const y = doc.y + 3;
  doc.roundedRect(M, y, ANCHO_UTIL, hCaja, 5).fill(FONDO_SUAVE);
  doc.rect(M, y, 3.5, hCaja).fill(AZUL);
  doc.font('Helvetica').fontSize(9.5).fillColor(AZUL_OSCURO)
    .text(texto, M + padX + 4, y + padY, { width: w, lineGap: 2 });
  doc.y = y + hCaja;
  doc.moveDown(0.5);
}

function tabla(doc, { header, rows, widths }) {
  const padX = 8, padY = 6;
  const anchos = widths.map((f) => f * ANCHO_UTIL);

  const alturaFila = (celdas, bold) => {
    let h = 0;
    celdas.forEach((c, i) => {
      const hc = doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9)
        .heightOfString(String(c), { width: anchos[i] - padX * 2, lineGap: 1.6 });
      h = Math.max(h, hc);
    });
    return h + padY * 2;
  };

  const dibujarFila = (celdas, { bold = false, fondo = null, colorTexto = TINTA } = {}) => {
    const h = alturaFila(celdas, bold);
    asegurarEspacio(doc, h + 2);
    const y = doc.y;
    if (fondo) doc.rect(M, y, ANCHO_UTIL, h).fill(fondo);
    let x = M;
    celdas.forEach((c, i) => {
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(colorTexto)
        .text(String(c), x + padX, y + padY, { width: anchos[i] - padX * 2, lineGap: 1.6 });
      x += anchos[i];
    });
    doc.moveTo(M, y + h).lineTo(ANCHO - M, y + h).lineWidth(0.5).stroke(LINEA);
    doc.y = y + h;
  };

  doc.moveDown(0.3);
  dibujarFila(header, { bold: true, fondo: AZUL, colorTexto: '#FFFFFF' });
  rows.forEach((fila, i) => dibujarFila(fila, { fondo: i % 2 === 1 ? FONDO_TABLA : null }));
  doc.moveDown(0.6);
}

// ── Generador principal ──
function generateManualPdf(appUrl) {
  const url = appUrl || process.env.APP_URL || 'https://app.colsein.co';
  const doc = new PDFDocument({ size: 'A4', margins: { top: 70, bottom: 64, left: M, right: M }, bufferPages: true });

  portada(doc, url);

  doc.addPage();
  doc.y = 70;

  for (const bloque of contenido(url)) {
    if (bloque.h1) h1(doc, bloque.h1);
    else if (bloque.h2) h2(doc, bloque.h2);
    else if (bloque.p) parrafo(doc, bloque.p);
    else if (bloque.ul) lista(doc, bloque.ul, false);
    else if (bloque.ol) lista(doc, bloque.ol, true);
    else if (bloque.note) nota(doc, bloque.note);
    else if (bloque.table) tabla(doc, bloque.table);
  }

  // Encabezados y pies de página (menos en la portada). OJO: al escribir por
  // debajo del margen inferior, pdfkit agrega páginas automáticamente; se
  // desactiva el margen mientras se dibuja el pie para evitarlo.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    if (i === 0) continue; // portada limpia
    const margenInferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    encabezado(doc);
    doc.moveTo(M, ALTO - 46).lineTo(ANCHO - M, ALTO - 46).lineWidth(0.8).stroke(LINEA);
    doc.font('Helvetica').fontSize(8).fillColor(GRIS_CLARO)
      .text('COLSEIN S.A.S. — NIT 800002030 · Sistema de Legalizaciones', M, ALTO - 38, { width: ANCHO_UTIL / 2, lineBreak: false })
      .text(`Página ${i} de ${range.count - 1}`, M + ANCHO_UTIL / 2, ALTO - 38, { width: ANCHO_UTIL / 2, align: 'right', lineBreak: false });
    doc.page.margins.bottom = margenInferior;
  }

  doc.end();
  return doc;
}

module.exports = { generateManualPdf };
