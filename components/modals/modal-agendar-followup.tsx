'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAlert } from '@/hooks/use-alert'
import { Modal, Button, Input, Textarea } from '@/components/ui'
import { useAuth } from '@/context/auth-context'
import { followUpSchema, type FollowUpFormData } from '@/schemas/follow-up'
import { criarFollowUp, reagendarFollowUp } from '@/services/follow-ups'
import { today } from '@/utils'
import type { ClienteFollowUp } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  clienteId: string
  clienteNome?: string
  followUp?: ClienteFollowUp | null
}

function buildDefaults(followUp?: ClienteFollowUp | null): FollowUpFormData {
  if (followUp) {
    return { data_agendada: followUp.data_agendada, horario: followUp.horario, motivo: followUp.motivo }
  }
  return { data_agendada: today(), horario: null, motivo: '' }
}

export function ModalAgendarFollowUp({ open, onClose, onSuccess, clienteId, clienteNome, followUp }: Props) {
  const { user } = useAuth()
  const alert = useAlert()
  const isReagendando = !!followUp

  const {
    register, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<FollowUpFormData>({
    resolver: zodResolver(followUpSchema) as never,
    defaultValues: buildDefaults(followUp),
  })

  useEffect(() => {
    if (open) reset(buildDefaults(followUp))
  }, [open, followUp, reset])

  async function onSave(data: FollowUpFormData) {
    if (!user) return
    const { error } = isReagendando
      ? await reagendarFollowUp(followUp, data, user.id)
      : await criarFollowUp(clienteId, data, user.id)

    if (error) {
      alert.error('Erro', error)
    } else {
      alert.success(
        isReagendando ? 'Follow-up Reagendado!' : 'Follow-up Agendado!',
        'O retorno foi salvo na agenda.',
        { onConfirm: () => { onSuccess(); onClose() } },
      )
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isReagendando ? 'Reagendar Follow-up' : `Agendar Retorno${clienteNome ? ` — ${clienteNome}` : ''}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="form-agendar-followup" loading={isSubmitting}>
            {isReagendando ? 'Salvar' : 'Agendar'}
          </Button>
        </>
      }
    >
      <form id="form-agendar-followup" onSubmit={handleSubmit(onSave)} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Data" type="date" error={errors.data_agendada?.message} {...register('data_agendada')} />
          <Input label="Horário" type="time" {...register('horario')} />
        </div>
        <Textarea
          label="Motivo"
          placeholder='Ex: "Cliente vai receber pagamento"'
          error={errors.motivo?.message}
          {...register('motivo')}
        />
      </form>
    </Modal>
  )
}
