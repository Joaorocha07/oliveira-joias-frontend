import { z } from 'zod'

export const followUpSchema = z.object({
  data_agendada: z.string().min(1, 'Data é obrigatória'),
  horario: z.string().nullable(),
  motivo: z.string().min(1, 'Motivo é obrigatório'),
})

export type FollowUpFormData = z.infer<typeof followUpSchema>
