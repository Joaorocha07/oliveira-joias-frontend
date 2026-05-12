'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import toast from 'react-hot-toast'
import { Modal, Button } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { editarCrediarioSchema, type EditarCrediarioFormData } from '@/schemas/crediario'
import { updateCrediario } from '@/services/crediario'
import { formatMoney } from '@/utils'
import type { CrediarioComRelacoes } from '@/types'

interface ModalEditarCrediarioProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  crediario: CrediarioComRelacoes | null
}

export function ModalEditarCrediario({ open, onClose, onSuccess, crediario }: ModalEditarCrediarioProps) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditarCrediarioFormData>({
    resolver: zodResolver(editarCrediarioSchema) as never,
    defaultValues: { entrada: 0, num_parcelas: 1, dia_vencimento: 10 },
  })

  const watchedEntrada = watch('entrada') ?? 0
  const watchedParcelas = watch('num_parcelas') ?? 1
  const total = crediario?.total ?? 0
  const saldo = Math.max(0, total - watchedEntrada)
  const valorParcela = watchedParcelas > 0 ? Math.round((saldo / watchedParcelas) * 100) / 100 : 0

  const parcelasPagas = (crediario?.parcelas ?? []).filter((p) => p.status === 'pago')
  const hasPayments = parcelasPagas.length > 0

  useEffect(() => {
    if (open && crediario) {
      reset({
        entrada: crediario.entrada,
        num_parcelas: crediario.num_parcelas,
        dia_vencimento: crediario.dia_vencimento,
      })
    }
  }, [open, crediario, reset])

  async function onSave(data: EditarCrediarioFormData) {
    if (!crediario) return
    const { error } = await updateCrediario(crediario.id, data)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Crediário atualizado.')
      onSuccess()
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar Crediário"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="form-editar-crediario"
            loading={isSubmitting}
            disabled={hasPayments}
          >
            Salvar
          </Button>
        </>
      }
    >
      {hasPayments && (
        <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
          <p className="text-xs text-amber-700 font-medium">
            {parcelasPagas.length} parcela{parcelasPagas.length !== 1 ? 's' : ''} já{' '}
            {parcelasPagas.length === 1 ? 'foi paga' : 'foram pagas'}. Edição bloqueada.
          </p>
        </div>
      )}

      <div className="mb-4 p-3 bg-gold-50 rounded-lg border border-gold-100">
        <p className="text-xs text-dark-400">Total da venda</p>
        <p className="text-lg font-display font-medium text-dark-700">{formatMoney(total)}</p>
      </div>

      <form id="form-editar-crediario" onSubmit={handleSubmit(onSave)} className="flex flex-col gap-4">
        <Controller
          name="entrada"
          control={control}
          render={({ field }) => (
            <CurrencyInput
              label="Entrada"
              value={field.value}
              onChange={field.onChange}
              error={errors.entrada?.message}
              disabled={hasPayments}
            />
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="label-base">Nº de parcelas</label>
            <input
              type="number"
              min={1}
              max={60}
              disabled={hasPayments}
              className={`input-base ${errors.num_parcelas ? 'border-red-400' : ''}`}
              {...register('num_parcelas', { valueAsNumber: true })}
            />
            {errors.num_parcelas && (
              <p className="text-xs text-red-600">{errors.num_parcelas.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="label-base">Dia de vencimento</label>
            <input
              type="number"
              min={1}
              max={28}
              disabled={hasPayments}
              className={`input-base ${errors.dia_vencimento ? 'border-red-400' : ''}`}
              {...register('dia_vencimento', { valueAsNumber: true })}
            />
            {errors.dia_vencimento && (
              <p className="text-xs text-red-600">{errors.dia_vencimento.message}</p>
            )}
          </div>
        </div>

        <div className="border-t border-gold-100 pt-3 flex flex-col gap-1.5">
          <div className="flex justify-between text-sm text-dark-500">
            <span>Saldo a financiar</span>
            <span className="font-medium">{formatMoney(saldo)}</span>
          </div>
          <div className="flex justify-between text-sm font-medium text-dark-700">
            <span>Valor por parcela</span>
            <span>{formatMoney(valorParcela)} × {watchedParcelas}x</span>
          </div>
        </div>
      </form>
    </Modal>
  )
}
