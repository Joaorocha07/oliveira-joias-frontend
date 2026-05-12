'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { Modal, Button, Select } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { pagarParcelaSchema, type PagarParcelaFormData } from '@/schemas/crediario'
import { pagarParcela } from '@/services/crediario'
import { useAuth } from '@/context/auth-context'
import { today, formatMoney, FORMA_PAGAMENTO_LABEL } from '@/utils'
import type { CrediarioParcela } from '@/types'

interface ModalPagarParcelaProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  parcela: CrediarioParcela | null
}

const FORMAS = [
  'dinheiro', 'pix', 'cartao_debito', 'cartao_credito', 'transferencia', 'cheque',
] as const

export function ModalPagarParcela({ open, onClose, onSuccess, parcela }: ModalPagarParcelaProps) {
  const { user } = useAuth()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PagarParcelaFormData>({
    resolver: zodResolver(pagarParcelaSchema) as never,
    defaultValues: {
      valor_pago: 0,
      data_pagamento: today(),
      forma_pagamento: undefined,
      observacoes: '',
    },
  })

  useEffect(() => {
    if (open && parcela) {
      reset({
        valor_pago: parcela.valor,
        data_pagamento: today(),
        forma_pagamento: undefined,
        observacoes: '',
      })
    }
  }, [open, parcela, reset])

  async function onSave(data: PagarParcelaFormData) {
    if (!parcela || !user) return
    const { error } = await pagarParcela(parcela.id, parcela.crediario_id, data, user.id)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Parcela paga com sucesso.')
      onSuccess()
      onClose()
    }
  }

  if (!parcela) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Pagar Parcela ${parcela.numero}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="form-pagar-parcela"
            loading={isSubmitting}
          >
            Confirmar Pagamento
          </Button>
        </>
      }
    >
      <div className="mb-4 p-3 bg-gold-50 rounded-lg border border-gold-100">
        <p className="text-xs text-dark-400">Valor da parcela</p>
        <p className="text-lg font-display font-medium text-dark-700">
          {formatMoney(parcela.valor)}
        </p>
      </div>

      <form id="form-pagar-parcela" onSubmit={handleSubmit(onSave)} className="flex flex-col gap-4">
        <Controller
          name="valor_pago"
          control={control}
          render={({ field }) => (
            <CurrencyInput
              label="Valor pago"
              value={field.value}
              onChange={field.onChange}
              error={errors.valor_pago?.message}
            />
          )}
        />

        <div className="flex flex-col gap-1">
          <label className="label-base">Data do pagamento</label>
          <input
            type="date"
            className={`input-base ${errors.data_pagamento ? 'border-red-400' : ''}`}
            {...register('data_pagamento')}
          />
          {errors.data_pagamento && (
            <p className="text-xs text-red-600">{errors.data_pagamento.message}</p>
          )}
        </div>

        <Select
          label="Forma de pagamento"
          placeholder="Selecione..."
          error={errors.forma_pagamento?.message}
          {...register('forma_pagamento')}
        >
          {FORMAS.map((f) => (
            <option key={f} value={f}>
              {FORMA_PAGAMENTO_LABEL[f]}
            </option>
          ))}
        </Select>

        <div className="flex flex-col gap-1">
          <label className="label-base">Observações (opcional)</label>
          <textarea
            className="input-base resize-none"
            rows={2}
            {...register('observacoes')}
          />
        </div>
      </form>
    </Modal>
  )
}
