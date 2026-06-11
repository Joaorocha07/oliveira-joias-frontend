'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAlert } from '@/hooks/use-alert'
import { Modal, Button, Select } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { pagarParcelaSchema, type PagarParcelaFormData } from '@/schemas/crediario'
import { editarPagamentoParcela, pagarParcela } from '@/services/crediario'
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

type FormaPagamentoParcela = PagarParcelaFormData['forma_pagamento']

function getFormaPagamentoParcela(forma: CrediarioParcela['forma_pagamento']): FormaPagamentoParcela | undefined {
  return FORMAS.find((f) => f === forma)
}

export function ModalPagarParcela({ open, onClose, onSuccess, parcela }: ModalPagarParcelaProps) {
  const { user } = useAuth()
  const alert = useAlert()
  const isEditandoPagamento = parcela?.status === 'pago'

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
        valor_pago: isEditandoPagamento ? parcela.valor_pago : parcela.valor,
        data_pagamento: isEditandoPagamento ? parcela.data_pagamento ?? today() : today(),
        forma_pagamento: isEditandoPagamento ? getFormaPagamentoParcela(parcela.forma_pagamento) : undefined,
        observacoes: parcela.observacoes ?? '',
      })
    }
  }, [isEditandoPagamento, open, parcela, reset])

  async function onSave(data: PagarParcelaFormData) {
    if (!parcela || !user) return
    const { error } = isEditandoPagamento
      ? await editarPagamentoParcela(parcela.id, parcela.crediario_id, data, user.id)
      : await pagarParcela(parcela.id, parcela.crediario_id, data, user.id)
    if (error) {
      alert.error(isEditandoPagamento ? 'Erro ao Editar' : 'Erro ao Pagar', error)
    } else {
      alert.success(
        isEditandoPagamento ? 'Pagamento Atualizado!' : 'Parcela Paga!',
        isEditandoPagamento ? 'Valor recebido atualizado com sucesso.' : 'Parcela registrada com sucesso.',
        { onConfirm: () => { onSuccess(); onClose() } },
      )
    }
  }

  if (!parcela) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${isEditandoPagamento ? 'Editar Pagamento' : 'Pagar Parcela'} ${parcela.numero}`}
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
            {isEditandoPagamento ? 'Salvar Alteracoes' : 'Confirmar Pagamento'}
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
