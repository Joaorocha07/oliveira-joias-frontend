'use client'

import { Card, CardHeader, MetricCard } from '@/components/ui'

export type OrigemResumo = { nome: string; total: number }

interface LeadsDashboardProps {
  total: number
  leads: number
  compradores: number
  origens: OrigemResumo[]
}

const ORIGEM_CORES = ['#B8962E', '#5B8EB8', '#5B8C5B', '#C75B5B', '#8E6BB8', '#C9A84C', '#6B9C9C', '#9C8B72']

function pct(parte: number, total: number) {
  return total > 0 ? (parte / total) * 100 : 0
}

function formatPct(v: number) {
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

export function LeadsDashboard({ total, leads, compradores, origens }: LeadsDashboardProps) {
  const pctLeads = pct(leads, total)
  const pctCompradores = pct(compradores, total)

  return (
    <div className="space-y-4 mb-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total na base" value={total} accent />
        <MetricCard label="Leads (sem compra)" value={leads} change={`${formatPct(pctLeads)} da base`} />
        <MetricCard
          label="Clientes que compraram"
          value={compradores}
          change={`${formatPct(pctCompradores)} da base`}
          changeType={compradores > 0 ? 'up' : 'neutral'}
        />
        <MetricCard
          label="Taxa de conversão"
          value={formatPct(pctCompradores)}
          change="leads que viraram clientes"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Leads vs. Clientes" subtitle="Composição da base cadastrada" />
          {total === 0 ? (
            <p className="text-sm text-dark-300">Nenhum cadastro ainda.</p>
          ) : (
            <>
              <div
                className="flex h-4 w-full overflow-hidden rounded-full bg-dark-200/20"
                role="img"
                aria-label={`${leads} leads (${formatPct(pctLeads)}) e ${compradores} clientes (${formatPct(pctCompradores)})`}
              >
                <div className="h-full bg-gold-300" style={{ width: `${pctLeads}%` }} />
                <div className="h-full bg-[#5B8C5B]" style={{ width: `${pctCompradores}%` }} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-gold-300" />
                  <div>
                    <p className="text-xs text-dark-400">Leads (ainda não compraram)</p>
                    <p className="font-display text-xl font-semibold text-dark-600 tabular-nums">
                      {leads} <span className="text-sm font-normal text-dark-300">· {formatPct(pctLeads)}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#5B8C5B]" />
                  <div>
                    <p className="text-xs text-dark-400">Clientes (já compraram)</p>
                    <p className="font-display text-xl font-semibold text-dark-600 tabular-nums">
                      {compradores} <span className="text-sm font-normal text-dark-300">· {formatPct(pctCompradores)}</span>
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Origem dos Leads" subtitle="Porcentagem de cada origem na base" />
          {origens.length === 0 ? (
            <p className="text-sm text-dark-300">Nenhum cadastro ainda.</p>
          ) : (
            <ul className="space-y-2.5">
              {origens.map((o, i) => {
                const p = pct(o.total, total)
                return (
                  <li key={o.nome}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 text-dark-600 truncate">
                        <span
                          className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: ORIGEM_CORES[i % ORIGEM_CORES.length] }}
                        />
                        <span className="truncate">{o.nome}</span>
                      </span>
                      <span className="flex-shrink-0 tabular-nums text-dark-500">
                        <strong className="font-semibold">{formatPct(p)}</strong>
                        <span className="text-xs text-dark-300"> · {o.total}</span>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-dark-200/20">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${p}%`, backgroundColor: ORIGEM_CORES[i % ORIGEM_CORES.length] }}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  )
}
