'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAlert } from '@/hooks/use-alert'
import { Modal, Button, Select, Input } from '@/components/ui'
import { SearchableSelect, type SelectOption } from '@/components/forms/searchable-select'
import { estoqueSchema, type EstoqueFormData } from '@/schemas/estoque'
import { createMovimentacao } from '@/services/estoque'
import { useAuth } from '@/context/auth-context'
import { supabase } from '@/lib/supabase'
import type { ProdutoVariacao } from '@/types'

interface ModalMovimentacaoEstoqueProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  produtoId?: string
  produtoNome?: string
  variacaoId?: string
}

const TIPO_LABEL: Record<string, string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  ajuste: 'Ajuste',
  devolucao: 'Devolução',
}

export function ModalMovimentacaoEstoque({
  open,
  onClose,
  onSuccess,
  produtoId,
  produtoNome,
  variacaoId,
}: ModalMovimentacaoEstoqueProps) {
  const { user } = useAuth()
  const alert = useAlert()
  const [variacoes, setVariacoes] = useState<ProdutoVariacao[]>([])
  const [estoqueAtual, setEstoqueAtual] = useState<number | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EstoqueFormData>({
    resolver: zodResolver(estoqueSchema) as never,
    defaultValues: {
      produto_id: produtoId ?? '',
      variacao_id: variacaoId ?? '',
      tipo: undefined,
      quantidade: 1,
      motivo: '',
    },
  })

  const watchedProdutoId = watch('produto_id')
  const watchedVariacaoId = watch('variacao_id')
  const watchedTipo = watch('tipo')

  useEffect(() => {
    if (open) {
      reset({
        produto_id: produtoId ?? '',
        variacao_id: variacaoId ?? '',
        tipo: undefined,
        quantidade: 1,
        motivo: '',
      })
      setVariacoes([])
      setEstoqueAtual(null)
    }
  }, [open, produtoId, variacaoId, reset])

  useEffect(() => {
    if (!watchedProdutoId) { setVariacoes([]); return }
    supabase
      .from('produto_variacoes')
      .select('*')
      .eq('produto_id', watchedProdutoId)
      .eq('ativo', true)
      .then(({ data }) => {
        setVariacoes((data as ProdutoVariacao[]) ?? [])
        if (data?.length === 1) setValue('variacao_id', data[0].id)
      })
  }, [watchedProdutoId, setValue])

  useEffect(() => {
    if (!watchedVariacaoId) { setEstoqueAtual(null); return }
    const found = variacoes.find((v) => v.id === watchedVariacaoId)
    if (found) setEstoqueAtual(found.estoque_atual)
  }, [watchedVariacaoId, variacoes])

  const searchProdutos = useCallback(async (q: string): Promise<SelectOption[]> => {
    const { data } = await supabase
      .from('produtos')
      .select('id, nome, codigo')
      .eq('ativo', true)
      .ilike('nome', `%${q}%`)
      .limit(20)
    return (data ?? []).map((p: { id: string; nome: string; codigo: string }) => ({
      id: p.id,
      label: p.nome,
      sublabel: p.codigo,
    }))
  }, [])

  async function onSave(data: EstoqueFormData) {
    if (!user) return
    const { error } = await createMovimentacao(data, user.id)
    if (error) {
      alert.error('Erro', error)
    } else {
      alert.success('Movimentação Registrada!', 'Estoque atualizado com sucesso.', {
        onConfirm: () => { onSuccess(); onClose() },
      })
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nova Movimentação de Estoque"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="form-movimentacao"
            loading={isSubmitting}
          >
            Registrar
          </Button>
        </>
      }
    >
      <form id="form-movimentacao" onSubmit={handleSubmit(onSave)} className="flex flex-col gap-4">
        <Controller
          name="produto_id"
          control={control}
          render={({ field }) => (
            <SearchableSelect
              label="Produto"
              value={field.value || null}
              onChange={(id) => {
                field.onChange(id ?? '')
                setValue('variacao_id', '')
                setEstoqueAtual(null)
              }}
              onSearch={searchProdutos}
              placeholder="Buscar produto..."
              displayValue={produtoNome}
              error={errors.produto_id?.message}
            />
          )}
        />

        {variacoes.length > 0 && (
          <Select
            label="Variação"
            placeholder="Selecione a variação..."
            error={errors.variacao_id?.message}
            {...register('variacao_id')}
          >
            {variacoes.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nome}: {v.valor} (estoque: {v.estoque_atual})
              </option>
            ))}
          </Select>
        )}

        {estoqueAtual !== null && (
          <div className="p-3 bg-cream-50 rounded-lg border border-gold-100 text-sm text-dark-500">
            Estoque atual: <strong className="text-dark-700">{estoqueAtual} un.</strong>
          </div>
        )}

        <Select
          label="Tipo de movimentação"
          placeholder="Selecione..."
          error={errors.tipo?.message}
          {...register('tipo')}
        >
          {Object.entries(TIPO_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>

        <Input
          label={watchedTipo === 'ajuste' ? 'Novo estoque (quantidade final)' : 'Quantidade'}
          type="number"
          min={1}
          error={errors.quantidade?.message}
          {...register('quantidade', { valueAsNumber: true })}
        />

        <Input
          label="Motivo"
          placeholder="Ex: Compra de fornecedor, perda, correção..."
          error={errors.motivo?.message}
          {...register('motivo')}
        />
      </form>
    </Modal>
  )
}
