// Genera el archivo plano (CSV ;) para cargar en NetSuite, replicando el formato
// de "ARCHIVO PLANO CMT". El mapeo de cuentas por categoría es EDITABLE en la app.

// Encabezado: 25 columnas, en el mismo orden del archivo de ejemplo.
const HEADER = [
  'id externo', 'NOMBRE DE PROVEEDOR', 'ID PROVEEDOR', 'Nº referencia', 'NOTA',
  'FECHA', 'FECHA DE VENCIMIENTO', 'TRANSACTION THID PARTY ENTITY CABECERA',
  'CUENTA POR PAGAR', 'ID CUENTA POR PAGAR', 'NOMBRE SUBSIDIARIA', 'ID SUBSIDIARIA',
  'MONEDA', 'TIPO DE CAMBIO', 'CONCEPTO TRIBUTARIO cabecera', 'CUENTA', 'ID CUENTA',
  'NOTA LINEA', 'IMPORTE', 'CONCEPTO TRIBUTARIO linea', 'CÓDIGO DE IVA linea',
  'RETENCIÓN DE FUENTE linea', 'RETENCIÓN DE IVA linea', 'RETENCIÓN DE ICA linea',
  'TRANSACTION THID PARTY ENTITY Linea',
];

// Constantes de cabecera (tomadas del archivo de ejemplo). Ajustables si cambian.
const CXP = '233595001 OTROS POR PAGAR';
const CXP_ID = '742';
const SUBSIDIARIA = 'COLSEIN SAS';
const SUBSIDIARIA_ID = '2';
const MONEDA = 'COP';
const TIPO_CAMBIO = '1';
const DEFAULT_IVA = 'C-IVA-19 BN';

// Además de quitar separadores, neutraliza la inyección de fórmulas: si el valor
// empieza con = + - @ o TAB, Excel lo interpretaría como fórmula al abrir el CSV
// (riesgo de ejecución de comandos en la máquina del contador). Se antepone ' para
// que siempre se lea como texto.
const clean = (s) => {
  const v = String(s == null ? '' : s).replace(/[;\r\n\t]+/g, ' ').trim();
  return /^[=+\-@]/.test(v) ? `'${v}` : v;
};

function fmtFecha(d) {
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  return `${dt.getDate()}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
}

function legalizableDe(exp) {
  return exp.valor_legalizable != null ? parseFloat(exp.valor_legalizable) : parseFloat(exp.valor || 0);
}

// legalizations: con include de expenses y User; mappingByCat: { categoria: mapping }
function generateFlat(legalizations, mappingByCat, opts = {}) {
  const batchLabel = opts.batchLabel || 'PG CMT';
  const rows = [HEADER.join(';')];

  for (const leg of legalizations) {
    for (const exp of (leg.expenses || [])) {
      const map = mappingByCat[exp.categoria] || {};
      const concepto = map.concepto_tributario || 'COMPRAS';
      const ref = clean(exp.numero_factura) || `LEG${leg.id}-${exp.id}`;
      const desc = clean(exp.establecimiento || exp.categoria).toUpperCase();
      const nota = `${ref} / ${desc} / ${batchLabel}`;
      const fecha = fmtFecha(exp.fecha);

      const iva = parseFloat(exp.iva) || 0;
      const impo = parseFloat(exp.impoconsumo) || 0;
      const legal = legalizableDe(exp);
      const baseImporte = Math.round(legal - iva - impo); // base (el IVA va por código)

      // Línea principal del gasto
      rows.push([
        ref, '', '', ref, nota, fecha, fecha, '',
        CXP, CXP_ID, SUBSIDIARIA, SUBSIDIARIA_ID, MONEDA, TIPO_CAMBIO,
        concepto, map.cuenta || '', map.cuenta_id || '',
        nota, baseImporte, concepto,
        iva > 0 ? (map.codigo_iva || DEFAULT_IVA) : '',
        '', '', '', '',
      ].map(clean).join(';'));

      // Línea aparte para el impuesto al consumo (si lo hay)
      if (impo > 0) {
        const im = mappingByCat['__impoconsumo__'] || {};
        const conceptoImp = im.concepto_tributario || 'SERVICIOS';
        const notaImp = `${nota} / IMPUESTO AL CONSUMO`;
        rows.push([
          ref, '', '', ref, notaImp, fecha, fecha, '',
          CXP, CXP_ID, SUBSIDIARIA, SUBSIDIARIA_ID, MONEDA, TIPO_CAMBIO,
          conceptoImp, im.cuenta || '', im.cuenta_id || '',
          notaImp, Math.round(impo), conceptoImp, '', '', '', '', '',
        ].map(clean).join(';'));
      }
    }
  }

  return rows.join('\r\n');
}

module.exports = { generateFlat, HEADER };
