import React from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function ToastContainer() {
  const { toasts, removeToast } = useAuth();

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto bg-slate-900 text-white border border-slate-700 rounded-xl shadow-xl p-3.5 flex items-start gap-3 animate-in fade-in slide-in-from-bottom-3"
        >
          {t.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
          ) : t.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white">{t.title}</div>
            <div className="text-xs text-slate-300 mt-0.5 leading-relaxed">{t.message}</div>
          </div>
          <button
            onClick={() => removeToast(t.id)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
