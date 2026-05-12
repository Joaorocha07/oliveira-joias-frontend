'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Menu } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { Sidebar } from './sidebar'
import { Spinner } from '@/components/ui'
import { cn } from '@/lib/cn'

export function AppShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  // Auto-collapse on tablet, close mobile drawer on resize up
  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth
      if (w < 768) {
        setMobileOpen(false)
      } else if (w < 1024) {
        setCollapsed(true)
        setMobileOpen(false)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login')
    }
  }, [session, loading, router])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-cream-100">
        <div className="text-center">
          <Spinner size={28} />
          <p className="text-xs text-dark-300 mt-3">Carregando...</p>
        </div>
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="flex h-screen overflow-hidden bg-cream-100">
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-dark-900/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: drawer on mobile, inline on md+ */}
      <div className={cn(
        'transition-transform duration-200',
        'md:relative md:flex md:flex-shrink-0',
        mobileOpen ? 'fixed inset-y-0 left-0 z-40 flex' : 'hidden md:flex',
      )}>
        <Sidebar
          collapsed={collapsed}
          onToggle={() => setCollapsed((v) => !v)}
          onMobileClose={() => setMobileOpen(false)}
        />
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 h-14 bg-white border-b border-gold-100 flex-shrink-0">
          <button
            onClick={() => { setCollapsed(false); setMobileOpen(true) }}
            className="p-2 -ml-1 rounded-lg text-dark-400 hover:text-gold-600 hover:bg-cream-100 transition-colors"
            aria-label="Abrir menu"
          >
            <Menu size={20} />
          </button>
          <p className="font-display text-base text-gold-600 leading-none">Oliveira Joias</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}
