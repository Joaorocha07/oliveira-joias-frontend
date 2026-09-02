'use client'

import { useCallback, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAlert } from '@/hooks/use-alert'
import { useAuth } from '@/context/auth-context'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, Button, Input, Select, Textarea } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { MaskedInput } from '@/components/forms/masked-input'
import { SearchableSelect, type SelectOption } from '@/components/forms/searchable-select'
import { ModalQuickCliente } from '@/components/modals/modal-quick-cliente'
import { ModalQuickCatalogoItem } from '@/components/modals/modal-quick-catalogo-item'
import { certificadoSchema, type CertificadoFormData } from '@/schemas/certificado'
import { formatMoney, formatDate } from '@/utils'
import {
  criarCertificado,
  atualizarCertificado,
  criarCertificadoModelo,
  criarCertificadoMaterial,
} from '@/services/certificados'
import type { Certificado, CertificadoModelo, CertificadoMaterial, Profile } from '@/types'

interface FormCertificadoProps {
  certificado?: Certificado | null
  modelos: CertificadoModelo[]
  materiais: CertificadoMaterial[]
  vendedores: Pick<Profile, 'id' | 'nome'>[]
  onModelosChanged: () => void
  onMateriaisChanged: () => void
  onSaved: (certificado: Certificado, isEditing: boolean) => void
  onCancelEdit?: () => void
}

function buildDefaults(cert?: Certificado | null): CertificadoFormData {
  return {
    cliente_nome: cert?.cliente_nome ?? '',
    cliente_cpf: cert?.cliente_cpf ?? '',
    cliente_telefone: cert?.cliente_telefone ?? '',
    data_compra: cert?.data_compra ?? '',
    modelo: cert?.modelo ?? '',
    material: cert?.material ?? '',
    largura: cert?.largura ?? '',
    gramas: cert?.gramas ?? '',
    numeracao: cert?.numeracao ?? '',
    pedido_os: cert?.pedido_os ?? '',
    valor: cert?.valor ?? undefined,
    vendedor_nome: cert?.vendedor_nome ?? '',
    observacoes: cert?.observacoes ?? '',
  }
}

export function FormCertificado({
  certificado, modelos, materiais, vendedores,
  onModelosChanged, onMateriaisChanged, onSaved, onCancelEdit,
}: FormCertificadoProps) {
  const { user } = useAuth()
  const alert = useAlert()
  const isEditing = !!certificado

  const [clienteId, setClienteId] = useState<string | null>(certificado?.cliente_id ?? null)
  const [clienteDisplay, setClienteDisplay] = useState<string | undefined>(certificado?.cliente_nome ?? undefined)
  const [vendedorId, setVendedorId] = useState<string | null>(certificado?.vendedor_id ?? null)
  const [vendaId, setVendaId] = useState<string | null>(certificado?.venda_id ?? null)
  const [vendaDisplay, setVendaDisplay] = useState<string | undefined>(
    certificado?.venda_id && certificado?.pedido_os ? `Venda nº ${certificado.pedido_os}` : undefined,
  )

  const [modeloId, setModeloId] = useState<string | null>(null)
  const [modeloDisplay, setModeloDisplay] = useState<string | undefined>(certificado?.modelo ?? undefined)
  const [materialId, setMaterialId] = useState<string | null>(null)
  const [materialDisplay, setMaterialDisplay] = useState<string | undefined>(certificado?.material ?? undefined)

  const [quickClienteOpen, setQuickClienteOpen] = useState(false)
  const [quickModeloOpen, setQuickModeloOpen] = useState(false)
  const [quickMaterialOpen, setQuickMaterialOpen] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CertificadoFormData>({
    resolver: zodResolver(certificadoSchema) as never,
    defaultValues: buildDefaults(certificado),
  })

  const searchVendas = useCallback(async (q: string): Promise<SelectOption[]> => {
    const query = q.trim().toLowerCase()
    const { data } = await supabase
      .from('vendas')
      .select('id, numero, total, data_venda, cliente:clientes(nome)')
      .order('data_venda', { ascending: false })
      .limit(30)
    const vendas = (data ?? []) as unknown as {
      id: string; numero: number; total: number; data_venda: string; cliente: { nome: string } | null
    }[]
    return vendas
      .filter((v) => !query || String(v.numero).includes(query) || (v.cliente?.nome ?? '').toLowerCase().includes(query))
      .map((v) => ({
        id: v.id,
        label: `Venda nº ${v.numero}${v.cliente?.nome ? ` · ${v.cliente.nome}` : ''}`,
        sublabel: `${formatMoney(v.total)} · ${formatDate(v.data_venda)}`,
      }))
  }, [])

  async function handleVendaChange(id: string | null, option?: SelectOption) {
    setVendaId(id)
    setVendaDisplay(option?.label)
    if (!id) return
    const { data } = await supabase
      .from('vendas')
      .select('numero, total, cliente_id, cliente:clientes(nome, cpf, telefone)')
      .eq('id', id)
      .maybeSingle()
    if (!data) return
    const venda = data as unknown as {
      numero: number
      total: number
      cliente_id: string | null
      cliente: { nome: string; cpf: string | null; telefone: string | null } | null
    }
    setValue('pedido_os', String(venda.numero), { shouldValidate: true })
    if (!getValues('cliente_nome') && venda.cliente) {
      setClienteId(venda.cliente_id)
      setClienteDisplay(venda.cliente.nome)
      setValue('cliente_nome', venda.cliente.nome, { shouldValidate: true })
      setValue('cliente_cpf', venda.cliente.cpf ?? '')
      setValue('cliente_telefone', venda.cliente.telefone ?? '')
    }
    if (!getValues('valor') && venda.total) {
      setValue('valor', Number(venda.total))
    }
  }

  const searchClientes = useCallback(async (q: string): Promise<SelectOption[]> => {
    const { data } = await supabase
      .from('clientes')
      .select('id, nome, telefone, cpf')
      .eq('ativo', true)
      .ilike('nome', `%${q}%`)
      .limit(20)
    return (data ?? []).map((c: { id: string; nome: string; telefone: string | null }) => ({
      id: c.id,
      label: c.nome,
      sublabel: c.telefone ?? undefined,
    }))
  }, [])

  async function handleClienteChange(id: string | null, option?: SelectOption) {
    setClienteId(id)
    setClienteDisplay(option?.label)
    setValue('cliente_nome', option?.label ?? '', { shouldValidate: true })
    if (id) {
      const { data } = await supabase
        .from('clientes')
        .select('cpf, telefone')
        .eq('id', id)
        .maybeSingle()
      if (data) {
        setValue('cliente_cpf', (data.cpf as string | null) ?? '')
        setValue('cliente_telefone', (data.telefone as string | null) ?? '')
      }
    }
  }

  function handleQuickClienteSuccess(cliente: { id: string; nome: string; telefone: string | null }) {
    setClienteId(cliente.id)
    setClienteDisplay(cliente.nome)
    setValue('cliente_nome', cliente.nome, { shouldValidate: true })
    setValue('cliente_telefone', cliente.telefone ?? '')
  }

  const searchModelos = useCallback(async (q: string): Promise<SelectOption[]> => {
    const query = q.trim().toLowerCase()
    return modelos.filter((m) => !query || m.nome.toLowerCase().includes(query)).map((m) => ({ id: m.id, label: m.nome }))
  }, [modelos])

  const searchMateriais = useCallback(async (q: string): Promise<SelectOption[]> => {
    const query = q.trim().toLowerCase()
    return materiais.filter((m) => !query || m.nome.toLowerCase().includes(query)).map((m) => ({ id: m.id, label: m.nome }))
  }, [materiais])

  function handleModeloChange(id: string | null, option?: SelectOption) {
    setModeloId(id)
    setModeloDisplay(option?.label)
    setValue('modelo', option?.label ?? '', { shouldValidate: true })
  }

  function handleMaterialChange(id: string | null, option?: SelectOption) {
    setMaterialId(id)
    setMaterialDisplay(option?.label)
    setValue('material', option?.label ?? '', { shouldValidate: true })
  }

  function handleQuickModeloSuccess(item: CertificadoModelo) {
    setModeloId(item.id)
    setModeloDisplay(item.nome)
    setValue('modelo', item.nome, { shouldValidate: true })
    onModelosChanged()
  }

  function handleQuickMaterialSuccess(item: CertificadoMaterial) {
    setMaterialId(item.id)
    setMaterialDisplay(item.nome)
    setValue('material', item.nome, { shouldValidate: true })
    onMateriaisChanged()
  }

  function handleVendedorChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value || null
    setVendedorId(id)
    setValue('vendedor_nome', vendedores.find((v) => v.id === id)?.nome ?? '')
  }

  async function onSave(data: CertificadoFormData) {
    if (!user) return
    const extras = { cliente_id: clienteId, vendedor_id: vendedorId, venda_id: vendaId }

    if (isEditing && certificado) {
      const { data: result, error } = await atualizarCertificado(certificado.id, data, extras)
      if (error) { alert.error('Erro', error); return }
      alert.success('Certificado Atualizado!', 'As alterações foram salvas.', {
        onConfirm: () => { if (result) onSaved(result, true) },
      })
      return
    }

    const { data: result, error } = await criarCertificado(data, extras, user.id)
    if (error) { alert.error('Erro', error); return }
    if (result) {
      reset(buildDefaults(null))
      setClienteId(null); setClienteDisplay(undefined)
      setModeloId(null); setModeloDisplay(undefined)
      setMaterialId(null); setMaterialDisplay(undefined)
      setVendedorId(null)
      setVendaId(null); setVendaDisplay(undefined)
      onSaved(result, false)
    }
  }

  return (
    <Card>
      <CardHeader
        title={isEditing ? `Editar Certificado ${certificado?.numero}` : 'Novo Certificado'}
        subtitle="Os dados abaixo compõem o certificado de garantia vitalícia em PDF"
      />

      <form onSubmit={handleSubmit(onSave)} className="flex flex-col gap-6">
        {/* Dados do cliente */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wide">Dados do Cliente</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchableSelect
              label="Cliente"
              value={clienteId}
              displayValue={clienteDisplay}
              onChange={handleClienteChange}
              onSearch={searchClientes}
              onCreateNew={() => setQuickClienteOpen(true)}
              createNewLabel="Cadastrar cliente"
              placeholder="Buscar cliente..."
              error={errors.cliente_nome?.message}
            />
            <Controller
              name="cliente_cpf"
              control={control}
              render={({ field }) => (
                <MaskedInput
                  mask="cpf"
                  label="CPF (opcional)"
                  placeholder="000.000.000-00"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
            />
            <Controller
              name="cliente_telefone"
              control={control}
              render={({ field }) => (
                <MaskedInput
                  mask="phone"
                  label="Telefone"
                  placeholder="(34) 90000-0000"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                />
              )}
            />
            <Input label="Data da compra" type="date" {...register('data_compra')} />
          </div>
        </section>

        {/* Dados da joia */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wide">Dados da Joia</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchableSelect
              label="Modelo"
              value={modeloId}
              displayValue={modeloDisplay}
              onChange={handleModeloChange}
              onSearch={searchModelos}
              onCreateNew={() => setQuickModeloOpen(true)}
              createNewLabel="Cadastrar modelo"
              placeholder="Buscar modelo..."
              error={errors.modelo?.message}
            />
            <SearchableSelect
              label="Material"
              value={materialId}
              displayValue={materialDisplay}
              onChange={handleMaterialChange}
              onSearch={searchMateriais}
              onCreateNew={() => setQuickMaterialOpen(true)}
              createNewLabel="Cadastrar material"
              placeholder="Buscar material..."
              error={errors.material?.message}
            />
            <Input label="Largura" placeholder="Ex: 4mm" {...register('largura')} />
            <Input label="Gramas (par)" placeholder="Ex: 8,4g" {...register('gramas')} />
            <Input label="Numeração (par)" placeholder="Ex: 18 / 22" {...register('numeracao')} />
            <Controller
              name="valor"
              control={control}
              render={({ field }) => (
                <CurrencyInput
                  label="Valor pago (R$)"
                  placeholder="Ex: 450,00"
                  value={field.value ?? 0}
                  onChange={(v) => field.onChange(v || undefined)}
                />
              )}
            />
          </div>
        </section>

        {/* Pedido / OS */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wide">Pedido / OS</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchableSelect
              label="Venda vinculada (opcional)"
              value={vendaId}
              displayValue={vendaDisplay}
              onChange={handleVendaChange}
              onSearch={searchVendas}
              placeholder="Buscar venda por nº ou cliente..."
            />
            <Input
              label="Nº do pedido/OS"
              placeholder="Ex: 1042"
              hint="Preenchido ao vincular uma venda — pode editar manualmente."
              {...register('pedido_os')}
            />
          </div>
        </section>

        {/* Responsável */}
        <section className="flex flex-col gap-3">
          <p className="text-xs font-medium text-dark-400 uppercase tracking-wide">Responsável</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label="Vendedor" value={vendedorId ?? ''} onChange={handleVendedorChange}>
              <option value="">Selecione…</option>
              {vendedores.map((v) => (
                <option key={v.id} value={v.id}>{v.nome}</option>
              ))}
            </Select>
          </div>
          <Textarea label="Observações (opcional)" rows={2} {...register('observacoes')} />
        </section>

        <div className="flex justify-end gap-3 pt-4 border-t border-gold-50">
          {isEditing && onCancelEdit && (
            <Button type="button" variant="ghost" onClick={onCancelEdit} disabled={isSubmitting}>
              Cancelar edição
            </Button>
          )}
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {isEditing ? 'Salvar Alterações' : 'Gerar Certificado'}
          </Button>
        </div>
      </form>

      <ModalQuickCliente
        open={quickClienteOpen}
        onClose={() => setQuickClienteOpen(false)}
        onSuccess={handleQuickClienteSuccess}
      />
      <ModalQuickCatalogoItem
        open={quickModeloOpen}
        title="Novo Modelo"
        label="modelo"
        placeholder="Ex: Abaulada"
        onClose={() => setQuickModeloOpen(false)}
        onCreate={criarCertificadoModelo}
        onSuccess={handleQuickModeloSuccess}
      />
      <ModalQuickCatalogoItem
        open={quickMaterialOpen}
        title="Novo Material"
        label="material"
        placeholder="Ex: Ouro 18K"
        onClose={() => setQuickMaterialOpen(false)}
        onCreate={criarCertificadoMaterial}
        onSuccess={handleQuickMaterialSuccess}
      />
    </Card>
  )
}
