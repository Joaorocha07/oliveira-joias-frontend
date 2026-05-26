'use client'

import { useEffect, useState } from 'react'
import { Button, Input, Modal, Select } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { useAuth } from '@/context/auth-context'
import { useAlert } from '@/hooks/use-alert'
import { criarContaPagar, atualizarContaPagar } from '@/services/contas-pagar'
import type { ContaPagar } from '@/types'
import { today } from '@/utils'

interface ModalContaPagarProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  conta?: ContaPagar | null
}

interface FormState {
  nome: string
  descricao: string
  valor: number
  fixa: boolean
  data_vencimento: string
  observacoes: string
}

const EMPTY_FORM: FormState = {
  nome: '',
  descricao: '',
  valor: 0,
  fixa: false,
  data_vencimento: today(),
  observacoes: '',
}

export function ModalContaPagar({ open, onClose, onSuccess, conta }: ModalContaPagarProps) {
  const { user } = useAuth()
  const alert = useAlert()
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)
  const editando = !!conta

  useEffect(() => {
    if (open) {
      if (conta) {
        setForm({
          nome: conta.nome,
          descricao: conta.descricao ?? '',
          valor: conta.valor,
          fixa: conta.fixa,
          data_vencimento: conta.data_vencimento,
          observacoes: conta.observacoes ?? '',
        })
      } else {
        setForm(EMPTY_FORM)
      }
    }
  }, [open, conta])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSalvar() {
    if (!form.nome.trim()) {
      alert.error('Campo obrigatório', 'Informe o nome da conta.')
      return
    }
    if (!form.valor || form.valor <= 0) {
      alert.error('Campo obrigatório', 'Informe um valor maior que zero.')
      return
    }
    if (!form.data_vencimento) {
      alert.error('Campo obrigatório', 'Informe a data de vencimento.')
      return
    }
    if (!user?.id) return

    setSalvando(true)

    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      valor: form.valor,
      fixa: form.fixa,
      data_vencimento: form.data_vencimento,
      observacoes: form.observacoes.trim() || null,
    }

    const { error } = editando
      ? await atualizarContaPagar(conta.id, payload)
      : await criarContaPagar(payload, user.id)

    setSalvando(false)

    if (error) {
      alert.error('Erro ao salvar', error)
      return
    }

    alert.success(
      editando ? 'Conta atualizada!' : 'Conta criada!',
      editando ? 'As alterações foram salvas.' : 'Conta a pagar registrada com sucesso.',
      { onConfirm: () => { onClose(); onSuccess() } },
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSalvar} loading={salvando}>
            {editando ? 'Salvar alterações' : 'Registrar conta'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Nome da conta *"
          placeholder="Ex: Aluguel, Conta de luz…"
          value={form.nome}
          onChange={(e) => setField('nome', e.target.value)}
        />

        <div className="grid grid-cols-2 gap-4">
          <CurrencyInput
            label="Valor *"
            value={form.valor}
            onChange={(v) => setField('valor', v)}
          />
          <Input
            label="Vencimento *"
            type="date"
            value={form.data_vencimento}
            onChange={(e) => setField('data_vencimento', e.target.value)}
          />
        </div>

        <Input
          label="Descrição"
          placeholder="Detalhes adicionais"
          value={form.descricao}
          onChange={(e) => setField('descricao', e.target.value)}
        />

        {/* Toggle fixa */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setField('fixa', !form.fixa)}
          onKeyDown={(e) => e.key === 'Enter' && setField('fixa', !form.fixa)}
          className={[
            'flex cursor-pointer select-none items-center justify-between rounded-xl border p-4 transition-all',
            form.fixa
              ? 'border-gold-400 bg-gold-50'
              : 'border-gold-100 bg-white hover:bg-cream-50',
          ].join(' ')}
        >
          <div>
            <p className="text-sm font-semibold text-dark-700">Conta fixa (recorrente)</p>
            <p className="text-xs text-dark-400 mt-0.5">
              {form.fixa
                ? 'Aparece em "Contas Fixas" no caixa ao pagar'
                : 'Conta pontual, sem recorrência'}
            </p>
          </div>
          <div className={[
            'h-5 w-9 rounded-full transition-colors',
            form.fixa ? 'bg-gold-500' : 'bg-cream-300',
          ].join(' ')}>
            <div className={[
              'mt-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform',
              form.fixa ? 'translate-x-4 ml-0.5' : 'translate-x-0.5',
            ].join(' ')} />
          </div>
        </div>

        <Input
          label="Observações"
          placeholder="Notas internas"
          value={form.observacoes}
          onChange={(e) => setField('observacoes', e.target.value)}
        />
      </div>
    </Modal>
  )
}
