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

// Devuelve null si la fecha es válida y está en rango; si no, un mensaje de error.
function validarFechaGasto(fecha) {
  const d = parseFecha(fecha);
  if (!d) return 'La fecha del gasto no es válida (usa el formato AAAA-MM-DD)';

  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);
  if (d > hoy) return 'La fecha del gasto no puede ser futura';

  const limite = new Date();
  limite.setFullYear(limite.getFullYear() - MAX_ANIOS_ATRAS);
  limite.setHours(0, 0, 0, 0);
  if (d < limite) {
    return `La fecha del gasto (${fecha}) es demasiado antigua (más de ${MAX_ANIOS_ATRAS} años). Verifica que el OCR haya leído bien el recibo.`;
  }
  return null;
}

module.exports = { parseFecha, validarFechaGasto, MAX_ANIOS_ATRAS };
