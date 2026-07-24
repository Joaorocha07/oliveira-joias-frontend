'use client'

import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAlert } from '@/hooks/use-alert'
import { Card, CardHeader, Button, Input, Textarea } from '@/components/ui'
import { MaskedInput } from '@/components/forms/masked-input'
import { orcamentoConfiguracaoSchema, type OrcamentoConfiguracaoFormData } from '@/schemas/orcamento'
import { upsertOrcamentoConfiguracoes } from '@/services/orcamentos'
import type { OrcamentoConfiguracao } from '@/types'

interface ConfiguracoesOrcamentoProps {
  configuracao: OrcamentoConfiguracao
  onSaved: (configuracao: OrcamentoConfiguracao) => void
}

function buildDefaults(c: OrcamentoConfiguracao): OrcamentoConfiguracaoFormData {
  return {
    nome_empresa: c.nome_empresa,
    contato: c.contato ?? '',
    endereco: c.endereco ?? '',
    whatsapp: c.whatsapp ?? '',
    instagram: c.instagram ?? '',
    texto_rodape: c.texto_rodape ?? '',
    cor_principal: c.cor_principal,
  }
}

export function ConfiguracoesOrcamento({ configuracao, onSaved }: ConfiguracoesOrcamentoProps) {
  const alert = useAlert()
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<OrcamentoConfiguracaoFormData>({
    resolver: zodResolver(orcamentoConfiguracaoSchema) as never,
    defaultValues: buildDefaults(configuracao),
  })

  async function onSave(data: OrcamentoConfiguracaoFormData) {
    const { error } = await upsertOrcamentoConfiguracoes(data)
    if (error) {
      alert.error('Erro', 'Erro ao salvar configurações.')
      return
    }
    alert.success('Configurações Salvas!', 'Os dados da empresa foram atualizados.')
    onSaved({ ...configuracao, ...data })
  }

  return (
    <Card>
      <CardHeader title="Configurações do Orçamento" subtitle="Dados usados no documento gerado para o cliente" />

      <form onSubmit={handleSubmit(onSave)} className="flex flex-col gap-5">
        <Input
          label="Nome da Empresa"
          error={errors.nome_empresa?.message}
          {...register('nome_empresa')}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Contato" {...register('contato')} />
          <Input label="Endereço" placeholder="Rua Exemplo, 123 — Uberlândia, MG" {...register('endereco')} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <MaskedInput mask="phone" label="WhatsApp" placeholder="34900000000" {...register('whatsapp')} />
          <Input label="Instagram" placeholder="@oliveirajoias" {...register('instagram')} />
        </div>

        <div className="border-t border-gold-50 pt-4 flex flex-col gap-4">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wide">Rodapé e Marca</p>

          <Textarea
            label="Texto do Rodapé"
            rows={3}
            placeholder="Obrigado por escolher a Oliveira Joias. Será um prazer fazer parte deste momento tão especial."
            {...register('texto_rodape')}
          />

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
                  <Input
                    value={field.value}
                    onChange={(e) => field.onChange(e.target.value)}
                    wrapperClassName="flex-1"
                  />
                </div>
                <p className="text-xs text-dark-300">Usada em destaques e botões do orçamento gerado.</p>
                {errors.cor_principal && <p className="text-xs text-red-600">{errors.cor_principal.message}</p>}
              </div>
            )}
          />
        </div>

        <div className="flex justify-end pt-2 border-t border-gold-50">
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Salvar Configurações
          </Button>
        </div>
      </form>
    </Card>
  )
}
