'use client'

import { useState, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAlert } from '@/hooks/use-alert'
import { useAuth } from '@/context/auth-context'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, Button, Input, Textarea } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { MaskedInput } from '@/components/forms/masked-input'
import { SearchableSelect, type SelectOption } from '@/components/forms/searchable-select'
import { ModalQuickCliente } from '@/components/modals/modal-quick-cliente'
import { ModalQuickCatalogoItem } from '@/components/modals/modal-quick-catalogo-item'
import { orcamentoSchema, ORCAMENTO_ITENS_PADRAO, type OrcamentoFormData } from '@/schemas/orcamento'
import { createOrcamento, updateOrcamento, createOrcamentoModelo, createOrcamentoMaterial } from '@/services/orcamentos'
import { calcularCondicaoOrcamento, formatMoney } from '@/utils'
import type { Orcamento, OrcamentoModelo, OrcamentoMaterial } from '@/types'

interface FormOrcamentoProps {
  orcamento?: Orcamento | null
  initialValues?: Partial<OrcamentoFormData> | null
  modelos: OrcamentoModelo[]
  materiais: OrcamentoMaterial[]
  onModelosChanged?: () => void
  onMateriaisChanged?: () => void
  onSaved: (orcamento: Orcamento, isEditing: boolean) => void
  onCancelEdit?: () => void
}

function buildDefaults(
  orcamento?: Orcamento | null,
  initialValues?: Partial<OrcamentoFormData> | null,
): OrcamentoFormData {
  if (orcamento) {
    return {
      cliente_nome: orcamento.cliente_nome ?? '',
      cliente_telefone: orcamento.cliente_telefone ?? '',
      modelo_nome: orcamento.modelo_nome ?? '',
      material: orcamento.material ?? '',
      largura: orcamento.largura ?? '',
      itens_inclusos: orcamento.itens_inclusos ?? [],
      valor_vista: orcamento.valor_vista,
      prazo_fabricacao: orcamento.prazo_fabricacao ?? '',
      observacoes: orcamento.observacoes ?? '',
    }
  }
  return {
    cliente_nome: initialValues?.cliente_nome ?? '',
    cliente_telefone: initialValues?.cliente_telefone ?? '',
    modelo_nome: initialValues?.modelo_nome ?? '',
    material: initialValues?.material ?? '',
    largura: initialValues?.largura ?? '',
    itens_inclusos: initialValues?.itens_inclusos ?? [],
    valor_vista: initialValues?.valor_vista ?? 0,
    prazo_fabricacao: initialValues?.prazo_fabricacao ?? '',
    observacoes: initialValues?.observacoes ?? '',
  }
}

export function FormOrcamento({
  orcamento, initialValues, modelos, materiais, onModelosChanged, onMateriaisChanged, onSaved, onCancelEdit,
}: FormOrcamentoProps) {
  const { user } = useAuth()
  const alert = useAlert()
  const isEditing = !!orcamento

  const [quickClienteOpen, setQuickClienteOpen] = useState(false)
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [clienteDisplayValue, setClienteDisplayValue] = useState<string | undefined>(
    orcamento?.cliente_nome ?? initialValues?.cliente_nome ?? undefined,
  )

  const [quickModeloOpen, setQuickModeloOpen] = useState(false)
  const [modeloId, setModeloId] = useState<string | null>(null)
  const [modeloDisplayValue, setModeloDisplayValue] = useState<string | undefined>(
    orcamento?.modelo_nome ?? initialValues?.modelo_nome ?? undefined,
  )

  const [quickMaterialOpen, setQuickMaterialOpen] = useState(false)
  const [materialId, setMaterialId] = useState<string | null>(null)
  const [materialDisplayValue, setMaterialDisplayValue] = useState<string | undefined>(
    orcamento?.material ?? initialValues?.material ?? undefined,
  )

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<OrcamentoFormData>({
    resolver: zodResolver(orcamentoSchema) as never,
    defaultValues: buildDefaults(orcamento, initialValues),
  })

  const searchClientes = useCallback(async (q: string): Promise<SelectOption[]> => {
    const { data } = await supabase
      .from('clientes')
      .select('id, nome, telefone')
      .eq('ativo', true)
      .ilike('nome', `%${q}%`)
      .limit(20)
    return (data ?? []).map((c: { id: string; nome: string; telefone: string | null }) => ({
      id: c.id,
      label: c.nome,
      sublabel: c.telefone ?? undefined,
    }))
  }, [])

  function handleClienteChange(id: string | null, option?: SelectOption) {
    setClienteId(id)
    setValue('cliente_nome', option?.label ?? '')
    setValue('cliente_telefone', option?.sublabel ?? '')
    setClienteDisplayValue(option?.label)
  }

  function handleQuickClienteSuccess(cliente: { id: string; nome: string; telefone: string | null }) {
    setClienteId(cliente.id)
    setValue('cliente_nome', cliente.nome)
    setValue('cliente_telefone', cliente.telefone ?? '')
    setClienteDisplayValue(cliente.nome)
  }

  const searchModelos = useCallback(async (q: string): Promise<SelectOption[]> => {
    const query = q.trim().toLowerCase()
    return modelos
      .filter((m) => !query || m.nome.toLowerCase().includes(query))
      .map((m) => ({ id: m.id, label: m.nome }))
  }, [modelos])

  function handleModeloChange(id: string | null, option?: SelectOption) {
    setModeloId(id)
    setValue('modelo_nome', option?.label ?? '', { shouldValidate: true })
    setModeloDisplayValue(option?.label)
  }

  function handleQuickModeloSuccess(item: OrcamentoModelo) {
    setModeloId(item.id)
    setValue('modelo_nome', item.nome, { shouldValidate: true })
    setModeloDisplayValue(item.nome)
    onModelosChanged?.()
  }

  const searchMateriais = useCallback(async (q: string): Promise<SelectOption[]> => {
    const query = q.trim().toLowerCase()
    return materiais
      .filter((m) => !query || m.nome.toLowerCase().includes(query))
      .map((m) => ({ id: m.id, label: m.nome }))
  }, [materiais])

  function handleMaterialChange(id: string | null, option?: SelectOption) {
    setMaterialId(id)
    setValue('material', option?.label ?? '')
    setMaterialDisplayValue(option?.label)
  }

  function handleQuickMaterialSuccess(item: OrcamentoMaterial) {
    setMaterialId(item.id)
    setValue('material', item.nome)
    setMaterialDisplayValue(item.nome)
    onMateriaisChanged?.()
  }

  const watchedValor = watch('valor_vista') ?? 0
  const watchedMaterial = watch('material') ?? ''
  const condicao = calcularCondicaoOrcamento(watchedValor, watchedMaterial)

  async function onSave(data: OrcamentoFormData) {
    if (!user) return

    if (isEditing && orcamento) {
      const { data: result, error } = await updateOrcamento(orcamento.id, data)
      if (error) {
        alert.error('Erro', error)
        return
      }
      alert.success('Orçamento Atualizado!', 'As alterações foram salvas com sucesso.', {
        onConfirm: () => { if (result) onSaved(result, true) },
      })
    } else {
      const { data: result, error } = await createOrcamento(data, user.id)
      if (error) {
        alert.error('Erro', error)
        return
      }
      if (result) {
        reset(buildDefaults(null, null))
        setClienteId(null)
        setClienteDisplayValue(undefined)
        setModeloId(null)
        setModeloDisplayValue(undefined)
        setMaterialId(null)
        setMaterialDisplayValue(undefined)
        onSaved(result, false)
      }
    }
  }

  return (
    <Card>
      <CardHeader
        title={isEditing ? `Editar Orçamento #${orcamento?.numero}` : 'Novo Orçamento'}
        subtitle="Preencha os dados para gerar o orçamento"
      />

      <form onSubmit={handleSubmit(onSave)} className="flex flex-col gap-6">
        {/* Dados do Cliente */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wide">Dados do Cliente</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchableSelect
              label="Cliente (opcional)"
              value={clienteId}
              displayValue={clienteDisplayValue}
              onChange={handleClienteChange}
              onSearch={searchClientes}
              onCreateNew={() => setQuickClienteOpen(true)}
              createNewLabel="Cadastrar cliente"
              placeholder="Buscar cliente..."
              error={errors.cliente_nome?.message}
            />
            <MaskedInput
              mask="phone"
              label="Telefone (opcional)"
              placeholder="(34) 9 0000-0000"
              {...register('cliente_telefone')}
            />
          </div>
        </section>

        {/* Produto */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wide">Produto</p>
          <SearchableSelect
            label="Modelo"
            value={modeloId}
            displayValue={modeloDisplayValue}
            onChange={handleModeloChange}
            onSearch={searchModelos}
            onCreateNew={() => setQuickModeloOpen(true)}
            createNewLabel="Cadastrar modelo"
            placeholder="Buscar modelo..."
            error={errors.modelo_nome?.message}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchableSelect
              label="Material"
              value={materialId}
              displayValue={materialDisplayValue}
              onChange={handleMaterialChange}
              onSearch={searchMateriais}
              onCreateNew={() => setQuickMaterialOpen(true)}
              createNewLabel="Cadastrar material"
              placeholder="Buscar material..."
            />
            <Input label="Largura (mm)" placeholder="Ex: 4mm" {...register('largura')} />
          </div>
        </section>

        {/* Itens Inclusos */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wide">Itens Inclusos</p>
          <Controller
            name="itens_inclusos"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ORCAMENTO_ITENS_PADRAO.map((item) => {
                  const checked = field.value.includes(item)
                  return (
                    <label key={item} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-gold-500 w-4 h-4"
                        checked={checked}
                        onChange={() => {
                          field.onChange(
                            checked ? field.value.filter((v) => v !== item) : [...field.value, item],
                          )
                        }}
                      />
                      <span className="text-sm text-dark-600">{item}</span>
                    </label>
                  )
                })}
              </div>
            )}
          />
        </section>

        {/* Valor */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wide">Valor</p>
          <Controller
            name="valor_vista"
            control={control}
            render={({ field }) => (
              <CurrencyInput
                label="Valor à vista (R$)"
                placeholder="Ex: 400"
                value={field.value}
                onChange={field.onChange}
                error={errors.valor_vista?.message}
              />
            )}
          />
          <p className="text-xs text-dark-300 leading-relaxed">
            O parcelamento é calculado automaticamente pelo Material: Ouro → 12x sem juros (+20%),
            outros materiais → 3x sem juros (+10%).
          </p>
          {watchedValor > 0 && (
            <p className="text-sm font-medium text-gold-600">
              ou {condicao.parcelas}x de {formatMoney(condicao.valorParcela)} sem juros
            </p>
          )}
        </section>

        {/* Prazo de Fabricação */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wide">Prazo de Fabricação</p>
          <Input label="Prazo" placeholder="Ex: 4 dias úteis" {...register('prazo_fabricacao')} />
        </section>

        {/* Observações */}
        <section className="flex flex-col gap-3">
          <Textarea
            label="Observações (opcional)"
            rows={3}
            {...register('observacoes')}
          />
        </section>

        <div className="flex justify-end gap-3 pt-4 border-t border-gold-50">
          {isEditing && onCancelEdit && (
            <Button type="button" variant="ghost" onClick={onCancelEdit} disabled={isSubmitting}>
              Cancelar edição
            </Button>
          )}
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {isEditing ? 'Salvar Alterações' : 'Gerar Orçamento'}
          </Button>
        </div>
      </form>

      <ModalQuickCliente
        open={quickClienteOpen}
        onClose={() => setQuickClienteOpen(false)}
        onSuccess={handleQuickClienteSuccess}
      />
      <ModalQuickCatalogoItem
        open={quickModeloOpen}
        title="Novo Modelo"
        label="modelo"
        placeholder="Ex: Tradicional 5mm"
        onClose={() => setQuickModeloOpen(false)}
        onCreate={createOrcamentoModelo}
        onSuccess={handleQuickModeloSuccess}
      />
      <ModalQuickCatalogoItem
        open={quickMaterialOpen}
        title="Novo Material"
        label="material"
        placeholder="Ex: Ouro 18k"
        onClose={() => setQuickMaterialOpen(false)}
        onCreate={createOrcamentoMaterial}
        onSuccess={handleQuickMaterialSuccess}
      />
    </Card>
  )
}
