'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, subMonths, addWeeks, subWeeks, addDays, subDays,
  format, isSameMonth, isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { useAlert } from '@/hooks/use-alert'
import { PageHeader, Card, Button, Spinner, EmptyState } from '@/components/ui'
import { FollowUpCard } from '@/components/crm/followup-card'
import { ModalAgendarFollowUp } from '@/components/modals/modal-agendar-followup'
import { ModalWhatsApp } from '@/components/modals/modal-whatsapp'
import { listarFollowUps, concluirFollowUp, cancelarFollowUp } from '@/services/follow-ups'
import { cn } from '@/lib/cn'
import type { ClienteFollowUp } from '@/types'

type ViewMode = 'dia' | 'semana' | 'mes'

export default function CalendarioPage() {
  const { user, profile } = useAuth()
  const alert = useAlert()
  const [followUps, setFollowUps] = useState<ClienteFollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<ViewMode>('mes')
  const [dataRef, setDataRef] = useState(new Date())
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [reagendando, setReagendando] = useState<ClienteFollowUp | null>(null)
  const [whatsappFollowUp, setWhatsappFollowUp] = useState<ClienteFollowUp | null>(null)

  const escopoVendedor = profile?.role === 'vendedor' ? profile.id : undefined

  async function carregar() {
    setLoading(true)
    const { data, error } = await listarFollowUps(escopoVendedor)
    if (error) alert.error('Erro', 'Erro ao carregar a agenda.')
    else setFollowUps(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void carregar(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [escopoVendedor])

  const porDia = useMemo(() => {
    const map = new Map<string, ClienteFollowUp[]>()
    followUps.forEach((f) => {
      const key = f.data_agendada
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(f)
    })
    return map
  }, [followUps])

  function navegar(direcao: 1 | -1) {
    if (view === 'mes') setDataRef((d) => direcao === 1 ? addMonths(d, 1) : subMonths(d, 1))
    else if (view === 'semana') setDataRef((d) => direcao === 1 ? addWeeks(d, 1) : subWeeks(d, 1))
    else setDataRef((d) => direcao === 1 ? addDays(d, 1) : subDays(d, 1))
  }

  async function handleConcluir(followUp: ClienteFollowUp) {
    if (!user) return
    setProcessingId(followUp.id)
    const { error } = await concluirFollowUp(followUp, user.id)
    if (error) alert.error('Erro', error)
    else await carregar()
    setProcessingId(null)
  }

  async function handleCancelar(followUp: ClienteFollowUp) {
    if (!user) return
    setProcessingId(followUp.id)
    const { error } = await cancelarFollowUp(followUp, user.id)
    if (error) alert.error('Erro', error)
    else await carregar()
    setProcessingId(null)
  }

  const diasDoMes = useMemo(() => {
    const inicio = startOfWeek(startOfMonth(dataRef), { weekStartsOn: 0 })
    const fim = endOfWeek(endOfMonth(dataRef), { weekStartsOn: 0 })
    return eachDayOfInterval({ start: inicio, end: fim })
  }, [dataRef])

  const diasDaSemana = useMemo(() => {
    const inicio = startOfWeek(dataRef, { weekStartsOn: 0 })
    const fim = endOfWeek(dataRef, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: inicio, end: fim })
  }, [dataRef])

  const followUpsDoDia = porDia.get(format(dataRef, 'yyyy-MM-dd')) ?? []

  const tituloPeriodo = view === 'mes'
    ? format(dataRef, "MMMM 'de' yyyy", { locale: ptBR })
    : view === 'semana'
      ? `${format(startOfWeek(dataRef, { weekStartsOn: 0 }), 'dd/MM')} – ${format(endOfWeek(dataRef, { weekStartsOn: 0 }), 'dd/MM')}`
      : format(dataRef, "EEEE, d 'de' MMMM", { locale: ptBR })

  return (
    <div>
      <PageHeader
        title="CRM · Calendário"
        subtitle="Todos os retornos agendados, por dia, semana ou mês"
      />

      <Card padding="sm" className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => navegar(-1)} className="p-1.5 rounded-lg text-dark-400 hover:bg-cream-100 transition-colors">
              <ChevronLeft size={16} />
            </button>
            <p className="text-sm font-semibold text-dark-700 capitalize min-w-[160px] text-center">{tituloPeriodo}</p>
            <button onClick={() => navegar(1)} className="p-1.5 rounded-lg text-dark-400 hover:bg-cream-100 transition-colors">
              <ChevronRight size={16} />
            </button>
            <Button variant="ghost" size="sm" onClick={() => setDataRef(new Date())}>Hoje</Button>
          </div>
          <div className="flex gap-1 bg-cream-100 rounded-lg p-1">
            {(['dia', 'semana', 'mes'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
                  view === v ? 'bg-white text-gold-600 shadow-sm' : 'text-dark-400 hover:text-dark-600'
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={24} /></div>
      ) : view === 'mes' ? (
        <Card padding="none">
          <div className="grid grid-cols-7 border-b border-gold-100">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
              <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold text-dark-400 uppercase">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {diasDoMes.map((dia) => {
              const key = format(dia, 'yyyy-MM-dd')
              const itens = porDia.get(key) ?? []
              return (
                <button
                  key={key}
                  onClick={() => { setDataRef(dia); setView('dia') }}
                  className={cn(
                    'min-h-[86px] p-1.5 border-b border-r border-gold-50 text-left hover:bg-cream-50/60 transition-colors flex flex-col gap-1',
                    !isSameMonth(dia, dataRef) && 'bg-cream-50/40 text-dark-200'
                  )}
                >
                  <span className={cn(
                    'text-xs w-5 h-5 flex items-center justify-center rounded-full',
                    isToday(dia) ? 'bg-gold-500 text-white font-semibold' : 'text-dark-500'
                  )}>
                    {format(dia, 'd')}
                  </span>
                  {itens.slice(0, 2).map((f) => (
                    <span key={f.id} className="text-[10px] truncate px-1 py-0.5 rounded bg-gold-50 text-gold-700">
                      {f.cliente?.nome ?? '—'}
                    </span>
                  ))}
                  {itens.length > 2 && (
                    <span className="text-[10px] text-dark-300">+{itens.length - 2}</span>
                  )}
                </button>
              )
            })}
          </div>
        </Card>
      ) : view === 'semana' ? (
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
          {diasDaSemana.map((dia) => {
            const key = format(dia, 'yyyy-MM-dd')
            const itens = porDia.get(key) ?? []
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <button
                  onClick={() => { setDataRef(dia); setView('dia') }}
                  className={cn(
                    'text-xs font-semibold px-2 py-1.5 rounded-lg text-left',
                    isToday(dia) ? 'bg-gold-500 text-white' : 'bg-cream-100 text-dark-600'
                  )}
                >
                  {format(dia, "EEE dd/MM", { locale: ptBR })}
                </button>
                {itens.map((f) => (
                  <div key={f.id} className="text-xs bg-white border border-gold-100 rounded-lg px-2 py-1.5">
                    <p className="font-medium text-dark-700 truncate">{f.cliente?.nome ?? '—'}</p>
                    {f.horario && <p className="text-dark-300">{f.horario.slice(0, 5)}</p>}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      ) : (
        followUpsDoDia.length === 0 ? (
          <Card>
            <EmptyState imageSrc="/images/No data-cuate.svg" title="Nada agendado para este dia" />
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {followUpsDoDia.map((followUp) => (
              <FollowUpCard
                key={followUp.id}
                followUp={followUp}
                atrasado={false}
                processing={processingId === followUp.id}
                onConcluir={() => void handleConcluir(followUp)}
                onReagendar={() => setReagendando(followUp)}
                onCancelar={() => void handleCancelar(followUp)}
                onWhatsApp={() => setWhatsappFollowUp(followUp)}
              />
            ))}
          </div>
        )
      )}

      {reagendando && (
        <ModalAgendarFollowUp
          open={!!reagendando}
          onClose={() => setReagendando(null)}
          onSuccess={carregar}
          clienteId={reagendando.cliente_id}
          clienteNome={reagendando.cliente?.nome}
          followUp={reagendando}
        />
      )}

      {whatsappFollowUp?.cliente && (
        <ModalWhatsApp
          open={!!whatsappFollowUp}
          onClose={() => setWhatsappFollowUp(null)}
          cliente={whatsappFollowUp.cliente}
        />
      )}
    </div>
  )
}
