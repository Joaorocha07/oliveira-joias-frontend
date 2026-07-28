'use client'

import { useState } from 'react'
import { Modal, Button, Select, Input } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { useAlert } from '@/hooks/use-alert'
import { concluirFollowUp } from '@/services/follow-ups'
import { FORMA_PAGAMENTO_LABEL } from '@/utils'
import type { ClienteFollowUp, FormaPagamento } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  followUp: ClienteFollowUp
  userId: string
}

const FORMAS_DISPONIVEIS: FormaPagamento[] = [
  'dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'transferencia', 'cheque', 'misto',
]

function descricaoPadrao(followUp: ClienteFollowUp): string {
  return `Follow-up${followUp.cliente?.nome ? ` — ${followUp.cliente.nome}` : ''}`
}

export function ModalConcluirFollowUp({ open, onClose, onSuccess, followUp, userId }: Props) {
  const alert = useAlert()
  const [registrarValor, setRegistrarValor] = useState(false)
  const [valor, setValor] = useState(0)
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | ''>('')
  const [descricao, setDescricao] = useState(() => descricaoPadrao(followUp))
  const [submitting, setSubmitting] = useState(false)

  function handleClose() {
    setRegistrarValor(false)
    setValor(0)
    setFormaPagamento('')
    setDescricao(descricaoPadrao(followUp))
    onClose()
  }

  async function handleConfirm() {
    if (registrarValor) {
      if (!valor || valor <= 0) { alert.error('Atenção', 'Informe o valor recebido.'); return }
      if (!formaPagamento) { alert.error('Atenção', 'Selecione a forma de pagamento.'); return }
      if (!descricao.trim()) { alert.error('Atenção', 'Descrição é obrigatória.'); return }
    }

    setSubmitting(true)
    const { error } = await concluirFollowUp(
      followUp,
      userId,
      registrarValor
        ? { valor, forma_pagamento: formaPagamento as FormaPagamento, descricao: descricao.trim() }
        : undefined,
    )
    setSubmitting(false)

    if (error) {
      alert.error('Erro', error)
      return
    }

    alert.success(
      'Follow-up Concluído!',
      registrarValor ? 'O valor foi lançado no caixa.' : 'O retorno foi marcado como concluído.',
      { onConfirm: () => { onSuccess(); handleClose() } },
    )
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={`Concluir Follow-up${followUp.cliente?.nome ? ` — ${followUp.cliente.nome}` : ''}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleConfirm} loading={submitting}>
            {registrarValor ? 'Concluir e lançar no caixa' : 'Concluir'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="accent-gold-500 w-4 h-4"
            checked={registrarValor}
            onChange={(e) => setRegistrarValor(e.target.checked)}
          />
          <span className="text-sm text-dark-600">Registrar valor recebido neste atendimento</span>
        </label>

        {registrarValor && (
          <div className="flex flex-col gap-4 border-t border-gold-100 pt-4">
            <CurrencyInput label="Valor recebido *" value={valor} onChange={setValor} />
            <Select
              label="Forma de pagamento *"
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}
              placeholder="Selecione..."
            >
              {FORMAS_DISPONIVEIS.map((f) => (
                <option key={f} value={f}>{FORMA_PAGAMENTO_LABEL[f]}</option>
              ))}
            </Select>
            <Input
              label="Descrição do lançamento"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>
        )}
      </div>
    </Modal>
  )
}
