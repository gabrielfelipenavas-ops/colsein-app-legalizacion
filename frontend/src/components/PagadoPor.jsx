import { PAGADO_POR, pagadoPorInfo } from '../utils/helpers';

// Selector "¿Quién pagó?" (dinero propio / anticipo / empresa). Se usa al
// registrar o editar un gasto y al registrar un día de kilometraje con apoyos.
export function PagadoPorSelector({ value, onChange, label = '¿Quién pagó este gasto?', compact = false }) {
  const actual = pagadoPorInfo(value);
  return (
    <div>
      <label className="text-xs font-semibold text-slate-500 mb-1 block">{label}</label>
      <div className="grid grid-cols-3 gap-1.5">
        {PAGADO_POR.map(p => (
          <button key={p.value} type="button" onClick={() => onChange(p.value)}
            className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all ${value === p.value ? 'bg-colsein-500 text-white border-colsein-500' : 'bg-white text-slate-600 border-slate-200'}`}>
            {p.label}
          </button>
        ))}
      </div>
      {!compact && (
        <p className={`mt-1.5 text-[10px] leading-relaxed rounded-lg px-2 py-1.5 ${actual.value === 'empresa' ? 'bg-amber-50 text-amber-800' : actual.value === 'anticipo' ? 'bg-violet-50 text-violet-800' : 'bg-emerald-50 text-emerald-800'}`}>
          {actual.value === 'personal' && 'Lo pagaste con tu dinero (efectivo o tarjeta propia): la empresa te lo reembolsa.'}
          {actual.value === 'anticipo' && 'Lo pagaste con el dinero del anticipo que te giraron: se cruza con el anticipo en la legalización, no se paga de nuevo.'}
          {actual.value === 'empresa' && 'Lo pagó directamente la empresa (tarjeta de crédito corporativa o cuenta Cabify/app de la empresa): se relaciona en la legalización pero no se te reembolsa.'}
        </p>
      )}
    </div>
  );
}

// Etiqueta pequeña para listas e informes. Por defecto no se muestra cuando el
// gasto lo pagó el colaborador (es el caso normal), salvo que se pida con always.
export function PagadoPorBadge({ value, always = false, className = '' }) {
  const info = pagadoPorInfo(value);
  if (!always && info.value === 'personal') return null;
  return (
    <span className={`inline-flex items-center text-[9px] font-bold px-1.5 py-0.5 rounded border ${info.color} ${className}`} title={info.desc}>
      {info.value === 'empresa' ? '🏢 ' : info.value === 'anticipo' ? '💵 ' : ''}{info.short}
    </span>
  );
}
