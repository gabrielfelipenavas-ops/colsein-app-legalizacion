import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle } from 'lucide-react';
import PdfViewer from './PdfViewer';

// Visor de soportes (foto o PDF de una factura) DENTRO de la app.
// Antes el soporte se abría con un enlace en "pestaña nueva"; con la app
// instalada en el celular (modo standalone) esa pestaña ocupa toda la pantalla
// y no hay botón para volver. Este visor se muestra encima y siempre tiene
// el botón "Cerrar" visible (respetando la zona del notch / barra de estado).
export default function SoporteViewer({ src, isPdf = false, onClose }) {
  const [error, setError] = useState(false);

  // Un soporte en PDF se muestra con el visor de PDF (todas las páginas; un
  // iframe en el iPhone solo mostraría la primera).
  const fetchPdf = useCallback(async () => {
    const r = await fetch(src);
    if (!r.ok) throw new Error('El archivo ya no está disponible en el servidor. Vuelve a subirlo con "Reemplazar soporte".');
    return r.blob();
  }, [src]);

  // Cerrar con la tecla Escape (computador)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Se monta directamente en <body> (portal) para cubrir toda la pantalla aunque
  // el modal que lo abre tenga animaciones/transformaciones.
  if (isPdf) {
    return <PdfViewer title="Soporte de la factura (PDF)" fetchBlob={fetchPdf} filename="soporte.pdf" onClose={onClose} />;
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] bg-black/80">
        <span />
        <button onClick={onClose} className="flex items-center gap-1.5 text-white text-sm font-bold px-4 py-2 rounded-xl bg-white/20 active:bg-white/30">
          <X size={18} /> Cerrar
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center" onClick={onClose}>
        {error ? (
          <div className="m-4 bg-red-50 border border-red-200 rounded-xl p-4 max-w-sm">
            <p className="flex items-center gap-2 text-sm font-bold text-red-700"><AlertTriangle size={16} /> No se pudo cargar el soporte</p>
            <p className="text-xs text-red-600 mt-1">El archivo ya no está disponible en el servidor. Vuelve a subirlo con "Reemplazar soporte".</p>
          </div>
        ) : (
          <img
            src={src}
            alt="Soporte"
            className="max-w-full max-h-full object-contain"
            style={{ touchAction: 'pinch-zoom' }}
            onClick={e => e.stopPropagation()}
            onError={() => setError(true)}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
