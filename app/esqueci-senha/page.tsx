'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function EsqueciSenhaPage() {
  const { sendPasswordResetEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    await sendPasswordResetEmail(email)
    setSubmitting(false)
    setEnviado(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-dark-50 px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-gold-100 shadow-[0_8px_40px_rgba(26,21,16,0.08)] p-8">
          <div className="mb-7">
            <h2 className="font-display text-2xl font-semibold text-dark-500">
              Esqueci minha senha
            </h2>
            <p className="text-sm text-dark-300 mt-1">
              Informe seu e-mail cadastrado e enviaremos um link para redefinir a senha.
            </p>
          </div>

          {enviado ? (
            <div className="text-sm text-dark-500 bg-[rgba(91,140,91,0.08)] border border-[rgba(91,140,91,0.2)] rounded-lg px-3 py-2.5">
              Se esse e-mail estiver cadastrado no sistema, você vai receber um link para
              redefinir sua senha em instantes.
            </div>
          ) : (
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
              <Button
                type="submit"
                variant="primary"
                size="lg"
                loading={submitting}
                className="w-full mt-2"
              >
                Enviar link de redefinição
              </Button>
            </form>
          )}

          <Link
            href="/login"
            className="flex items-center gap-1.5 justify-center text-sm text-dark-300 hover:text-gold-600 transition-colors mt-6"
          >
            <ArrowLeft size={14} />
            Voltar para o login
          </Link>
        </div>
      </div>
    </div>
  )
}
