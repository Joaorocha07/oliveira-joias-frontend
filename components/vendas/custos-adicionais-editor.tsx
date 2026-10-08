'use client'

import { useEffect, useState } from 'react'
import type { FieldErrors } from 'react-hook-form'
import { Plus, Trash2, Receipt } from 'lucide-react'
import { Button, Select, Input } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { ModalQuickCatalogoItem } from '@/components/modals/modal-quick-catalogo-item'
import { listarCustoTipos, criarCustoTipo } from '@/services/custos'
import { formatMoney } from '@/utils'
import type { CustoAdicionalFormData } from '@/schemas/custo'
import type { CustoTipo } from '@/types'

const NOVO_TIPO = '__novo__'

interface CustosAdicionaisEditorProps {
  // Pode chegar undefined no primeiro render do modal de edição, antes do reset() preencher o form
  value: CustoAdicionalFormData[] | undefined
  onChange: (custos: CustoAdicionalFormData[]) => void
  errors?: FieldErrors<{ custos_adicionais: CustoAdicionalFormData[] }>['custos_adicionais']
}

// Lista editável de custos adicionais da venda (mão de obra, gravação, frete...).
// Usado nos modais de nova venda e de edição, dentro de um Controller do React Hook Form.
export function CustosAdicionaisEditor({ value: valueProp, onChange, errors }: CustosAdicionaisEditorProps) {
  const value = valueProp ?? []
  const [tipos, setTipos] = useState<CustoTipo[]>([])
  const [loadError, setLoadError] = useState(false)
  const [novoTipoIndex, setNovoTipoIndex] = useState<number | null>(null)

  useEffect(() => {
    void listarCustoTipos().then(({ data, error }) => {
      setTipos(data)
      setLoadError(!!error)
    })
  }, [])

  const total = value.reduce((sum, c) => sum + (c.valor ?? 0), 0)

  function update(index: number, patch: Partial<CustoAdicionalFormData>) {
    onChange(value.map((c, i) => (i === index ? { ...c, ...patch } : c)))
  }

  function add() {
    onChange([...value, { tipo_id: '', descricao: '', valor: 0 }])
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-dark-600">Custos adicionais</h4>
          <p className="text-xs text-dark-400">Mão de obra, gravação, frete... Lançados como saída no caixa.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" leftIcon={<Plus size={13} />} onClick={add}>
          Adicionar custo
        </Button>
      </div>

      {loadError && (
        <p className="text-xs text-red-600">Não foi possível carregar os tipos de custo.</p>
      )}

      {value.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-gold-200 px-4 py-3 text-sm text-dark-400">
          <Receipt size={16} className="text-dark-300" />
          Nenhum custo adicional nesta venda.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {value.map((custo, index) => {
            const rowErrors = errors?.[index]
            return (
              <div key={custo.id ?? `novo-${index}`} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-gold-100 bg-cream-50/50 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_8.5rem_auto] sm:items-start">
                <Select
                  aria-label="Tipo de custo"
                  placeholder="Tipo de custo..."
                  value={custo.tipo_id}
                  error={rowErrors?.tipo_id?.message}
                  wrapperClassName="col-span-2 sm:col-span-1"
                  onChange={(e) => {
                    if (e.target.value === NOVO_TIPO) { setNovoTipoIndex(index); return }
                    update(index, { tipo_id: e.target.value })
                  }}
                >
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                  <option value={NOVO_TIPO}>+ Novo tipo...</option>
                </Select>
                <Input
                  aria-label="Descrição do custo"
                  placeholder="Descrição (opcional)"
                  value={custo.descricao}
                  wrapperClassName="col-span-2 sm:col-span-1"
                  onChange={(e) => update(index, { descricao: e.target.value })}
                />
                <CurrencyInput
                  aria-label="Valor do custo"
                  placeholder="0,00"
                  value={custo.valor}
                  error={rowErrors?.valor?.message}
                  onChange={(v) => update(index, { valor: v })}
                />
                <Button type="button" variant="danger-ghost" size="icon" className="mt-1" onClick={() => remove(index)} aria-label="Remover custo">
                  <Trash2 size={13} />
                </Button>
              </div>
            )
          })}
          <p className="text-right text-sm text-dark-500">
            Total de custos adicionais: <strong className="text-dark-700">{formatMoney(total)}</strong>
          </p>
        </div>
      )}

      <ModalQuickCatalogoItem<CustoTipo>
        open={novoTipoIndex !== null}
        title="Novo Tipo de Custo"
        label="tipo de custo"
        placeholder="Ex: Cravação, Polimento..."
        onClose={() => setNovoTipoIndex(null)}
        onCreate={criarCustoTipo}
        onSuccess={(tipo) => {
          setTipos((prev) => [...prev, tipo].sort((a, b) => a.nome.localeCompare(b.nome)))
          if (novoTipoIndex !== null) update(novoTipoIndex, { tipo_id: tipo.id })
        }}
      />
    </div>
  )
}
