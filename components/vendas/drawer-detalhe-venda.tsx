'use client'

import { X, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui'
import { formatMoney, formatDate, vendaStatusVariant, VENDA_STATUS_LABEL, FORMA_PAGAMENTO_LABEL } from '@/utils'
import type { VendaRow } from '@/app/(app)/vendas/page'

interface DrawerDetalheVendaProps {
  open: boolean
  onClose: () => void
  venda: VendaRow | null
  displayNum?: number
  onEditar: () => void
  onExcluir: () => void
}

export function DrawerDetalheVenda({
  open,
  onClose,
  venda,
  displayNum,
  onEditar,
  onExcluir,
}: DrawerDetalheVendaProps) {
  if (!open || !venda) return null

  const itens = venda.itens ?? []
  const totalItens = itens.reduce((s, i) => s + i.quantidade, 0)

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
              <Badge variant={vendaStatusVariant(venda.status)}>
                {VENDA_STATUS_LABEL[venda.status]}
              </Badge>
            </div>
            <p className="font-display text-lg font-medium text-dark-700 truncate mt-1">
              {venda.cliente?.nome || <span className="italic text-dark-300">Sem cliente</span>}
            </p>
            <p className="text-xs text-dark-400 mt-0.5">
              {formatDate(venda.data_venda)} · {FORMA_PAGAMENTO_LABEL[venda.forma_pagamento]}
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
        <div className="grid grid-cols-3 divide-x divide-gold-100 border-b border-gold-100 flex-shrink-0">
          {[
            { label: 'Subtotal', value: venda.subtotal },
            { label: 'Desconto', value: venda.desconto },
            { label: 'Total', value: venda.total },
          ].map(({ label, value }) => (
            <div key={label} className="px-4 py-3 text-center">
              <p className="text-[10px] text-dark-300 uppercase tracking-wide">{label}</p>
              <p className={`font-display text-base font-medium mt-0.5 ${label === 'Desconto' && value > 0 ? 'text-red-500' : 'text-dark-700'}`}>
                {label === 'Desconto' && value > 0 ? `−${formatMoney(value)}` : formatMoney(value)}
              </p>
            </div>
          ))}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-medium text-dark-400 uppercase tracking-wide">
              Produtos vendidos
            </h3>
            <span className="text-xs text-dark-400">
              {itens.length} {itens.length === 1 ? 'item' : 'itens'} · {totalItens} {totalItens === 1 ? 'unidade' : 'unidades'}
            </span>
          </div>

          {itens.length === 0 ? (
            <p className="text-sm text-dark-300 text-center py-8">Nenhum produto registrado.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {itens.map((item, idx) => {
                const sub = item.subtotal ?? Math.max(0, item.quantidade * item.preco_unitario - item.desconto)
                const bruto = item.quantidade * item.preco_unitario
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 rounded-xl border border-gold-100 bg-white"
                  >
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gold-100 flex items-center justify-center text-[11px] font-bold text-gold-700">
                      {idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-dark-700 text-sm leading-tight">{item.nome_produto}</p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-dark-300 flex-wrap">
                        {item.produto?.codigo && (
                          <span className="font-mono bg-cream-100 border border-gold-100 rounded px-1.5 py-0.5">
                            {item.produto.codigo}
                          </span>
                        )}
                        {item.variacao && (
                          <span>{item.variacao.nome}: {item.variacao.valor}</span>
                        )}
                        {item.produto?.material && <span>{item.produto.material}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-dark-400 flex-wrap">
                        <span className="font-semibold text-dark-600 text-sm">
                          {item.quantidade}×
                        </span>
                        <span>{formatMoney(item.preco_unitario)} cada</span>
                        {item.desconto > 0 && (
                          <span className="text-red-400">−{formatMoney(item.desconto)}</span>
                        )}
                      </div>
                      {item.descricao && (
                        <p className="text-xs text-dark-300 mt-1 truncate">{item.descricao}</p>
                      )}
                    </div>

                    <div className="flex-shrink-0 text-right">
                      <p className="font-medium text-dark-700 text-sm">{formatMoney(sub)}</p>
                      {item.desconto > 0 && (
                        <p className="text-[10px] text-dark-300 line-through mt-0.5">
                          {formatMoney(bruto)}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {venda.observacoes && (
            <div className="mt-4 p-3 bg-cream-50 rounded-xl border border-gold-100">
              <p className="text-[10px] text-dark-300 uppercase tracking-wide mb-1">Observações</p>
              <p className="text-sm text-dark-600">{venda.observacoes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
