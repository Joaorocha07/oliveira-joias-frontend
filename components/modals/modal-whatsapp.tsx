'use client'

import { useEffect, useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { Modal, Spinner } from '@/components/ui'
import { useAuth } from '@/context/auth-context'
import { useAlert } from '@/hooks/use-alert'
import { getOrcamentoConfiguracoes } from '@/services/orcamentos'
import { criarNotaTimeline } from '@/services/clientes'
import { listarMensagensModelo, preencherMensagem } from '@/services/mensagens'
import { buildWhatsAppLink, PRODUTO_INTERESSE_LABEL } from '@/utils'
import type { Cliente, OrcamentoConfiguracao, MensagemModelo } from '@/types'

type ClienteWhatsApp = Pick<Cliente, 'id' | 'nome' | 'telefone' | 'produto_interesse'>

interface Props {
  open: boolean
  onClose: () => void
  onSent?: () => void
  cliente: ClienteWhatsApp
}

export function ModalWhatsApp({ open, onClose, onSent, cliente }: Props) {
  const { user } = useAuth()
  const alert = useAlert()
  const [config, setConfig] = useState<OrcamentoConfiguracao | null>(null)
  const [templates, setTemplates] = useState<MensagemModelo[] | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  const loading = open && (!config || !templates)

  useEffect(() => {
    if (!open || (config && templates)) return
    void Promise.all([getOrcamentoConfiguracoes(), listarMensagensModelo()]).then(([configRes, templatesRes]) => {
      setConfig(configRes.data)
      setTemplates(templatesRes.data ?? [])
    })
  }, [open, config, templates])

  async function enviar(key: string, mensagem: string | undefined, registro: string) {
    if (!cliente.telefone) {
      alert.error('Sem telefone', 'Este cliente não possui telefone cadastrado.')
      return
    }
    if (!user) return

    setEnviando(key)
    window.open(buildWhatsAppLink(cliente.telefone, mensagem), '_blank', 'noopener,noreferrer')
    await criarNotaTimeline(cliente.id, registro, user.id)
    setEnviando(null)
    onSent?.()
    onClose()
  }

  async function handleAbrirConversa() {
    await enviar('abrir', undefined, 'Conversa aberta pelo WhatsApp')
  }

  async function handleTemplate(template: MensagemModelo) {
    if (!config) return
    const mensagem = preencherMensagem(template.mensagem, {
      nome: cliente.nome.split(' ')[0],
      produto: cliente.produto_interesse ? PRODUTO_INTERESSE_LABEL[cliente.produto_interesse] : undefined,
      empresa: config.nome_empresa,
      endereco: config.endereco ?? undefined,
      instagram: config.instagram ?? undefined,
    })
    await enviar(template.id, mensagem, `Mensagem "${template.titulo}" enviada`)
  }

  return (
    <Modal open={open} onClose={onClose} title={`WhatsApp — ${cliente.nome}`} size="sm">
      {loading ? (
        <div className="flex justify-center py-6"><Spinner size={22} /></div>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-[60vh] overflow-y-auto">
          <button
            type="button"
            onClick={() => void handleAbrirConversa()}
            disabled={!!enviando}
            className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm text-dark-600 hover:bg-[#25D366]/10 hover:text-[#128C4A] transition-colors disabled:opacity-50 text-left"
          >
            <span className="text-[#25D366] flex-shrink-0"><MessageCircle size={16} /></span>
            Abrir conversa
            {enviando === 'abrir' && <Spinner size={14} className="ml-auto" />}
          </button>

          {templates && templates.length > 0 && (
            <div className="border-t border-gold-100 my-1" />
          )}

          {(templates ?? []).map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => void handleTemplate(template)}
              disabled={!!enviando}
              className="flex flex-col items-start gap-0.5 px-3.5 py-2.5 rounded-lg text-sm text-dark-600 hover:bg-[#25D366]/10 hover:text-[#128C4A] transition-colors disabled:opacity-50 text-left"
            >
              <span className="flex items-center gap-2 w-full">
                {template.titulo}
                {enviando === template.id && <Spinner size={14} className="ml-auto" />}
              </span>
              <span className="text-xs text-dark-300 font-normal line-clamp-1">{template.mensagem}</span>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
