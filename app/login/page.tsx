'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, Lock } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

export default function LoginPage() {
  const { signIn, session, loading } = useAuth()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && session) {
      router.replace('/dashboard')
    }
  }, [session, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-50">
        <Spinner size={24} />
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error: err } = await signIn(email, password)
    if (err) {
      setError(err)
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Painel esquerdo — ilustração ────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] bg-dark-800 flex-col items-center justify-center relative overflow-hidden p-12">
        {/* Gradiente decorativo */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(201,168,76,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(201,168,76,0.05),transparent_60%)]" />

        {/* Logo */}
        <div className="text-center mb-10 relative z-10">
          <h1 className="font-display text-5xl font-light text-gold-500 leading-tight tracking-wide">
            Oliveira Joias
          </h1>
          <div className="w-12 h-px bg-gold-500/40 mx-auto my-4" />
          <p className="text-[11px] text-dark-300 tracking-[3px] uppercase">
            Sistema de Gestão
          </p>
        </div>

        {/* Ilustração */}
        <div className="relative z-10 w-full max-w-md">
          <img
            src="/images/Tablet login-amico.svg"
            alt="Login illustration"
            className="w-full h-auto object-contain select-none pointer-events-none"
            draggable={false}
          />
        </div>

        {/* Rodapé esquerdo */}
        <p className="absolute bottom-8 text-[11px] text-dark-300/60 tracking-widest z-10">
          © {new Date().getFullYear()} Oliveira Joias
        </p>
      </div>

      {/* ── Painel direito — formulário ─────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-dark-50 px-6 py-12 lg:px-16">

        {/* Logo mobile */}
        <div className="lg:hidden text-center mb-10">
          <h1 className="font-display text-4xl font-light text-dark-500 tracking-wide">
            Oliveira Joias
          </h1>
          <p className="text-[10px] text-dark-300 tracking-[2.5px] uppercase mt-2">
            Sistema de Gestão
          </p>
        </div>

        <div className="w-full max-w-sm">
          {/* Card do formulário */}
          <div className="bg-white rounded-2xl border border-gold-100 shadow-[0_8px_40px_rgba(26,21,16,0.08)] p-8">
            <div className="mb-7">
              <h2 className="font-display text-2xl font-semibold text-dark-500">
                Bem-vindo de volta
              </h2>
              <p className="text-sm text-dark-300 mt-1">
                Entre com suas credenciais para acessar
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="seu@email.com"
                leftAddon={<Mail size={16} />}
              />
              <Input
                label="Senha"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                leftAddon={<Lock size={16} />}
              />

              {error && (
                <div className="flex items-start gap-2 text-sm text-[#C75B5B] bg-[rgba(199,91,91,0.06)] border border-[rgba(199,91,91,0.15)] rounded-lg px-3 py-2.5">
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={submitting}
                className="w-full mt-2"
              >
                Entrar
              </Button>
            </form>
          </div>

          {/* Imagem mobile abaixo do card */}
          <div className="lg:hidden mt-8">
            <img
              src="/images/Jewelry shop-pana.svg"
              alt=""
              className="w-full max-w-[260px] mx-auto h-auto object-contain opacity-80 select-none pointer-events-none"
              draggable={false}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
