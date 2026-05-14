'use client'

import { useEffect, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAlert } from '@/hooks/use-alert'
import { Modal, Button, Select, Input } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { SearchableSelect, type SelectOption } from '@/components/forms/searchable-select'
import { servicoSchema, type ServicoFormData } from '@/schemas/servico'
import { createServico, updateServico } from '@/services/servicos'
import { useAuth } from '@/context/auth-context'
import { supabase } from '@/lib/supabase'
import { today, SERVICO_STATUS_LABEL, FORMA_PAGAMENTO_LABEL, toInputDate } from '@/utils'
import type { ServicoComCliente, ServicoStatus, FormaPagamento } from '@/types'

interface ModalNovoServicoProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  servico?: ServicoComCliente | null
  displayNum?: number
}

const STATUS_OPTS: ServicoStatus[] = ['orcamento', 'aguardando', 'em_andamento', 'concluido', 'entregue', 'cancelado']
const FORMAS: FormaPagamento[] = ['dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'transferencia', 'cheque']

function buildDefaults(servico?: ServicoComCliente | null): ServicoFormData {
  if (servico) {
    return {
      cliente_id: servico.cliente_id,
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
    }
  }
  return {
    cliente_id: null,
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
  }
}

export function ModalNovoServico({ open, onClose, onSuccess, servico, displayNum }: ModalNovoServicoProps) {
  const { user } = useAuth()
  const alert = useAlert()
  const isEditing = !!servico

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ServicoFormData>({
    resolver: zodResolver(servicoSchema) as never,
    defaultValues: buildDefaults(servico),
  })

  const pago = watch('pago')

  useEffect(() => {
    if (open) reset(buildDefaults(servico))
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

  async function onSave(data: ServicoFormData) {
    if (!user) return
    const { error } = isEditing
      ? await updateServico(servico.id, data)
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
              onChange={(id) => field.onChange(id)}
              onSearch={searchClientes}
              placeholder="Buscar cliente..."
              displayValue={servico?.cliente?.nome}
              error={errors.cliente_id?.message}
            />
          )}
        />

        <div className="grid grid-cols-2 gap-4">
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

        <div className="grid grid-cols-2 gap-4">
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
                label="Custo estimado (opcional)"
                value={field.value ?? 0}
                onChange={(v) => field.onChange(v || null)}
              />
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
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
              onChange={(id) => field.onChange(id)}
              onSearch={searchResponsaveis}
              placeholder="Buscar colaborador..."
              displayValue={servico?.responsavel?.nome}
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

        <div className="border-t border-gold-100 pt-4 flex flex-col gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="accent-gold-500 w-4 h-4"
              {...register('pago')}
            />
            <span className="text-sm text-dark-600">Serviço já pago</span>
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
        </div>
      </form>
    </Modal>
  )
}
