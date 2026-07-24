'use client'

import { X, Printer } from 'lucide-react'
import { Button } from '@/components/ui'
import { formatMoney, formatDate } from '@/utils'
import type { Orcamento, OrcamentoConfiguracao } from '@/types'

interface OrcamentoPreviewModalProps {
  open: boolean
  onClose: () => void
  orcamento: Orcamento | null
  configuracao: OrcamentoConfiguracao
}

export function OrcamentoPreviewModal({ open, onClose, orcamento, configuracao }: OrcamentoPreviewModalProps) {
  if (!open || !orcamento) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          body * { visibility: hidden; }
          #orcamento-print-area, #orcamento-print-area * { visibility: visible; }
          #orcamento-print-area {
            position: fixed;
            inset: 0;
            width: 100%;
            height: auto;
            margin: 0;
            padding: 0;
          }
        }
      `}</style>
      <div
        className="absolute inset-0 bg-[rgba(26,21,16,0.55)] backdrop-blur-[6px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-2xl bg-white rounded-2xl flex flex-col max-h-[90vh] border border-[rgba(232,213,163,0.3)] shadow-[0_20px_60px_rgba(26,21,16,0.15)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gold-100 flex-shrink-0">
          <h3 className="font-display text-lg font-semibold text-dark-500">Orçamento #{orcamento.numero}</h3>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" leftIcon={<Printer size={14} />} onClick={() => window.print()}>
              Imprimir
            </Button>
            <button
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-lg text-dark-300 hover:text-dark-500 hover:bg-gold-50 transition-all duration-200"
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          <div id="orcamento-print-area" className="p-8 print:p-0 flex flex-col print:min-h-[269mm]">
            <header
              className="flex flex-col items-center text-center pb-5 mb-5 border-b-2 print:pb-8 print:mb-10"
              style={{ borderColor: configuracao.cor_principal }}
            >
              <h1
                className="font-display text-2xl font-semibold print:text-4xl"
                style={{ color: configuracao.cor_principal }}
              >
                {configuracao.nome_empresa}
              </h1>
              {configuracao.endereco && <p className="text-xs text-dark-400 mt-1 print:text-sm">{configuracao.endereco}</p>}
              {(configuracao.contato || configuracao.whatsapp || configuracao.instagram) && (
                <p className="text-xs text-dark-400 mt-0.5 print:text-sm">
                  {[configuracao.contato, configuracao.whatsapp, configuracao.instagram].filter(Boolean).join(' · ')}
                </p>
              )}
            </header>

            <div className="flex justify-between items-start mb-5 text-sm print:mb-10 print:text-base">
              <div>
                <p className="text-xs text-dark-300 uppercase tracking-wide print:text-sm">Cliente</p>
                <p className="font-medium text-dark-700 print:text-lg">{orcamento.cliente_nome || '—'}</p>
                {orcamento.cliente_telefone && (
                  <p className="text-dark-500 text-xs mt-0.5 print:text-sm">{orcamento.cliente_telefone}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-dark-300 uppercase tracking-wide print:text-sm">Orçamento</p>
                <p className="font-medium text-dark-700 print:text-lg">#{orcamento.numero}</p>
                <p className="text-dark-500 text-xs mt-0.5 print:text-sm">{formatDate(orcamento.created_at)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 print:grid-cols-2 print:gap-12 mb-5 print:mb-10">
              <div className="flex flex-col gap-5 print:gap-8">
                <div>
                  <p className="text-xs text-dark-300 uppercase tracking-wide mb-1.5 print:text-sm">Produto</p>
                  <p className="text-sm text-dark-700 font-medium print:text-lg">{orcamento.modelo_nome || '—'}</p>
                  {(orcamento.material || orcamento.largura) && (
                    <p className="text-sm text-dark-500 print:text-base">
                      {[orcamento.material, orcamento.largura].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>

                {orcamento.itens_inclusos.length > 0 && (
                  <div>
                    <p className="text-xs text-dark-300 uppercase tracking-wide mb-1.5 print:text-sm">Itens Inclusos</p>
                    <ul className="text-sm text-dark-600 space-y-1 print:text-base print:space-y-1.5">
                      {orcamento.itens_inclusos.map((item) => (
                        <li key={item} className="flex items-center gap-2">
                          <span style={{ color: configuracao.cor_principal }}>✓</span> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {orcamento.prazo_fabricacao && (
                  <div>
                    <p className="text-xs text-dark-300 uppercase tracking-wide mb-1 print:text-sm">Prazo de Fabricação</p>
                    <p className="text-sm text-dark-700 print:text-base">{orcamento.prazo_fabricacao}</p>
                  </div>
                )}
              </div>

              <div className="rounded-xl p-4 print:p-8 h-fit" style={{ backgroundColor: `${configuracao.cor_principal}14` }}>
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-dark-600 print:text-base">Valor à vista</span>
                  <span className="text-xl font-semibold print:text-3xl" style={{ color: configuracao.cor_principal }}>
                    {formatMoney(orcamento.valor_vista)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline mt-1 text-sm text-dark-500 print:mt-3 print:text-base">
                  <span>ou parcelado</span>
                  <span>
                    {orcamento.num_parcelas}x de {formatMoney(orcamento.valor_parcela)}
                    {orcamento.percentual_acrescimo === 0
                      ? ' sem juros'
                      : ` com acréscimo de ${orcamento.percentual_acrescimo}%`}
                  </span>
                </div>
              </div>
            </div>

            {orcamento.observacoes && (
              <div className="mb-5 print:mb-10">
                <p className="text-xs text-dark-300 uppercase tracking-wide mb-1 print:text-sm">Observações</p>
                <p className="text-sm text-dark-600 whitespace-pre-line print:text-base">{orcamento.observacoes}</p>
              </div>
            )}

            {configuracao.texto_rodape && (
              <footer className="pt-4 border-t border-gold-100 text-center print:pt-8 print:mt-auto">
                <p className="text-xs text-dark-400 whitespace-pre-line leading-relaxed print:text-sm">
                  {configuracao.texto_rodape}
                </p>
              </footer>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
