'use client'

import { useCallback, useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAlert } from '@/hooks/use-alert'
import { useAuth } from '@/context/auth-context'
import { Modal, Button, Select, Input } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { SearchableSelect, type SelectOption } from '@/components/forms/searchable-select'
import { ModalQuickCatalogoItem } from '@/components/modals/modal-quick-catalogo-item'
import { custoAvulsoSchema, type CustoAvulsoFormData } from '@/schemas/custo'
import { listarCustoTipos, criarCustoTipo, criarCusto, atualizarCusto } from '@/services/custos'
import { buscarVendas, buscarServicos } from '@/services/busca'
import { formatDate, formatMoney, today } from '@/utils'
import type { CustoTipo, VendaCustoComRelacoes } from '@/types'

const NOVO_TIPO = '__novo__'

interface ModalCustoAdicionalProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  custo: VendaCustoComRelacoes | null
}

function buildDefaults(custo: VendaCustoComRelacoes | null): CustoAvulsoFormData {
  return {
    id: custo?.id,
    tipo_id: custo?.tipo_id ?? '',
    descricao: custo?.descricao ?? '',
    valor: custo?.valor ?? 0,
    venda_id: custo?.venda_id ?? null,
    servico_id: custo?.servico_id ?? null,
    data_custo: custo?.data_custo ?? today(),
  }
}

function vendaLabel(v: { numero: number; cliente?: { nome: string } | null; descricao_livre?: string | null }) {
  return `Venda #${v.numero} · ${v.cliente?.nome ?? v.descricao_livre ?? 'Sem cliente'}`
}

function servicoLabel(s: { numero: number; tipo: string; cliente?: { nome: string } | null }) {
  return `Serviço #${s.numero} · ${s.tipo}${s.cliente?.nome ? ` · ${s.cliente.nome}` : ''}`
}

export function ModalCustoAdicional({ open, onClose, onSuccess, custo }: ModalCustoAdicionalProps) {
  const { user } = useAuth()
  const alert = useAlert()
  const [tipos, setTipos] = useState<CustoTipo[]>([])
  const [novoTipoOpen, setNovoTipoOpen] = useState(false)
  const [vendaDisplay, setVendaDisplay] = useState<string | undefined>(undefined)
  const [servicoDisplay, setServicoDisplay] = useState<string | undefined>(undefined)

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustoAvulsoFormData>({
    resolver: zodResolver(custoAvulsoSchema) as never,
    defaultValues: buildDefaults(custo),
  })

  useEffect(() => {
    if (!open) return
    const timeoutId = window.setTimeout(() => {
      reset(buildDefaults(custo))
      setVendaDisplay(custo?.venda ? vendaLabel(custo.venda) : undefined)
      setServicoDisplay(custo?.servico ? servicoLabel(custo.servico) : undefined)
      void listarCustoTipos().then(({ data, error }) => {
        if (error) alert.error('Erro', error)
        setTipos(data)
      })
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [open, custo, reset])

  const searchVendas = useCallback(async (q: string): Promise<SelectOption[]> => {
    const { data } = await buscarVendas(q)
    return data.map((v) => ({
      id: v.id,
      label: vendaLabel(v),
      sublabel: `${formatDate(v.data_venda)} · ${formatMoney(v.total)}`,
    }))
  }, [])

  const searchServicos = useCallback(async (q: string): Promise<SelectOption[]> => {
    const { data } = await buscarServicos(q)
    return data.map((s) => ({
      id: s.id,
      label: servicoLabel(s),
      sublabel: `${formatDate(s.data_entrada)} · ${formatMoney(s.valor)}`,
    }))
  }, [])

  async function onSave(data: CustoAvulsoFormData) {
    if (!user) return
    const input = {
      venda_id: data.venda_id,
      servico_id: data.servico_id,
      tipo_id: data.tipo_id,
      descricao: data.descricao,
      valor: data.valor,
      data_custo: data.data_custo,
    }
    const { error } = custo
      ? await atualizarCusto(custo.id, input, user.id)
      : await criarCusto(input, user.id)

    if (error) {
      alert.error('Erro', error)
      return
    }
    alert.success(custo ? 'Custo Atualizado!' : 'Custo Registrado!', 'O lançamento de saída no caixa também foi atualizado.', {
      onConfirm: () => { onSuccess(); onClose() },
    })
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={custo ? 'Editar Custo Adicional' : 'Novo Custo Adicional'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>Cancelar</Button>
            <Button variant="primary" type="submit" form="form-custo-adicional" loading={isSubmitting}>
              Salvar
            </Button>
          </>
        }
      >
        <form id="form-custo-adicional" onSubmit={handleSubmit(onSave)} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Controller
              name="tipo_id"
              control={control}
              render={({ field }) => (
                <Select
                  label="Tipo de custo *"
                  placeholder="Selecione..."
                  value={field.value}
                  error={errors.tipo_id?.message}
                  onChange={(e) => {
                    if (e.target.value === NOVO_TIPO) { setNovoTipoOpen(true); return }
                    field.onChange(e.target.value)
                  }}
                >
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                  <option value={NOVO_TIPO}>+ Novo tipo...</option>
                </Select>
              )}
            />
            <Controller
              name="valor"
              control={control}
              render={({ field }) => (
                <CurrencyInput label="Valor *" value={field.value} onChange={field.onChange} error={errors.valor?.message} />
              )}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Data do custo *" type="date" error={errors.data_custo?.message} {...register('data_custo')} />
            <Input label="Descrição" placeholder="Ex: Ourives João, gravação a laser..." {...register('descricao')} />
          </div>

          <div className="flex flex-col gap-3 rounded-xl border border-gold-100 bg-cream-50/50 p-4">
            <div>
              <p className="text-sm font-medium text-dark-600">Vínculo</p>
              <p className="text-xs text-dark-400">
                Vinculado a uma venda, o custo entra no lucro dela. Só com serviço, entra no lucro dos serviços.
              </p>
            </div>
            <Controller
              name="venda_id"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  label="Venda"
                  value={field.value}
                  displayValue={vendaDisplay}
                  onChange={(id, option) => {
                    field.onChange(id)
                    setVendaDisplay(option?.label)
                    return true
                  }}
                  onSearch={searchVendas}
                  placeholder="Buscar por nº ou cliente..."
                  error={errors.venda_id?.message}
                />
              )}
            />
            <Controller
              name="servico_id"
              control={control}
              render={({ field }) => (
                <SearchableSelect
                  label="Ordem de serviço (opcional)"
                  value={field.value}
                  displayValue={servicoDisplay}
                  onChange={(id, option) => {
                    field.onChange(id)
                    setServicoDisplay(option?.label)
                    return true
                  }}
                  onSearch={searchServicos}
                  placeholder="Buscar por nº, tipo ou cliente..."
                />
              )}
            />
          </div>
        </form>
      </Modal>

      <ModalQuickCatalogoItem<CustoTipo>
        open={novoTipoOpen}
        title="Novo Tipo de Custo"
        label="tipo de custo"
        placeholder="Ex: Cravação, Polimento..."
        onClose={() => setNovoTipoOpen(false)}
        onCreate={criarCustoTipo}
        onSuccess={(tipo) => {
          setTipos((prev) => [...prev, tipo].sort((a, b) => a.nome.localeCompare(b.nome)))
          setValue('tipo_id', tipo.id, { shouldValidate: true })
        }}
      />
    </>
  )
}
