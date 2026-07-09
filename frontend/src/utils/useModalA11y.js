import { useEffect, useRef } from 'react';

// Accesibilidad básica de modales:
//  - Cierra con la tecla Escape.
//  - Al abrir, enfoca el primer campo (o el contenedor).
//  - Mantiene el foco dentro del modal (trampa de foco con Tab).
//  - Al cerrar, devuelve el foco al elemento que lo tenía.
// Uso: const ref = useModalA11y(onClose); ... <div ref={ref} role="dialog" aria-modal="true">
export default function useModalA11y(onClose) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previo = document.activeElement;
    const el = ref.current;

    const handler = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key === 'Tab' && el) {
        const focusables = el.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !el.contains(document.activeElement))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);

    if (el) {
      const primerCampo = el.querySelector('input, select, textarea');
      const target = primerCampo || el;
      if (target === el && !el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      target.focus?.();
    }

    return () => {
      document.removeEventListener('keydown', handler);
      previo?.focus?.();
    };
  }, []);

  return ref;
}
