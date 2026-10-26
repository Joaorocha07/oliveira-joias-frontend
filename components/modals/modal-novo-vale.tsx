'use client'

import { useState } from 'react'
import { Button, Input, Modal, Select } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { FORMAS_PAGAMENTO_FOLHA } from '@/components/folha/formas-pagamento'
import { useAuth } from '@/context/auth-context'
import { useAlert } from '@/hooks/use-alert'
import { criarVale } from '@/services/folha'
import { today } from '@/utils'
import type { FuncionarioFolha } from '@/types'

interface ModalNovoValeProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  funcionarios: FuncionarioFolha[]
}

export function ModalNovoVale({ open, ...props }: ModalNovoValeProps) {
  if (!open) return null
  return <FormVale {...props} />
}

function FormVale({ onClose, onSuccess, funcionarios }: Omit<ModalNovoValeProps, 'open'>) {
  const { user } = useAuth()
  const alert = useAlert()
  const [funcionarioId, setFuncionarioId] = useState('')
  const [dataVale, setDataVale] = useState(today())
  const [valor, setValor] = useState(0)
  const [descricao, setDescricao] = useState('')
  const [forma, setForma] = useState<string>(FORMAS_PAGAMENTO_FOLHA[0].value)
  const [salvando, setSalvando] = useState(false)

  async function handleSalvar() {
    const funcionario = funcionarios.find((f) => f.profile.id === funcionarioId)
    if (!funcionario) { alert.error('Campo obrigatório', 'Selecione o funcionário.'); return }
    if (valor <= 0) { alert.error('Campo obrigatório', 'Informe um valor maior que zero.'); return }
    if (!dataVale) { alert.error('Campo obrigatório', 'Informe a data do vale.'); return }
    if (!user?.id) return

    setSalvando(true)
    const { error } = await criarVale(
      {
        funcionario_id: funcionario.profile.id,
        data_vale: dataVale,
        valor,
        descricao: descricao.trim() || null,
        forma_pagamento: forma,
      },
      funcionario.profile.nome,
      user.id,
    )
    setSalvando(false)
    if (error) { alert.error('Erro ao registrar vale', error); return }

    alert.success('Vale registrado!', 'A saída foi lançada no caixa e o valor será descontado na folha do mês.', {
      onConfirm: () => { onClose(); onSuccess() },
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Novo vale / adiantamento"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button variant="primary" onClick={handleSalvar} loading={salvando}>Registrar vale</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Select label="Funcionário *" value={funcionarioId} onChange={(e) => setFuncionarioId(e.target.value)}>
          <option value="">Selecione…</option>
          {funcionarios.map((f) => (
            <option key={f.profile.id} value={f.profile.id}>{f.profile.nome}</option>
          ))}
        </Select>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CurrencyInput label="Valor *" value={valor} onChange={setValor} />
          <Input label="Data *" type="date" value={dataVale} onChange={(e) => setDataVale(e.target.value)} />
        </div>
        <Input label="Descrição" placeholder="Ex: Adiantamento quinzenal" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        <Select label="Forma de pagamento" value={forma} onChange={(e) => setForma(e.target.value)}>
          {FORMAS_PAGAMENTO_FOLHA.map((fp) => <option key={fp.value} value={fp.value}>{fp.label}</option>)}
        </Select>
        <p className="text-xs text-dark-400">
          O vale sai do caixa agora (categoria <strong>Vale / Adiantamento</strong>) e é descontado
          automaticamente na folha do mês da data informada.
        </p>
      </div>
    </Modal>
  )
}
