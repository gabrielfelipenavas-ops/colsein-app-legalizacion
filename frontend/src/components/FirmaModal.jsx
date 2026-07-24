import { useRef, useState, useEffect } from 'react';
import { X, PenLine, Upload, Eraser, Check } from 'lucide-react';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

// Modal para registrar/reemplazar la firma manuscrita del colaborador.
// Dos formas: dibujarla en un canvas (dedo/mouse) o subir una imagen.
// La firma se estampa en el PDF de la legalización para no tener que
// imprimir, firmar y escanear el documento.
export default function FirmaModal({ onClose, onSaved }) {
  const { user, updateUser } = useAuth();
  const [tab, setTab] = useState('dibujar');
  const [saving, setSaving] = useState(false);
  const [hasStroke, setHasStroke] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPoint = useRef(null);

  // Ajustar la resolución interna del canvas a su tamaño real en pantalla
  useEffect(() => {
    if (tab !== 'dibujar') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = window.devicePixelRatio || 1;
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e293b';
  }, [tab]);

  const pointFromEvent = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    canvasRef.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    lastPoint.current = pointFromEvent(e);
  };
  const moveDraw = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = pointFromEvent(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint.current = p;
    setHasStroke(true);
  };
  const endDraw = () => { drawing.current = false; lastPoint.current = null; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  };

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result);
    reader.readAsDataURL(f);
  };

  const save = async () => {
    setSaving(true);
    try {
      let res;
      if (tab === 'dibujar') {
        if (!hasStroke) { alert('Dibuja tu firma antes de guardar.'); setSaving(false); return; }
        res = await authAPI.saveFirmaDataUrl(canvasRef.current.toDataURL('image/png'));
      } else {
        if (!file) { alert('Selecciona la imagen de tu firma.'); setSaving(false); return; }
        res = await authAPI.uploadFirma(file);
      }
      updateUser({ firma_url: res.data.firma_url });
      alert('Firma guardada. Se estampará en el PDF de tus legalizaciones.');
      onSaved?.(res.data.firma_url);
      onClose();
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar la firma');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[80]" onClick={onClose} />
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-[90] max-w-md mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-white border-b border-slate-100 p-4 flex items-center justify-between">
          <h3 className="text-sm font-bold flex items-center gap-2"><PenLine size={16} className="text-colsein-500" /> Mi firma</h3>
          <button onClick={onClose} className="text-slate-400 p-1"><X size={22} /></button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-500">
            Tu firma se estampa en el PDF de la legalización, así no tienes que imprimir, firmar y escanear.
          </p>

          {user?.firma_url && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
              <img src={user.firma_url} alt="Firma actual" className="h-10 max-w-[140px] object-contain" />
              <p className="text-[11px] text-emerald-700 font-semibold">Ya tienes una firma registrada. Al guardar, la reemplazas.</p>
            </div>
          )}

          <div className="flex gap-1.5">
            <button onClick={() => setTab('dibujar')}
              className={`flex-1 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 ${tab === 'dibujar' ? 'bg-colsein-500 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
              <PenLine size={12} /> Dibujar
            </button>
            <button onClick={() => setTab('subir')}
              className={`flex-1 py-2 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 ${tab === 'subir' ? 'bg-colsein-500 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
              <Upload size={12} /> Subir imagen
            </button>
          </div>

          {tab === 'dibujar' ? (
            <div>
              <canvas
                ref={canvasRef}
                className="w-full h-40 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 touch-none"
                onPointerDown={startDraw}
                onPointerMove={moveDraw}
                onPointerUp={endDraw}
                onPointerLeave={endDraw}
              />
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-slate-400">Firma dentro del recuadro con el dedo o el mouse</p>
                <button onClick={clearCanvas} className="text-[11px] text-red-500 font-semibold flex items-center gap-1"><Eraser size={12} /> Limpiar</button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 p-4 text-center cursor-pointer hover:bg-slate-100">
                {preview
                  ? <img src={preview} alt="Vista previa de la firma" className="max-h-28 mx-auto object-contain" />
                  : (
                    <span className="text-xs text-slate-500 flex flex-col items-center gap-1">
                      <Upload size={20} className="text-slate-400" />
                      Toca para elegir la foto de tu firma (fondo claro, tinta oscura)
                    </span>
                  )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              </label>
            </div>
          )}

          <button onClick={save} disabled={saving} className="btn-primary w-full">
            <Check size={16} /> {saving ? 'Guardando...' : 'Guardar firma'}
          </button>
        </div>
      </div>
    </>
  );
}
