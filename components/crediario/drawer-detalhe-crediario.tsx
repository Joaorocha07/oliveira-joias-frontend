'use client'

import { useState } from 'react'
import { X, Pencil, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui'
import {
  formatMoney, formatDate,
  FORMA_PAGAMENTO_LABEL, CREDIARIO_STATUS_LABEL, PARCELA_STATUS_LABEL,
  crediarioStatusVariant, parcelaStatusVariant, today, parcelaVencida,
} from '@/utils'
import type { CrediarioComRelacoes, CrediarioParcela, CrediarioStatus, Venda } from '@/types'

export type CrediarioRow = CrediarioComRelacoes & {
  venda?: Pick<Venda, 'numero' | 'data_venda' | 'forma_pagamento'> | null
}

interface DrawerDetalheCrediarioProps {
  open: boolean
  onClose: () => void
  crediario: CrediarioRow | null
  onEditarCrediario: () => void
  onReceberParcela: (parcela: CrediarioParcela) => void
}

type Tab = 'parcelas' | 'venda'

function computeStatus(c: CrediarioRow): CrediarioStatus {
  if (c.status === 'cancelado') return 'cancelado'
  const parcelas = c.parcelas ?? []
  const totalPago = parcelas.filter((p) => p.status === 'pago').reduce((sum, p) => sum + p.valor_pago, 0)
  const saldoAtual = Math.max(0, c.total - c.entrada - totalPago)
  if (saldoAtual <= 0) return 'quitado'
  const atrasada = parcelas.some(
    (p) => p.status !== 'pago' && p.status !== 'cancelado' && parcelaVencida(p.data_vencimento),
  )
  return atrasada ? 'vencido' : 'em_dia'
}

function ParcelaRow({
  parcela,
  onReceber,
}: {
  parcela: CrediarioParcela
  onReceber: () => void
}) {
  const todayStr = today()
  const dvStr = parcela.data_vencimento.slice(0, 10)
  const isVencida = parcela.status !== 'pago' && parcela.status !== 'cancelado' && parcelaVencida(parcela.data_vencimento)
  const isHoje = parcela.status !== 'pago' && dvStr === todayStr
  const isPaga = parcela.status === 'pago'

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border ${isPaga ? 'bg-green-50/50 border-green-100' : isVencida ? 'bg-red-50/50 border-red-100' : 'bg-white border-gold-100'}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${isPaga ? 'bg-green-100 text-green-700' : isVencida ? 'bg-red-100 text-red-700' : 'bg-gold-100 text-gold-700'}`}>
        {isPaga ? <CheckCircle2 size={16} /> : isVencida ? <AlertCircle size={16} /> : <Clock size={16} />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-dark-400">Parcela {String(parcela.numero).padStart(2, '0')}</span>
          <Badge variant={parcelaStatusVariant(parcela.status)} className="text-[10px]">
            {PARCELA_STATUS_LABEL[parcela.status]}
          </Badge>
          {isVencida && (
            <span className="text-[10px] font-medium text-red-600">
              Venceu {formatDate(parcela.data_vencimento)}
            </span>
          )}
          {isHoje && (
            <span className="text-[10px] font-medium text-orange-500">Vence hoje</span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1">
          <span className="font-medium text-dark-700 text-sm">{formatMoney(parcela.valor)}</span>
          {!isVencida && !isPaga && (
            <span className="text-xs text-dark-400">Vence {formatDate(parcela.data_vencimento)}</span>
          )}
        </div>

        {isPaga && (
          <div className="mt-1 text-xs text-dark-400 space-y-px">
            <p>Pago em {formatDate(parcela.data_pagamento)} · {parcela.forma_pagamento ? FORMA_PAGAMENTO_LABEL[parcela.forma_pagamento] : '—'}</p>
            {parcela.valor_pago !== parcela.valor && (
              <p className="text-amber-600">Recebido: {formatMoney(parcela.valor_pago)}</p>
            )}
          </div>
        )}
      </div>

      {isPaga && (
        <button
          type="button"
          onClick={onReceber}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-dark-600 border border-green-200 rounded-lg hover:bg-green-50 transition-colors"
        >
          <Pencil size={12} />
          Editar
        </button>
      )}

      {!isPaga && parcela.status !== 'cancelado' && (
        <button
          type="button"
          onClick={onReceber}
          className="flex-shrink-0 px-3 py-1.5 text-xs font-medium bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-colors"
        >
          Receber
        </button>
      )}
    </div>
  )
}

export function DrawerDetalheCrediario({
  open,
  onClose,
  crediario,
  onEditarCrediario,
  onReceberParcela,
}: DrawerDetalheCrediarioProps) {
  const [tab, setTab] = useState<Tab>('parcelas')

  if (!open || !crediario) return null

  const parcelas = (crediario.parcelas ?? []).sort((a, b) => a.numero - b.numero)
  const parcelasPagas = parcelas.filter((p) => p.status === 'pago')
  const totalPago = parcelasPagas.reduce((sum, p) => sum + p.valor_pago, 0)
  const saldoAtual = Math.max(0, crediario.total - crediario.entrada - totalPago)
  const progressoPct = parcelas.length > 0 ? Math.round((parcelasPagas.length / parcelas.length) * 100) : 0
  const computedStatus = computeStatus(crediario)
  const hasPayments = parcelasPagas.length > 0
  const parcelasAtrasadas = parcelas.filter(
    (p) => p.status !== 'pago' && p.status !== 'cancelado' && parcelaVencida(p.data_vencimento),
  )
  const pendentes = parcelas.filter((p) => p.status !== 'pago' && p.status !== 'cancelado')
  const totalPendente = pendentes.reduce((sum, p) => sum + p.valor, 0)

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-dark-800/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gold-100 bg-cream-50/50 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-medium text-dark-700 truncate">
              {crediario.cliente?.nome || <span className="italic text-dark-300">Sem cliente</span>}
            </p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant={crediarioStatusVariant(computedStatus)}>
                {CREDIARIO_STATUS_LABEL[computedStatus]}
              </Badge>
              {crediario.venda?.numero && (
                <span className="text-xs text-dark-400 font-mono">Venda #{crediario.venda.numero}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-3 flex-shrink-0">
            {!hasPayments && (
              <button
                type="button"
                onClick={onEditarCrediario}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-dark-600 border border-gold-200 rounded-lg hover:bg-cream-100 transition-colors"
              >
                <Pencil size={12} />
                Editar
              </button>
            )}
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-dark-300 hover:text-dark-600 hover:bg-cream-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-3 divide-x divide-gold-100 border-b border-gold-100 flex-shrink-0">
          {[
            { label: 'Total', value: crediario.total },
            { label: 'Entrada', value: crediario.entrada },
            { label: 'Saldo', value: saldoAtual },
          ].map(({ label, value }) => (
            <div key={label} className="px-4 py-3 text-center">
              <p className="text-[10px] text-dark-300 uppercase tracking-wide">{label}</p>
              <p className="font-display text-base font-medium text-dark-700 mt-0.5">{formatMoney(value)}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gold-100 flex-shrink-0">
          {(['parcelas', 'venda'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                tab === t
                  ? 'text-gold-700 border-b-2 border-gold-500'
                  : 'text-dark-400 hover:text-dark-600'
              }`}
            >
              {t === 'parcelas' ? `Parcelas (${parcelas.length})` : 'Dados da Venda'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {tab === 'parcelas' && (
            <div className="flex flex-col gap-4">
              {/* Progress */}
              <div>
                <div className="flex justify-between text-xs text-dark-400 mb-1.5">
                  <span>{parcelasPagas.length} de {parcelas.length} parcelas pagas ({progressoPct}%)</span>
                  {parcelasAtrasadas.length > 0 && (
                    <span className="text-red-500 font-medium">{parcelasAtrasadas.length} atrasada{parcelasAtrasadas.length !== 1 ? 's' : ''}</span>
                  )}
                </div>
                <div className="w-full bg-gold-100 rounded-full h-2">
                  <div
                    className="bg-gold-500 h-2 rounded-full transition-all"
                    style={{ width: `${progressoPct}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-green-50 rounded-lg border border-green-100">
                  <p className="text-[10px] text-green-600 uppercase tracking-wide">Total pago</p>
                  <p className="font-medium text-green-700 text-sm mt-0.5">{formatMoney(totalPago)}</p>
                </div>
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100">
                  <p className="text-[10px] text-amber-600 uppercase tracking-wide">Total pendente</p>
                  <p className="font-medium text-amber-700 text-sm mt-0.5">{formatMoney(totalPendente)}</p>
                </div>
              </div>

              {/* Parcelas list */}
              <div className="flex flex-col gap-2">
                {parcelas.map((p) => (
                  <ParcelaRow
                    key={p.id}
                    parcela={p}
                    onReceber={() => onReceberParcela(p)}
                  />
                ))}
                {parcelas.length === 0 && (
                  <p className="text-sm text-dark-300 text-center py-6">Nenhuma parcela cadastrada.</p>
                )}
              </div>
            </div>
          )}

          {tab === 'venda' && (
            <div className="flex flex-col gap-3">
              <div className="p-4 bg-cream-50 rounded-xl border border-gold-100 flex flex-col gap-3">
                {crediario.venda ? (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-dark-400">Número da venda</span>
                      <span className="font-mono text-dark-700 font-medium">#{crediario.venda.numero}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-dark-400">Data</span>
                      <span className="text-dark-700 text-sm">{formatDate(crediario.venda.data_venda)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-dark-400">Forma de pagamento</span>
                      <span className="text-dark-700 text-sm">{FORMA_PAGAMENTO_LABEL[crediario.venda.forma_pagamento]}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-dark-300 text-center py-3">Dados da venda não disponíveis.</p>
                )}
              </div>

              <div className="p-4 bg-cream-50 rounded-xl border border-gold-100 flex flex-col gap-2">
                <p className="text-xs text-dark-400 uppercase tracking-wide">Resumo financeiro</p>
                <div className="flex justify-between text-sm">
                  <span className="text-dark-500">Total financiado</span>
                  <span className="font-medium text-dark-700">{formatMoney(crediario.total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-dark-500">Entrada</span>
                  <span className="text-dark-700">{formatMoney(crediario.entrada)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-dark-500">{crediario.num_parcelas}× de</span>
                  <span className="text-dark-700">{formatMoney(crediario.valor_parcela)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-gold-100 pt-2 mt-1">
                  <span className="font-medium text-dark-600">Saldo atual</span>
                  <span className="font-display font-medium text-dark-700">{formatMoney(saldoAtual)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
