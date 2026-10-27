'use client';

import { createContext, useCallback, useContext, useState } from 'react';

interface Toast {
  id: number;
  kind: 'ok' | 'error';
  text: string;
}

const ToastContext = createContext<{ notify: (text: string, kind?: Toast['kind']) => void }>({ notify: () => undefined });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((text: string, kind: Toast['kind'] = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`rounded-card border px-4 py-2 text-sm shadow-md ${t.kind === 'error' ? 'border-red-300 bg-red-50 text-red-800' : 'border-border bg-bg text-fg'}`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
