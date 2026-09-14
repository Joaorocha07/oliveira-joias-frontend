'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAlert } from '@/hooks/use-alert'
import { Card, CardHeader, Button, Input, Textarea } from '@/components/ui'
import { MaskedInput } from '@/components/forms/masked-input'
import {
  certificadoConfiguracaoSchema,
  type CertificadoConfiguracaoFormData,
  type CertificadoConfiguracaoFormInput,
} from '@/schemas/certificado'
import { upsertCertificadoConfiguracoes } from '@/services/certificados'
import type { CertificadoConfiguracao } from '@/types'

interface Props {
  configuracao: CertificadoConfiguracao
  onSaved: (configuracao: CertificadoConfiguracao) => void
}

function buildDefaults(c: CertificadoConfiguracao): CertificadoConfiguracaoFormInput {
  return {
    nome_empresa: c.nome_empresa,
    subtitulo: c.subtitulo ?? '',
    endereco: c.endereco ?? '',
    whatsapp: c.whatsapp ?? '',
    telefone_secundario: c.telefone_secundario ?? '',
    instagram: c.instagram ?? '',
    cor_principal: c.cor_principal,
    texto_introducao: c.texto_introducao ?? '',
    termos_garantia: c.termos_garantia.join('\n'),
    beneficios: c.beneficios.join('\n'),
    nao_cobre: c.nao_cobre.join('\n'),
    recomendacoes: c.recomendacoes.join('\n'),
    texto_declaracao: c.texto_declaracao ?? '',
    texto_agradecimento: c.texto_agradecimento ?? '',
    texto_validade: c.texto_validade ?? '',
  }
}

export function ConfiguracoesCertificado({ configuracao, onSaved }: Props) {
  const alert = useAlert()
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CertificadoConfiguracaoFormInput>({
    resolver: zodResolver(certificadoConfiguracaoSchema) as never,
    defaultValues: buildDefaults(configuracao),
  })

  async function onSave(raw: CertificadoConfiguracaoFormInput) {
    const data = raw as unknown as CertificadoConfiguracaoFormData
    const { error } = await upsertCertificadoConfiguracoes(data)
    if (error) {
      alert.error('Erro', 'Erro ao salvar configurações.')
      return
    }
    alert.success('Configurações Salvas!', 'Os dados do certificado foram atualizados.')
    onSaved({
      ...configuracao,
      ...data,
      subtitulo: data.subtitulo ?? configuracao.subtitulo,
      endereco: data.endereco || null,
      whatsapp: data.whatsapp || null,
      telefone_secundario: data.telefone_secundario || null,
      instagram: data.instagram || null,
      texto_introducao: data.texto_introducao || null,
      texto_declaracao: data.texto_declaracao || null,
      texto_agradecimento: data.texto_agradecimento || null,
      texto_validade: data.texto_validade || null,
    })
  }

  return (
    <Card>
      <CardHeader
        title="Configurações do Certificado"
        subtitle="Dados da empresa e textos usados no certificado de garantia gerado"
      />

      <form onSubmit={handleSubmit(onSave)} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nome da Empresa" error={errors.nome_empresa?.message} {...register('nome_empresa')} />
          <Input label="Subtítulo" placeholder="Especializada em Alianças e Joias" {...register('subtitulo')} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Endereço" placeholder="Avenida Seme Simão, 1281" {...register('endereco')} />
          <Input label="Instagram" placeholder="@oliveirajoias" {...register('instagram')} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="WhatsApp" placeholder="5534998717389 (com DDI)" hint="Usado no QR Code do certificado." {...register('whatsapp')} />
          <MaskedInput mask="phone" label="Telefone secundário" placeholder="(34) 99771-7779" {...register('telefone_secundario')} />
        </div>

        <Controller
          name="cor_principal"
          control={control}
          render={({ field }) => (
            <div className="flex flex-col gap-1.5">
              <label className="label-base">Cor Principal</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  className="w-11 h-11 rounded-lg border border-gold-100 cursor-pointer bg-transparent p-0.5"
                />
                <Input value={field.value} onChange={(e) => field.onChange(e.target.value)} wrapperClassName="flex-1" />
              </div>
              <p className="text-xs text-dark-300">Usada nos detalhes dourados do PDF.</p>
              {errors.cor_principal && <p className="text-xs text-red-600">{errors.cor_principal.message}</p>}
            </div>
          )}
        />

        <div className="border-t border-gold-50 pt-4 flex flex-col gap-4">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wide">Textos do Certificado</p>
          <p className="text-xs text-dark-300 -mt-2">
            Nas listas, escreva <strong>um item por linha</strong>. Use <code>{'{empresa}'}</code> onde o nome da empresa deve aparecer.
          </p>

          <Textarea label="Texto de introdução" rows={3} {...register('texto_introducao')} />
          <Textarea label="Termos da garantia (um por linha)" rows={3} {...register('termos_garantia')} />
          <Textarea label="Benefícios exclusivos (um por linha)" rows={3} {...register('beneficios')} />
          <Textarea label="A garantia não cobre (um por linha)" rows={4} {...register('nao_cobre')} />
          <Textarea label="Recomendações de conservação (um por linha)" rows={3} {...register('recomendacoes')} />
          <Textarea label="Declaração do cliente" rows={3} {...register('texto_declaracao')} />
          <Textarea label="Texto de agradecimento (rodapé)" rows={2} {...register('texto_agradecimento')} />
          <Input label="Aviso de validade (rodapé)" {...register('texto_validade')} />
        </div>

        <div className="flex justify-end pt-2 border-t border-gold-50">
          <Button type="submit" variant="primary" loading={isSubmitting}>Salvar Configurações</Button>
        </div>
      </form>
    </Card>
  )
}
