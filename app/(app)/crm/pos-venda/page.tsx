'use client'

import { useEffect, useMemo, useState } from 'react'
import { differenceInCalendarDays, parseISO, subDays, setYear } from 'date-fns'
import { Heart, Gift, Sparkles, PartyPopper, MessageCircle } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { useAlert } from '@/hooks/use-alert'
import { supabase } from '@/lib/supabase'
import { PageHeader, Card, CardHeader, Button, Spinner, EmptyState, Badge } from '@/components/ui'
import { ModalWhatsApp } from '@/components/modals/modal-whatsapp'
import { formatDate, today } from '@/utils'
import type { Cliente } from '@/types'

interface VendaComCliente {
  id: string
  data_venda: string
  cliente_id: string | null
  cliente: Pick<Cliente, 'id' | 'nome' | 'telefone' | 'produto_interesse' | 'ativo'> | null
}

interface Marco {
  dias: number
  label: string
  acao: string
}

const MARCOS: Marco[] = [
  { dias: 7, label: '7 dias', acao: 'Perguntar se o cliente gostou' },
  { dias: 30, label: '30 dias', acao: 'Solicitar avaliação' },
  { dias: 180, label: '6 meses', acao: 'Oferecer limpeza ou polimento' },
  { dias: 365, label: '1 ano', acao: 'Oferecer manutenção' },
]
const JANELA_DIAS = 3

interface AlertaPosVenda {
  chave: string
  cliente: NonNullable<VendaComCliente['cliente']>
  marco: Marco
  dataVenda: string
}

interface DataComemorativa {
  chave: string
  cliente: Pick<Cliente, 'id' | 'nome' | 'telefone'>
  tipo: 'Aniversário' | 'Noivado' | 'Casamento'
  data: string
  proximaOcorrencia: Date
}

const TIPO_ICON = { 'Aniversário': Gift, 'Noivado': Sparkles, 'Casamento': Heart } as const

function proximaOcorrenciaDe(dataStr: string): Date {
  const original = parseISO(dataStr)
  const agora = new Date()
  let proxima = setYear(original, agora.getFullYear())
  if (differenceInCalendarDays(proxima, agora) < 0) proxima = setYear(original, agora.getFullYear() + 1)
  return proxima
}

export default function PosVendaPage() {
  const { profile } = useAuth()
  const alert = useAlert()
  const [loading, setLoading] = useState(true)
  const [alertasPosVenda, setAlertasPosVenda] = useState<AlertaPosVenda[]>([])
  const [datasComemorativas, setDatasComemorativas] = useState<DataComemorativa[]>([])
  const [whatsappCliente, setWhatsappCliente] = useState<Pick<Cliente, 'id' | 'nome' | 'telefone' | 'produto_interesse'> | null>(null)

  const escopoVendedor = profile?.role === 'vendedor' ? profile.id : undefined

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void carregar(), 0)
    return () => window.clearTimeout(timeoutId)

    async function carregar() {
      setLoading(true)
      const limiteAntigo = subDays(new Date(), 370)

      let vendasQuery = supabase
        .from('vendas')
        .select('id, data_venda, cliente_id, vendedor_id, cliente:clientes(id, nome, telefone, produto_interesse, ativo)')
        .neq('status', 'cancelado')
        .not('cliente_id', 'is', null)
        .gte('data_venda', limiteAntigo.toISOString().slice(0, 10))
        .lte('data_venda', today())
      if (escopoVendedor) vendasQuery = vendasQuery.eq('vendedor_id', escopoVendedor)

      let clientesQuery = supabase
        .from('clientes')
        .select('id, nome, telefone, vendedor_id, data_nascimento, data_casamento, data_noivado')
        .eq('ativo', true)
      if (escopoVendedor) clientesQuery = clientesQuery.or(`vendedor_id.eq.${escopoVendedor},vendedor_id.is.null`)

      const [vendasRes, clientesRes] = await Promise.all([vendasQuery, clientesQuery])

      if (vendasRes.error || clientesRes.error) alert.error('Erro', 'Erro ao carregar dados de pós-venda.')

      const vendasRows = (vendasRes.data ?? []) as unknown as VendaComCliente[]
      const hoje = new Date()
      const alertas: AlertaPosVenda[] = []
      vendasRows.forEach((venda) => {
        if (!venda.cliente || !venda.cliente.ativo) return
        const dias = differenceInCalendarDays(hoje, parseISO(venda.data_venda))
        const marco = MARCOS.find((m) => dias >= m.dias && dias < m.dias + JANELA_DIAS)
        if (!marco) return
        alertas.push({ chave: `${venda.id}-${marco.dias}`, cliente: venda.cliente, marco, dataVenda: venda.data_venda })
      })
      setAlertasPosVenda(alertas)

      const clientesRows = (clientesRes.data ?? []) as unknown as (Pick<Cliente, 'id' | 'nome' | 'telefone'> & {
        data_nascimento: string | null; data_casamento: string | null; data_noivado: string | null
      })[]
      const datas: DataComemorativa[] = []
      clientesRows.forEach((c) => {
        const candidatos: [string | null, DataComemorativa['tipo']][] = [
          [c.data_nascimento, 'Aniversário'], [c.data_noivado, 'Noivado'], [c.data_casamento, 'Casamento'],
        ]
        candidatos.forEach(([data, tipo]) => {
          if (!data) return
          const proxima = proximaOcorrenciaDe(data)
          const diasAte = differenceInCalendarDays(proxima, hoje)
          if (diasAte >= 0 && diasAte <= 14) {
            datas.push({ chave: `${c.id}-${tipo}`, cliente: c, tipo, data, proximaOcorrencia: proxima })
          }
        })
      })
      datas.sort((a, b) => a.proximaOcorrencia.getTime() - b.proximaOcorrencia.getTime())
      setDatasComemorativas(datas)

      setLoading(false)
    }
  }, [escopoVendedor])

  const alertasPorMarco = useMemo(() => {
    return MARCOS.map((marco) => ({
      marco,
      itens: alertasPosVenda.filter((a) => a.marco.dias === marco.dias),
    })).filter((g) => g.itens.length > 0)
  }, [alertasPosVenda])

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM · Pós-venda"
        subtitle="Detecção automática de contatos de pós-venda e datas comemorativas — envio continua manual (1 clique)"
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={24} /></div>
      ) : (
        <>
          <Card>
            <CardHeader title="Lembretes de Pós-venda" subtitle="7 dias, 30 dias, 6 meses e 1 ano após a compra" />
            {alertasPorMarco.length === 0 ? (
              <EmptyState imageSrc="/images/No data-cuate.svg" title="Nenhum lembrete de pós-venda no momento" />
            ) : (
              <div className="space-y-4">
                {alertasPorMarco.map(({ marco, itens }) => (
                  <div key={marco.dias}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-dark-400 mb-2">
                      {marco.label} · {marco.acao}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                      {itens.map((a) => (
                        <div key={a.chave} className="flex items-center justify-between gap-2 rounded-lg border border-gold-100 px-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-dark-700 truncate">{a.cliente.nome}</p>
                            <p className="text-xs text-dark-300">Comprou em {formatDate(a.dataVenda)}</p>
                          </div>
                          {a.cliente.telefone && (
                            <Button
                              variant="secondary" size="sm" leftIcon={<MessageCircle size={12} />}
                              onClick={() => setWhatsappCliente(a.cliente)}
                            >
                              Enviar
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Datas Comemorativas" subtitle="Aniversário, noivado e casamento nos próximos 14 dias" />
            {datasComemorativas.length === 0 ? (
              <EmptyState imageSrc="/images/No data-cuate.svg" title="Nenhuma data comemorativa próxima" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {datasComemorativas.map((d) => {
                  const Icon = TIPO_ICON[d.tipo]
                  const diasAte = differenceInCalendarDays(d.proximaOcorrencia, new Date())
                  return (
                    <div key={d.chave} className="flex items-center justify-between gap-2 rounded-lg border border-gold-100 px-3 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon size={16} className="text-gold-500 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-dark-700 truncate">{d.cliente.nome}</p>
                          <p className="text-xs text-dark-300 flex items-center gap-1.5">
                            {d.tipo}
                            <Badge variant={diasAte === 0 ? 'gold' : 'gray'} className="!px-1.5 !py-0 !text-[10px]">
                              {diasAte === 0 ? 'Hoje!' : `em ${diasAte}d`}
                            </Badge>
                          </p>
                        </div>
                      </div>
                      {d.cliente.telefone && (
                        <Button
                          variant="secondary" size="sm" leftIcon={<PartyPopper size={12} />}
                          onClick={() => setWhatsappCliente({ ...d.cliente, produto_interesse: null })}
                        >
                          Enviar
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {whatsappCliente && (
        <ModalWhatsApp
          open={!!whatsappCliente}
          onClose={() => setWhatsappCliente(null)}
          cliente={whatsappCliente}
        />
      )}
    </div>
  )
}
