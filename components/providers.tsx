'use client'

import { useState } from 'react'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/context/auth-context'
import { AlertModalProvider } from '@/hooks/use-alert'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AlertModalProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3500,
              style: {
                fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
                fontSize: '13px',
                borderRadius: '8px',
                border: '1px solid #F0EBE0',
                background: '#FFFFFF',
                color: '#2D2418',
                boxShadow: '0 4px 16px rgba(26,21,16,0.10)',
              },
              success: { iconTheme: { primary: '#5B8C5B', secondary: '#fff' } },
              error:   { iconTheme: { primary: '#C75B5B', secondary: '#fff' } },
            }}
          />
        </AlertModalProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
