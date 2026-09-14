'use client'

import { useState } from 'react'
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

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-50 px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl border border-gold-100 shadow-[0_8px_40px_rgba(26,21,16,0.08)] p-8 text-center">
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
        </div>
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
    <div className="min-h-screen flex items-center justify-center bg-dark-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-gold-100 shadow-[0_8px_40px_rgba(26,21,16,0.08)] p-8">
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
        </div>
      </div>
    </div>
  )
}
