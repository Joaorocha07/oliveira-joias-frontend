'use client'

import { X, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui'
import {
  formatMoney, formatDate, formatDateTime,
  servicoStatusVariant, SERVICO_STATUS_LABEL, FORMA_PAGAMENTO_LABEL,
} from '@/utils'
import type { ServicoComCliente } from '@/types'

interface DrawerDetalheServicoProps {
  open: boolean
  onClose: () => void
  servico: ServicoComCliente | null
  displayNum?: number
  onEditar: () => void
  onExcluir: () => void
}

export function DrawerDetalheServico({
  open,
  onClose,
  servico,
  displayNum,
  onEditar,
  onExcluir,
}: DrawerDetalheServicoProps) {
  if (!open || !servico) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-dark-800/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gold-100 bg-cream-50/50 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-dark-400 bg-cream-100 border border-gold-100 px-1.5 py-0.5 rounded">
                #{displayNum}
              </span>
              <Badge variant={servicoStatusVariant(servico.status)}>
                {SERVICO_STATUS_LABEL[servico.status]}
              </Badge>
              {servico.pago && (
                <Badge variant="success">Pago</Badge>
              )}
            </div>
            <p className="font-display text-lg font-medium text-dark-700 truncate mt-1">
              {servico.cliente?.nome || <span className="italic text-dark-300">Sem cliente</span>}
            </p>
            <p className="text-xs text-dark-400 mt-0.5">{servico.tipo}</p>
            <p className="text-[11px] text-dark-300 mt-0.5">
              Registrado em {formatDateTime(servico.created_at)}
            </p>
          </div>

          <div className="flex items-center gap-1.5 ml-3 flex-shrink-0">
            <button
              type="button"
              onClick={onEditar}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-dark-600 border border-gold-200 rounded-lg hover:bg-cream-100 transition-colors"
            >
              <Pencil size={12} />
              Editar
            </button>
            <button
              type="button"
              onClick={onExcluir}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <Trash2 size={12} />
              Excluir
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-dark-300 hover:text-dark-600 hover:bg-cream-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Financial summary */}
        <div className="grid grid-cols-2 divide-x divide-gold-100 border-b border-gold-100 flex-shrink-0">
          <div className="px-4 py-3 text-center">
            <p className="text-[10px] text-dark-300 uppercase tracking-wide">Valor</p>
            <p className="font-display text-base font-medium text-dark-700 mt-0.5">{formatMoney(servico.valor)}</p>
          </div>
          <div className="px-4 py-3 text-center">
            <p className="text-[10px] text-dark-300 uppercase tracking-wide">Custo estimado</p>
            <p className="font-display text-base font-medium text-dark-700 mt-0.5">
              {servico.custo_estimado ? formatMoney(servico.custo_estimado) : '—'}
            </p>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {/* Datas */}
          <div>
            <p className="text-xs font-medium text-dark-400 uppercase tracking-wide mb-2">Datas</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-gold-100 bg-cream-50/40 px-3 py-2.5">
                <span className="block text-[10px] text-dark-300 uppercase tracking-wide">Entrada</span>
                <span className="text-sm font-medium text-dark-700">{formatDate(servico.data_entrada)}</span>
              </div>
              <div className="rounded-lg border border-gold-100 bg-cream-50/40 px-3 py-2.5">
                <span className="block text-[10px] text-dark-300 uppercase tracking-wide">Previsão</span>
                <span className="text-sm font-medium text-dark-700">{formatDate(servico.data_previsao)}</span>
              </div>
              {servico.data_conclusao && (
                <div className="rounded-lg border border-gold-100 bg-cream-50/40 px-3 py-2.5">
                  <span className="block text-[10px] text-dark-300 uppercase tracking-wide">Conclusão</span>
                  <span className="text-sm font-medium text-dark-700">{formatDate(servico.data_conclusao)}</span>
                </div>
              )}
              {servico.data_entrega && (
                <div className="rounded-lg border border-gold-100 bg-cream-50/40 px-3 py-2.5">
                  <span className="block text-[10px] text-dark-300 uppercase tracking-wide">Entrega</span>
                  <span className="text-sm font-medium text-dark-700">{formatDate(servico.data_entrega)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Descrição */}
          {servico.descricao && (
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wide mb-2">Descrição</p>
              <div className="rounded-lg border border-gold-100 bg-cream-50/40 px-3 py-2.5">
                <p className="text-sm text-dark-600 whitespace-pre-wrap">{servico.descricao}</p>
              </div>
            </div>
          )}

          {/* Pagamento */}
          {servico.forma_pagamento && (
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wide mb-2">Pagamento</p>
              <div className="rounded-lg border border-gold-100 bg-cream-50/40 px-3 py-2.5">
                <p className="text-sm text-dark-600">{FORMA_PAGAMENTO_LABEL[servico.forma_pagamento]}</p>
              </div>
            </div>
          )}

          {/* Responsável */}
          {servico.responsavel?.nome && (
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wide mb-2">Responsável</p>
              <div className="rounded-lg border border-gold-100 bg-cream-50/40 px-3 py-2.5">
                <p className="text-sm text-dark-600">{servico.responsavel.nome}</p>
              </div>
            </div>
          )}

          {/* Observações internas */}
          {servico.observacoes_internas && (
            <div>
              <p className="text-xs font-medium text-dark-400 uppercase tracking-wide mb-2">Observações internas</p>
              <div className="rounded-lg border border-gold-100 bg-cream-50/40 px-3 py-2.5">
                <p className="text-sm text-dark-600 whitespace-pre-wrap">{servico.observacoes_internas}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
