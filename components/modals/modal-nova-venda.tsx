'use client'

import { useEffect, useCallback, useState } from 'react'
import { useForm, useFieldArray, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2, Package } from 'lucide-react'
import { useAlert } from '@/hooks/use-alert'
import { Modal, Button, Select, Input, Spinner } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { SearchableSelect, type SelectOption } from '@/components/forms/searchable-select'
import { ModalQuickCliente } from '@/components/modals/modal-quick-cliente'
import { ModalQuickVendedor } from '@/components/modals/modal-quick-vendedor'
import { vendaSchema, type VendaFormData } from '@/schemas/venda'
import { createVenda } from '@/services/vendas'
import { useAuth } from '@/context/auth-context'
import { supabase } from '@/lib/supabase'
import { today, formatMoney, FORMA_PAGAMENTO_LABEL } from '@/utils'
import type { FormaPagamento, Produto, ProdutoVariacao, OrigemCliente } from '@/types'

interface ModalNovaVendaProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const FORMAS: FormaPagamento[] = [
  'dinheiro', 'pix', 'cartao_debito', 'cartao_credito',
  'crediario', 'transferencia', 'cheque', 'misto',
]

interface ItemProdutoState {
  variacoes: ProdutoVariacao[]
  loading: boolean
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

export function ModalNovaVenda({ open, onClose, onSuccess }: ModalNovaVendaProps) {
  const { user } = useAuth()
  const alert = useAlert()
  const [itemProdutos, setItemProdutos] = useState<Record<number, ItemProdutoState>>({})
  const [quickClienteOpen, setQuickClienteOpen] = useState(false)
  const [quickVendedorOpen, setQuickVendedorOpen] = useState(false)
  const [clienteDisplayValue, setClienteDisplayValue] = useState<string | undefined>(undefined)
  const [origens, setOrigens] = useState<OrigemCliente[]>([])
  const [vendedorDisplayValue, setVendedorDisplayValue] = useState<string | undefined>(undefined)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<VendaFormData>({
    resolver: zodResolver(vendaSchema) as never,
    defaultValues: {
      cliente_id: null,
      vendedor_id: null,
      origem_id: null,
      origem_outro: null,
      data_venda: today(),
      forma_pagamento: undefined,
      desconto: 0,
      observacoes: '',
      itens: [],
      num_parcelas: 1,
      entrada: 0,
      dia_vencimento: 10,
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'itens' })

  const watchedItens = watch('itens')
  const watchedDesconto = watch('desconto')
  const watchedFormaPagamento = watch('forma_pagamento')
  const isCrediario = watchedFormaPagamento === 'crediario'

  const subtotal = (watchedItens ?? []).reduce((acc, item) => {
    return acc + round2(Math.max(0, (item.quantidade ?? 0) * (item.preco_unitario ?? 0) - (item.desconto ?? 0)))
  }, 0)
  const total = round2(Math.max(0, subtotal - (watchedDesconto ?? 0)))

  useEffect(() => {
    if (open) {
      reset({
        cliente_id: null,
        vendedor_id: null,
        origem_id: null,
        origem_outro: null,
        data_venda: today(),
        forma_pagamento: undefined,
        desconto: 0,
        observacoes: '',
        itens: [],
        num_parcelas: 1,
        entrada: 0,
        dia_vencimento: 10,
      })
      setItemProdutos({})
      setClienteDisplayValue(undefined)
      setVendedorDisplayValue(undefined)
      supabase
        .from('origens_cliente')
        .select('id, nome, ativo, created_at')
        .order('nome')
        .then(({ data, error }) => {
          if (error) alert.error('Erro', 'Erro ao carregar origens.')
          else setOrigens((data as OrigemCliente[]) ?? [])
        })
    }
  }, [open, reset])

  const watchedOrigemId = watch('origem_id')
  const origemSelecionada = origens.find((o) => o.id === watchedOrigemId)
  const isOrigemOutro = origemSelecionada?.nome === 'Outro'

  const searchVendedores = useCallback(async (q: string): Promise<SelectOption[]> => {
    const { data } = await supabase
      .from('profiles')
      .select('id, nome, role')
      .eq('ativo', true)
      .ilike('nome', `%${q}%`)
      .limit(20)
    return (data ?? []).map((v: { id: string; nome: string; role: string }) => ({
      id: v.id,
      label: v.nome,
      sublabel: v.role,
    }))
  }, [])

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

  const searchProdutos = useCallback(async (q: string): Promise<SelectOption[]> => {
    const { data } = await supabase
      .from('produtos')
      .select('id, nome, codigo, preco_venda, variacoes:produto_variacoes(ativo, estoque_atual)')
      .eq('ativo', true)
      .ilike('nome', `%${q}%`)
      .limit(20)
    return (data ?? []).map((p: {
      id: string
      nome: string
      codigo: string
      preco_venda: number
      variacoes?: { ativo: boolean; estoque_atual: number }[]
    }) => ({
      id: p.id,
      label: p.nome,
      sublabel: `${p.codigo} · ${formatMoney(p.preco_venda)}`,
    }))
  }, [])

  async function handleProdutoSelect(index: number, produtoId: string) {
    setItemProdutos((prev) => ({ ...prev, [index]: { variacoes: [], loading: true } }))

    const { data: produto } = await supabase
      .from('produtos')
      .select('*, variacoes:produto_variacoes(*)')
      .eq('id', produtoId)
      .single()

    const p = produto as (Produto & { variacoes: ProdutoVariacao[] }) | null
    if (!p) {
      setItemProdutos((prev) => ({ ...prev, [index]: { variacoes: [], loading: false } }))
      return false
    }

    const variacoes = (p.variacoes ?? []).filter((v) => v.ativo && v.estoque_atual > 0)
    if (variacoes.length === 0) {
      setItemProdutos((prev) => ({ ...prev, [index]: { variacoes: [], loading: false } }))
      setError(`itens.${index}.produto_id`, { type: 'manual', message: 'Produto sem estoque disponível.' })
      alert.error('Sem Estoque', 'Este produto acabou e não pode ser selecionado.')
      return false
    }

    setItemProdutos((prev) => ({ ...prev, [index]: { variacoes, loading: false } }))
    clearErrors([`itens.${index}.produto_id`, `itens.${index}.quantidade`, `itens.${index}.variacao_id`])
    setValue(`itens.${index}.produto_id`, p.id)
    setValue(`itens.${index}.nome_produto`, p.nome)
    setValue(`itens.${index}.preco_unitario`, p.preco_venda)
    setValue(`itens.${index}.custo_unitario`, p.custo)
    setValue(`itens.${index}.variacao_id`, variacoes.length === 1 ? variacoes[0].id : null)
    setValue(`itens.${index}.quantidade`, 1)
    return true
  }

  function addItem() {
    append({ produto_id: '', variacao_id: null, nome_produto: '', quantidade: 1, preco_unitario: 0, custo_unitario: 0, desconto: 0 })
  }

  function removeItem(index: number) {
    remove(index)
    setItemProdutos((prev) => {
      const next = { ...prev }
      delete next[index]
      const reindexed: typeof next = {}
      Object.entries(next).forEach(([k, v]) => {
        const ki = parseInt(k)
        reindexed[ki > index ? ki - 1 : ki] = v
      })
      return reindexed
    })
  }

  function handleQuickClienteSuccess(cliente: { id: string; nome: string; telefone: string | null }) {
    setValue('cliente_id', cliente.id)
    setClienteDisplayValue(cliente.nome)
  }

  function handleQuickVendedorSuccess(vendedor: { id: string; nome: string }) {
    setValue('vendedor_id', vendedor.id)
    setVendedorDisplayValue(vendedor.nome)
  }

  async function onSave(data: VendaFormData) {
    if (!user) return

    const stockErrorIndex = data.itens.findIndex((item, index) => {
      const variacoes = itemProdutos[index]?.variacoes ?? []
      const selectedVariation = variacoes.find((v) => v.id === item.variacao_id)
      if (!selectedVariation) return true
      return item.quantidade > selectedVariation.estoque_atual
    })

    if (stockErrorIndex >= 0) {
      setError(`itens.${stockErrorIndex}.quantidade`, { type: 'manual', message: 'Quantidade maior que o estoque disponível.' })
      alert.error('Estoque Insuficiente', 'A quantidade informada passa do estoque disponível.')
      return
    }

    const { error } = await createVenda(data, user.id)
    if (error) {
      alert.error('Erro', error)
    } else {
      alert.success('Venda Registrada!', 'Venda registrada com sucesso.', {
        onConfirm: () => { onSuccess(); onClose() },
      })
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Nova Venda"
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
            <Button variant="primary" type="submit" form="form-nova-venda" loading={isSubmitting}>
              Registrar Venda
            </Button>
          </>
        }
      >
        <form id="form-nova-venda" onSubmit={handleSubmit(onSave)} className="flex flex-col gap-5">
          {/* Cliente + Data */}
          <div className="grid grid-cols-2 gap-4">
            <Controller
              name="cliente_id"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  label="Cliente (opcional)"
                  value={field.value}
                  displayValue={clienteDisplayValue}
                  onChange={(id, option) => {
                    field.onChange(id)
                    if (option) setClienteDisplayValue(option.label)
                    else if (id === null) setClienteDisplayValue(undefined)
                    return !!option || id === null
                  }}
                  onSearch={searchClientes}
                  onCreateNew={() => setQuickClienteOpen(true)}
                  createNewLabel="Cadastrar cliente"
                  placeholder="Buscar cliente..."
                  error={errors.cliente_id?.message}
                />
              )}
            />
            <div className="flex flex-col gap-1">
              <label className="label-base">Data da venda</label>
              <input
                type="date"
                className={`input-base ${errors.data_venda ? 'border-red-400' : ''}`}
                {...register('data_venda')}
              />
              {errors.data_venda && (
                <p className="text-xs text-red-600">{errors.data_venda.message}</p>
              )}
            </div>
          </div>

          {/* Vendedor + Origem */}
          <div className="grid grid-cols-2 gap-4">
            <Controller
              name="vendedor_id"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  label="Vendedor (opcional)"
                  value={field.value}
                  displayValue={vendedorDisplayValue}
                  onChange={(id, option) => {
                    field.onChange(id)
                    setVendedorDisplayValue(option?.label)
                    return true
                  }}
                  onSearch={searchVendedores}
                  onCreateNew={() => setQuickVendedorOpen(true)}
                  createNewLabel="Cadastrar vendedor"
                  placeholder="Buscar vendedor..."
                />
              )}
            />
            <div className="flex flex-col gap-1">
              <label className="label-base">Origem do cliente</label>
              <select
                className="input-base"
                {...register('origem_id')}
                onChange={(e) => {
                  setValue('origem_id', e.target.value || null)
                  setValue('origem_outro', null)
                }}
              >
                <option value="">Não informado</option>
                {origens.map((o) => (
                  <option key={o.id} value={o.id}>{o.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {isOrigemOutro && (
            <Input
              label="Onde exatamente? *"
              placeholder="Ex: Feira do bairro, amigo João..."
              {...register('origem_outro')}
              error={errors.origem_outro?.message}
            />
          )}

          {/* Itens */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-dark-600">Itens da venda</h4>
              <Button type="button" variant="ghost" size="sm" leftIcon={<Plus size={13} />} onClick={addItem}>
                Adicionar item
              </Button>
            </div>

            {fields.length === 0 && (
              <div className="border border-dashed border-gold-200 rounded-xl p-6 text-center">
                <Package size={20} className="mx-auto mb-2 text-dark-300" />
                <p className="text-sm text-dark-400">Nenhum item adicionado</p>
                <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={addItem}>
                  Adicionar primeiro item
                </Button>
              </div>
            )}

            {typeof errors.itens?.message === 'string' && (
              <p className="text-xs text-red-600">{errors.itens.message}</p>
            )}

            {fields.map((field, index) => {
              const itemState = itemProdutos[index]
              const itemErrors = errors.itens?.[index]
              const item = watchedItens?.[index]
              const produtoId = item?.produto_id
              const selectedVariation = itemState?.variacoes.find((v) => v.id === item?.variacao_id)
              const estoqueDisponivel = selectedVariation?.estoque_atual ?? (
                itemState?.variacoes.length === 1 ? itemState.variacoes[0].estoque_atual : undefined
              )

              return (
                <div key={field.id} className="border border-gold-100 rounded-xl p-4 bg-cream-50/50 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-dark-400">Item {index + 1}</span>
                    <Button type="button" variant="danger-ghost" size="icon" onClick={() => removeItem(index)}>
                      <Trash2 size={13} />
                    </Button>
                  </div>

                  <SearchableSelect
                    label="Produto"
                    value={produtoId || null}
                    onChange={(id) => { if (!id) return; return handleProdutoSelect(index, id) }}
                    onSearch={searchProdutos}
                    placeholder="Buscar produto..."
                    error={itemErrors?.produto_id?.message}
                  />

                  {itemState?.loading && (
                    <div className="flex items-center gap-2 text-xs text-dark-400">
                      <Spinner size={12} /> Carregando variações...
                    </div>
                  )}

                  {itemState && itemState.variacoes.length > 1 && (
                    <Select
                      label="Variação"
                      placeholder="Selecione a variação..."
                      error={itemErrors?.variacao_id?.message}
                      {...register(`itens.${index}.variacao_id`)}
                    >
                      {itemState.variacoes.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nome}: {v.valor} (estoque: {v.estoque_atual})
                        </option>
                      ))}
                    </Select>
                  )}

                  {estoqueDisponivel !== undefined && (
                    <p className="text-xs text-dark-400">Estoque disponível: {estoqueDisponivel} un.</p>
                  )}

                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      label="Qtd"
                      type="number"
                      min={1}
                      max={estoqueDisponivel}
                      error={itemErrors?.quantidade?.message}
                      {...register(`itens.${index}.quantidade`, {
                        valueAsNumber: true,
                        validate: (quantidade) => {
                          if (estoqueDisponivel === undefined) return true
                          return quantidade <= estoqueDisponivel || `Disponível: ${estoqueDisponivel} un.`
                        },
                      })}
                    />
                    <Controller
                      name={`itens.${index}.preco_unitario`}
                      control={control}
                      render={({ field: f }) => (
                        <CurrencyInput label="Preço unit." value={f.value} onChange={f.onChange} error={itemErrors?.preco_unitario?.message} />
                      )}
                    />
                    <Controller
                      name={`itens.${index}.desconto`}
                      control={control}
                      render={({ field: f }) => (
                        <CurrencyInput label="Desconto" value={f.value} onChange={f.onChange} />
                      )}
                    />
                  </div>

                  {(() => {
                    if (!item) return null
                    const sub = round2(Math.max(0, (item.quantidade ?? 0) * (item.preco_unitario ?? 0) - (item.desconto ?? 0)))
                    return (
                      <div className="text-right text-sm text-dark-500">
                        Subtotal: <strong className="text-dark-700">{formatMoney(sub)}</strong>
                      </div>
                    )
                  })()}
                </div>
              )
            })}
          </div>

          {/* Forma de pagamento + Desconto total */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Forma de pagamento"
              placeholder="Selecione..."
              error={errors.forma_pagamento?.message}
              {...register('forma_pagamento')}
            >
              {FORMAS.map((f) => (
                <option key={f} value={f}>{FORMA_PAGAMENTO_LABEL[f]}</option>
              ))}
            </Select>
            <Controller
              name="desconto"
              control={control}
              render={({ field }) => (
                <CurrencyInput label="Desconto total" value={field.value} onChange={field.onChange} error={errors.desconto?.message} />
              )}
            />
          </div>

          {/* Crediário */}
          {isCrediario && (
            <div className="border border-gold-200 rounded-xl p-4 bg-gold-50/30 flex flex-col gap-4">
              <h4 className="text-sm font-medium text-dark-600">Condições do crediário</h4>
              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Nº de parcelas"
                  type="number"
                  min={1}
                  max={60}
                  error={errors.num_parcelas?.message}
                  {...register('num_parcelas', { valueAsNumber: true })}
                />
                <Controller
                  name="entrada"
                  control={control}
                  render={({ field }) => (
                    <CurrencyInput label="Entrada" value={field.value} onChange={field.onChange} error={errors.entrada?.message} />
                  )}
                />
                <Input
                  label="Dia de vencimento"
                  type="number"
                  min={1}
                  max={28}
                  error={errors.dia_vencimento?.message}
                  {...register('dia_vencimento', { valueAsNumber: true })}
                />
              </div>
              {(() => {
                const entrada = watch('entrada') ?? 0
                const numParcelas = watch('num_parcelas') ?? 1
                const saldo = Math.max(0, total - entrada)
                const valorParcela = numParcelas > 0 ? round2(saldo / numParcelas) : 0
                return (
                  <div className="text-sm text-dark-500">
                    Saldo a parcelar: <strong>{formatMoney(saldo)}</strong>
                    {valorParcela > 0 && (
                      <> · {numParcelas}x de <strong>{formatMoney(valorParcela)}</strong></>
                    )}
                  </div>
                )
              })()}
            </div>
          )}

          {/* Observações */}
          <div className="flex flex-col gap-1">
            <label className="label-base">Observações (opcional)</label>
            <textarea className="input-base resize-none" rows={2} {...register('observacoes')} />
          </div>

          {/* Resumo */}
          <div className="border-t border-gold-100 pt-4 flex flex-col gap-1">
            <div className="flex justify-between text-sm text-dark-500">
              <span>Subtotal</span><span>{formatMoney(subtotal)}</span>
            </div>
            {(watchedDesconto ?? 0) > 0 && (
              <div className="flex justify-between text-sm text-dark-500">
                <span>Desconto</span>
                <span className="text-red-600">− {formatMoney(watchedDesconto ?? 0)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-medium text-dark-700 mt-1">
              <span>Total</span>
              <span className="font-display text-lg">{formatMoney(total)}</span>
            </div>
          </div>
        </form>
      </Modal>

      <ModalQuickCliente
        open={quickClienteOpen}
        onClose={() => setQuickClienteOpen(false)}
        onSuccess={handleQuickClienteSuccess}
      />
      <ModalQuickVendedor
        open={quickVendedorOpen}
        onClose={() => setQuickVendedorOpen(false)}
        onSuccess={handleQuickVendedorSuccess}
      />
    </>
  )
}
