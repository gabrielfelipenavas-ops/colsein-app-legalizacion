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

// Roles que pueden VER datos de otros empleados (aprobadores + auditoría).
const VISORES = [...APROBADORES, ROLES.CONTROL_INTERNO, ROLES.CONTABILIDAD];

// Roles que pueden autorizar taxis por app (Uber/InDriver/DiDi) y gastos especiales.
const AUTORIZADORES_ESPECIALES = [ROLES.GERENTE_VENTAS, ROLES.GERENTE_GENERAL, ROLES.PRESIDENTE];

// ¿Puede `aprobadorRol` aprobar una solicitud enviada por alguien con `emisorRol`?
function puedeAprobar(aprobadorRol, emisorRol) {
  if (emisorRol === ROLES.GERENTE_GENERAL) return aprobadorRol === ROLES.PRESIDENTE;
  if (emisorRol === ROLES.ADMIN) return [ROLES.GERENTE_GENERAL, ROLES.PRESIDENTE].includes(aprobadorRol);
  return APROBADORES.includes(aprobadorRol);
}

module.exports = { ROLES, APROBADORES, VISORES, AUTORIZADORES_ESPECIALES, puedeAprobar };
