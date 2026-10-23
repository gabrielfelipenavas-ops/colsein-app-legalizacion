// ── ¿Quién pagó? ──
// Reglas para diferenciar, en la legalización de gastos y en la de kilometraje,
// la fuente con la que se pagó cada gasto:
//   personal → lo pagó el colaborador con su dinero: la empresa se lo reembolsa.
//   anticipo → lo pagó con el anticipo que ya le giraron: se cruza con el anticipo.
//   empresa  → lo pagó directamente la empresa (tarjeta de crédito corporativa,
//              cuenta Cabify/app de la empresa): se relaciona pero NO se reembolsa
//              ni se descuenta del anticipo.

const PAGADO_POR = ['personal', 'anticipo', 'empresa'];
const PAGADO_POR_LABEL = { personal: 'Dinero propio', anticipo: 'Anticipo', empresa: 'Empresa' };
const MEDIOS_PAGO = ['efectivo', 'tarjeta_debito', 'tarjeta_credito', 'cuenta_empresa'];
const MEDIO_PAGO_LABEL = { efectivo: 'Efectivo', tarjeta_debito: 'T. Débito', tarjeta_credito: 'T. Crédito', cuenta_empresa: 'Cuenta empresa' };

const pagadoPorDe = (x) => (PAGADO_POR.includes(x?.pagado_por) ? x.pagado_por : 'personal');
const valorLegalizable = (e) => parseFloat(e.valor_legalizable != null ? e.valor_legalizable : (e.valor || 0));

// Totales de una legalización de gastos.
//   gasto_real_total      = todo lo gastado (lo que se relaciona en el informe)
//   total_pagado_empresa  = parte que pagó la empresa (no se reembolsa)
//   a cargo del colaborador = gasto real − pagado por la empresa
//   saldo = a cargo del colaborador − anticipo
//     > 0 → pago a favor del empleado (la empresa le reembolsa)
//     < 0 → pago a favor de la empresa (el empleado devuelve)
function computeLegalizationTotals(expenses, valorAnticipo) {
  let gasto_real_total = 0;
  let total_pagado_empresa = 0;
  let total_pagado_anticipo = 0;
  for (const e of expenses) {
    const v = valorLegalizable(e);
    gasto_real_total += v;
    const quien = pagadoPorDe(e);
    if (quien === 'empresa') total_pagado_empresa += v;
    if (quien === 'anticipo') total_pagado_anticipo += v;
  }
  const a_cargo_colaborador = gasto_real_total - total_pagado_empresa;
  const diff = a_cargo_colaborador - (parseFloat(valorAnticipo) || 0);
  const r2 = (n) => Math.round(n * 100) / 100;
  return {
    gasto_real_total: r2(gasto_real_total),
    total_pagado_empresa: r2(total_pagado_empresa),
    total_pagado_anticipo: r2(total_pagado_anticipo),
    a_cargo_colaborador: r2(a_cargo_colaborador),
    pago_favor_empresa: diff < 0 ? r2(Math.abs(diff)) : 0,
    pago_favor_empleado: diff > 0 ? r2(diff) : 0,
  };
}

module.exports = { PAGADO_POR, PAGADO_POR_LABEL, MEDIOS_PAGO, MEDIO_PAGO_LABEL, pagadoPorDe, valorLegalizable, computeLegalizationTotals };
