'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { useAlert } from '@/hooks/use-alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'

export default function DefinirSenhaPage() {
  const { session, loading, updatePassword } = useAuth()
  const alert = useAlert()
  const router = useRouter()
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

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

    if (senha.length < 6) {
      setError('A senha deve ter ao menos 6 caracteres.')
      return
    }
    if (senha !== confirmarSenha) {
      setError('As senhas não conferem.')
      return
    }

    setSubmitting(true)
    const { error: err } = await updatePassword(senha)
    setSubmitting(false)

    if (err) {
      setError(err)
      return
    }

    alert.success('Senha definida!', 'Sua senha foi atualizada com sucesso.', {
      onConfirm: () => router.replace('/dashboard'),
    })
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
          <Image
            src="/images/Tablet login-amico.svg"
            alt="Login illustration"
            width={420}
            height={420}
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
            {!session ? (
              <div className="text-center">
                <h2 className="font-display text-2xl font-semibold text-dark-500">
                  Link inválido ou expirado
                </h2>
                <p className="text-sm text-dark-300 mt-2">
                  Peça um novo link em &quot;Esqueci minha senha&quot; na tela de login.
                </p>
                <Link
                  href="/login"
                  className="inline-block mt-6 text-sm text-gold-600 hover:text-gold-700 font-medium transition-colors"
                >
                  Voltar para o login
                </Link>
              </div>
            ) : (
              <>
                <div className="mb-7">
                  <h2 className="font-display text-2xl font-semibold text-dark-500">
                    Defina sua senha
                  </h2>
                  <p className="text-sm text-dark-300 mt-1">
                    Escolha a senha que você vai usar para acessar o sistema.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    label="Nova senha"
                    type="password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                    autoComplete="new-password"
                    placeholder="Mínimo 6 caracteres"
                    leftAddon={<Lock size={16} />}
                  />
                  <Input
                    label="Confirmar nova senha"
                    type="password"
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    required
                    autoComplete="new-password"
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
                    Salvar senha
                  </Button>
                </form>
              </>
            )}
          </div>

          {/* Imagem mobile abaixo do card */}
          <div className="lg:hidden mt-8">
            <Image
              src="/images/Jewelry shop-pana.svg"
              alt=""
              width={260}
              height={260}
              className="w-full max-w-[260px] mx-auto h-auto object-contain opacity-80 select-none pointer-events-none"
              draggable={false}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
