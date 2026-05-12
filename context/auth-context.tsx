'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigError } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  updateProfile: (data: Partial<Profile>) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)
const AUTH_TIMEOUT_MS = 15000

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), AUTH_TIMEOUT_MS)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId))
}

function getAuthRequestErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message === 'Failed to fetch') {
      return 'Nao foi possivel conectar ao Supabase. Verifique a URL, a chave anonima e a conexao.'
    }

    return error.message
  }

  return 'Nao foi possivel autenticar agora. Tente novamente.'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const profileRequestIdRef = useRef(0)

  const fetchProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) throw error
    return (data as Profile | null) ?? null
  }, [])

  const syncProfile = useCallback(async (userId: string, message: string) => {
    const requestId = profileRequestIdRef.current + 1
    profileRequestIdRef.current = requestId

    try {
      const nextProfile = await withTimeout(fetchProfile(userId), message)
      if (profileRequestIdRef.current === requestId) setProfile(nextProfile)
    } catch (error) {
      if (profileRequestIdRef.current !== requestId) return
      console.warn('Perfil indisponivel no momento:', error)
      setProfile(null)
    }
  }, [fetchProfile])

  useEffect(() => {
    let mounted = true

    async function initAuth() {
      try {
        const {
          data: { session: currentSession },
        } = await withTimeout(supabase.auth.getSession(), 'Tempo esgotado ao carregar sessao.')

        if (!mounted) return
        setSession(currentSession)
        setUser(currentSession?.user ?? null)

        if (currentSession?.user) {
          await syncProfile(currentSession.user.id, 'Tempo esgotado ao carregar perfil.')
        } else {
          setProfile(null)
        }
      } catch (error) {
        console.warn('Autenticacao indisponivel no momento:', error)
        if (!mounted) return
        setSession(null)
        setUser(null)
        setProfile(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)

      window.setTimeout(() => {
        if (!mounted) return
        if (nextSession?.user) {
          void syncProfile(nextSession.user.id, 'Tempo esgotado ao atualizar perfil.')
        } else {
          setProfile(null)
        }
      }, 0)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [syncProfile])

  async function signIn(email: string, password: string) {
    if (supabaseConfigError) return { error: supabaseConfigError }

    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        'Tempo esgotado ao conectar ao Supabase.'
      )
      if (error) return { error: 'Email ou senha incorretos.' }
      return { error: null }
    } catch (error) {
      return { error: getAuthRequestErrorMessage(error) }
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    setProfile(null)
  }

  async function updateProfile(data: Partial<Profile>) {
    if (!user) return { error: 'Nao autenticado' }
    const { error } = await supabase.from('profiles').update(data).eq('id', user.id)
    if (error) return { error: error.message }
    setProfile((prev) => (prev ? { ...prev, ...data } : prev))
    return { error: null }
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
