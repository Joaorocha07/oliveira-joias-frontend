'use client'

import { useEffect, useCallback, useState } from 'react'
import { useForm, Controller, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAlert } from '@/hooks/use-alert'
import { Modal, Button, Select, Input, Spinner } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { SearchableSelect, type SelectOption } from '@/components/forms/searchable-select'
import { ModalQuickCliente } from '@/components/modals/modal-quick-cliente'
import { ModalQuickVendedor } from '@/components/modals/modal-quick-vendedor'
import { updateVenda } from '@/services/vendas'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth-context'
import {
  formatMoney, toInputDate, VENDA_STATUS_LABEL, FORMA_PAGAMENTO_LABEL,
} from '@/utils'
import type { VendaStatus, FormaPagamento, OrigemCliente, Produto, ProdutoVariacao } from '@/types'
import type { VendaRow } from '@/app/(app)/vendas/page'

const itemEditSchema = z.object({
  id: z.string(),
  produto_id: z.string(),
  variacao_id: z.string().nullable(),
  nome_produto: z.string().min(1, 'Nome obrigatorio'),
  quantidade: z.number().int().min(1, 'Minimo 1'),
  preco_unitario: z.number().min(0.01, 'Valor invalido'),
  custo_unitario: z.number().min(0),
  desconto: z.number().min(0),
})

const schema = z.object({
  cliente_id: z.string().nullable(),
  vendedor_id: z.string().nullable(),
  origem_id: z.string().nullable(),
  origem_outro: z.string().nullable(),
  status: z.enum(['orcamento', 'pendente', 'pago', 'crediario', 'cancelado'] as const),
  forma_pagamento: z.enum([
    'dinheiro', 'pix', 'cartao_debito', 'cartao_credito',
    'crediario', 'transferencia', 'cheque', 'misto',
  ] as const),
  desconto: z.number().min(0),
  data_venda: z.string().min(1),
  observacoes: z.string(),
  itens: z.array(itemEditSchema),
  descricao_livre: z.string(),
  valor_livre: z.number().min(0),
  custo_livre: z.number().min(0),
})

type FormData = z.infer<typeof schema>

const STATUS_OPTS: VendaStatus[] = ['orcamento', 'pendente', 'pago', 'crediario', 'cancelado']
const FORMAS: FormaPagamento[] = [
  'dinheiro', 'pix', 'cartao_debito', 'cartao_credito',
  'crediario', 'transferencia', 'cheque', 'misto',
]

interface ModalEditarVendaProps {
  open: boolean
  onClose: () => void
  onSuccess: (updated: Partial<VendaRow>) => void
  venda: VendaRow | null
  displayNum?: number
}

function buildDefaults(venda: VendaRow): FormData {
  return {
    cliente_id: venda.cliente_id,
    vendedor_id: venda.vendedor_id,
    origem_id: venda.origem_id,
    origem_outro: venda.origem_outro,
    status: venda.status,
    forma_pagamento: venda.forma_pagamento,
    desconto: venda.desconto,
    data_venda: toInputDate(venda.data_venda),
    observacoes: venda.observacoes ?? '',
    itens: (venda.itens ?? []).map((item) => ({
      id: item.id,
      produto_id: item.produto_id,
      variacao_id: item.variacao_id,
      nome_produto: item.nome_produto,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      custo_unitario: item.custo_unitario,
      desconto: item.desconto,
    })),
    descricao_livre: venda.descricao_livre ?? '',
    valor_livre: venda.tipo === 'livre' ? venda.subtotal : 0,
    custo_livre: venda.custo_livre ?? 0,
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function itemSubtotal(item: FormData['itens'][number]) {
  return round2(Math.max(0, (item.quantidade ?? 0) * (item.preco_unitario ?? 0) - (item.desconto ?? 0)))
}

export function ModalEditarVenda({ open, onClose, onSuccess, venda, displayNum }: ModalEditarVendaProps) {
  const { user } = useAuth()
  const alert = useAlert()
  const [quickClienteOpen, setQuickClienteOpen] = useState(false)
  const [quickVendedorOpen, setQuickVendedorOpen] = useState(false)
  const [clienteDisplayValue, setClienteDisplayValue] = useState<string | undefined>(undefined)
  const [vendedorDisplayValue, setVendedorDisplayValue] = useState<string | undefined>(undefined)
  const [origens, setOrigens] = useState<OrigemCliente[]>([])
  const [itemProdutos, setItemProdutos] = useState<Record<number, { variacoes: ProdutoVariacao[]; loading: boolean }>>({})
  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: venda ? buildDefaults(venda) : undefined,
  })

  const watchedDesconto = useWatch({ control, name: 'desconto' }) ?? 0
  const watchedItens = useWatch({ control, name: 'itens' }) ?? []
  const watchedValorLivre = useWatch({ control, name: 'valor_livre' }) ?? 0
  const watchedOrigemId = useWatch({ control, name: 'origem_id' })
  const isLivre = venda?.tipo === 'livre'
  const subtotal = isLivre
    ? round2(watchedValorLivre)
    : watchedItens.reduce((sum, item) => sum + itemSubtotal(item), 0)
  const total = round2(Math.max(0, subtotal - watchedDesconto))

  const origemSelecionada = origens.find((o) => o.id === watchedOrigemId)
  const isOrigemOutro = origemSelecionada?.nome === 'Outro'

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
      sublabel: `${p.codigo} - ${formatMoney(p.preco_venda)}`,
    }))
  }, [])

  const loadProdutoVariacoes = useCallback(async (index: number, produtoId: string, selectedVariacaoId?: string | null) => {
    setItemProdutos((prev) => ({ ...prev, [index]: { variacoes: prev[index]?.variacoes ?? [], loading: true } }))

    const { data: produto } = await supabase
      .from('produtos')
      .select('*, variacoes:produto_variacoes(*)')
      .eq('id', produtoId)
      .single()

    const p = produto as (Produto & { variacoes: ProdutoVariacao[] }) | null
    if (!p) {
      setItemProdutos((prev) => ({ ...prev, [index]: { variacoes: [], loading: false } }))
      return null
    }

    const variacoes = (p.variacoes ?? []).filter((v) => (
      v.ativo && (v.estoque_atual > 0 || v.id === selectedVariacaoId)
    ))
    setItemProdutos((prev) => ({ ...prev, [index]: { variacoes, loading: false } }))
    return { produto: p, variacoes }
  }, [])

  async function handleProdutoSelect(index: number, produtoId: string) {
    const loaded = await loadProdutoVariacoes(index, produtoId)
    if (!loaded) return false

    const { produto, variacoes } = loaded
    if (variacoes.length === 0) {
      setError(`itens.${index}.produto_id`, { type: 'manual', message: 'Produto sem estoque disponivel.' })
      alert.error('Sem Estoque', 'Este produto acabou e nao pode ser selecionado.')
      return false
    }

    clearErrors([`itens.${index}.produto_id`, `itens.${index}.quantidade`, `itens.${index}.variacao_id`])
    setValue(`itens.${index}.produto_id`, produto.id)
    setValue(`itens.${index}.nome_produto`, produto.nome)
    setValue(`itens.${index}.preco_unitario`, produto.preco_venda)
    setValue(`itens.${index}.custo_unitario`, produto.custo)
    setValue(`itens.${index}.variacao_id`, variacoes.length === 1 ? variacoes[0].id : null)
    setValue(`itens.${index}.quantidade`, 1)
    return true
  }

  useEffect(() => {
    if (open && venda) {
      const timeoutId = window.setTimeout(() => {
        reset(buildDefaults(venda))
        setClienteDisplayValue(venda.cliente?.nome ?? undefined)
        setVendedorDisplayValue(venda.vendedor?.nome ?? undefined)
        setItemProdutos({})
        void Promise.all(
          (venda.itens ?? []).map((item, index) => (
            loadProdutoVariacoes(index, item.produto_id, item.variacao_id)
          )),
        )
        supabase
          .from('origens_cliente')
          .select('id, nome, ativo, created_at')
          .order('nome')
          .then(({ data, error }) => {
            if (error) alert.error('Erro', 'Erro ao carregar origens.')
            else setOrigens((data as OrigemCliente[]) ?? [])
          })
      }, 0)

      return () => window.clearTimeout(timeoutId)
    }
  }, [alert, loadProdutoVariacoes, open, venda, reset])

  function handleQuickClienteSuccess(cliente: { id: string; nome: string; telefone: string | null }) {
    setValue('cliente_id', cliente.id)
    setClienteDisplayValue(cliente.nome)
  }

  function handleQuickVendedorSuccess(vendedor: { id: string; nome: string }) {
    setValue('vendedor_id', vendedor.id)
    setVendedorDisplayValue(vendedor.nome)
  }

  async function onSave(data: FormData) {
    if (!venda || !user) return
    if (venda.tipo === 'normal') {
      const stockErrorIndex = data.itens.findIndex((item, index) => {
        const variacoes = itemProdutos[index]?.variacoes ?? []
        if (variacoes.length === 0) return false
        const selectedVariation = variacoes.find((v) => v.id === item.variacao_id)
        const original = venda.itens?.find((current) => current.id === item.id)
        const originalQty = original?.variacao_id === item.variacao_id ? original.quantidade : 0
        return !selectedVariation || item.quantidade > selectedVariation.estoque_atual + originalQty
      })

      if (stockErrorIndex >= 0) {
        setError(`itens.${stockErrorIndex}.quantidade`, { type: 'manual', message: 'Quantidade maior que o estoque disponivel.' })
        alert.error('Estoque Insuficiente', 'A quantidade informada passa do estoque disponivel.')
        return
      }
    }

    const { error } = await updateVenda(venda.id, subtotal, data, user.id)
    if (error) {
      alert.error('Erro', error)
    } else {
      const updatedItens = data.itens.map((item) => {
        const original = venda.itens?.find((current) => current.id === item.id)
        const sameProduct = original?.produto_id === item.produto_id
        const sameVariation = original?.variacao_id === item.variacao_id
        return {
          ...item,
          descricao: original?.descricao ?? null,
          subtotal: itemSubtotal(item),
          produto: sameProduct ? original?.produto : undefined,
          variacao: sameVariation ? original?.variacao : undefined,
        }
      })
      onSuccess({
        cliente_id: data.cliente_id,
        vendedor_id: data.vendedor_id,
        origem_id: data.origem_id,
        origem_outro: data.origem_outro,
        status: data.status,
        forma_pagamento: data.forma_pagamento,
        desconto: data.desconto,
        subtotal,
        total,
        valor_pago: data.forma_pagamento === 'crediario' ? 0 : total,
        data_venda: data.data_venda,
        observacoes: data.observacoes,
        descricao_livre: venda.tipo === 'livre' ? data.descricao_livre : venda.descricao_livre,
        custo_livre: venda.tipo === 'livre' ? data.custo_livre : venda.custo_livre,
        itens: venda.tipo === 'normal' ? updatedItens : venda.itens,
        cliente: data.cliente_id ? { nome: clienteDisplayValue ?? venda.cliente?.nome ?? 'Cliente', telefone: venda.cliente?.telefone ?? null } : null,
        vendedor: data.vendedor_id ? { nome: vendedorDisplayValue ?? venda.vendedor?.nome ?? 'Vendedor' } : null,
        origem: data.origem_id && origemSelecionada ? { id: origemSelecionada.id, nome: origemSelecionada.nome } : null,
      })
      alert.success('Venda Atualizada!', 'As alterações foram salvas com sucesso.', {
        onConfirm: () => onClose(),
      })
    }
  }

  const itens = watchedItens

  return (
    <>
    <Modal
      open={open}
      onClose={onClose}
      title={`Editar Venda #${displayNum ?? venda?.numero}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="form-editar-venda"
            loading={isSubmitting}
          >
            Salvar
          </Button>
        </>
      }
    >
      <form id="form-editar-venda" onSubmit={handleSubmit(onSave)} className="flex flex-col gap-5">
        {venda?.tipo === 'normal' && itens.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-dark-400 uppercase tracking-wide mb-2">
              Itens da venda
            </p>
            <div className="flex flex-col gap-3">
              {itens.map((item, idx) => (
                (() => {
                  const itemState = itemProdutos[idx]
                  const selectedVariation = itemState?.variacoes.find((v) => v.id === item.variacao_id)
                  const original = venda?.itens?.find((current) => current.id === item.id)
                  const originalQty = original?.variacao_id === item.variacao_id ? original.quantidade : 0
                  const estoqueDisponivel = selectedVariation
                    ? selectedVariation.estoque_atual + originalQty
                    : itemState?.variacoes.length === 1
                      ? itemState.variacoes[0].estoque_atual + (original?.variacao_id === itemState.variacoes[0].id ? original.quantidade : 0)
                      : undefined

                  return (
                    <div key={item.id} className="rounded-xl border border-gold-100 bg-cream-50/40 p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-dark-400">Item {idx + 1}</span>
                      </div>

                      <div className="mt-3">
                        <SearchableSelect
                          label="Produto"
                          value={item.produto_id || null}
                          displayValue={item.nome_produto}
                          onChange={(id) => { if (!id) return false; return handleProdutoSelect(idx, id) }}
                          onSearch={searchProdutos}
                          placeholder="Buscar produto..."
                          error={errors.itens?.[idx]?.produto_id?.message}
                        />
                      </div>

                      {itemState?.loading && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-dark-400">
                          <Spinner size={12} /> Carregando variacoes...
                        </div>
                      )}

                      {itemState && itemState.variacoes.length > 1 && (
                        <div className="mt-3">
                          <Select
                            label="Variacao"
                            placeholder="Selecione a variacao..."
                            error={errors.itens?.[idx]?.variacao_id?.message}
                            {...register(`itens.${idx}.variacao_id`)}
                          >
                            {itemState.variacoes.map((v) => {
                              const estoque = v.estoque_atual + (original?.variacao_id === v.id ? original.quantidade : 0)
                              return (
                                <option key={v.id} value={v.id}>
                                  {v.nome}: {v.valor} (estoque: {estoque})
                                </option>
                              )
                            })}
                          </Select>
                        </div>
                      )}

                      {estoqueDisponivel !== undefined && (
                        <p className="mt-2 text-xs text-dark-400">Estoque disponivel: {estoqueDisponivel} un.</p>
                      )}

                      <div className="mt-3 grid grid-cols-3 gap-3">
                        <Input
                          label="Qtd"
                          type="number"
                          min={1}
                          max={estoqueDisponivel}
                          error={errors.itens?.[idx]?.quantidade?.message}
                          {...register(`itens.${idx}.quantidade`, {
                            valueAsNumber: true,
                            validate: (quantidade) => {
                              if (estoqueDisponivel === undefined) return true
                              return quantidade <= estoqueDisponivel || `Disponivel: ${estoqueDisponivel} un.`
                            },
                          })}
                        />
                        <Controller
                          name={`itens.${idx}.preco_unitario`}
                          control={control}
                          render={({ field }) => (
                            <CurrencyInput
                              label="Valor unit."
                              value={field.value}
                              onChange={field.onChange}
                              error={errors.itens?.[idx]?.preco_unitario?.message}
                            />
                          )}
                        />
                        <Controller
                          name={`itens.${idx}.desconto`}
                          control={control}
                          render={({ field }) => (
                            <CurrencyInput
                              label="Desconto"
                              value={field.value}
                              onChange={field.onChange}
                              error={errors.itens?.[idx]?.desconto?.message}
                            />
                          )}
                        />
                      </div>

                      <div className="mt-2 text-right text-sm text-dark-500">
                        Subtotal: <strong className="text-dark-700">{formatMoney(itemSubtotal(item))}</strong>
                      </div>
                    </div>
                  )
                })()
              ))}
            </div>
          </div>
        )}

        {venda?.tipo === 'livre' && (
          <div className="flex flex-col gap-4 rounded-xl border border-gold-100 bg-cream-50/40 p-4">
            <div className="flex flex-col gap-1">
              <label className="label-base">Produto/servico</label>
              <textarea
                className={`input-base resize-none ${errors.descricao_livre ? 'border-red-400' : ''}`}
                rows={3}
                {...register('descricao_livre')}
              />
              {errors.descricao_livre && (
                <p className="text-xs text-red-600">{errors.descricao_livre.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="valor_livre"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    label="Valor da venda"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.valor_livre?.message}
                  />
                )}
              />
              <Controller
                name="custo_livre"
                control={control}
                render={({ field }) => (
                  <CurrencyInput
                    label="Custo/Despesa"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.custo_livre?.message}
                  />
                )}
              />
            </div>
          </div>
        )}

        {/* Itens da venda (read-only) */}
        {false && (
          <div>
            <p className="text-xs font-medium text-dark-400 uppercase tracking-wide mb-2">
              Itens da venda
            </p>
            <div className="border border-gold-100 rounded-xl overflow-hidden">
              {([] as NonNullable<VendaRow['itens']>).map((item, idx) => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between px-4 py-2.5 text-sm ${idx > 0 ? 'border-t border-gold-50' : ''}`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xs text-dark-300 font-mono w-6 flex-shrink-0">
                      {item.quantidade}×
                    </span>
                    <span className="text-dark-700 truncate">{item.nome_produto}</span>
                    {item.desconto > 0 && (
                      <span className="text-[10px] text-red-400 flex-shrink-0">
                        −{formatMoney(item.desconto)}
                      </span>
                    )}
                  </div>
                  <span className="text-dark-600 font-medium ml-3 flex-shrink-0">
                    {formatMoney(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Campos editáveis */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Status"
            error={errors.status?.message}
            {...register('status')}
          >
            {STATUS_OPTS.map((s) => (
              <option key={s} value={s}>{VENDA_STATUS_LABEL[s]}</option>
            ))}
          </Select>

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

        <Controller
          name="cliente_id"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              label="Cliente"
              value={field.value}
              onChange={(id, option) => {
                field.onChange(id)
                if (option) setClienteDisplayValue(option.label)
                else if (id === null) setClienteDisplayValue(undefined)
                return true
              }}
              onSearch={searchClientes}
              onCreateNew={() => setQuickClienteOpen(true)}
              createNewLabel="Cadastrar cliente"
              placeholder="Buscar cliente..."
              displayValue={clienteDisplayValue}
              error={errors.cliente_id?.message}
            />
          )}
        />

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
              {origens.map((origem) => (
                <option key={origem.id} value={origem.id}>{origem.nome}</option>
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

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Forma de pagamento"
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
              <CurrencyInput
                label="Desconto total"
                value={field.value}
                onChange={field.onChange}
                error={errors.desconto?.message}
              />
            )}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="label-base">Observações</label>
          <textarea
            className="input-base resize-none"
            rows={2}
            placeholder="Observações sobre a venda..."
            {...register('observacoes')}
          />
        </div>

        {/* Resumo */}
        <div className="border-t border-gold-100 pt-4 flex flex-col gap-1.5">
          <div className="flex justify-between text-sm text-dark-500">
            <span>Subtotal</span>
            <span>{formatMoney(subtotal)}</span>
          </div>
          {watchedDesconto > 0 && (
            <div className="flex justify-between text-sm text-dark-500">
              <span>Desconto</span>
              <span className="text-red-500">− {formatMoney(watchedDesconto)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-medium text-dark-700 mt-0.5">
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
