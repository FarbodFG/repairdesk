import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { CheckCircle2, X } from 'lucide-react'
const ToastContext = createContext<(message: string) => void>(() => {})
export const useToast = () => useContext(ToastContext)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )
  function notify(text: string) {
    if (timer.current) clearTimeout(timer.current)
    setMessage(text)
    timer.current = setTimeout(() => setMessage(''), 4500)
  }
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className={`toast ${message ? 'visible' : ''}`} role="status" aria-live="polite">
        {message && (
          <>
            <CheckCircle2 size={20} />
            <span>{message}</span>
            <button onClick={() => setMessage('')} className="icon-button" aria-label="بستن پیام">
              <X size={16} />
            </button>
          </>
        )}
      </div>
    </ToastContext.Provider>
  )
}
