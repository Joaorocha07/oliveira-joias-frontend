'use client'

import { useCallback, useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAlert } from '@/hooks/use-alert'
import { Modal, Button, Select, Input, Textarea } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { SearchableSelect, type SelectOption } from '@/components/forms/searchable-select'
import { clienteLeadSchema, clienteToLeadFormData, type ClienteLeadFormData } from '@/schemas/cliente'
import { updateLead } from '@/services/clientes'
import { supabase } from '@/lib/supabase'
import { PRODUTO_INTERESSE_LABEL, STATUS_QUALIFICACAO_LABEL } from '@/utils'
import type { Cliente, OrigemCliente, ProdutoInteresse, StatusQualificacao } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  cliente: Cliente | null
}

const PRODUTOS: ProdutoInteresse[] = [
  'alianca_prata', 'alianca_ouro', 'alianca_moeda_antiga', 'alianca_aco', 'semijoias', 'outro',
]

const STATUS_QUALIFICACAO_OPTS: StatusQualificacao[] = [
  'novo_lead', 'em_atendimento', 'fazendo_orcamento', 'interessado',
  'aguardando_resposta', 'follow_up_agendado', 'venda_concluida',
  'lead_perdido', 'nao_respondeu',
]

export function ModalEditarLead({ open, onClose, onSuccess, cliente }: Props) {
  const alert = useAlert()
  const [origens, setOrigens] = useState<OrigemCliente[]>([])
  const [vendedorDisplayValue, setVendedorDisplayValue] = useState<string | undefined>(undefined)

  const {
    register, handleSubmit, control, reset, setValue, watch,
    formState: { errors, isSubmitting },
  } = useForm<ClienteLeadFormData>({
    resolver: zodResolver(clienteLeadSchema) as never,
  })

  const watchedOrigemId = watch('origem_id')
  const isOrigemOutro = origens.find((o) => o.id === watchedOrigemId)?.nome === 'Outro'

  useEffect(() => {
    if (!open || !cliente) return
    reset(clienteToLeadFormData(cliente))
    setVendedorDisplayValue(cliente.vendedor?.nome ?? undefined)
    supabase
      .from('origens_cliente')
      .select('id, nome, ativo, created_at')
      .eq('ativo', true)
      .order('nome')
      .then(({ data, error }) => {
        if (error) alert.error('Erro', 'Erro ao carregar origens.')
        else setOrigens((data as OrigemCliente[]) ?? [])
      })
  }, [open, cliente, reset])

  const searchVendedores = useCallback(async (q: string): Promise<SelectOption[]> => {
    const { data } = await supabase
      .from('profiles')
      .select('id, nome')
      .eq('ativo', true)
      .in('role', ['vendedor', 'admin'])
      .ilike('nome', `%${q}%`)
      .limit(10)
    return (data ?? []).map((p: { id: string; nome: string }) => ({ id: p.id, label: p.nome }))
  }, [])

  async function onSave(data: ClienteLeadFormData) {
    if (!cliente) return
    const { error } = await updateLead(cliente.id, data)
    if (error) {
      alert.error('Erro', error)
    } else {
      alert.success('Salvo!', 'Lead atualizado com sucesso.', {
        onConfirm: () => { onSuccess(); onClose() },
      })
    }
  }

  if (!cliente) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar Lead"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="form-editar-lead" loading={isSubmitting}>
            Salvar alterações
          </Button>
        </>
      }
    >
      <form id="form-editar-lead" onSubmit={handleSubmit(onSave)} className="flex flex-col gap-4">
        <Input label="Nome *" error={errors.nome?.message} {...register('nome')} />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input label="Telefone" placeholder="(00) 00000-0000" {...register('telefone')} />
          <Input label="WhatsApp" placeholder="(00) 00000-0000" {...register('whatsapp')} />
          <Input label="Instagram" placeholder="@usuario" {...register('instagram')} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Cidade" {...register('cidade')} />
          <Select
            label="Produto de interesse"
            placeholder="Selecione..."
            {...register('produto_interesse')}
            onChange={(e) => setValue('produto_interesse', (e.target.value || null) as ProdutoInteresse | null)}
          >
            {PRODUTOS.map((p) => (
              <option key={p} value={p}>{PRODUTO_INTERESSE_LABEL[p]}</option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className={isOrigemOutro ? 'flex flex-col gap-1' : 'flex flex-col gap-1 sm:col-span-2'}>
            <label className="label-base">Origem do lead</label>
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
            <Input label="Onde exatamente?" placeholder="Ex: Feira do bairro..." {...register('origem_outro')} />
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Controller
            name="vendedor_id"
            control={control}
            render={({ field }) => (
              <SearchableSelect
                label="Vendedor responsável"
                value={field.value}
                onChange={(id, option) => {
                  field.onChange(id)
                  setVendedorDisplayValue(option?.label)
                }}
                onSearch={searchVendedores}
                placeholder="Buscar vendedor..."
                displayValue={vendedorDisplayValue}
              />
            )}
          />
          <Select
            label="Status de atendimento"
            {...register('status_qualificacao')}
          >
            {STATUS_QUALIFICACAO_OPTS.map((s) => (
              <option key={s} value={s}>{STATUS_QUALIFICACAO_LABEL[s]}</option>
            ))}
          </Select>
        </div>

        <div className="border-t border-gold-100 pt-4 flex flex-col gap-4">
          <p className="text-xs font-medium text-dark-500 uppercase tracking-wide">Informações comerciais</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Controller
              name="valor_pretendido"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  label="Valor pretendido"
                  value={field.value ?? 0}
                  onChange={(v) => field.onChange(v || null)}
                />
              )}
            />
            <Input label="Quando pretende comprar" placeholder="Ex: em 2 semanas" {...register('quando_pretende_comprar')} />
            <Input label="Modelo desejado" {...register('modelo_desejado')} />
            <Input label="Numeração" {...register('numeracao')} />
            <Input label="Data do casamento" type="date" {...register('data_casamento')} />
            <Input label="Data do noivado" type="date" {...register('data_noivado')} />
            <Input label="Início da conversa" type="date" {...register('data_inicio_conversa')} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Nome do(a) parceiro(a)" placeholder="Opcional" {...register('parceiro_nome')} />
            <Input label="Telefone do(a) parceiro(a)" placeholder="(00) 00000-0000" {...register('parceiro_telefone')} />
          </div>

          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-gold-500 w-4 h-4" {...register('perguntou_pagamento')} />
              <span className="text-sm text-dark-600">Perguntou formas de pagamento</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-gold-500 w-4 h-4" {...register('solicitou_gravacao')} />
              <span className="text-sm text-dark-600">Solicitou gravação</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" className="accent-gold-500 w-4 h-4" {...register('demonstrou_intencao')} />
              <span className="text-sm text-dark-600">Demonstra intenção de compra</span>
            </label>
          </div>
        </div>

        <Textarea label="Observações" {...register('observacoes')} />
      </form>
    </Modal>
  )
}
