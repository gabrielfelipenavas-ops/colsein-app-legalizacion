// Definición central de roles y reglas de autorización del sistema.
// Jerarquía (de mayor a menor):
//   presidente  → audita/autoriza al gerente general
//   gerente_general → autoriza al administrador; los demás roles le responden
//   gerente_ventas (gerente comercial) · control_interno · contabilidad · administrador
//   lider_regional → comercial
// El ADMINISTRADOR es operativo (gestiona usuarios/config) y NO autoriza solicitudes.

const ROLES = {
  COMERCIAL: 'comercial',
  LIDER: 'lider_regional',
  GERENTE_VENTAS: 'gerente_ventas',
  CONTROL_INTERNO: 'control_interno',
  ADMIN: 'administrador',
  CONTABILIDAD: 'contabilidad',
  GERENTE_GENERAL: 'gerente_general',
  PRESIDENTE: 'presidente',
};

// Roles que aprueban/revisan solicitudes (el administrador NO aprueba).
const APROBADORES = [ROLES.LIDER, ROLES.GERENTE_VENTAS, ROLES.GERENTE_GENERAL, ROLES.PRESIDENTE];

// Roles de gerencia: todo lo que envíen SOLO lo autoriza el presidente.
const GERENTES = [ROLES.GERENTE_VENTAS, ROLES.GERENTE_GENERAL];

// Roles que pueden VER/descargar datos de TODOS los empleados (aprobadores +
// auditoría + administrador). El administrador puede ver y descargar todo
// (legalizaciones, facturas, archivo plano) aunque NO aprueba solicitudes.
const VISORES = [...APROBADORES, ROLES.CONTROL_INTERNO, ROLES.CONTABILIDAD, ROLES.ADMIN];

// Roles que pueden autorizar taxis por app (Uber/InDriver/DiDi) y gastos especiales.
const AUTORIZADORES_ESPECIALES = [ROLES.GERENTE_VENTAS, ROLES.GERENTE_GENERAL, ROLES.PRESIDENTE];

// Roles con facultades administrativas del sistema: gestionar usuarios y
// configuración. Además del administrador, el gerente general y el presidente
// (cúpula de la jerarquía) tienen estas mismas facultades.
const ADMIN_SISTEMA = [ROLES.ADMIN, ROLES.GERENTE_GENERAL, ROLES.PRESIDENTE];

// ¿Puede `aprobadorRol` aprobar una solicitud enviada por alguien con `emisorRol`?
// Reglas:
//   - El presidente no requiere autorización de nadie (sus envíos se aprueban solos).
//   - Lo que envía un gerente (comercial o general) SOLO lo autoriza el presidente.
//   - Lo del administrador lo autoriza el gerente general o el presidente.
function puedeAprobar(aprobadorRol, emisorRol) {
  if (emisorRol === ROLES.PRESIDENTE) return false;
  if (GERENTES.includes(emisorRol)) return aprobadorRol === ROLES.PRESIDENTE;
  if (emisorRol === ROLES.ADMIN) return [ROLES.GERENTE_GENERAL, ROLES.PRESIDENTE].includes(aprobadorRol);
  return APROBADORES.includes(aprobadorRol);
}

// ¿A qué roles se les notifica/dirige una solicitud según quién la envió?
// El presidente no requiere autorización → lista vacía (se auto-aprueba).
function aprobadoresDe(emisorRol) {
  if (emisorRol === ROLES.PRESIDENTE) return [];
  if (GERENTES.includes(emisorRol)) return [ROLES.PRESIDENTE];
  if (emisorRol === ROLES.ADMIN) return [ROLES.GERENTE_GENERAL, ROLES.PRESIDENTE];
  return [ROLES.GERENTE_VENTAS, ROLES.GERENTE_GENERAL];
}

module.exports = { ROLES, APROBADORES, GERENTES, VISORES, AUTORIZADORES_ESPECIALES, ADMIN_SISTEMA, puedeAprobar, aprobadoresDe };
