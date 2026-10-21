import { useEffect, useState } from 'react';
import { X, Download, AlertTriangle } from 'lucide-react';

// Visor de soportes (foto o PDF de una factura) DENTRO de la app.
// Antes el soporte se abría con un enlace en "pestaña nueva"; con la app
// instalada en el celular (modo standalone) esa pestaña ocupa toda la pantalla
// y no hay botón para volver. Este visor se muestra encima y siempre tiene
// el botón "Cerrar" visible (respetando la zona del notch / barra de estado).
export default function SoporteViewer({ src, isPdf = false, onClose }) {
  const [pdfUrl, setPdfUrl] = useState(null);
  const [error, setError] = useState(false);

  // El PDF se descarga como blob para mostrarlo en un iframe: así no depende de
  // las cabeceras de seguridad con las que el servidor entrega /uploads.
  useEffect(() => {
    if (!isPdf || !src) return undefined;
    let url = null;
    let cancel = false;
    fetch(src)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })
      .then(b => {
        if (cancel) return;
        url = URL.createObjectURL(new Blob([b], { type: 'application/pdf' }));
        setPdfUrl(url);
      })
      .catch(() => { if (!cancel) setError(true); });
    return () => { cancel = true; if (url) URL.revokeObjectURL(url); };
  }, [src, isPdf]);

  // Cerrar con la tecla Escape (computador)
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] bg-black/80">
        {isPdf && pdfUrl ? (
          <a href={pdfUrl} download="soporte.pdf" className="flex items-center gap-1 text-white/80 text-xs font-semibold px-3 py-2 rounded-xl bg-white/10">
            <Download size={14} /> Descargar
          </a>
        ) : <span />}
        <button onClick={onClose} className="flex items-center gap-1.5 text-white text-sm font-bold px-4 py-2 rounded-xl bg-white/20 active:bg-white/30">
          <X size={18} /> Cerrar
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center" onClick={isPdf ? undefined : onClose}>
        {error ? (
          <div className="m-4 bg-red-50 border border-red-200 rounded-xl p-4 max-w-sm">
            <p className="flex items-center gap-2 text-sm font-bold text-red-700"><AlertTriangle size={16} /> No se pudo cargar el soporte</p>
            <p className="text-xs text-red-600 mt-1">El archivo ya no está disponible en el servidor. Vuelve a subirlo con "Reemplazar soporte".</p>
          </div>
        ) : isPdf ? (
          pdfUrl
            ? <iframe src={pdfUrl} title="Soporte PDF" className="w-full h-full bg-white" />
            : <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
    </div>
  );
}
