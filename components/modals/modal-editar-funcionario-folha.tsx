'use client'

import { useState } from 'react'
import { Button, Input, Modal, Textarea } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { useAlert } from '@/hooks/use-alert'
import { salvarFuncionarioFolha } from '@/services/folha'
import type { FuncionarioFolha } from '@/types'

interface ModalEditarFuncionarioFolhaProps {
  funcionario: FuncionarioFolha | null
  onClose: () => void
  onSuccess: () => void
}

export function ModalEditarFuncionarioFolha({ funcionario, onClose, onSuccess }: ModalEditarFuncionarioFolhaProps) {
  if (!funcionario) return null
  return <FormFuncionario key={funcionario.profile.id} funcionario={funcionario} onClose={onClose} onSuccess={onSuccess} />
}

function FormFuncionario({ funcionario, onClose, onSuccess }: { funcionario: FuncionarioFolha; onClose: () => void; onSuccess: () => void }) {
  const alert = useAlert()
  const { profile, folha } = funcionario
  const [cargo, setCargo] = useState(folha?.cargo ?? '')
  const [salario, setSalario] = useState(folha?.salario_base ?? 0)
  const [comissao, setComissao] = useState(String(profile.comissao_percentual ?? 0).replace('.', ','))
  const [ativo, setAtivo] = useState(folha?.ativo ?? true)
  const [observacoes, setObservacoes] = useState(folha?.observacoes ?? '')
  const [salvando, setSalvando] = useState(false)

  async function handleSalvar() {
    const comissaoNum = comissao.trim() === '' ? 0 : Number(comissao.replace(',', '.'))
    if (!Number.isFinite(comissaoNum) || comissaoNum < 0 || comissaoNum > 100) {
      alert.error('Comissão inválida', 'Informe um percentual entre 0 e 100.')
      return
    }
    setSalvando(true)
    const { error } = await salvarFuncionarioFolha(profile.id, {
      cargo: cargo.trim() || null,
      salario_base: salario,
      ativo,
      observacoes: observacoes.trim() || null,
    }, Math.round(comissaoNum * 100) / 100)
    setSalvando(false)
    if (error) {
      alert.error('Erro ao salvar', error)
      return
    }
    alert.success('Dados salvos!', `Folha de ${profile.nome} atualizada.`, {
      onConfirm: () => { onClose(); onSuccess() },
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Folha — ${profile.nome}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button variant="primary" onClick={handleSalvar} loading={salvando}>Salvar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Cargo" placeholder="Ex: Vendedora, Ourives…" value={cargo} onChange={(e) => setCargo(e.target.value)} />
          <CurrencyInput label="Salário base" value={salario} onChange={setSalario} showZero hint="Valor fixo mensal (pode ser 0, ex.: só comissão)." />
        </div>
        <Input
          label="Comissão (%)"
          inputMode="decimal"
          placeholder="Ex: 5 ou 2,5"
          value={comissao}
          onChange={(e) => setComissao(e.target.value.replace(/[^\d,.]/g, ''))}
          rightAddon={<span className="text-sm text-dark-400">%</span>}
          hint="Sobre as vendas do mês em que a pessoa é a vendedora. É o mesmo % de Equipe (/vendedores) e do CRM."
        />
        <Textarea label="Observações" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-dark-500 cursor-pointer">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="accent-gold-500" />
          Incluir na folha mensal
        </label>
      </div>
    </Modal>
  )
}
