'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Wallet, TrendingUp, TrendingDown, Pencil, Trash2 } from 'lucide-react'
import { useAlert } from '@/hooks/use-alert'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, Card, MetricCard, Button,
  SearchInput, Select, Spinner, EmptyState, Modal, Input, Textarea,
  PeriodFilter, getPeriodRange, type PeriodPreset,
  ActionMenu, type ActionMenuItem, ConfirmDialog,
} from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { formatMoney, formatDate, today } from '@/utils'
import type { Lancamento, LancamentoInsert, LancamentoTipo } from '@/types'
import { useAuth } from '@/context/auth-context'

interface CategoriaLancamento {
  id: string
  nome: string
}

const EMPTY_FORM: LancamentoInsert = {
  tipo: 'entrada',
  descricao: '',
  valor: 0,
  data_lancamento: today(),
  categoria_id: null,
  categoria_nome: null,
  forma_pagamento: null,
  referencia_id: null,
  referencia_tipo: null,
  observacoes: null,
  created_by: null,
  updated_by: null,
}

export default function CaixaPage() {
  const { user } = useAuth()
  const alert = useAlert()
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(true)
  const [categorias, setCategorias] = useState<CategoriaLancamento[]>([])
  const [categoriasLoading, setCategoriasLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<LancamentoTipo | ''>('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const initialPeriod = getPeriodRange('hoje')
  const [dataInicio, setDataInicio] = useState(initialPeriod.inicio)
  const [dataFim, setDataFim] = useState(initialPeriod.fim)
  const [activePreset, setActivePreset] = useState<PeriodPreset>('hoje')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Lancamento | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Lancamento | null>(null)
  const [deletando, setDeletando] = useState(false)
  const [form, setForm] = useState<LancamentoInsert>(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)

  const loadLancamentos = useCallback(async () => {
    const { data, error } = await supabase
      .from('lancamentos')
      .select('*')
      .gte('data_lancamento', dataInicio)
      .lte('data_lancamento', dataFim)
      .order('data_lancamento', { ascending: false })

    if (error) {
      alert.error('Erro', 'Erro ao carregar lançamentos.')
    } else {
      setLancamentos(data ?? [])
    }
    setLoading(false)
  }, [dataFim, dataInicio])

  const loadCategorias = useCallback(async () => {
    setCategoriasLoading(true)
    const { data, error } = await supabase
      .from('categorias')
      .select('id, nome')
      .order('nome')

    if (error) {
      alert.error('Erro', `Erro ao carregar categorias: ${error.message}`)
      setCategorias([])
    } else {
      setCategorias((data as CategoriaLancamento[]) ?? [])
    }
    setCategoriasLoading(false)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadLancamentos(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadLancamentos])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadCategorias(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadCategorias])

  const filtered = useMemo(() => {
    return lancamentos.filter((l) => {
      const matchSearch = !search || l.descricao.toLowerCase().includes(search.toLowerCase())
      const matchTipo = !filtroTipo || l.tipo === filtroTipo
      const matchCat = !filtroCategoria || l.categoria_nome === filtroCategoria
      return matchSearch && matchTipo && matchCat
    })
  }, [lancamentos, search, filtroTipo, filtroCategoria])

  const totalEntradas = lancamentos
    .filter((l) => l.tipo === 'entrada')
    .reduce((s, l) => s + l.valor, 0)
  const totalSaidas = lancamentos
    .filter((l) => l.tipo === 'saida')
    .reduce((s, l) => s + l.valor, 0)
  const saldo = totalEntradas - totalSaidas
  const periodoLabel = dataInicio === dataFim
    ? formatDate(dataInicio)
    : `${formatDate(dataInicio)} a ${formatDate(dataFim)}`

  function setField<K extends keyof LancamentoInsert>(key: K, value: LancamentoInsert[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleTipoChange(value: LancamentoTipo) {
    setForm((prev) => ({ ...prev, tipo: value }))
  }

  function handleCategoriaChange(categoriaId: string) {
    const categoria = categorias.find((item) => item.id === categoriaId)
    setForm((prev) => ({
      ...prev,
      categoria_id: categoria?.id ?? null,
      categoria_nome: categoria?.nome ?? null,
    }))
  }

  function openEdit(l: Lancamento) {
    setEditando(l)
    setForm({
      tipo: l.tipo,
      descricao: l.descricao,
      valor: l.valor,
      data_lancamento: l.data_lancamento,
      categoria_id: l.categoria_id,
      categoria_nome: l.categoria_nome,
      forma_pagamento: l.forma_pagamento,
      referencia_id: l.referencia_id,
      referencia_tipo: l.referencia_tipo,
      observacoes: l.observacoes,
      created_by: l.created_by,
      updated_by: user?.id ?? null,
    })
    setModalOpen(true)
  }

  function getLancamentoActions(l: Lancamento): ActionMenuItem[] {
    return [
      { label: 'Editar', icon: <Pencil size={14} />, onClick: () => openEdit(l) },
      { label: 'Excluir', icon: <Trash2 size={14} />, onClick: () => setConfirmDelete(l), variant: 'danger' },
    ]
  }

  async function handleSave() {
    if (!form.descricao.trim()) { alert.error('Atenção', 'Descrição é obrigatória.'); return }
    if (!form.valor || form.valor <= 0) { alert.error('Atenção', 'Valor deve ser maior que zero.'); return }

    setSalvando(true)

    if (editando) {
      const { data, error } = await supabase
        .from('lancamentos')
        .update({ ...form, updated_by: user?.id ?? null })
        .eq('id', editando.id)
        .select()
        .single()

      if (error) {
        alert.error('Erro', `Erro ao atualizar: ${error.message}`)
      } else {
        if (data) setLancamentos((prev) => prev.map((l) => l.id === editando.id ? data as Lancamento : l))
        alert.success('Lançamento Atualizado!', 'As alterações foram salvas.', {
          onConfirm: () => { setModalOpen(false); setEditando(null) },
        })
      }
    } else {
      const { data, error } = await supabase
        .from('lancamentos')
        .insert([{ ...form, created_by: user?.id ?? null }])
        .select()
        .single()

      if (error) {
        alert.error('Erro', `Erro ao registrar lançamento: ${error.message}`)
      } else {
        if (data) {
          const lancamento = data as Lancamento
          const belongsToCurrentPeriod =
            lancamento.data_lancamento >= dataInicio && lancamento.data_lancamento <= dataFim
          if (belongsToCurrentPeriod) setLancamentos((prev) => [lancamento, ...prev])
        }
        alert.success('Lançamento Registrado!', 'Movimento de caixa registrado com sucesso.', {
          onConfirm: () => setModalOpen(false),
        })
      }
    }

    setSalvando(false)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setDeletando(true)
    const { error } = await supabase
      .from('lancamentos')
      .delete()
      .eq('id', confirmDelete.id)

    if (error) {
      alert.error('Erro', `Erro ao excluir: ${error.message}`)
    } else {
      setLancamentos((prev) => prev.filter((l) => l.id !== confirmDelete.id))
      setConfirmDelete(null)
      alert.success('Lançamento Excluído!', 'O lançamento foi removido do caixa.')
    }
    setDeletando(false)
  }

  return (
    <div>
      <PageHeader
        title="Caixa & Financeiro"
        subtitle={`Movimento do caixa: ${periodoLabel}`}
        actions={
          <Button
            variant="primary"
            leftIcon={<Plus size={14} />}
            onClick={() => {
              setEditando(null)
              setForm({ ...EMPTY_FORM, data_lancamento: today(), created_by: user?.id ?? null })
              setModalOpen(true)
            }}
          >
            Novo Lançamento
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Total de Entradas" value={formatMoney(totalEntradas)} changeType="up" />
        <MetricCard label="Total de Saídas" value={formatMoney(totalSaidas)} changeType="down" />
        <MetricCard label="Saldo" value={formatMoney(saldo)} changeType={saldo >= 0 ? 'up' : 'down'} accent />
      </div>

      <Card padding="none">
        <div className="flex flex-col gap-3 p-4 border-b border-gold-100">
          <PeriodFilter
            dataInicio={dataInicio}
            dataFim={dataFim}
            activePreset={activePreset}
            onChange={({ inicio, fim, preset }) => {
              setLoading(true)
              setDataInicio(inicio)
              setDataFim(fim)
              setActivePreset(preset)
            }}
          />

          <div className="flex flex-col sm:flex-row gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar lançamento..."
              className="flex-1"
            />
            <Select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as LancamentoTipo | '')}
              placeholder="Todos os tipos"
              className="w-full sm:w-44"
            >
              <option value="entrada">Entradas</option>
              <option value="saida">Saídas</option>
            </Select>
            <Select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              placeholder="Todas as categorias"
              className="w-full sm:w-56"
            >
              {categorias.map((categoria) => (
                <option key={categoria.id} value={categoria.nome}>{categoria.nome}</option>
              ))}
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            imageSrc="/images/Push notifications-rafiki.svg"
            title="Nenhum lançamento encontrado"
            description={search || filtroTipo || filtroCategoria ? 'Tente ajustar os filtros.' : `Nenhum movimento em ${periodoLabel}.`}
          />
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden divide-y divide-gold-50">
              {filtered.map((l) => (
                <div key={l.id} className="p-4 hover:bg-cream-50/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-dark-700 text-sm truncate">{l.descricao}</p>
                      {l.categoria_nome && (
                        <p className="text-xs text-dark-400 mt-0.5">{l.categoria_nome}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {l.tipo === 'entrada' ? (
                        <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                          <TrendingUp size={11} /> Entrada
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
                          <TrendingDown size={11} /> Saída
                        </span>
                      )}
                      <ActionMenu items={getLancamentoActions(l)} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gold-50">
                    <span className="text-xs text-dark-300">{formatDate(l.data_lancamento)}</span>
                    <span className={`font-medium text-sm ${l.tipo === 'entrada' ? 'text-green-700' : 'text-red-700'}`}>
                      {l.tipo === 'saida' ? '− ' : '+ '}{formatMoney(l.valor)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold-100 bg-cream-50/50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Data</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Descrição</th>
                    <th className="hidden lg:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Categoria</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Tipo</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Valor</th>
                    <th className="px-5 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-50">
                  {filtered.map((l) => (
                    <tr key={l.id} className="hover:bg-cream-50/40 transition-colors">
                      <td className="px-5 py-3 text-dark-400 whitespace-nowrap">{formatDate(l.data_lancamento)}</td>
                      <td className="px-5 py-3 text-dark-700 max-w-[260px]">
                        <span className="block truncate">{l.descricao}</span>
                      </td>
                      <td className="hidden lg:table-cell px-5 py-3 text-dark-400 max-w-[180px]">
                        <span className="block truncate">{l.categoria_nome ?? '—'}</span>
                      </td>
                      <td className="px-5 py-3">
                        {l.tipo === 'entrada' ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                            <TrendingUp size={12} /> Entrada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
                            <TrendingDown size={12} /> Saída
                          </span>
                        )}
                      </td>
                      <td className={`px-5 py-3 text-right font-medium ${l.tipo === 'entrada' ? 'text-green-700' : 'text-red-700'}`}>
                        {l.tipo === 'saida' ? '− ' : '+ '}{formatMoney(l.valor)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => openEdit(l)}
                            className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Editar lançamento"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(l)}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Excluir lançamento"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditando(null) }}
        title={editando ? 'Editar Lançamento' : 'Novo Lançamento'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSave} loading={salvando}>
              {editando ? 'Salvar' : 'Registrar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Tipo"
            value={form.tipo}
            onChange={(e) => handleTipoChange(e.target.value as LancamentoTipo)}
          >
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
          </Select>

          <Select
            label="Categoria"
            value={form.categoria_id ?? ''}
            onChange={(e) => handleCategoriaChange(e.target.value)}
            placeholder={categoriasLoading ? 'Carregando categorias...' : 'Selecione a categoria...'}
            disabled={categoriasLoading}
            hint={!categoriasLoading && categorias.length === 0 ? 'Nenhuma categoria encontrada no banco.' : undefined}
          >
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>{categoria.nome}</option>
            ))}
          </Select>

          <Input label="Descrição *" value={form.descricao} onChange={(e) => setField('descricao', e.target.value)} />
          <CurrencyInput
            label="Valor *"
            value={form.valor}
            onChange={(v) => setField('valor', v)}
          />
          <Input label="Data" type="date" value={form.data_lancamento} onChange={(e) => setField('data_lancamento', e.target.value)} />
          <Textarea label="Observações" value={form.observacoes ?? ''} onChange={(e) => setField('observacoes', e.target.value || null)} />
        </div>
      </Modal>
      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Excluir Lançamento"
        description={`Tem certeza que deseja excluir "${confirmDelete?.descricao}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deletando}
      />
    </div>
  )
}
