// Validación defensiva de fechas de gastos/facturas.
// El OCR puede leer mal la fecha de un recibo (p. ej. 2005-12-24 desde un número
// de resolución) — aquí se define el rango razonable aceptado por el sistema.

// Antigüedad máxima aceptada para la fecha de un gasto (en años).
const MAX_ANIOS_ATRAS = 2;

// Parsea 'YYYY-MM-DD' a Date local (mediodía, para evitar corrimientos de zona horaria).
function parseFecha(fecha) {
  if (!fecha) return null;
  const m = String(fecha).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  // Rechaza fechas "corregidas" por JS (ej. 2026-02-31 → 3 de marzo)
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
  return d;
}

// La app opera en Colombia (UTC-5, sin horario de verano). "Hoy" se calcula
// respecto a Bogotá para que un registro hecho en la noche no caiga en el día
// siguiente cuando el servidor corre en UTC (p. ej. Railway).
const OFFSET_BOGOTA_MS = 5 * 60 * 60 * 1000;

function hoyBogota() {
  const d = new Date(Date.now() - OFFSET_BOGOTA_MS);
  return {
    anio: d.getUTCFullYear(),
    mes: d.getUTCMonth() + 1, // 1-12
    dia: d.getUTCDate(),
    fecha: d.toISOString().slice(0, 10), // 'YYYY-MM-DD'
  };
}

// Extrae { anio, mes } de una fecha 'YYYY-MM-DD' SIN pasar por el reloj UTC
// (new Date('YYYY-MM-DD') se interpreta como medianoche UTC y puede correr el
// registro al mes anterior según la zona horaria del servidor).
function periodoDe(fecha) {
  const d = parseFecha(fecha);
  if (!d) return null;
  return { anio: d.getFullYear(), mes: d.getMonth() + 1 };
}

// Devuelve null si la fecha es válida y está en rango; si no, un mensaje de error.
function validarFechaGasto(fecha) {
  const d = parseFecha(fecha);
  if (!d) return 'La fecha del gasto no es válida (usa el formato AAAA-MM-DD)';

  // "Hoy" según la hora de Colombia (el servidor puede estar en UTC)
  const hb = hoyBogota();
  const hoy = new Date(hb.anio, hb.mes - 1, hb.dia);
  hoy.setHours(23, 59, 59, 999);
  if (d > hoy) return 'La fecha del gasto no puede ser futura';

  const limite = new Date(hoy);
  limite.setFullYear(limite.getFullYear() - MAX_ANIOS_ATRAS);
  limite.setHours(0, 0, 0, 0);
  if (d < limite) {
    return `La fecha del gasto (${fecha}) es demasiado antigua (más de ${MAX_ANIOS_ATRAS} años). Verifica que el OCR haya leído bien el recibo.`;
  }
  return null;
}

module.exports = { parseFecha, validarFechaGasto, hoyBogota, periodoDe, MAX_ANIOS_ATRAS };
