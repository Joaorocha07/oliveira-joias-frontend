'use client'

import { useCallback, useEffect, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import {
  MetricCard, Card, CardHeader, Badge, Spinner, EmptyState,
  PeriodFilter, getPeriodRange, type PeriodPreset,
} from '@/components/ui'
import { formatMoney, formatDate, vendaStatusVariant, VENDA_STATUS_LABEL } from '@/utils'
import { listarMetasMensais } from '@/services/metas'
import { listarFollowUps } from '@/services/follow-ups'
import type { Profile, VendaComCliente } from '@/types'

interface Props {
  profile: Profile
}

interface State {
  totalVendido: number
  qtdVendas: number
  ticketMedio: number
  metaMes: number | null
  followUpsPendentes: number
  vendasRecentes: VendaComCliente[]
  loading: boolean
}

const INITIAL: State = {
  totalVendido: 0,
  qtdVendas: 0,
  ticketMedio: 0,
  metaMes: null,
  followUpsPendentes: 0,
  vendasRecentes: [],
  loading: true,
}

export function FuncionarioDashboard({ profile }: Props) {
  const mesAtual = format(new Date(), 'yyyy-MM-01')
  const initialPeriod = getPeriodRange('mes')
  const [dataInicio, setDataInicio] = useState(initialPeriod.inicio)
  const [dataFim, setDataFim] = useState(initialPeriod.fim)
  const [activePreset, setActivePreset] = useState<PeriodPreset>('mes')
  const [state, setState] = useState<State>(INITIAL)

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }))

    const [
      { data: vendasRaw },
      { data: metas },
      { data: followUps },
      { data: vendasRecentes },
    ] = await Promise.all([
      supabase
        .from('vendas')
        .select('total, forma_pagamento')
        .eq('vendedor_id', profile.id)
        .neq('status', 'cancelado')
        .gte('data_venda', dataInicio)
        .lte('data_venda', dataFim),
      listarMetasMensais(mesAtual),
      listarFollowUps(),
      supabase
        .from('vendas')
        .select('*, cliente:clientes(nome, telefone)')
        .eq('vendedor_id', profile.id)
        .neq('status', 'cancelado')
        .gte('data_venda', dataInicio)
        .lte('data_venda', dataFim)
        .order('created_at', { ascending: false })
        .limit(8),
    ])

    const vendas = (vendasRaw ?? []) as { total: number; forma_pagamento: string }[]
    const vendasRecebidas = vendas.filter((v) => v.forma_pagamento !== 'crediario')
    const totalVendido = vendasRecebidas.reduce((sum, v) => sum + (v.total ?? 0), 0)
    const qtdVendas = vendas.length

    const metaRow = metas?.find((m) => m.vendedor_id === profile.id)
    const metaMes = metaRow?.valor_meta ?? null

    const followUpsPendentes = (followUps ?? []).filter((f) => f.status === 'pendente').length

    setState({
      totalVendido,
      qtdVendas,
      ticketMedio: qtdVendas > 0 ? totalVendido / qtdVendas : 0,
      metaMes,
      followUpsPendentes,
      vendasRecentes: (vendasRecentes as VendaComCliente[]) ?? [],
      loading: false,
    })
  }, [dataInicio, dataFim, profile.id, mesAtual])

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(id)
  }, [load])

  const percentMeta =
    state.metaMes && state.metaMes > 0
      ? Math.min(100, (state.totalVendido / state.metaMes) * 100)
      : null

  if (state.loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium text-dark-800">
          Olá, {profile.nome.split(' ')[0]}!
        </h1>
        <p className="text-xs text-dark-300 mt-0.5">
          {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>

      <Card>
        <PeriodFilter
          dataInicio={dataInicio}
          dataFim={dataFim}
          activePreset={activePreset}
          onChange={({ inicio, fim, preset }) => {
            setDataInicio(inicio)
            setDataFim(fim)
            setActivePreset(preset)
          }}
        />
      </Card>

      {/* Meta do mês — sempre mês atual */}
      {state.metaMes !== null && (
        <Card>
          <CardHeader
            title="Meta do Mês"
            subtitle={format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
          />
          <div className="mt-3">
            <div className="flex items-end justify-between mb-2">
              <div>
                <p className="font-display text-2xl font-semibold text-dark-700">
                  {formatMoney(state.totalVendido)}
                </p>
                <p className="text-xs text-dark-400 mt-0.5">
                  de {formatMoney(state.metaMes)} de meta
                </p>
              </div>
              <p className={`font-display text-3xl font-bold ${(percentMeta ?? 0) >= 100 ? 'text-green-600' : 'text-gold-600'}`}>
                {(percentMeta ?? 0).toFixed(1)}%
              </p>
            </div>
            <div className="h-3 bg-gold-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${(percentMeta ?? 0) >= 100 ? 'bg-green-500' : 'bg-gold-500'}`}
                style={{ width: `${percentMeta ?? 0}%` }}
              />
            </div>
            <p className="text-xs text-dark-300 mt-2">
              {(percentMeta ?? 0) >= 100
                ? 'Meta atingida! Parabéns!'
                : `Faltam ${formatMoney(state.metaMes - state.totalVendido)} para atingir a meta`}
            </p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          label="Total Vendido"
          value={formatMoney(state.totalVendido)}
          change={`${state.qtdVendas} venda(s) no período`}
          changeType="neutral"
          accent
        />
        <MetricCard
          label="Ticket Médio"
          value={formatMoney(state.ticketMedio)}
          change={state.qtdVendas > 0 ? `${state.qtdVendas} venda(s)` : 'Sem vendas'}
          changeType="neutral"
        />
        <MetricCard
          label="Follow-ups Pendentes"
          value={String(state.followUpsPendentes)}
          change={state.followUpsPendentes > 0 ? 'Requerem atenção' : 'Tudo em dia'}
          changeType={state.followUpsPendentes > 0 ? 'down' : 'up'}
        />
      </div>

      <Card>
        <CardHeader title="Minhas Vendas Recentes" />
        {state.vendasRecentes.length === 0 ? (
          <EmptyState
            imageSrc="/images/Shopping-bro.svg"
            title="Sem vendas no período"
            description="Nenhuma venda registrada no período selecionado."
          />
        ) : (
          <div className="divide-y divide-gold-50">
            {state.vendasRecentes.map((venda) => (
              <div key={venda.id} className="flex items-start justify-between py-3">
                <div>
                  <p className="text-sm font-medium text-dark-700 leading-tight">
                    {venda.cliente?.nome || 'Sem cliente'}
                  </p>
                  <p className="text-xs text-dark-300 mt-0.5">{formatDate(venda.data_venda)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-dark-700">{formatMoney(venda.total)}</p>
                  <Badge variant={vendaStatusVariant(venda.status)} className="mt-0.5">
                    {VENDA_STATUS_LABEL[venda.status]}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
