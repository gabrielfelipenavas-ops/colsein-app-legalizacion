export const fmt = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

export const fmtNum = (n) => new Intl.NumberFormat('es-CO').format(n);

export const dateStr = (d) => {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d + (d.includes('T') ? '' : 'T12:00:00')) : d;
  return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const monthName = (m) =>
  ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m];

export const TARIFAS = { CARRO: 600.65, MOTO: 507.03 };

export const TIPOS_TAXI = ['Taxi convencional', 'Uber', 'InDriver', 'DiDi', 'Beat', 'Bus / Transmilenio', 'Otro transporte'];

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
