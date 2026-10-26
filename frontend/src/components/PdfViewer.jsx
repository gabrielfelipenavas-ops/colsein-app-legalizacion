import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, AlertTriangle, ZoomIn, ZoomOut } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.js?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// Visor de PDF DENTRO de la app (pantalla completa, botón Cerrar siempre
// visible). Dibuja cada página con PDF.js en un <canvas>: en el iPhone un
// iframe o una pestaña nueva solo muestran la primera página o sacan al
// usuario de la app instalada. Sirve para la vista previa de la legalización
// (borrador incluido) y para los soportes en PDF.
//   fetchBlob: función async que devuelve el Blob del PDF (con la sesión).
export default function PdfViewer({ title, subtitle, fetchBlob, filename = 'documento.pdf', onClose }) {
  const [state, setState] = useState({ status: 'loading', pages: 0, error: '' });
  const [blobUrl, setBlobUrl] = useState(null);
  const [pdfDoc, setPdfDoc] = useState(null);
  // La app desactiva el zoom con los dedos (viewport user-scalable=no), así que
  // el visor trae sus propios botones de acercar/alejar.
  const ZOOMS = [1, 1.5, 2, 3];
  const [zoom, setZoom] = useState(1);
  const containerRef = useRef(null);

  // 1) Descargar el PDF y abrirlo con PDF.js
  useEffect(() => {
    let cancel = false;
    let url = null;
    let doc = null;
    (async () => {
      try {
        const blob = await fetchBlob();
        if (cancel) return;
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
        const data = new Uint8Array(await blob.arrayBuffer());
        doc = await pdfjsLib.getDocument({ data }).promise;
        if (cancel) return;
        setPdfDoc(doc);
        setState({ status: 'ready', pages: doc.numPages, error: '' });
      } catch (err) {
        if (!cancel) setState({ status: 'error', pages: 0, error: err?.response?.data?.error || err?.message || 'No se pudo cargar el documento' });
      }
    })();
    return () => {
      cancel = true;
      if (url) URL.revokeObjectURL(url);
      if (doc) doc.destroy().catch(() => {});
    };
  }, [fetchBlob]);

  // 2) Dibujar las páginas (se repite al cambiar el zoom)
  useEffect(() => {
    if (!pdfDoc) return undefined;
    let cancel = false;
    const cont = containerRef.current;
    if (!cont) return undefined;
    (async () => {
      cont.innerHTML = '';
      const anchoDisponible = Math.max(280, cont.clientWidth - 16) * zoom;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      for (let n = 1; n <= pdfDoc.numPages; n++) {
        if (cancel) return;
        const page = await pdfDoc.getPage(n);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: anchoDisponible / base.width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        canvas.className = 'block mb-3 bg-white shadow-md rounded-sm';
        canvas.style.marginLeft = zoom === 1 ? 'auto' : '0';
        canvas.style.marginRight = zoom === 1 ? 'auto' : '0';
        cont.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null }).promise;
      }
    })().catch(err => { if (!cancel) setState({ status: 'error', pages: 0, error: err?.message || 'No se pudo dibujar el documento' }); });
    return () => { cancel = true; };
  }, [pdfDoc, zoom]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const descargar = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.click();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-slate-800 flex flex-col" onClick={e => e.stopPropagation()}>
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] bg-slate-900 text-white">
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">{title}</p>
          {subtitle && <p className="text-[11px] text-amber-300 font-semibold truncate">{subtitle}</p>}
          {state.status === 'ready' && <p className="text-[10px] text-slate-400">{state.pages} página{state.pages === 1 ? '' : 's'}</p>}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => setZoom(z => ZOOMS[Math.max(0, ZOOMS.indexOf(z) - 1)])} disabled={zoom === ZOOMS[0]} aria-label="Alejar" className="text-white/90 p-2 rounded-xl bg-white/10 disabled:opacity-40">
            <ZoomOut size={16} />
          </button>
          <button onClick={() => setZoom(z => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(z) + 1)])} disabled={zoom === ZOOMS[ZOOMS.length - 1]} aria-label="Acercar" className="text-white/90 p-2 rounded-xl bg-white/10 disabled:opacity-40">
            <ZoomIn size={16} />
          </button>
          <button onClick={descargar} disabled={!blobUrl} aria-label="Descargar" className="text-white/90 p-2 rounded-xl bg-white/10 disabled:opacity-40">
            <Download size={16} />
          </button>
          <button onClick={onClose} className="flex items-center gap-1 text-white text-sm font-bold px-3 py-2 rounded-xl bg-white/20 active:bg-white/30">
            <X size={18} /> Cerrar
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-2" style={{ WebkitOverflowScrolling: 'touch' }}>
        {state.status === 'loading' && (
          <div className="flex flex-col items-center justify-center gap-3 text-white/80 py-16">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold">Generando el documento...</p>
          </div>
        )}
        {state.status === 'error' && (
          <div className="m-4 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="flex items-center gap-2 text-sm font-bold text-red-700"><AlertTriangle size={16} /> No se pudo mostrar el documento</p>
            <p className="text-xs text-red-600 mt-1">{state.error}</p>
          </div>
        )}
        <div ref={containerRef} />
      </div>
    </div>,
    document.body,
  );
}
