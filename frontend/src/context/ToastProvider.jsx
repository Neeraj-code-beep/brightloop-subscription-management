import { useCallback, useMemo, useRef, useState } from 'react'
import ToastViewport from '../components/shared/ToastViewport.jsx'
import { ToastContext } from './ToastContext.js'

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const nextId = useRef(1)

  const dismissToast = useCallback((toastId) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== toastId))
  }, [])

  const showToast = useCallback(({ title, description, action }) => {
    const id = nextId.current
    nextId.current += 1
    setToasts((previous) => [...previous, { id, title, description, action }])
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  )
}
