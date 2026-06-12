'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { useAlert } from '@/hooks/use-alert'
import { Modal, Button, Input } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { SearchableSelect, type SelectOption } from '@/components/forms/searchable-select'
import { produtoSchema, type ProdutoFormData } from '@/schemas/produto'
import { createProduto, updateProduto, generateCodigo } from '@/services/produtos'
import { useAuth } from '@/context/auth-context'
import { supabase } from '@/lib/supabase'
import { PRODUTO_CATEGORIA_LABEL } from '@/utils'
import { cn } from '@/lib/cn'
import type { Produto, ProdutoCategoria } from '@/types'

interface ModalProdutoProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  produto?: Produto | null
}

const CATEGORIAS = Object.keys(PRODUTO_CATEGORIA_LABEL) as ProdutoCategoria[]

const EMPTY_VARIACAO = {
  nome: 'Tamanho',
  valor: 'Único',
  estoque_atual: 0,
  estoque_minimo: 1,
  custo_adicional: 0,
  ativo: true,
}

function buildDefaults(produto?: Produto | null): ProdutoFormData {
  if (produto) {
    return {
      nome: produto.nome,
      codigo: produto.codigo,
      descricao: produto.descricao,
      categoria: produto.categoria,
      material: produto.material,
      peso_g: produto.peso_g,
      fornecedor_id: produto.fornecedor_id,
      custo: produto.custo,
      preco_venda: produto.preco_venda,
      preco_minimo: produto.preco_minimo,
      observacoes: produto.observacoes,
      ativo: produto.ativo,
      is_kit: produto.is_kit,
      variacoes: produto.variacoes?.map((v) => ({
        id: v.id,
        nome: v.nome,
        valor: v.valor,
        estoque_atual: v.estoque_atual,
        estoque_minimo: v.estoque_minimo,
        custo_adicional: v.custo_adicional,
        ativo: v.ativo,
      })) ?? [EMPTY_VARIACAO],
    }
  }
  return {
    nome: '',
    codigo: '',
    descricao: null,
    categoria: 'outro',
    material: null,
    peso_g: null,
    fornecedor_id: null,
    custo: 0,
    preco_venda: 0,
    preco_minimo: null,
    observacoes: null,
    ativo: true,
    is_kit: false,
    variacoes: [EMPTY_VARIACAO],
  }
}

const TABS = ['Dados Gerais', 'Variações'] as const
type Tab = typeof TABS[number]

export function ModalProduto({ open, onClose, onSuccess, produto }: ModalProdutoProps) {
  const { user } = useAuth()
  const alert = useAlert()
  const isEditing = !!produto
  const [activeTab, setActiveTab] = useState<Tab>('Dados Gerais')

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProdutoFormData>({
    resolver: zodResolver(produtoSchema) as never,
    defaultValues: buildDefaults(produto),
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'variacoes' })

  const categoriaWatch = watch('categoria')

  useEffect(() => {
    if (open) {
      setActiveTab('Dados Gerais')
      reset(buildDefaults(produto))
    }
  }, [open, produto, reset])

  const handleCategoriaChange = useCallback(async (cat: ProdutoCategoria) => {
    setValue('categoria', cat)
    if (!isEditing) {
      const codigo = await generateCodigo(cat)
      setValue('codigo', codigo)
    }
  }, [setValue, isEditing])

  const searchFornecedores = useCallback(async (q: string): Promise<SelectOption[]> => {
    const { data } = await supabase
      .from('fornecedores')
      .select('id, nome')
      .eq('ativo', true)
      .ilike('nome', `%${q}%`)
      .limit(15)
    return (data ?? []).map((f: { id: string; nome: string }) => ({ id: f.id, label: f.nome }))
  }, [])

  async function onSave(data: ProdutoFormData) {
    if (!user) return
    const { error } = isEditing
      ? await updateProduto(produto.id, data, user.id)
      : await createProduto(data, user.id)

    if (error) {
      alert.error('Erro', error)
    } else {
      alert.success(
        isEditing ? 'Produto Atualizado!' : 'Produto Cadastrado!',
        isEditing ? 'As alterações foram salvas com sucesso.' : 'Produto adicionado ao catálogo.',
        { onConfirm: () => { onSuccess(); onClose() } },
      )
    }
  }

  const variacoesError = errors.variacoes?.root?.message ?? errors.variacoes?.message

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? `Editar Produto — ${produto.codigo}` : 'Novo Produto'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="form-produto"
            loading={isSubmitting}
          >
            {isEditing ? 'Salvar' : 'Cadastrar'}
          </Button>
        </>
      }
    >
      {/* Tabs */}
      <div className="flex border-b border-gold-100 mb-5 -mx-6 px-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
              activeTab === tab
                ? 'border-gold-500 text-gold-700'
                : 'border-transparent text-dark-400 hover:text-dark-600',
            )}
          >
            {tab}
            {tab === 'Variações' && variacoesError && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-500 text-white text-[9px]">!</span>
            )}
          </button>
        ))}
      </div>

      <form id="form-produto" onSubmit={handleSubmit(onSave)}>
        {/* Tab: Dados Gerais */}
        <div className={activeTab === 'Dados Gerais' ? 'flex flex-col gap-4' : 'hidden'}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Nome do produto *"
              placeholder="Ex: Anel Solitário Ouro 18k"
              error={errors.nome?.message}
              className="sm:col-span-2"
              {...register('nome')}
            />

            <div className="flex flex-col gap-1">
              <label className="label-base">Categoria *</label>
              <select
                value={categoriaWatch}
                onChange={(e) => void handleCategoriaChange(e.target.value as ProdutoCategoria)}
                className={cn('input-base', errors.categoria ? 'border-red-400' : '')}
              >
                <option value="">Selecione...</option>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>{PRODUTO_CATEGORIA_LABEL[c]}</option>
                ))}
              </select>
              {errors.categoria && <p className="text-xs text-red-600">{errors.categoria.message}</p>}
            </div>

            <Input
              label="Código *"
              placeholder="Ex: AN0001"
              error={errors.codigo?.message}
              {...register('codigo')}
            />

            <Input
              label="Material"
              placeholder="Ex: Ouro 18k, Prata 925..."
              {...register('material')}
            />

            <Input
              label="Peso (g)"
              type="number"
              step="0.01"
              min="0"
              placeholder="Ex: 3.5"
              error={errors.peso_g?.message}
              {...register('peso_g', { setValueAs: (v) => (v === '' || v === null ? null : Number(v)) })}
            />
          </div>

          <Controller
            name="fornecedor_id"
            control={control}
            render={({ field }) => (
              <SearchableSelect
                label="Fornecedor (opcional)"
                value={field.value}
                onChange={(id) => field.onChange(id)}
                onSearch={searchFornecedores}
                placeholder="Buscar fornecedor..."
                displayValue={produto?.fornecedor?.nome}
              />
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Controller
              name="custo"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  label="Custo"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.custo?.message}
                />
              )}
            />
            <Controller
              name="preco_venda"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  label="Preço de venda *"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.preco_venda?.message}
                />
              )}
            />
            <Controller
              name="preco_minimo"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  label="Preço mínimo"
                  value={field.value ?? 0}
                  onChange={(v) => field.onChange(v || null)}
                />
              )}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="label-base">Observações</label>
            <textarea
              className="input-base resize-none"
              rows={2}
              placeholder="Observações internas sobre o produto..."
              {...register('observacoes')}
            />
          </div>

          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-gold-500 w-4 h-4" {...register('ativo')} />
              <span className="text-sm text-dark-600">Produto ativo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-gold-500 w-4 h-4" {...register('is_kit')} />
              <span className="text-sm text-dark-600">É um kit</span>
            </label>
          </div>
        </div>

        {/* Tab: Variações */}
        <div className={activeTab === 'Variações' ? 'flex flex-col gap-3' : 'hidden'}>
          {variacoesError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {variacoesError}
            </p>
          )}

          {fields.map((field, idx) => (
            <div key={field.id} className="border border-gold-100 rounded-xl p-4 bg-cream-50/30">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-dark-500 uppercase tracking-wide">Variação {idx + 1}</p>
                {fields.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(idx)}
                    className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Remover variação"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Nome"
                  placeholder="Ex: Tamanho, Cor..."
                  error={errors.variacoes?.[idx]?.nome?.message}
                  {...register(`variacoes.${idx}.nome`)}
                />
                <Input
                  label="Valor"
                  placeholder="Ex: 18, Dourado..."
                  error={errors.variacoes?.[idx]?.valor?.message}
                  {...register(`variacoes.${idx}.valor`)}
                />
                <Input
                  label="Estoque atual"
                  type="number"
                  min="0"
                  error={errors.variacoes?.[idx]?.estoque_atual?.message}
                  {...register(`variacoes.${idx}.estoque_atual`, { valueAsNumber: true })}
                />
                <Input
                  label="Estoque mínimo"
                  type="number"
                  min="0"
                  error={errors.variacoes?.[idx]?.estoque_minimo?.message}
                  {...register(`variacoes.${idx}.estoque_minimo`, { valueAsNumber: true })}
                />
                <Controller
                  name={`variacoes.${idx}.custo_adicional`}
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput
                      label="Custo adicional"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-gold-500 w-4 h-4"
                      {...register(`variacoes.${idx}.ativo`)}
                    />
                    <span className="text-sm text-dark-600">Ativa</span>
                  </label>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => append({ ...EMPTY_VARIACAO })}
            className="flex items-center gap-2 text-sm text-gold-600 hover:text-gold-700 font-medium py-2 transition-colors"
          >
            <Plus size={14} />
            Adicionar variação
          </button>
        </div>
      </form>
    </Modal>
  )
}
