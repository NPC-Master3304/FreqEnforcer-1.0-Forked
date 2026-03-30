import { createContext, useContext, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import './Toast.css';

// ── Context ────────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

// ── Icons per type ─────────────────────────────────────────────────────────
const ICONS = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };

// ── Single toast item ──────────────────────────────────────────────────────
function ToastItem({ id, message, type, action, onRemove }) {
  const { t } = useTranslation();
  const [exiting, setExiting] = useState(false);

  function dismiss() {
    setExiting(true);
    setTimeout(() => onRemove(id), 195);
  }

  function handleAction() {
    action?.onClick();
    dismiss();
  }

  return (
    <div className={`toast toast--${type}${exiting ? ' toast--exiting' : ''}`}>
      <span className="toast-icon">{ICONS[type] ?? ICONS.info}</span>
      <span className="toast-message">{message}</span>
      {action && (
        <button className="toast-action" onClick={handleAction} type="button">{action.label}</button>
      )}
      <button className="toast-close" onClick={dismiss} type="button" aria-label={t('electron.toast.dismiss')}>×</button>
    </div>
  );
}

// ── Provider ───────────────────────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const counterRef = useRef(0);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /**
   * showToast(message, type?, duration?)
   *   type:     'success' | 'error' | 'info'  (default 'info')
   *   duration: ms before auto-dismiss        (default 4000, 0 = no auto-dismiss)
   */
  /**
   * showToast(message, type?, duration?, action?)
   *   action: { label: string, onClick: () => void }
   */
  const showToast = useCallback((message, type = 'info', duration = 4000, action = null) => {
    const id = ++counterRef.current;
    setToasts((prev) => [...prev, { id, message, type, action }]);

    if (duration > 0) {
      setTimeout(() => {
        // Trigger exit animation via ToastItem internal state is cleaner,
        // but here we just remove directly after duration + exit animation time
        setToasts((prev) => {
          const item = prev.find((t) => t.id === id);
          if (!item) return prev;
          // Mark as exiting by replacing with exiting flag
          return prev.map((t) => t.id === id ? { ...t, exiting: true } : t);
        });
        setTimeout(() => removeToast(id), 200);
      }, duration);
    }

    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {children}
      {createPortal(
        <div className="toast-container">
          {toasts.map((t) => (
            <ToastItem
              key={t.id}
              id={t.id}
              message={t.message}
              type={t.type}
              action={t.action}
              onRemove={removeToast}
            />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
