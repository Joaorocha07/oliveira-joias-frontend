'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Diamond, Menu } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { Sidebar } from './sidebar'
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
    return <InitialLoadingScreen />
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

        <div className="flex-1 overflow-y-auto p-4 md:p-6 min-w-0">
          {children}
        </div>
      </main>
    </div>
  )
}

function InitialLoadingScreen() {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[#FDFCF9] text-dark-500">
      <div className="absolute inset-x-0 top-0 h-1 bg-gold-100" aria-hidden="true">
        <div className="h-full w-1/3 animate-[loadingBar_1.35s_ease-in-out_infinite] bg-gold-500" />
      </div>

      <aside className="hidden w-64 shrink-0 border-r border-gold-100 bg-white/75 px-5 py-6 md:block">
        <div className="mb-9 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gold-300 bg-gold-50 text-gold-600">
            <Diamond size={18} />
          </div>
          <div className="min-w-0">
            <div className="h-4 w-28 rounded-full bg-gold-200/70" />
            <div className="mt-2 h-2 w-20 rounded-full bg-cream-300" />
          </div>
        </div>

        <div className="space-y-3">
          {[132, 156, 118, 146, 104, 138].map((width) => (
            <div key={width} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-cream-200" />
              <div className="h-3 rounded-full bg-cream-300" style={{ width }} />
            </div>
          ))}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gold-100 bg-white/80 px-4 md:hidden">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-gold-300 bg-gold-50 text-gold-600">
            <Diamond size={15} />
          </div>
          <div className="h-3 w-28 rounded-full bg-gold-200/70" />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10">
          <div className="w-full max-w-[720px]">
            <div className="mx-auto flex max-w-sm flex-col items-center text-center">
              <div className="relative mb-5 flex h-16 w-16 items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-gold-300" />
                <div className="absolute inset-1 rounded-full border-2 border-transparent border-t-gold-500 animate-spin" />
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-dark-800 text-gold-500 shadow-[0_12px_32px_rgba(26,21,16,0.18)]">
                  <Diamond size={19} />
                </div>
              </div>

              <p className="font-display text-2xl font-semibold leading-none text-dark-600">
                Oliveira Joias
              </p>
              <p className="mt-2 text-sm text-dark-300">Preparando seu painel...</p>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="rounded-lg border border-gold-100 bg-white/80 p-4 shadow-[0_16px_40px_rgba(26,21,16,0.05)]"
                >
                  <div className="h-2 w-16 rounded-full bg-cream-300" />
                  <div className="mt-4 h-5 w-24 rounded-full bg-gold-100" />
                  <div className="mt-3 h-2 w-full rounded-full bg-cream-200" />
                  <div className="mt-2 h-2 w-2/3 rounded-full bg-cream-200" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
