'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, supabaseConfigError } from '@/lib/supabase'
import type { Profile, UserRole } from '@/types'

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null; role: UserRole | null }>
  signOut: () => Promise<void>
  updateProfile: (data: Partial<Profile>) => Promise<{ error: string | null }>
  sendPasswordResetEmail: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
  enviarCodigoConfirmacao: () => Promise<{ error: string | null }>
  personificarVendedor: (vendedorId: string, codigo: string) => Promise<{ error: string | null }>
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

const AUTH_ERROR_TRANSLATIONS: Record<string, string> = {
  'New password should be different from the old password.':
    'A nova senha deve ser diferente da senha atual.',
  'Password should be at least 6 characters':
    'A senha deve ter ao menos 6 caracteres.',
  'Auth session missing!':
    'Sessao expirada. Peca um novo link de redefinicao de senha.',
  'Email rate limit exceeded':
    'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
  'Email not confirmed':
    'E-mail ainda nao confirmado.',
  'Unable to validate email address: invalid format':
    'Formato de e-mail invalido.',
}

function translateAuthErrorMessage(message: string) {
  if (AUTH_ERROR_TRANSLATIONS[message]) return AUTH_ERROR_TRANSLATIONS[message]

  const rateLimitMatch = message.match(/after (\d+) seconds/)
  if (rateLimitMatch) {
    return `Por seguranca, aguarde ${rateLimitMatch[1]} segundos antes de tentar novamente.`
  }

  return 'Nao foi possivel concluir a operacao. Tente novamente.'
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
    if (supabaseConfigError) return { error: supabaseConfigError, role: null }

    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        'Tempo esgotado ao conectar ao Supabase.'
      )
      if (error) return { error: 'Email ou senha incorretos.', role: null }

      let role: UserRole | null = null
      if (data.user) {
        try {
          role = (await fetchProfile(data.user.id))?.role ?? null
        } catch {
          role = null
        }
      }

      return { error: null, role }
    } catch (error) {
      return { error: getAuthRequestErrorMessage(error), role: null }
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

  async function sendPasswordResetEmail(email: string) {
    const token = crypto.randomUUID()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/definir-senha/${token}`,
    })
    if (error) return { error: translateAuthErrorMessage(error.message) }
    return { error: null }
  }

  async function updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) return { error: translateAuthErrorMessage(error.message) }
    return { error: null }
  }

  async function enviarCodigoConfirmacao() {
    if (!user?.email) return { error: 'Nao autenticado.' }

    const { error } = await supabase.auth.signInWithOtp({
      email: user.email,
      options: { shouldCreateUser: false },
    })
    if (error) return { error: translateAuthErrorMessage(error.message) }
    return { error: null }
  }

  async function personificarVendedor(vendedorId: string, codigo: string) {
    if (!user?.email) return { error: 'Nao autenticado.' }

    const { error: otpError } = await supabase.auth.verifyOtp({
      email: user.email,
      token: codigo,
      type: 'email',
    })
    if (otpError) return { error: 'Codigo invalido ou expirado.' }

    const { data: { session: currentSession } } = await supabase.auth.getSession()
    const accessToken = currentSession?.access_token
    if (!accessToken) return { error: 'Sessao invalida. Faca login novamente.' }

    let response: Response
    try {
      response = await fetch('/api/admin/personificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ vendedorId }),
      })
    } catch {
      return { error: 'Nao foi possivel conectar ao servidor. Tente novamente.' }
    }

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      return { error: typeof result?.error === 'string' ? result.error : 'Nao foi possivel entrar como esse vendedor.' }
    }

    const { error: swapError } = await supabase.auth.verifyOtp({
      token_hash: result.tokenHash,
      type: 'magiclink',
    })
    if (swapError) return { error: 'Nao foi possivel entrar como esse vendedor.' }

    return { error: null }
  }

  return (
    <AuthContext.Provider value={{
      session, user, profile, loading, signIn, signOut, updateProfile,
      sendPasswordResetEmail, updatePassword, enviarCodigoConfirmacao, personificarVendedor,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return ctx
}
