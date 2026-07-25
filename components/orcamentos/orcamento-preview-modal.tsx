'use client'

import { useState } from 'react'
import { X, Printer, Download } from 'lucide-react'
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
  const [baixando, setBaixando] = useState(false)

  if (!open || !orcamento) return null

  async function handleDownload() {
    if (!orcamento) return
    const element = document.getElementById('orcamento-print-area')
    if (!element) return

    setBaixando(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])

      const canvas = await html2canvas(element, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
      })

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const imgWidth = pageWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const imgData = canvas.toDataURL('image/png')

      let heightLeft = imgHeight
      let position = 0
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight

      while (heightLeft > 0) {
        position = heightLeft - imgHeight
        pdf.addPage()
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
        heightLeft -= pageHeight
      }

      pdf.save(`orcamento-${orcamento.numero}.pdf`)
    } finally {
      setBaixando(false)
    }
  }

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

      <div className="relative w-full max-w-3xl bg-white rounded-2xl flex flex-col max-h-[90vh] border border-[rgba(232,213,163,0.3)] shadow-[0_20px_60px_rgba(26,21,16,0.15)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gold-100 flex-shrink-0">
          <h3 className="font-display text-lg font-semibold text-dark-500">Orçamento #{orcamento.numero}</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download size={14} />}
              loading={baixando}
              onClick={handleDownload}
            >
              Baixar PDF
            </Button>
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
          <div id="orcamento-print-area" className="p-10 flex flex-col bg-white">
            <header
              className="flex flex-col items-center text-center pb-6 mb-8 border-b-2"
              style={{ borderColor: configuracao.cor_principal }}
            >
              <h1 className="font-display text-3xl font-semibold" style={{ color: configuracao.cor_principal }}>
                {configuracao.nome_empresa}
              </h1>
              {configuracao.endereco && <p className="text-sm text-dark-400 mt-1">{configuracao.endereco}</p>}
              {(configuracao.contato || configuracao.whatsapp || configuracao.instagram) && (
                <p className="text-sm text-dark-400 mt-0.5">
                  {[configuracao.contato, configuracao.whatsapp, configuracao.instagram].filter(Boolean).join(' · ')}
                </p>
              )}
            </header>

            <div className="flex justify-between items-start mb-8 text-base">
              <div>
                <p className="text-sm text-dark-300 uppercase tracking-wide">Cliente</p>
                <p className="font-medium text-dark-700 text-lg">{orcamento.cliente_nome || '—'}</p>
                {orcamento.cliente_telefone && (
                  <p className="text-dark-500 text-sm mt-0.5">{orcamento.cliente_telefone}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-dark-300 uppercase tracking-wide">Orçamento</p>
                <p className="font-medium text-dark-700 text-lg">#{orcamento.numero}</p>
                <p className="text-dark-500 text-sm mt-0.5">{formatDate(orcamento.created_at)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-12 mb-8">
              <div className="flex flex-col gap-8">
                <div>
                  <p className="text-sm text-dark-300 uppercase tracking-wide mb-1.5">Produto</p>
                  <p className="text-lg text-dark-700 font-medium">{orcamento.modelo_nome || '—'}</p>
                  {(orcamento.material || orcamento.largura) && (
                    <p className="text-base text-dark-500">
                      {[orcamento.material, orcamento.largura].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>

                {orcamento.itens_inclusos.length > 0 && (
                  <div>
                    <p className="text-sm text-dark-300 uppercase tracking-wide mb-1.5">Itens Inclusos</p>
                    <ul className="text-base text-dark-600 space-y-1.5">
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
                    <p className="text-sm text-dark-300 uppercase tracking-wide mb-1">Prazo de Fabricação</p>
                    <p className="text-base text-dark-700">{orcamento.prazo_fabricacao}</p>
                  </div>
                )}
              </div>

              <div className="rounded-xl p-8 h-fit" style={{ backgroundColor: `${configuracao.cor_principal}14` }}>
                <div className="flex justify-between items-baseline">
                  <span className="text-base text-dark-600">Valor à vista</span>
                  <span className="text-3xl font-semibold" style={{ color: configuracao.cor_principal }}>
                    {formatMoney(orcamento.valor_vista)}
                  </span>
                </div>
                <div className="flex justify-between items-baseline mt-3 text-base text-dark-500">
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
              <div className="mb-8">
                <p className="text-sm text-dark-300 uppercase tracking-wide mb-1">Observações</p>
                <p className="text-base text-dark-600 whitespace-pre-line">{orcamento.observacoes}</p>
              </div>
            )}

            {configuracao.texto_rodape && (
              <footer className="pt-6 border-t border-gold-100 text-center mt-auto">
                <p className="text-sm text-dark-400 whitespace-pre-line leading-relaxed">
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
