'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Plus, Receipt } from 'lucide-react'
import {
  PageHeader, Card, MetricCard, Spinner, EmptyState, Button, ActionMenu,
} from '@/components/ui'
import { ModalContaPagar } from '@/components/modals/modal-conta-pagar'
import { ModalPagarConta } from '@/components/modals/modal-pagar-conta'
import { useAlert } from '@/hooks/use-alert'
import {
  listarContasPagar,
  excluirContaPagar,
  cancelarContaPagar,
} from '@/services/contas-pagar'
import { formatMoney, today } from '@/utils'
import type { ContaPagar, ContaPagarStatus } from '@/types'

type FilterTab = 'pendentes' | 'vencidas' | 'pagas' | 'todas'
type FilterTipo = 'todas' | 'fixa' | 'variavel'

function getStatusEfetivo(conta: ContaPagar): ContaPagarStatus {
  if (conta.status === 'pendente' && conta.data_vencimento < today()) return 'vencido'
  return conta.status
}

function StatusBadge({ conta }: { conta: ContaPagar }) {
  const status = getStatusEfetivo(conta)
  const map: Record<string, { label: string; className: string }> = {
    pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-700' },
    vencido: { label: 'Vencida', className: 'bg-red-100 text-red-700' },
    pago: { label: 'Paga', className: 'bg-green-100 text-green-700' },
    cancelado: { label: 'Cancelada', className: 'bg-dark-100 text-dark-400' },
  }
  const { label, className } = map[status] ?? map.pendente
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>
      {label}
    </span>
  )
}

function VencimentoBadge({ conta }: { conta: ContaPagar }) {
  const status = getStatusEfetivo(conta)
  if (conta.status === 'pago') {
    return <span className="text-xs text-dark-400">{formatDate(conta.data_pagamento!)}</span>
  }
  const isVencida = status === 'vencido'
  return (
    <span className={`text-xs font-medium ${isVencida ? 'text-red-600' : 'text-dark-500'}`}>
      {formatDate(conta.data_vencimento)}
    </span>
  )
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export default function ContasPagarPage() {
  const alert = useAlert()
  const [contas, setContas] = useState<ContaPagar[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTab, setFilterTab] = useState<FilterTab>('pendentes')
  const [filterTipo, setFilterTipo] = useState<FilterTipo>('todas')

  const [modalCriarOpen, setModalCriarOpen] = useState(false)
  const [modalEditarConta, setModalEditarConta] = useState<ContaPagar | null>(null)
  const [modalPagarConta, setModalPagarConta] = useState<ContaPagar | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await listarContasPagar()
    setContas(data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── Métricas ─────────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const todayStr = today()
    const mesAtual = todayStr.slice(0, 7) // YYYY-MM

    const pendentes = contas.filter(c => c.status === 'pendente')
    const vencidas = pendentes.filter(c => c.data_vencimento < todayStr)
    const aVencer7d = pendentes.filter(c => {
      const diff = (new Date(c.data_vencimento).getTime() - new Date(todayStr).getTime()) / 86400000
      return diff >= 0 && diff <= 7
    })
    const pagasNoMes = contas.filter(c => c.status === 'pago' && c.data_pagamento?.startsWith(mesAtual))

    return {
      totalPendente: pendentes.reduce((s, c) => s + c.valor, 0),
      qtdVencidas: vencidas.length,
      valorVencido: vencidas.reduce((s, c) => s + c.valor, 0),
      qtdAVencer7d: aVencer7d.length,
      valorAVencer7d: aVencer7d.reduce((s, c) => s + c.valor, 0),
      valorPagoMes: pagasNoMes.reduce((s, c) => s + c.valor, 0),
      qtdPagoMes: pagasNoMes.length,
    }
  }, [contas])

  // ── Filtro ────────────────────────────────────────────────────────────────
  const contasFiltradas = useMemo(() => {
    const todayStr = today()
    return contas.filter(c => {
      const statusEf = getStatusEfetivo(c)
      const tabOk =
        filterTab === 'todas' ? true :
        filterTab === 'pendentes' ? (c.status === 'pendente' && statusEf !== 'vencido') :
        filterTab === 'vencidas' ? statusEf === 'vencido' :
        filterTab === 'pagas' ? c.status === 'pago' : true
      const tipoOk =
        filterTipo === 'todas' ? true :
        filterTipo === 'fixa' ? c.fixa :
        filterTipo === 'variavel' ? !c.fixa : true
      return tabOk && tipoOk
    })
  }, [contas, filterTab, filterTipo])

  // ── Ações ─────────────────────────────────────────────────────────────────
  function handleExcluir(conta: ContaPagar) {
    alert.warning(
      'Excluir conta?',
      `"${conta.nome}" será removida permanentemente.`,
      {
        showCancel: true,
        confirmText: 'Excluir',
        cancelText: 'Cancelar',
        onConfirm: async () => {
          const { error } = await excluirContaPagar(conta.id)
          if (error) { alert.error('Erro ao excluir', error); return }
          alert.success('Conta excluída', 'A conta foi removida.')
          load()
        },
      },
    )
  }

  function handleCancelar(conta: ContaPagar) {
    alert.warning(
      'Cancelar conta?',
      `"${conta.nome}" será marcada como cancelada.`,
      {
        showCancel: true,
        confirmText: 'Cancelar conta',
        cancelText: 'Voltar',
        onConfirm: async () => {
          const { error } = await cancelarContaPagar(conta.id)
          if (error) { alert.error('Erro ao cancelar', error); return }
          alert.success('Conta cancelada', 'A conta foi marcada como cancelada.')
          load()
        },
      },
    )
  }

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'pendentes', label: 'Pendentes' },
    { key: 'vencidas', label: 'Vencidas' },
    { key: 'pagas', label: 'Pagas' },
    { key: 'todas', label: 'Todas' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a Pagar"
        subtitle="Gerencie todas as contas fixas e variáveis da loja"
        actions={
          <Button variant="primary" size="sm" leftIcon={<Plus size={16} />} onClick={() => setModalCriarOpen(true)}>
            Nova conta
          </Button>
        }
      />

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Pendente"
          value={formatMoney(metrics.totalPendente)}
          changeType="neutral"
        />
        <MetricCard
          label="Vencidas"
          value={formatMoney(metrics.valorVencido)}
          changeType={metrics.qtdVencidas > 0 ? 'down' : 'neutral'}
          change={metrics.qtdVencidas > 0 ? `${metrics.qtdVencidas} conta(s) vencida(s)` : 'Nenhuma vencida'}
        />
        <MetricCard
          label="A Vencer em 7 dias"
          value={formatMoney(metrics.valorAVencer7d)}
          changeType={metrics.qtdAVencer7d > 0 ? 'down' : 'neutral'}
          change={metrics.qtdAVencer7d > 0 ? `${metrics.qtdAVencer7d} conta(s)` : 'Nenhuma'}
        />
        <MetricCard
          label="Pagas no Mês"
          value={formatMoney(metrics.valorPagoMes)}
          changeType="up"
          change={`${metrics.qtdPagoMes} conta(s) quitada(s)`}
        />
      </div>

      {/* Filtros */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Tabs de status */}
          <div className="flex gap-2 flex-wrap">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterTab(tab.key)}
                className={[
                  'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
                  filterTab === tab.key
                    ? 'border-gold-500 bg-gold-500 text-dark-800 shadow-sm'
                    : 'border-gold-100 bg-white text-dark-500 hover:bg-cream-50 hover:border-gold-200',
                ].join(' ')}
              >
                {tab.label}
                {tab.key === 'vencidas' && metrics.qtdVencidas > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {metrics.qtdVencidas}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Toggle Fixa/Variável */}
          <div className="flex gap-2">
            {(['todas', 'fixa', 'variavel'] as const).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => setFilterTipo(tipo)}
                className={[
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                  filterTipo === tipo
                    ? 'border-gold-400 bg-gold-50 text-gold-700'
                    : 'border-gold-100 bg-white text-dark-400 hover:bg-cream-50',
                ].join(' ')}
              >
                {tipo === 'todas' ? 'Todas' : tipo === 'fixa' ? 'Fixas' : 'Variáveis'}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Lista */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Spinner size={28} />
          </div>
        ) : contasFiltradas.length === 0 ? (
          <EmptyState
            imageSrc="/images/Analytics-rafiki.svg"
            title="Nenhuma conta encontrada"
            subtitle="Ajuste os filtros ou crie uma nova conta."
          />
        ) : (
          <div className="divide-y divide-gold-50">
            {contasFiltradas.map((conta) => {
              const statusEf = getStatusEfetivo(conta)
              const isPaga = conta.status === 'pago'
              const isCancelada = conta.status === 'cancelado'
              const podeEditar = !isPaga && !isCancelada
              const podePagar = !isPaga && !isCancelada

              return (
                <div
                  key={conta.id}
                  className={[
                    'flex items-center gap-4 py-3.5 px-1',
                    statusEf === 'vencido' ? 'bg-red-50/40' : '',
                  ].join(' ')}
                >
                  {/* Ícone de tipo */}
                  <div className={[
                    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full',
                    isPaga ? 'bg-green-100' : statusEf === 'vencido' ? 'bg-red-100' : 'bg-gold-50',
                  ].join(' ')}>
                    {isPaga
                      ? <CheckCircle2 size={16} className="text-green-600" />
                      : statusEf === 'vencido'
                        ? <AlertTriangle size={16} className="text-red-500" />
                        : <Receipt size={16} className="text-gold-600" />
                    }
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className={`text-sm font-semibold truncate ${isCancelada ? 'text-dark-300 line-through' : 'text-dark-800'}`}>
                        {conta.nome}
                      </p>
                      {conta.fixa && (
                        <span className="inline-flex items-center rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-semibold text-gold-700">
                          Fixa
                        </span>
                      )}
                      <StatusBadge conta={conta} />
                    </div>
                    {conta.descricao && (
                      <p className="text-xs text-dark-400 mt-0.5 truncate">{conta.descricao}</p>
                    )}
                  </div>

                  {/* Vencimento + Valor */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-bold text-dark-800">{formatMoney(conta.valor)}</p>
                    <div className="mt-0.5 flex items-center justify-end gap-1">
                      <Clock size={11} className="text-dark-300" />
                      <VencimentoBadge conta={conta} />
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex-shrink-0">
                    {podePagar && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => setModalPagarConta(conta)}
                        >
                          Pagar
                        </Button>
                        {podeEditar && (
                          <ActionMenu
                            items={[
                              { label: 'Editar', onClick: () => setModalEditarConta(conta) },
                              { label: 'Cancelar conta', onClick: () => handleCancelar(conta), variant: 'danger' },
                              { label: 'Excluir', onClick: () => handleExcluir(conta), variant: 'danger' },
                            ]}
                          />
                        )}
                      </div>
                    )}
                    {(isPaga || isCancelada) && (
                      <ActionMenu
                        items={[
                          { label: 'Excluir', onClick: () => handleExcluir(conta), variant: 'danger' },
                        ]}
                      />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Modais */}
      <ModalContaPagar
        open={modalCriarOpen || !!modalEditarConta}
        onClose={() => { setModalCriarOpen(false); setModalEditarConta(null) }}
        onSuccess={load}
        conta={modalEditarConta}
      />

      <ModalPagarConta
        open={!!modalPagarConta}
        onClose={() => setModalPagarConta(null)}
        onSuccess={load}
        conta={modalPagarConta}
      />
    </div>
  )
}
