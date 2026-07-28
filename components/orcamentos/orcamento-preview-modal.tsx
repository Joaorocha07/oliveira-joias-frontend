'use client'

import { useState } from 'react'
import { addDays } from 'date-fns'
import {
  X, Printer, Download, Gem, CheckCircle2, Clock, Ruler,
  Phone, MapPin, AtSign, ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui'
import { formatMoney, formatDate } from '@/utils'
import type { Orcamento, OrcamentoConfiguracao } from '@/types'

const VALIDADE_DIAS = 7

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

  const cor = configuracao.cor_principal
  const validoAte = formatDate(addDays(new Date(orcamento.created_at), VALIDADE_DIAS))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body * { visibility: hidden; }
          #orcamento-print-area, #orcamento-print-area * { visibility: visible; }
          #orcamento-print-area {
            position: fixed;
            inset: 0;
            width: 100%;
            height: auto;
            margin: 0;
          }
        }
      `}</style>
      <div
        className="absolute inset-0 bg-[rgba(26,21,16,0.55)] backdrop-blur-[8px]"
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
          <div id="orcamento-print-area" className="flex flex-col bg-white">

            {/* ── Cabeçalho de marca ─────────────────────────────────────── */}
            <header
              className="relative overflow-hidden px-10 py-8"
              style={{ background: 'linear-gradient(135deg, #1A1510 0%, #2D2418 100%)' }}
            >
              <div
                className="absolute inset-0 opacity-[0.10] pointer-events-none"
                style={{ backgroundImage: `radial-gradient(circle at 88% 12%, ${cor} 0%, transparent 55%)` }}
              />
              <div className="relative flex items-start justify-between gap-6">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div
                    className="w-12 h-12 rounded-full border flex items-center justify-center flex-shrink-0"
                    style={{ borderColor: `${cor}55`, backgroundColor: `${cor}1A` }}
                  >
                    <Gem size={20} style={{ color: cor }} />
                  </div>
                  <div className="min-w-0">
                    <h1 className="font-display text-2xl font-semibold text-white leading-tight truncate">
                      {configuracao.nome_empresa}
                    </h1>
                    <div className="flex flex-col gap-0.5 mt-1.5">
                      {configuracao.endereco && (
                        <p className="flex items-center gap-1.5 text-[11px] text-white/55">
                          <MapPin size={10} className="flex-shrink-0" /> {configuracao.endereco}
                        </p>
                      )}
                      {(configuracao.contato || configuracao.whatsapp) && (
                        <p className="flex items-center gap-1.5 text-[11px] text-white/55">
                          <Phone size={10} className="flex-shrink-0" /> {configuracao.contato || configuracao.whatsapp}
                        </p>
                      )}
                      {configuracao.instagram && (
                        <p className="flex items-center gap-1.5 text-[11px] text-white/55">
                          <AtSign size={10} className="flex-shrink-0" /> {configuracao.instagram}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-[10px] uppercase tracking-[2.5px] font-semibold" style={{ color: cor }}>
                    Orçamento
                  </p>
                  <p className="font-display text-3xl font-semibold text-white leading-tight mt-0.5">
                    Nº {orcamento.numero}
                  </p>
                  <p className="text-[11px] text-white/50 mt-1">{formatDate(orcamento.created_at)}</p>
                </div>
              </div>
            </header>

            {/* ── Corpo ────────────────────────────────────────────────── */}
            <div className="p-10 flex flex-col flex-1">

              <div className="flex items-center justify-between gap-4 mb-8 pb-6 border-b border-gold-100">
                <div>
                  <p className="text-[11px] text-dark-300 uppercase tracking-[1.5px] font-semibold mb-1">Preparado para</p>
                  <p className="font-display text-xl font-semibold text-dark-700">{orcamento.cliente_nome || 'Cliente'}</p>
                  {orcamento.cliente_telefone && (
                    <p className="flex items-center gap-1.5 text-sm text-dark-400 mt-0.5">
                      <Phone size={11} /> {orcamento.cliente_telefone}
                    </p>
                  )}
                </div>
                <div
                  className="flex items-center gap-2 rounded-full border px-3.5 py-2 flex-shrink-0"
                  style={{ borderColor: `${cor}40`, backgroundColor: `${cor}0D` }}
                >
                  <ShieldCheck size={14} style={{ color: cor }} />
                  <span className="text-xs font-medium text-dark-600">Válido até {validoAte}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-10 mb-8">
                {/* Detalhes do produto */}
                <div className="flex flex-col gap-6">
                  <div>
                    <p className="text-[11px] text-dark-300 uppercase tracking-[1.5px] font-semibold mb-2">Peça</p>
                    <p className="font-display text-lg text-dark-700 font-medium leading-snug">
                      {orcamento.modelo_nome || '—'}
                    </p>
                    {(orcamento.material || orcamento.largura) && (
                      <p className="flex items-center gap-1.5 text-sm text-dark-500 mt-1">
                        <Ruler size={12} className="flex-shrink-0" style={{ color: cor }} />
                        {[orcamento.material, orcamento.largura].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>

                  {orcamento.itens_inclusos.length > 0 && (
                    <div>
                      <p className="text-[11px] text-dark-300 uppercase tracking-[1.5px] font-semibold mb-2">Itens Inclusos</p>
                      <ul className="flex flex-col gap-1.5">
                        {orcamento.itens_inclusos.map((item) => (
                          <li key={item} className="flex items-center gap-2 text-sm text-dark-600">
                            <CheckCircle2 size={14} className="flex-shrink-0" style={{ color: cor }} />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {orcamento.prazo_fabricacao && (
                    <div>
                      <p className="text-[11px] text-dark-300 uppercase tracking-[1.5px] font-semibold mb-2">Prazo de Fabricação</p>
                      <p className="flex items-center gap-1.5 text-sm text-dark-700">
                        <Clock size={12} style={{ color: cor }} /> {orcamento.prazo_fabricacao}
                      </p>
                    </div>
                  )}
                </div>

                {/* Investimento */}
                <div
                  className="rounded-2xl p-7 h-fit border"
                  style={{ backgroundColor: `${cor}0D`, borderColor: `${cor}30` }}
                >
                  <p className="text-[11px] uppercase tracking-[1.5px] font-semibold mb-4" style={{ color: cor }}>
                    Investimento
                  </p>
                  <p className="text-xs text-dark-400 mb-1">À vista</p>
                  <p className="font-display text-4xl font-bold leading-none" style={{ color: cor }}>
                    {formatMoney(orcamento.valor_vista)}
                  </p>

                  <div className="flex items-center gap-3 my-4">
                    <div className="h-px flex-1" style={{ backgroundColor: `${cor}30` }} />
                    <span className="text-[11px] text-dark-300 uppercase tracking-wide">ou</span>
                    <div className="h-px flex-1" style={{ backgroundColor: `${cor}30` }} />
                  </div>

                  <p className="text-xl font-display font-semibold text-dark-700">
                    {orcamento.num_parcelas}x de {formatMoney(orcamento.valor_parcela)}
                  </p>
                  <p className="text-xs text-dark-400 mt-0.5">sem juros no cartão</p>
                </div>
              </div>

              {orcamento.observacoes && (
                <div className="mb-8 pb-8 border-b border-gold-100">
                  <p className="text-[11px] text-dark-300 uppercase tracking-[1.5px] font-semibold mb-1.5">Observações</p>
                  <p className="text-sm text-dark-600 whitespace-pre-line leading-relaxed">{orcamento.observacoes}</p>
                </div>
              )}

              <div className="mt-auto pt-2 text-center">
                {configuracao.texto_rodape && (
                  <p className="text-sm text-dark-500 whitespace-pre-line leading-relaxed font-medium mb-3">
                    {configuracao.texto_rodape}
                  </p>
                )}
                <p className="text-[10px] text-dark-300 tracking-wide">
                  {configuracao.nome_empresa}
                  {configuracao.instagram && ` · ${configuracao.instagram}`}
                  {(configuracao.contato || configuracao.whatsapp) && ` · ${configuracao.contato || configuracao.whatsapp}`}
                </p>
              </div>
            </div>

            {/* Faixa de rodapé */}
            <div className="h-2" style={{ backgroundColor: cor }} />
          </div>
        </div>
      </div>
    </div>
  )
}
