'use client'

import { useEffect, useMemo, useState } from 'react'
import { MessageCircle, ShoppingBag } from 'lucide-react'
import { useAlert } from '@/hooks/use-alert'
import { cn } from '@/lib/cn'
import { PageHeader, Card, Spinner, EmptyState, Badge, SearchInput, Pagination } from '@/components/ui'
import { usePagination } from '@/hooks/use-pagination'
import { ordenarPorRelevancia } from '@/utils/search'
import { formatDateTime, formatMoney, formatPhone } from '@/utils'
import {
  listarPedidosSite, alterarStatusPedidoSite, PEDIDO_STATUS_LABEL,
  type PedidoSite, type PedidoSiteStatus,
} from '@/services/loja-site'

const STATUS: PedidoSiteStatus[] = ['novo', 'em_atendimento', 'concluido', 'cancelado']
const STATUS_VARIANT: Record<PedidoSiteStatus, 'gold' | 'info' | 'success' | 'danger'> = {
  novo: 'gold',
  em_atendimento: 'info',
  concluido: 'success',
  cancelado: 'danger',
}

function linkWhatsApp(telefone: string | null | undefined, pedido: PedidoSite) {
  const digits = (telefone ?? '').replace(/\D/g, '')
  if (!digits) return null
  const numero = digits.startsWith('55') ? digits : `55${digits}`
  const texto = `Olá, ${pedido.cliente?.nome?.split(' ')[0] ?? ''}! Recebemos seu pedido #${pedido.numero} pelo site.`
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}

export default function PedidosSitePage() {
  const alert = useAlert()
  const [pedidos, setPedidos] = useState<PedidoSite[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<PedidoSiteStatus | 'todos'>('novo')
  const [search, setSearch] = useState('')

  async function load() {
    const { data, error } = await listarPedidosSite()
    if (error) alert.error('Erro', 'Erro ao carregar pedidos. Verifique se a migração 014 foi aplicada.')
    else setPedidos(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrados = useMemo(() => {
    const porStatus = filtro === 'todos' ? pedidos : pedidos.filter((p) => p.status === filtro)
    return ordenarPorRelevancia(porStatus, search, (p) => [String(p.numero), p.cliente?.nome, p.cliente?.telefone, p.cupom_codigo])
  }, [pedidos, filtro, search])

  const { paginated, page, setPage, totalPages, total, from, to } = usePagination(filtrados)

  async function mudarStatus(p: PedidoSite, status: PedidoSiteStatus) {
    const { error } = await alterarStatusPedidoSite(p.id, status)
    if (error) { alert.error('Erro', error); return }
    setPedidos((prev) => prev.map((x) => (x.id === p.id ? { ...x, status } : x)))
  }

  return (
    <div>
      <PageHeader title="Pedidos do Site" subtitle="Pedidos feitos pelo carrinho do oliveirajoias.com" />

      <Card padding="none">
        <div className="p-4 border-b border-gold-100 space-y-3">
          <div className="flex gap-2 overflow-x-auto">
            {(['novo', 'em_atendimento', 'concluido', 'cancelado', 'todos'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFiltro(s)}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                  filtro === s ? 'border-gold-400 bg-gold-50 text-gold-600' : 'border-gold-100 text-dark-400 hover:border-gold-200',
                )}
              >
                {s === 'todos' ? 'Todos' : PEDIDO_STATUS_LABEL[s]}
                <span className="ml-1.5 text-[10px] tabular-nums opacity-70">
                  {s === 'todos' ? pedidos.length : pedidos.filter((p) => p.status === s).length}
                </span>
              </button>
            ))}
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por número, cliente ou cupom..." className="w-full" />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={24} /></div>
        ) : filtrados.length === 0 ? (
          <EmptyState imageSrc="/images/Profile Interface-rafiki.svg" title="Nenhum pedido aqui" description="Os pedidos aparecem quando o cliente finaliza o carrinho no site." />
        ) : (
          <>
            <ul className="divide-y divide-gold-50">
              {paginated.map((p) => {
                const wa = linkWhatsApp(p.cliente?.whatsapp || p.cliente?.telefone, p)
                return (
                  <li key={p.id} className="p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <ShoppingBag size={14} className="text-gold-500" />
                          <p className="font-semibold text-dark-700">Pedido #{p.numero}</p>
                          <Badge variant={STATUS_VARIANT[p.status]} className="!px-2 !py-0.5 text-[10px]">{PEDIDO_STATUS_LABEL[p.status]}</Badge>
                        </div>
                        <p className="text-sm text-dark-500 mt-1">
                          {p.cliente?.nome ?? 'Cliente removido'}
                          {p.cliente?.telefone && <span className="text-dark-300"> · {formatPhone(p.cliente.telefone)}</span>}
                        </p>
                        <p className="text-xs text-dark-300">{formatDateTime(p.created_at)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
                          >
                            <MessageCircle size={12} /> WhatsApp
                          </a>
                        )}
                        <select
                          value={p.status}
                          onChange={(e) => void mudarStatus(p, e.target.value as PedidoSiteStatus)}
                          className="input-base !py-1.5 !text-xs cursor-pointer"
                          aria-label={`Status do pedido #${p.numero}`}
                        >
                          {STATUS.map((s) => <option key={s} value={s}>{PEDIDO_STATUS_LABEL[s]}</option>)}
                        </select>
                      </div>
                    </div>

                    <ul className="mt-3 space-y-1 text-sm text-dark-500">
                      {p.itens.map((i, idx) => (
                        <li key={idx} className="flex justify-between gap-4">
                          <span>
                            {i.quantidade}× {i.nome}
                            {i.observacao && <span className="text-dark-300"> — {i.observacao}</span>}
                          </span>
                          <span className="tabular-nums text-dark-400">{formatMoney(Number(i.subtotal))}</span>
                        </li>
                      ))}
                    </ul>
                    {p.observacoes && <p className="mt-2 text-xs text-dark-400 italic">Obs.: {p.observacoes}</p>}
                    <div className="mt-3 flex flex-wrap justify-end gap-x-4 text-sm">
                      {p.cupom_codigo && (
                        <span className="text-emerald-700">Cupom {p.cupom_codigo}: −{formatMoney(Number(p.desconto))}</span>
                      )}
                      <span className="font-semibold text-dark-700">Total {formatMoney(Number(p.total))}</span>
                    </div>
                    {p.cupom_codigo && p.status !== 'cancelado' && (
                      <p className="mt-1 text-right text-[11px] text-dark-300">
                        Ao lançar a venda, selecione o cupom {p.cupom_codigo} em Nova Venda para marcá-lo como usado.
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} from={from} to={to} total={total} />
          </>
        )}
      </Card>
    </div>
  )
}
