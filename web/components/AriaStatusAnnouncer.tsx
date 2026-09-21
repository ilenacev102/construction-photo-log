'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

interface AriaStatusContextType {
  announce: (message: string) => void
}

const AriaStatusContext = createContext<AriaStatusContextType>({
  announce: () => {},
})

export function AriaStatusProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState('')

  const announce = useCallback((msg: string) => {
    setMessage('')
    // Ensure state trigger across renders for screen readers
    setTimeout(() => setMessage(msg), 50)
  }, [])

  return (
    <AriaStatusContext.Provider value={{ announce }}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {message}
      </div>
    </AriaStatusContext.Provider>
  )
}

export function useAriaStatus() {
  return useContext(AriaStatusContext)
}
