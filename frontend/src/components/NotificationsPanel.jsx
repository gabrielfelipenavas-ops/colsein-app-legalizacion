import { useEffect, useState, useRef } from 'react';
import { Bell, X, CheckCheck, CheckCircle, XCircle, Send, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationAPI } from '../services/api';

const TIPO_ICON = {
  enviado: Send,
  aprobado: CheckCircle,
  rechazado: XCircle,
  comentario: Info,
  info: Info,
};

const TIPO_COLOR = {
  enviado: 'text-blue-600 bg-blue-50',
  aprobado: 'text-emerald-600 bg-emerald-50',
  rechazado: 'text-red-600 bg-red-50',
  comentario: 'text-amber-600 bg-amber-50',
  info: 'text-slate-600 bg-slate-50',
};

const REF_ROUTE = {
  kilometraje: '/km',
  anticipo: '/viajes',
  legalizacion: '/legalizacion',
};

function timeAgo(date) {
  const now = new Date();
  const d = new Date(date);
  const sec = Math.floor((now - d) / 1000);
  if (sec < 60) return 'ahora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });
}

export default function NotificationsPanel() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef(null);

  const loadCount = async () => {
    try {
      const { data } = await notificationAPI.unreadCount();
      setUnread(data.count || 0);
    } catch {}
  };

  const loadList = async () => {
    try {
      const { data } = await notificationAPI.list({ limit: 30 });
      setNotifs(data);
    } catch {}
  };

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) loadList();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = async (n) => {
    if (!n.leida) {
      try {
        await notificationAPI.markRead(n.id);
        setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, leida: true } : x));
        setUnread(c => Math.max(0, c - 1));
      } catch {}
    }
    if (n.ref_tipo && REF_ROUTE[n.ref_tipo]) {
      setOpen(false);
      navigate(REF_ROUTE[n.ref_tipo]);
    }
  };

  const markAll = async () => {
    try {
      await notificationAPI.markAllRead();
      setNotifs(prev => prev.map(x => ({ ...x, leida: true })));
      setUnread(0);
    } catch {}
  };

  return (
    <div className="relative" ref={panelRef}>
      <button onClick={() => setOpen(o => !o)} className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center relative">
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] rounded-full bg-red-500 text-white text-[9px] font-extrabold flex items-center justify-center px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-[340px] max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-slate-200 z-[200] text-slate-800 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-slate-100">
            <p className="text-sm font-bold">Notificaciones</p>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button onClick={markAll} title="Marcar todas como leídas"
                  className="text-[10px] font-semibold text-colsein-600 hover:text-colsein-700 flex items-center gap-1">
                  <CheckCheck size={12} /> Marcar todas
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-400 p-1"><X size={16} /></button>
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="text-center py-10 px-4">
                <Bell className="mx-auto text-slate-300 mb-2" size={28} />
                <p className="text-xs text-slate-400">No tienes notificaciones</p>
              </div>
            ) : notifs.map(n => {
              const Icon = TIPO_ICON[n.tipo] || Info;
              const color = TIPO_COLOR[n.tipo] || TIPO_COLOR.info;
              return (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-left p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors flex gap-3 ${!n.leida ? 'bg-blue-50/40' : ''}`}
                >
                  <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${color}`}>
                    <Icon size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs ${!n.leida ? 'font-extrabold' : 'font-semibold'} text-slate-800 truncate`}>{n.titulo}</p>
                      <span className="text-[10px] text-slate-400 shrink-0">{timeAgo(n.created_at)}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.mensaje}</p>
                    {!n.leida && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mt-1" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
