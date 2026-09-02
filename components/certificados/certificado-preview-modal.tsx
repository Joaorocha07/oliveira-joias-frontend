'use client'

import { useEffect, useState } from 'react'
import { X, Download } from 'lucide-react'
import { Button, Spinner } from '@/components/ui'
import { useAlert } from '@/hooks/use-alert'
import { formatMoney, formatDate } from '@/utils'
import { baixarCertificadoPdf, certificadoPdfBlobUrl } from '@/utils/certificado-pdf'
import type { Certificado, CertificadoConfiguracao } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  certificado: Certificado | null
  configuracao: CertificadoConfiguracao
}

export function CertificadoPreviewModal({ open, onClose, certificado, configuracao }: Props) {
  const alert = useAlert()
  const [url, setUrl] = useState<string | null>(null)
  const [gerando, setGerando] = useState(false)
  const [baixando, setBaixando] = useState(false)

  useEffect(() => {
    if (!open || !certificado) return
    let revoked: string | null = null
    let cancelled = false
    const timer = window.setTimeout(() => {
      setGerando(true)
      certificadoPdfBlobUrl(certificado, configuracao)
        .then((u) => {
          if (cancelled) { URL.revokeObjectURL(u); return }
          revoked = u
          setUrl(u)
        })
        .catch(() => { if (!cancelled) alert.error('Erro', 'Não foi possível gerar o PDF do certificado.') })
        .finally(() => { if (!cancelled) setGerando(false) })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (revoked) URL.revokeObjectURL(revoked)
      setUrl(null)
    }
  }, [open, certificado, configuracao, alert])

  if (!open || !certificado) return null

  async function handleDownload() {
    if (!certificado) return
    setBaixando(true)
    try {
      await baixarCertificadoPdf(certificado, configuracao)
    } catch {
      alert.error('Erro', 'Não foi possível baixar o PDF.')
    } finally {
      setBaixando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[rgba(26,21,16,0.55)] backdrop-blur-[6px]" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-3xl bg-white rounded-2xl flex flex-col max-h-[92vh] border border-[rgba(232,213,163,0.3)] shadow-[0_20px_60px_rgba(26,21,16,0.15)]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gold-100 flex-shrink-0">
          <div>
            <h3 className="font-display text-lg font-semibold text-dark-500">Certificado {certificado.numero}</h3>
            <p className="text-xs text-dark-400 mt-0.5">
              {certificado.cliente_nome || 'Sem cliente'} · {certificado.modelo || '—'} ·{' '}
              {certificado.valor != null ? formatMoney(certificado.valor) : '—'} · {formatDate(certificado.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="primary" size="sm" leftIcon={<Download size={14} />} loading={baixando} onClick={handleDownload}>
              Baixar PDF
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

        <div className="flex-1 overflow-hidden bg-cream-100 rounded-b-2xl min-h-[60vh]">
          {gerando || !url ? (
            <div className="flex items-center justify-center h-full py-20"><Spinner size={24} /></div>
          ) : (
            <iframe title={`Certificado ${certificado.numero}`} src={url} className="w-full h-full min-h-[60vh]" />
          )}
        </div>
      </div>
    </div>
  )
}
