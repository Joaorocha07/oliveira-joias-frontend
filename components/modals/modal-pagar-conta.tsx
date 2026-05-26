'use client'

import { useState } from 'react'
import { Button, Modal, Select } from '@/components/ui'
import { useAlert } from '@/hooks/use-alert'
import { pagarConta } from '@/services/contas-pagar'
import { useAuth } from '@/context/auth-context'
import { formatMoney } from '@/utils'
import type { ContaPagar } from '@/types'

interface ModalPagarContaProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  conta: ContaPagar | null
}

const FORMAS_PAGAMENTO = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'cartao_debito', label: 'Cartão de Débito' },
  { value: 'cartao_credito', label: 'Cartão de Crédito' },
  { value: 'transferencia', label: 'Transferência' },
  { value: 'cheque', label: 'Cheque' },
]

export function ModalPagarConta({ open, onClose, onSuccess, conta }: ModalPagarContaProps) {
  const { user } = useAuth()
  const alert = useAlert()
  const [formaPagamento, setFormaPagamento] = useState('dinheiro')
  const [salvando, setSalvando] = useState(false)

  async function handlePagar() {
    if (!conta || !user?.id) return

    setSalvando(true)
    const { error } = await pagarConta(conta, formaPagamento, user.id)
    setSalvando(false)

    if (error) {
      alert.error('Erro ao pagar', error)
      return
    }

    alert.success(
      'Conta paga!',
      `"${conta.nome}" marcada como paga. Lançamento registrado no caixa.`,
      { onConfirm: () => { onClose(); onSuccess() } },
    )
  }

  if (!conta) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar Pagamento"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handlePagar} loading={salvando}>
            Confirmar pagamento
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Resumo da conta */}
        <div className="rounded-xl border border-gold-100 bg-cream-50 px-4 py-4 space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-dark-400">Conta a pagar</p>
          <p className="text-base font-semibold text-dark-800">{conta.nome}</p>
          <p className="text-2xl font-bold text-dark-800">{formatMoney(conta.valor)}</p>
          {conta.descricao && (
            <p className="text-xs text-dark-400 mt-1">{conta.descricao}</p>
          )}
        </div>

        <Select
          label="Forma de pagamento"
          value={formaPagamento}
          onChange={(e) => setFormaPagamento(e.target.value)}
        >
          {FORMAS_PAGAMENTO.map((fp) => (
            <option key={fp.value} value={fp.value}>{fp.label}</option>
          ))}
        </Select>

        <p className="text-xs text-dark-400">
          Um lançamento de saída será criado automaticamente no caixa
          como <strong>{conta.fixa ? 'Conta Fixa' : 'Conta Variável'}</strong>.
        </p>
      </div>
    </Modal>
  )
}
