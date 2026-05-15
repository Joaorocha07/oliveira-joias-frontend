'use client'

import { AlertTriangle, Package, ShoppingCart, CreditCard, Trash2 } from 'lucide-react'
import { Button, Spinner } from '@/components/ui'
import { formatMoney } from '@/utils'
import type { DeleteVendaPreview } from '@/services/vendas'

interface Props {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  loading: boolean
  loadingPreview: boolean
  displayNum?: number
  preview: DeleteVendaPreview | null
}

export function ModalConfirmarExclusaoVenda({
  open,
  onClose,
  onConfirm,
  loading,
  loadingPreview,
  displayNum,
  preview,
}: Props) {
  if (!open) return null

  const temParcelasPagas = (preview?.crediario?.parcelasPagas ?? 0) > 0
  const temEstoque = (preview?.itens ?? []).some((i) => i.variacao_id)
  const temCrediario = !!preview?.crediario

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-[rgba(26,21,16,0.55)] backdrop-blur-[6px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-md bg-white rounded-2xl flex flex-col max-h-[90vh] border border-[rgba(232,213,163,0.3)] shadow-[0_20px_60px_rgba(26,21,16,0.15)]">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gold-100">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 flex-shrink-0">
            <Trash2 size={18} className="text-red-500" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-dark-700">Excluir Venda</h3>
            {displayNum !== undefined && (
              <p className="text-sm text-dark-400">Venda #{displayNum}</p>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {loadingPreview ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Spinner size={24} />
              <p className="text-sm text-dark-400">Carregando detalhes...</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-dark-500">
                As seguintes ações serão executadas e{' '}
                <span className="font-semibold text-dark-700">não poderão ser desfeitas</span>:
              </p>

              {/* Venda */}
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
                <ShoppingCart size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-700">Venda excluída</p>
                  <p className="text-xs text-red-400 mt-0.5">
                    Registro da Venda #{displayNum} removido permanentemente
                  </p>
                </div>
              </div>

              {/* Estoque */}
              {temEstoque && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
                  <Package size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-blue-700">Produtos retornam ao estoque</p>
                    <ul className="mt-1.5 space-y-0.5">
                      {(preview?.itens ?? [])
                        .filter((i) => i.variacao_id)
                        .map((item, idx) => (
                          <li key={idx} className="text-xs text-blue-600 truncate">
                            +{item.quantidade} × {item.nome_produto}
                          </li>
                        ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Crediário */}
              {temCrediario && (
                <div
                  className={`flex items-start gap-3 p-3 rounded-xl border ${
                    temParcelasPagas
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-orange-50 border-orange-100'
                  }`}
                >
                  <CreditCard
                    size={15}
                    className={`mt-0.5 flex-shrink-0 ${temParcelasPagas ? 'text-amber-500' : 'text-orange-400'}`}
                  />
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        temParcelasPagas ? 'text-amber-700' : 'text-orange-700'
                      }`}
                    >
                      Crediário excluído ({formatMoney(preview!.crediario!.total)})
                    </p>
                    <p
                      className={`text-xs mt-0.5 ${
                        temParcelasPagas ? 'text-amber-600' : 'text-orange-400'
                      }`}
                    >
                      {preview!.crediario!.parcelasTotal} parcela
                      {preview!.crediario!.parcelasTotal !== 1 ? 's' : ''} ·{' '}
                      {preview!.crediario!.parcelasPagas} paga
                      {preview!.crediario!.parcelasPagas !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              )}

              {/* Aviso parcelas pagas */}
              {temParcelasPagas && (
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <AlertTriangle size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    <span className="font-semibold">Atenção:</span> Esta venda possui{' '}
                    {preview!.crediario!.parcelasPagas} parcela
                    {preview!.crediario!.parcelasPagas !== 1 ? 's' : ''} já paga
                    {preview!.crediario!.parcelasPagas !== 1 ? 's' : ''}. Todo o crediário será
                    permanentemente removido ao confirmar.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-gold-100 flex items-center justify-end gap-3 flex-shrink-0">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            loading={loading}
            disabled={loadingPreview || loading}
          >
            Confirmar Exclusão
          </Button>
        </div>
      </div>
    </div>
  )
}
