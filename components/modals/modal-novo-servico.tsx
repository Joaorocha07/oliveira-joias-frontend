'use client'

import { useEffect, useCallback, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAlert } from '@/hooks/use-alert'
import { Modal, Button, Select, Input } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { SearchableSelect, type SelectOption } from '@/components/forms/searchable-select'
import { ModalQuickCliente } from '@/components/modals/modal-quick-cliente'
import { ModalQuickVendedor } from '@/components/modals/modal-quick-vendedor'
import { servicoSchema, type ServicoFormData } from '@/schemas/servico'
import { createServico, updateServico } from '@/services/servicos'
import { useAuth } from '@/context/auth-context'
import { supabase } from '@/lib/supabase'
import { today, SERVICO_STATUS_LABEL, FORMA_PAGAMENTO_LABEL, toInputDate, formatMoney } from '@/utils'
import type { ServicoComCliente, ServicoStatus, FormaPagamento, OrigemCliente } from '@/types'

interface ModalNovoServicoProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  servico?: ServicoComCliente | null
  displayNum?: number
}

const STATUS_OPTS: ServicoStatus[] = ['orcamento', 'aguardando', 'em_andamento', 'concluido', 'entregue', 'cancelado']
const FORMAS: FormaPagamento[] = ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'crediario', 'transferencia', 'cheque']

function buildDefaults(servico?: ServicoComCliente | null): ServicoFormData {
  if (servico) {
    return {
      cliente_id: servico.cliente_id,
      origem_id: servico.origem_id,
      origem_outro: servico.origem_outro,
      tipo: servico.tipo,
      descricao: servico.descricao,
      observacoes_internas: servico.observacoes_internas ?? '',
      valor: servico.valor,
      custo_estimado: servico.custo_estimado,
      status: servico.status,
      data_entrada: toInputDate(servico.data_entrada),
      data_previsao: toInputDate(servico.data_previsao) || null,
      forma_pagamento: servico.forma_pagamento,
      responsavel_id: servico.responsavel_id,
      pago: servico.pago,
      num_parcelas: 1,
      entrada_crediario: 0,
      dia_vencimento: 10,
    }
  }
  return {
    cliente_id: null,
    origem_id: null,
    origem_outro: null,
    tipo: '',
    descricao: '',
    observacoes_internas: '',
    valor: 0,
    custo_estimado: null,
    status: 'orcamento',
    data_entrada: today(),
    data_previsao: null,
    forma_pagamento: null,
    responsavel_id: null,
    pago: false,
    num_parcelas: 1,
    entrada_crediario: 0,
    dia_vencimento: 10,
  }
}

export function ModalNovoServico({ open, onClose, onSuccess, servico, displayNum }: ModalNovoServicoProps) {
  const { user } = useAuth()
  const alert = useAlert()
  const isEditing = !!servico
  const [quickClienteOpen, setQuickClienteOpen] = useState(false)
  const [quickVendedorOpen, setQuickVendedorOpen] = useState(false)
  const [clienteDisplayValue, setClienteDisplayValue] = useState<string | undefined>(undefined)
  const [responsavelDisplayValue, setResponsavelDisplayValue] = useState<string | undefined>(undefined)
  const [origens, setOrigens] = useState<OrigemCliente[]>([])

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ServicoFormData>({
    resolver: zodResolver(servicoSchema) as never,
    defaultValues: buildDefaults(servico),
  })

  const pago = watch('pago')
  const formaPagamento = watch('forma_pagamento')
  const watchedValor = watch('valor') ?? 0
  const watchedEntrada = watch('entrada_crediario') ?? 0
  const watchedParcelas = watch('num_parcelas') ?? 1
  const isCrediario = formaPagamento === 'crediario'
  const saldoCrediario = Math.max(0, watchedValor - watchedEntrada)
  const valorParcela = watchedParcelas > 0 ? Math.round((saldoCrediario / watchedParcelas) * 100) / 100 : 0
  const watchedOrigemId = watch('origem_id')
  const origemSelecionada = origens.find((o) => o.id === watchedOrigemId)
  const isOrigemOutro = origemSelecionada?.nome === 'Outro'

  useEffect(() => {
    if (open) {
      reset(buildDefaults(servico))
      setClienteDisplayValue(servico?.cliente?.nome ?? undefined)
      setResponsavelDisplayValue(servico?.responsavel?.nome ?? undefined)
      supabase
        .from('origens_cliente')
        .select('id, nome, ativo, created_at')
        .order('nome')
        .then(({ data, error }) => {
          if (error) alert.error('Erro', 'Erro ao carregar origens.')
          else setOrigens((data as OrigemCliente[]) ?? [])
        })
    }
  }, [open, servico, reset])

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

  const searchResponsaveis = useCallback(async (q: string): Promise<SelectOption[]> => {
    const { data } = await supabase
      .from('profiles')
      .select('id, nome')
      .eq('ativo', true)
      .ilike('nome', `%${q}%`)
      .limit(10)
    return (data ?? []).map((p: { id: string; nome: string }) => ({
      id: p.id,
      label: p.nome,
    }))
  }, [])

  function handleQuickClienteSuccess(cliente: { id: string; nome: string; telefone: string | null }) {
    setValue('cliente_id', cliente.id)
    setClienteDisplayValue(cliente.nome)
  }

  function handleQuickVendedorSuccess(vendedor: { id: string; nome: string }) {
    setValue('responsavel_id', vendedor.id)
    setResponsavelDisplayValue(vendedor.nome)
  }

  async function onSave(data: ServicoFormData) {
    if (!user) return

    if (isCrediario && !data.cliente_id) {
      alert.error('Atenção', 'Selecione um cliente para registrar o crediário.')
      return
    }

    const { error } = isEditing
      ? await updateServico(servico.id, data, user.id)
      : await createServico(data, user.id)

    if (error) {
      alert.error('Erro', error)
    } else {
      alert.success(
        isEditing ? 'Serviço Atualizado!' : 'Serviço Criado!',
        isEditing ? 'As alterações foram salvas com sucesso.' : 'Ordem de serviço criada com sucesso.',
        { onConfirm: () => { onSuccess(); onClose() } },
      )
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={isEditing ? `Editar Serviço #${displayNum ?? servico.numero}` : 'Nova Ordem de Serviço'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="form-novo-servico"
              loading={isSubmitting}
            >
              {isEditing ? 'Salvar' : 'Criar Serviço'}
            </Button>
          </>
        }
      >
        <form id="form-novo-servico" onSubmit={handleSubmit(onSave)} className="flex flex-col gap-4">
          <Controller
            name="cliente_id"
            control={control}
            render={({ field }) => (
              <SearchableSelect
                label="Cliente (opcional)"
                value={field.value}
                onChange={(id, option) => {
                  field.onChange(id)
                  if (option) setClienteDisplayValue(option.label)
                  else if (id === null) setClienteDisplayValue(undefined)
                }}
                onSearch={searchClientes}
                placeholder="Buscar cliente..."
                displayValue={clienteDisplayValue ?? servico?.cliente?.nome}
                onCreateNew={() => setQuickClienteOpen(true)}
                createNewLabel="Cadastrar cliente"
                error={errors.cliente_id?.message}
              />
            )}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={isOrigemOutro ? 'flex flex-col gap-1' : 'flex flex-col gap-1 sm:col-span-2'}>
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
            {isOrigemOutro && (
              <Input
                label="Onde exatamente? *"
                placeholder="Ex: Feira do bairro, amigo João..."
                {...register('origem_outro')}
                error={errors.origem_outro?.message}
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Tipo de serviço"
              placeholder="Ex: Redimensionamento, Solda..."
              error={errors.tipo?.message}
              {...register('tipo')}
            />
            <Select
              label="Status"
              error={errors.status?.message}
              {...register('status')}
            >
              {STATUS_OPTS.map((s) => (
                <option key={s} value={s}>{SERVICO_STATUS_LABEL[s]}</option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="label-base">Descrição</label>
            <textarea
              className={`input-base resize-none ${errors.descricao ? 'border-red-400' : ''}`}
              rows={3}
              placeholder="Descreva o serviço a ser realizado..."
              {...register('descricao')}
            />
            {errors.descricao && (
              <p className="text-xs text-red-600">{errors.descricao.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Controller
              name="valor"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  label="Valor do serviço"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.valor?.message}
                />
              )}
            />
            <Controller
              name="custo_estimado"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  label="Custo estimado (despesa)"
                  value={field.value ?? 0}
                  onChange={(v) => field.onChange(v || null)}
                />
              )}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="label-base">Data de entrada</label>
              <input
                type="date"
                className={`input-base ${errors.data_entrada ? 'border-red-400' : ''}`}
                {...register('data_entrada')}
              />
              {errors.data_entrada && (
                <p className="text-xs text-red-600">{errors.data_entrada.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label className="label-base">Previsão de entrega</label>
              <input
                type="date"
                className="input-base"
                {...register('data_previsao')}
              />
            </div>
          </div>

          <Controller
            name="responsavel_id"
            control={control}
            render={({ field }) => (
              <SearchableSelect
                label="Responsável (opcional)"
                value={field.value}
                onChange={(id, option) => {
                  field.onChange(id)
                  if (option) setResponsavelDisplayValue(option.label)
                  else if (id === null) setResponsavelDisplayValue(undefined)
                }}
                onSearch={searchResponsaveis}
                placeholder="Buscar colaborador..."
                displayValue={responsavelDisplayValue ?? servico?.responsavel?.nome}
                onCreateNew={() => setQuickVendedorOpen(true)}
                createNewLabel="Cadastrar vendedor"
              />
            )}
          />

          <div className="flex flex-col gap-1">
            <label className="label-base">Observações internas</label>
            <textarea
              className="input-base resize-none"
              rows={2}
              placeholder="Notas internas sobre o serviço..."
              {...register('observacoes_internas')}
            />
          </div>

          {/* Pagamento */}
          <div className="border-t border-gold-100 pt-4 flex flex-col gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="accent-gold-500 w-4 h-4"
                {...register('pago')}
              />
              <span className="text-sm text-dark-600">Serviço já pago / faturado</span>
            </label>

            {pago && (
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
            )}

            {/* Crediário para serviço */}
            {pago && isCrediario && (
              <div className="flex flex-col gap-3 p-4 bg-gold-50 rounded-xl border border-gold-100">
                <p className="text-xs font-medium text-dark-500 uppercase tracking-wide">Condições do Crediário</p>
                {!watch('cliente_id') && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Selecione um cliente acima para registrar o crediário.
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Controller
                    name="entrada_crediario"
                    control={control}
                    render={({ field }) => (
                      <CurrencyInput
                        label="Entrada"
                        value={field.value ?? 0}
                        onChange={field.onChange}
                      />
                    )}
                  />
                  <div className="flex flex-col gap-1">
                    <label className="label-base">Nº de parcelas</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      className="input-base"
                      {...register('num_parcelas', { valueAsNumber: true })}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="label-base">Dia vencimento</label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      className="input-base"
                      {...register('dia_vencimento', { valueAsNumber: true })}
                    />
                  </div>
                </div>

                <div className="border-t border-gold-200 pt-2 flex flex-col gap-1">
                  <div className="flex justify-between text-sm text-dark-500">
                    <span>Saldo a financiar</span>
                    <span className="font-medium">{formatMoney(saldoCrediario)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-medium text-dark-700">
                    <span>Valor por parcela</span>
                    <span>{formatMoney(valorParcela)} × {watchedParcelas}x</span>
                  </div>
                </div>
              </div>
            )}
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
