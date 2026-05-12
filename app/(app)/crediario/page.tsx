'use client'

import { useState, useEffect, useMemo } from 'react'
import { CreditCard } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, Card, Badge, SearchInput, Select, Spinner, EmptyState,
} from '@/components/ui'
import {
  formatMoney, crediarioStatusVariant, CREDIARIO_STATUS_LABEL,
} from '@/utils'
import type { CrediarioComRelacoes, CrediarioStatus } from '@/types'

export default function CrediarioPage() {
  const [crediarios, setCrediarios] = useState<CrediarioComRelacoes[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<CrediarioStatus | ''>('')

  async function loadCrediarios() {
    const { data, error } = await supabase
      .from('crediario')
      .select('*, cliente:clientes(nome, telefone), parcelas:crediario_parcelas(*)')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Erro ao carregar crediários.')
    } else {
      setCrediarios((data as CrediarioComRelacoes[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadCrediarios(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [])

  const filtered = useMemo(() => {
    return crediarios.filter((c) => {
      const matchSearch = !search || c.cliente?.nome?.toLowerCase().includes(search.toLowerCase())
      const matchStatus = !filtroStatus || c.status === filtroStatus
      return matchSearch && matchStatus
    })
  }, [crediarios, search, filtroStatus])

  return (
    <div>
      <PageHeader
        title="Crediário"
        subtitle="Controle de parcelas e financiamento"
      />

      <Card padding="none">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gold-100">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por cliente..."
            className="flex-1"
          />
          <Select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as CrediarioStatus | '')}
            placeholder="Todos os status"
            className="w-full sm:w-44"
          >
            {(Object.keys(CREDIARIO_STATUS_LABEL) as CrediarioStatus[]).map((s) => (
              <option key={s} value={s}>{CREDIARIO_STATUS_LABEL[s]}</option>
            ))}
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<CreditCard size={24} />}
            title="Nenhum crediário encontrado"
            description={search || filtroStatus ? 'Tente ajustar os filtros.' : 'Nenhum crediário registrado.'}
          />
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden divide-y divide-gold-50">
              {filtered.map((c) => {
                const parcelasPendentes = c.parcelas?.filter((p) => p.status === 'pendente' || p.status === 'vencido').length ?? 0
                const parcelasVencidas = c.parcelas?.filter((p) => p.status === 'vencido').length ?? 0
                return (
                  <div key={c.id} className="p-4 hover:bg-cream-50/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-dark-700 text-sm truncate">
                        {c.cliente?.nome || <span className="text-dark-300 italic">Sem cliente</span>}
                      </p>
                      <Badge variant={crediarioStatusVariant(c.status)} className="flex-shrink-0">
                        {CREDIARIO_STATUS_LABEL[c.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mt-2 text-sm">
                      <span className="text-xs text-dark-400">Saldo</span>
                      <span className="font-medium text-dark-700">{formatMoney(c.saldo)}</span>
                    </div>
                    {parcelasPendentes > 0 && (
                      <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-gold-50">
                        <span className="text-xs text-dark-400">
                          {parcelasPendentes} parcela{parcelasPendentes !== 1 ? 's' : ''} pendente{parcelasPendentes !== 1 ? 's' : ''}
                        </span>
                        {parcelasVencidas > 0 && (
                          <Badge variant="danger">{parcelasVencidas} vencida{parcelasVencidas !== 1 ? 's' : ''}</Badge>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold-100 bg-cream-50/50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Cliente</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Total</th>
                    <th className="hidden md:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Entrada</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Saldo</th>
                    <th className="hidden lg:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Parcelas</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-50">
                  {filtered.map((c) => {
                    const parcelasPendentes = c.parcelas?.filter((p) => p.status === 'pendente' || p.status === 'vencido').length ?? 0
                    const parcelasVencidas = c.parcelas?.filter((p) => p.status === 'vencido').length ?? 0
                    return (
                      <tr key={c.id} className="hover:bg-cream-50/40 transition-colors">
                        <td className="px-5 py-3 font-medium text-dark-700 max-w-[180px]">
                          <span className="block truncate">
                            {c.cliente?.nome || <span className="text-dark-300 italic font-normal">Sem cliente</span>}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-dark-400">{formatMoney(c.total)}</td>
                        <td className="hidden md:table-cell px-5 py-3 text-dark-400">{formatMoney(c.entrada)}</td>
                        <td className="px-5 py-3 font-medium text-dark-700">{formatMoney(c.saldo)}</td>
                        <td className="hidden lg:table-cell px-5 py-3 text-dark-400">
                          <span>{parcelasPendentes} pendente{parcelasPendentes !== 1 ? 's' : ''}</span>
                          {parcelasVencidas > 0 && (
                            <Badge variant="danger" className="ml-2">{parcelasVencidas} vencida{parcelasVencidas !== 1 ? 's' : ''}</Badge>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={crediarioStatusVariant(c.status)}>
                            {CREDIARIO_STATUS_LABEL[c.status]}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
