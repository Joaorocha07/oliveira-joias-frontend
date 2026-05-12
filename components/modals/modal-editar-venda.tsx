'use client'

import { useEffect, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Modal, Button, Select } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { SearchableSelect, type SelectOption } from '@/components/forms/searchable-select'
import { updateVenda } from '@/services/vendas'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/auth-context'
import {
  formatMoney, toInputDate, VENDA_STATUS_LABEL, FORMA_PAGAMENTO_LABEL,
} from '@/utils'
import type { VendaStatus, FormaPagamento } from '@/types'
import type { VendaRow } from '@/app/(app)/vendas/page'

const schema = z.object({
  cliente_id: z.string().nullable(),
  status: z.enum(['orcamento', 'pendente', 'pago', 'crediario', 'cancelado'] as const),
  forma_pagamento: z.enum([
    'dinheiro', 'pix', 'cartao_debito', 'cartao_credito',
    'crediario', 'transferencia', 'cheque', 'misto',
  ] as const),
  desconto: z.number().min(0),
  data_venda: z.string().min(1),
  observacoes: z.string(),
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
    status: venda.status,
    forma_pagamento: venda.forma_pagamento,
    desconto: venda.desconto,
    data_venda: toInputDate(venda.data_venda),
    observacoes: venda.observacoes ?? '',
  }
}

export function ModalEditarVenda({ open, onClose, onSuccess, venda, displayNum }: ModalEditarVendaProps) {
  const { user } = useAuth()
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: venda ? buildDefaults(venda) : undefined,
  })

  const watchedDesconto = watch('desconto') ?? 0
  const subtotal = venda?.subtotal ?? 0
  const total = Math.max(0, Math.round((subtotal - watchedDesconto) * 100) / 100)

  useEffect(() => {
    if (open && venda) reset(buildDefaults(venda))
  }, [open, venda, reset])

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

  async function onSave(data: FormData) {
    if (!venda || !user) return
    const { error } = await updateVenda(venda.id, subtotal, data, user.id)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Venda atualizada.')
      onSuccess({
        cliente_id: data.cliente_id,
        status: data.status,
        forma_pagamento: data.forma_pagamento,
        desconto: data.desconto,
        total,
        data_venda: data.data_venda,
        observacoes: data.observacoes,
      })
      onClose()
    }
  }

  const itens = venda?.itens ?? []

  return (
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
        {/* Itens da venda (read-only) */}
        {itens.length > 0 && (
          <div>
            <p className="text-xs font-medium text-dark-400 uppercase tracking-wide mb-2">
              Itens da venda
            </p>
            <div className="border border-gold-100 rounded-xl overflow-hidden">
              {itens.map((item, idx) => (
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
              onChange={(id) => field.onChange(id)}
              onSearch={searchClientes}
              placeholder="Buscar cliente..."
              displayValue={venda?.cliente?.nome ?? undefined}
              error={errors.cliente_id?.message}
            />
          )}
        />

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
  )
}
