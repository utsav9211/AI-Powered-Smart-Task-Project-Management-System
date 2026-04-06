"use client"

import React, { createContext, useContext, useState, ReactNode } from "react"
import { AlertCircle, CheckCircle2, X } from "lucide-react"

type ToastType = "success" | "error" | "info"

interface Toast {
  id: number
  message: string
  type: ToastType
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = (message: string, type: ToastType = "info") => {
    const id = Date.now()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 5000)
  }

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-md shadow-lg border text-sm font-medium slide-in-bottom
              ${t.type === "success" ? "bg-green-50 border-green-200 text-green-800" :
                t.type === "error" ? "bg-red-50 border-red-200 text-red-800" :
                "bg-white border-gray-200 text-gray-800"
              }`}
          >
            {t.type === "success" && <CheckCircle2 className="h-5 w-5 text-green-600" />}
            {t.type === "error" && <AlertCircle className="h-5 w-5 text-red-600" />}
            <span>{t.message}</span>
            <button onClick={() => removeToast(t.id)} className="ml-auto text-gray-500 hover:text-gray-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
