'use client'

import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Modal, Button } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { useAlert } from '@/hooks/use-alert'
import { editarValorParcela } from '@/services/crediario'
import { editarValorParcelaSchema, type EditarValorParcelaFormData } from '@/schemas/crediario'
import { formatMoney } from '@/utils'
import type { CrediarioParcela } from '@/types'

interface ModalEditarValorParcelaProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  parcela: CrediarioParcela | null
}

export function ModalEditarValorParcela({
  open,
  onClose,
  onSuccess,
  parcela,
}: ModalEditarValorParcelaProps) {
  const alert = useAlert()
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EditarValorParcelaFormData>({
    resolver: zodResolver(editarValorParcelaSchema) as never,
    defaultValues: { valor: 0 },
  })

  useEffect(() => {
    if (open && parcela) {
      reset({ valor: parcela.valor })
    }
  }, [open, parcela, reset])

  async function onSave(data: EditarValorParcelaFormData) {
    if (!parcela) return
    const { error } = await editarValorParcela(parcela.id, parcela.crediario_id, data)

    if (error) {
      alert.error('Erro ao Editar', error)
    } else {
      alert.success('Valor Atualizado!', 'O valor da parcela foi ajustado com sucesso.', {
        onConfirm: () => { onSuccess(); onClose() },
      })
    }
  }

  if (!parcela) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Editar Valor da Parcela ${parcela.numero}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="form-editar-valor-parcela"
            loading={isSubmitting}
          >
            Salvar
          </Button>
        </>
      }
    >
      {parcela.status === 'pago' && (
        <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-100">
          <p className="text-xs text-green-700 uppercase tracking-wide">Valor recebido</p>
          <p className="text-lg font-display font-medium text-green-700">
            {formatMoney(parcela.valor_pago)}
          </p>
        </div>
      )}

      <form id="form-editar-valor-parcela" onSubmit={handleSubmit(onSave)}>
        <Controller
          name="valor"
          control={control}
          render={({ field }) => (
            <CurrencyInput
              label="Valor da parcela"
              value={field.value}
              onChange={field.onChange}
              error={errors.valor?.message}
              hint={parcela.status === 'pago' ? 'Para parcela paga, o valor nao pode ser menor que o recebido.' : undefined}
            />
          )}
        />
      </form>
    </Modal>
  )
}
