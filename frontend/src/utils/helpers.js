// Formato de moneda COP. Muestra los centavos SOLO cuando el valor los tiene
// (ej. $9.999,99), y sin decimales cuando es un entero (ej. $60.065). Así no se
// "redondean" cifras en la visualización (evita descuadres al conciliar).
export const fmt = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(n) || 0);

export const fmtNum = (n) => new Intl.NumberFormat('es-CO').format(n);

// Fecha de HOY en hora local del dispositivo ('YYYY-MM-DD').
// (new Date().toISOString() usa UTC: a las 8 p. m. en Colombia ya devuelve el
// día siguiente, y el registro caía en la fecha equivocada.)
export const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Parseo defensivo de fechas: acepta Date, ISO ('2026-07-03' o con hora) y
// devuelve null si el valor es ausente o inválido (nunca un Date inválido).
export const parseDateSafe = (d) => {
  if (!d) return null;
  const date = typeof d === 'string' ? new Date(d + (d.includes('T') ? '' : 'T12:00:00')) : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const dateStr = (d) => {
  const date = parseDateSafe(d);
  if (!date) return '—';
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

// Tiempo relativo ("ahora", "5m", "3h", "2d") con fallback seguro para
// fechas ausentes o inválidas.
export const timeAgo = (d) => {
  const date = parseDateSafe(d);
  if (!date) return '—';
  const sec = Math.floor((new Date() - date) / 1000);
  if (sec < 60) return 'ahora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
};

// Rango razonable para la fecha de un gasto (espejo de backend/src/utils/dates.js).
// Devuelve null si es válida; si no, el mensaje de advertencia para el usuario.
export const FECHA_GASTO_MAX_ANIOS = 2;
export const validarFechaGasto = (fecha) => {
  if (!fecha) return 'La fecha del gasto es obligatoria';
  const d = parseDateSafe(fecha);
  if (!d) return 'La fecha del gasto no es válida';
  const hoy = new Date();
  hoy.setHours(23, 59, 59, 999);
  if (d > hoy) return 'La fecha del gasto no puede ser futura';
  const limite = new Date();
  limite.setFullYear(limite.getFullYear() - FECHA_GASTO_MAX_ANIOS);
  limite.setHours(0, 0, 0, 0);
  if (d < limite) return `La fecha (${dateStr(d)}) es muy antigua (más de ${FECHA_GASTO_MAX_ANIOS} años) — probablemente el OCR la leyó mal. Verifícala.`;
  return null;
};

export const monthName = (m) =>
  ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m];

export const TARIFAS = { CARRO: 600.65, MOTO: 507.03 };

export const TIPOS_TAXI = ['Taxi convencional', 'Uber', 'InDriver', 'DiDi', 'Beat', 'Cabify', 'Bus / Transmilenio', 'Otro transporte'];

// Apps de transporte que SÍ requieren factura/soporte obligatorio.
// El taxi convencional y el transporte público no exigen factura.
export const APPS_TAXI_CON_FACTURA = ['Uber', 'InDriver', 'DiDi', 'Beat', 'Cabify'];
export const requiereFacturaTaxi = (tipo) => APPS_TAXI_CON_FACTURA.includes(tipo);

export const PROCESOS = ['Ventas', 'Mercadeo', 'Gestión Integral', 'Administración y Finanzas'];

export const ESTADOS_LABEL = {
  borrador: 'Borrador', enviado: 'Enviado', revisado: 'Revisado', aprobado: 'Aprobado', rechazado: 'Rechazado',
  anticipo_girado: 'Anticipo girado', legalizado: 'Legalizado',
};

export const ESTADOS_COLOR = {
  borrador: 'bg-slate-100 text-slate-600',
  enviado: 'bg-blue-100 text-blue-700',
  revisado: 'bg-amber-100 text-amber-700',
  aprobado: 'bg-emerald-100 text-emerald-700',
  rechazado: 'bg-red-100 text-red-700',
  anticipo_girado: 'bg-violet-100 text-violet-700',
  legalizado: 'bg-emerald-100 text-emerald-700',
};

export const calcKm = (entry) => {
  const total = (parseFloat(entry.km_final) || 0) - (parseFloat(entry.km_inicial) || 0);
  const tarifa = entry.medio === 'CARRO' ? TARIFAS.CARRO : TARIFAS.MOTO;
  return { totalKm: total, valorKm: Math.round(total * tarifa) };
};
