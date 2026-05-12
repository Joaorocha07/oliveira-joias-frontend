'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, Card, MetricCard, Button,
  SearchInput, Select, Spinner, EmptyState, Modal, Input, Textarea,
} from '@/components/ui'
import { formatMoney, formatDate, today } from '@/utils'
import type { Lancamento, LancamentoInsert, LancamentoTipo } from '@/types'
import { useAuth } from '@/context/auth-context'

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

type PeriodoAtalho = 'hoje' | 'sete_dias' | 'mes'

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function monthStart() {
  const now = new Date()
  return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1))
}

export default function CaixaPage() {
  const { user } = useAuth()
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<LancamentoTipo | ''>('')
  const [dataInicio, setDataInicio] = useState(today())
  const [dataFim, setDataFim] = useState(today())
  const [modalOpen, setModalOpen] = useState(false)
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
      toast.error('Erro ao carregar lancamentos.')
    } else {
      setLancamentos(data ?? [])
    }
    setLoading(false)
  }, [dataFim, dataInicio])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadLancamentos(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadLancamentos])

  const filtered = useMemo(() => {
    return lancamentos.filter((l) => {
      const matchSearch = !search || l.descricao.toLowerCase().includes(search.toLowerCase())
      const matchTipo = !filtroTipo || l.tipo === filtroTipo
      return matchSearch && matchTipo
    })
  }, [lancamentos, search, filtroTipo])

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

  function setPeriodo(atalho: PeriodoAtalho) {
    const hoje = today()
    setLoading(true)

    if (atalho === 'hoje') {
      setDataInicio(hoje)
      setDataFim(hoje)
      return
    }

    if (atalho === 'sete_dias') {
      setDataInicio(toDateInputValue(addDays(new Date(), -6)))
      setDataFim(hoje)
      return
    }

    setDataInicio(monthStart())
    setDataFim(hoje)
  }

  function handleDataInicioChange(value: string) {
    setLoading(true)
    setDataInicio(value)
    if (value > dataFim) setDataFim(value)
  }

  function handleDataFimChange(value: string) {
    setLoading(true)
    setDataFim(value)
    if (value < dataInicio) setDataInicio(value)
  }

  async function handleSave() {
    if (!form.descricao.trim()) {
      toast.error('Descricao e obrigatoria.')
      return
    }
    if (!form.valor || form.valor <= 0) {
      toast.error('Valor deve ser maior que zero.')
      return
    }

    setSalvando(true)
    const { data, error } = await supabase
      .from('lancamentos')
      .insert([{ ...form, created_by: user?.id ?? null }])
      .select()
      .single()

    if (error) {
      toast.error('Erro ao registrar lancamento.')
    } else {
      toast.success('Lancamento registrado.')
      setModalOpen(false)
      if (data) {
        const lancamento = data as Lancamento
        const belongsToCurrentPeriod = lancamento.data_lancamento >= dataInicio && lancamento.data_lancamento <= dataFim
        if (belongsToCurrentPeriod) setLancamentos((prev) => [lancamento, ...prev])
      }
    }
    setSalvando(false)
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
              setForm({ ...EMPTY_FORM, data_lancamento: today(), created_by: user?.id ?? null })
              setModalOpen(true)
            }}
          >
            Novo Lancamento
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Total de Entradas" value={formatMoney(totalEntradas)} changeType="up" />
        <MetricCard label="Total de Saidas" value={formatMoney(totalSaidas)} changeType="down" />
        <MetricCard label="Saldo" value={formatMoney(saldo)} changeType={saldo >= 0 ? 'up' : 'down'} accent />
      </div>

      <Card padding="none">
        <div className="flex flex-col gap-3 p-4 border-b border-gold-100">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={dataInicio === today() && dataFim === today() ? 'primary' : 'secondary'}
                onClick={() => setPeriodo('hoje')}
              >
                Hoje
              </Button>
              <Button type="button" variant="secondary" onClick={() => setPeriodo('sete_dias')}>
                7 dias
              </Button>
              <Button type="button" variant="secondary" onClick={() => setPeriodo('mes')}>
                Mes
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:ml-auto">
              <Input
                label="De"
                type="date"
                value={dataInicio}
                onChange={(e) => handleDataInicioChange(e.target.value)}
              />
              <Input
                label="Ate"
                type="date"
                value={dataFim}
                onChange={(e) => handleDataFimChange(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Buscar lancamento..."
              className="flex-1"
            />
            <Select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value as LancamentoTipo | '')}
              placeholder="Todos os tipos"
              className="w-full sm:w-44"
            >
              <option value="entrada">Entradas</option>
              <option value="saida">Saidas</option>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Wallet size={24} />}
            title="Nenhum lancamento encontrado"
            description={search || filtroTipo ? 'Tente ajustar os filtros.' : `Nenhum movimento em ${periodoLabel}.`}
          />
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden divide-y divide-gold-50">
              {filtered.map((l) => (
                <div key={l.id} className="p-4 hover:bg-cream-50/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-dark-700 text-sm truncate flex-1">{l.descricao}</p>
                    {l.tipo === 'entrada' ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium flex-shrink-0">
                        <TrendingUp size={11} /> Entrada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium flex-shrink-0">
                        <TrendingDown size={11} /> Saida
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gold-50">
                    <span className="text-xs text-dark-300">{formatDate(l.data_lancamento)}</span>
                    <span className={`font-medium text-sm ${l.tipo === 'entrada' ? 'text-green-700' : 'text-red-700'}`}>
                      {l.tipo === 'saida' ? '- ' : '+ '}{formatMoney(l.valor)}
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
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Descricao</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Tipo</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-50">
                  {filtered.map((l) => (
                    <tr key={l.id} className="hover:bg-cream-50/40 transition-colors">
                      <td className="px-5 py-3 text-dark-400 whitespace-nowrap">{formatDate(l.data_lancamento)}</td>
                      <td className="px-5 py-3 text-dark-700 max-w-[300px]">
                        <span className="block truncate">{l.descricao}</span>
                      </td>
                      <td className="px-5 py-3">
                        {l.tipo === 'entrada' ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                            <TrendingUp size={12} /> Entrada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium">
                            <TrendingDown size={12} /> Saida
                          </span>
                        )}
                      </td>
                      <td className={`px-5 py-3 text-right font-medium ${l.tipo === 'entrada' ? 'text-green-700' : 'text-red-700'}`}>
                        {l.tipo === 'saida' ? '- ' : '+ '}{formatMoney(l.valor)}
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
        onClose={() => setModalOpen(false)}
        title="Novo Lancamento"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSave} loading={salvando}>
              Registrar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Tipo"
            value={form.tipo}
            onChange={(e) => setField('tipo', e.target.value as LancamentoTipo)}
          >
            <option value="entrada">Entrada</option>
            <option value="saida">Saida</option>
          </Select>
          <Input label="Descricao *" value={form.descricao} onChange={(e) => setField('descricao', e.target.value)} />
          <Input
            label="Valor *"
            type="number"
            min="0.01"
            step="0.01"
            value={form.valor || ''}
            onChange={(e) => setField('valor', parseFloat(e.target.value) || 0)}
          />
          <Input label="Data" type="date" value={form.data_lancamento} onChange={(e) => setField('data_lancamento', e.target.value)} />
          <Textarea label="Observacoes" value={form.observacoes ?? ''} onChange={(e) => setField('observacoes', e.target.value || null)} />
        </div>
      </Modal>
    </div>
  )
}
