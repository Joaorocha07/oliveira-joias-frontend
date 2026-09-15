'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Users, ArrowLeft, KeyRound, Mail } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { listarVendedoresAtivos } from '@/services/vendedores'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import type { Profile } from '@/types'

type Etapa = 'escolha' | 'lista' | 'codigo'

export default function PersonificarPage() {
  const { session, profile, loading, user, enviarCodigoConfirmacao, personificarVendedor } = useAuth()
  const router = useRouter()

  const [etapa, setEtapa] = useState<Etapa>('escolha')
  const [vendedores, setVendedores] = useState<Profile[]>([])
  const [carregandoVendedores, setCarregandoVendedores] = useState(false)
  const [vendedorSelecionado, setVendedorSelecionado] = useState<Profile | null>(null)
  const [codigo, setCodigo] = useState('')
  const [enviandoCodigo, setEnviandoCodigo] = useState(false)
  const [reenviado, setReenviado] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (loading) return
    if (!session) {
      router.replace('/login')
      return
    }
    if (profile && profile.role !== 'admin') {
      router.replace('/dashboard')
    }
  }, [loading, session, profile, router])

  if (loading || !session || !profile || profile.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-50">
        <Spinner size={24} />
      </div>
    )
  }

  async function abrirListaVendedores() {
    setEtapa('lista')
    if (vendedores.length > 0) return
    setCarregandoVendedores(true)
    const { data, error: err } = await listarVendedoresAtivos()
    setCarregandoVendedores(false)
    if (err) {
      setError(err)
      return
    }
    setVendedores(data ?? [])
  }

  async function selecionarVendedor(vendedor: Profile) {
    setVendedorSelecionado(vendedor)
    setCodigo('')
    setError('')
    setEtapa('codigo')
    setEnviandoCodigo(true)
    const { error: err } = await enviarCodigoConfirmacao()
    setEnviandoCodigo(false)
    if (err) setError(err)
  }

  async function reenviarCodigo() {
    setError('')
    setReenviado(false)
    setEnviandoCodigo(true)
    const { error: err } = await enviarCodigoConfirmacao()
    setEnviandoCodigo(false)
    if (err) {
      setError(err)
      return
    }
    setReenviado(true)
  }

  async function handleConfirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!vendedorSelecionado) return
    setError('')
    setConfirmando(true)
    const { error: err } = await personificarVendedor(vendedorSelecionado.id, codigo)
    setConfirmando(false)
    if (err) {
      setError(err)
      return
    }
    router.replace('/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Painel esquerdo — ilustração ────────────────────────── */}
      <div className="hidden lg:flex lg:w-[55%] bg-dark-800 flex-col items-center justify-center relative overflow-hidden p-12">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(201,168,76,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(201,168,76,0.05),transparent_60%)]" />

        <div className="text-center mb-10 relative z-10">
          <h1 className="font-display text-5xl font-light text-gold-500 leading-tight tracking-wide">
            Oliveira Joias
          </h1>
          <div className="w-12 h-px bg-gold-500/40 mx-auto my-4" />
          <p className="text-[11px] text-dark-300 tracking-[3px] uppercase">
            Sistema de Gestão
          </p>
        </div>

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

        <p className="absolute bottom-8 text-[11px] text-dark-300/60 tracking-widest z-10">
          © {new Date().getFullYear()} Oliveira Joias
        </p>
      </div>

      {/* ── Painel direito — fluxo ───────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-dark-50 px-6 py-12 lg:px-16">

        <div className="lg:hidden text-center mb-10">
          <h1 className="font-display text-4xl font-light text-dark-500 tracking-wide">
            Oliveira Joias
          </h1>
          <p className="text-[10px] text-dark-300 tracking-[2.5px] uppercase mt-2">
            Sistema de Gestão
          </p>
        </div>

        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl border border-gold-100 shadow-[0_8px_40px_rgba(26,21,16,0.08)] p-8">

            {/* ── Etapa 1: escolher conta ─────────────────────────── */}
            {etapa === 'escolha' && (
              <>
                <div className="mb-7">
                  <h2 className="font-display text-2xl font-semibold text-dark-500">
                    Como você quer entrar?
                  </h2>
                  <p className="text-sm text-dark-300 mt-1">
                    Você é administrador. Entre com sua conta ou acesse o sistema como outro usuário.
                  </p>
                </div>

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => router.replace('/dashboard')}
                    className="w-full flex items-center gap-3 rounded-xl border border-gold-100 px-4 py-3.5 text-left hover:bg-gold-50 hover:border-gold-200 transition-colors cursor-pointer"
                  >
                    <span className="flex-shrink-0 w-10 h-10 rounded-full bg-gold-50 border border-gold-200 flex items-center justify-center text-gold-600">
                      <ShieldCheck size={18} />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-dark-500">Entrar com minha conta</span>
                      <span className="block text-xs text-dark-300">{profile.nome}</span>
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void abrirListaVendedores()}
                    className="w-full flex items-center gap-3 rounded-xl border border-gold-100 px-4 py-3.5 text-left hover:bg-gold-50 hover:border-gold-200 transition-colors cursor-pointer"
                  >
                    <span className="flex-shrink-0 w-10 h-10 rounded-full bg-gold-50 border border-gold-200 flex items-center justify-center text-gold-600">
                      <Users size={18} />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-dark-500">Entrar como outro usuário</span>
                      <span className="block text-xs text-dark-300">Acessar como um vendedor da equipe</span>
                    </span>
                  </button>
                </div>
              </>
            )}

            {/* ── Etapa 2: escolher vendedor ──────────────────────── */}
            {etapa === 'lista' && (
              <>
                <button
                  type="button"
                  onClick={() => { setEtapa('escolha'); setError('') }}
                  className="flex items-center gap-1.5 text-xs text-dark-300 hover:text-gold-600 transition-colors mb-5"
                >
                  <ArrowLeft size={13} />
                  Voltar
                </button>

                <div className="mb-5">
                  <h2 className="font-display text-2xl font-semibold text-dark-500">
                    Entrar como quem?
                  </h2>
                  <p className="text-sm text-dark-300 mt-1">
                    Escolha o vendedor que você quer acessar.
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-2 text-sm text-[#C75B5B] bg-[rgba(199,91,91,0.06)] border border-[rgba(199,91,91,0.15)] rounded-lg px-3 py-2.5 mb-4">
                    <span>{error}</span>
                  </div>
                )}

                {carregandoVendedores ? (
                  <div className="flex items-center justify-center py-10">
                    <Spinner size={22} />
                  </div>
                ) : vendedores.length === 0 ? (
                  <EmptyState
                    icon={<Users />}
                    title="Nenhum vendedor ativo"
                    description="Cadastre vendedores em Equipe para poder acessar como eles."
                  />
                ) : (
                  <div className="max-h-[320px] overflow-y-auto -mx-1 px-1 space-y-2">
                    {vendedores.map((vendedor) => (
                      <button
                        key={vendedor.id}
                        type="button"
                        onClick={() => void selecionarVendedor(vendedor)}
                        className="w-full flex items-center gap-3 rounded-xl border border-gold-100 px-3.5 py-3 text-left hover:bg-gold-50 hover:border-gold-200 transition-colors cursor-pointer"
                      >
                        <span className="flex-shrink-0 w-9 h-9 rounded-full bg-dark-800 text-gold-400 text-xs font-medium flex items-center justify-center uppercase">
                          {vendedor.nome.slice(0, 2)}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-dark-500 truncate">{vendedor.nome}</span>
                          <span className="block text-xs text-dark-300 truncate">{vendedor.email}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Etapa 3: código de confirmação ──────────────────── */}
            {etapa === 'codigo' && vendedorSelecionado && (
              <>
                <button
                  type="button"
                  onClick={() => { setEtapa('lista'); setCodigo(''); setError('') }}
                  className="flex items-center gap-1.5 text-xs text-dark-300 hover:text-gold-600 transition-colors mb-5"
                >
                  <ArrowLeft size={13} />
                  Voltar
                </button>

                <div className="mb-6">
                  <h2 className="font-display text-2xl font-semibold text-dark-500">
                    Confirme que é você
                  </h2>
                  <p className="text-sm text-dark-300 mt-1">
                    {enviandoCodigo
                      ? 'Enviando código de confirmação...'
                      : <>Enviamos um código para <span className="text-dark-500 font-medium">{user?.email}</span>. Digite abaixo para entrar como <span className="text-dark-500 font-medium">{vendedorSelecionado.nome}</span>.</>}
                  </p>
                </div>

                <form onSubmit={handleConfirmar} className="space-y-4">
                  <Input
                    label="Código de confirmação"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={codigo}
                    onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    required
                    placeholder="000000"
                    leftAddon={<KeyRound size={16} />}
                    disabled={enviandoCodigo}
                  />

                  {error && (
                    <div className="flex items-start gap-2 text-sm text-[#C75B5B] bg-[rgba(199,91,91,0.06)] border border-[rgba(199,91,91,0.15)] rounded-lg px-3 py-2.5">
                      <span>{error}</span>
                    </div>
                  )}

                  {reenviado && !error && (
                    <div className="flex items-start gap-2 text-sm text-dark-500 bg-[rgba(91,140,91,0.08)] border border-[rgba(91,140,91,0.2)] rounded-lg px-3 py-2.5">
                      <span>Código reenviado. Confira seu e-mail.</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    loading={confirmando}
                    disabled={enviandoCodigo || codigo.length < 6}
                    className="w-full mt-2"
                  >
                    Confirmar e entrar
                  </Button>

                  <button
                    type="button"
                    onClick={() => void reenviarCodigo()}
                    disabled={enviandoCodigo}
                    className="flex items-center gap-1.5 justify-center text-xs text-dark-300 hover:text-gold-600 transition-colors w-full disabled:opacity-50"
                  >
                    <Mail size={12} />
                    Reenviar código
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
