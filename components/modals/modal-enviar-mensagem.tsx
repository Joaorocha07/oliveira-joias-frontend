'use client'

import { useState } from 'react'
import { Modal, Button, Spinner } from '@/components/ui'
import { SearchableSelect, type SelectOption } from '@/components/forms/searchable-select'
import { useAuth } from '@/context/auth-context'
import { useAlert } from '@/hooks/use-alert'
import { supabase } from '@/lib/supabase'
import { getOrcamentoConfiguracoes } from '@/services/orcamentos'
import { criarNotaTimeline } from '@/services/clientes'
import { preencherMensagem } from '@/services/mensagens'
import { buildWhatsAppLink, PRODUTO_INTERESSE_LABEL } from '@/utils'
import type { MensagemModelo, ProdutoInteresse } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  mensagem: MensagemModelo | null
}

export function ModalEnviarMensagem({ open, onClose, mensagem }: Props) {
  const { user } = useAuth()
  const alert = useAlert()
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [clienteDisplay, setClienteDisplay] = useState<string | undefined>(undefined)
  const [enviando, setEnviando] = useState(false)

  async function searchClientes(q: string): Promise<SelectOption[]> {
    const { data } = await supabase
      .from('clientes')
      .select('id, nome, telefone')
      .eq('ativo', true)
      .not('telefone', 'is', null)
      .ilike('nome', `%${q}%`)
      .limit(20)
    return (data ?? []).map((c: { id: string; nome: string; telefone: string | null }) => ({
      id: c.id,
      label: c.nome,
      sublabel: c.telefone ?? undefined,
    }))
  }

  function handleClose() {
    setClienteId(null)
    setClienteDisplay(undefined)
    onClose()
  }

  async function handleEnviar() {
    if (!mensagem || !clienteId || !user) return
    setEnviando(true)

    const { data: cliente } = await supabase
      .from('clientes')
      .select('id, nome, telefone, produto_interesse')
      .eq('id', clienteId)
      .single()

    if (!cliente?.telefone) {
      alert.error('Sem telefone', 'Este cliente não possui telefone cadastrado.')
      setEnviando(false)
      return
    }

    const { data: config } = await getOrcamentoConfiguracoes()
    const texto = preencherMensagem(mensagem.mensagem, {
      nome: cliente.nome.split(' ')[0],
      produto: cliente.produto_interesse ? PRODUTO_INTERESSE_LABEL[cliente.produto_interesse as ProdutoInteresse] : undefined,
      empresa: config.nome_empresa,
      endereco: config.endereco ?? undefined,
      instagram: config.instagram ?? undefined,
    })

    window.open(buildWhatsAppLink(cliente.telefone, texto), '_blank', 'noopener,noreferrer')
    await criarNotaTimeline(cliente.id, `Mensagem "${mensagem.titulo}" enviada`, user.id)

    setEnviando(false)
    handleClose()
  }

  if (!mensagem) return null

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Enviar "${mensagem.titulo}"`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={enviando}>Cancelar</Button>
          <Button variant="primary" onClick={() => void handleEnviar()} loading={enviando} disabled={!clienteId}>
            Enviar pelo WhatsApp
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <SearchableSelect
          label="Selecionar cliente"
          value={clienteId}
          onChange={(id, option) => { setClienteId(id); setClienteDisplay(option?.label) }}
          onSearch={searchClientes}
          placeholder="Buscar por nome..."
          displayValue={clienteDisplay}
        />
        <div className="rounded-lg border border-gold-100 bg-cream-50/60 p-3">
          <p className="text-xs text-dark-400 leading-relaxed line-clamp-4">{mensagem.mensagem}</p>
        </div>
        {enviando && (
          <div className="flex items-center gap-2 text-xs text-dark-400">
            <Spinner size={12} /> Preparando envio...
          </div>
        )}
      </div>
    </Modal>
  )
}
