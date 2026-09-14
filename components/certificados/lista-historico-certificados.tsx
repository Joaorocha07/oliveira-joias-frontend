'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Eye, Pencil, Download, Trash2 } from 'lucide-react'
import { useAlert } from '@/hooks/use-alert'
import {
  Card, SearchInput, Spinner, EmptyState,
  ActionMenu, ConfirmDialog, PeriodFilter, Pagination, getPeriodRange,
} from '@/components/ui'
import type { PeriodPreset } from '@/components/ui'
import { usePagination } from '@/hooks/use-pagination'
import { formatMoney, formatDate } from '@/utils'
import { listarCertificados, excluirCertificado } from '@/services/certificados'
import { baixarCertificadoPdf } from '@/utils/certificado-pdf'
import type { Certificado, CertificadoConfiguracao } from '@/types'

interface Props {
  refreshKey: number
  configuracao: CertificadoConfiguracao
  onEditar: (cert: Certificado) => void
  onVisualizar: (cert: Certificado) => void
}

export function ListaHistoricoCertificados({ refreshKey, configuracao, onEditar, onVisualizar }: Props) {
  const alert = useAlert()
  const [certificados, setCertificados] = useState<Certificado[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const inicial = getPeriodRange('tudo')
  const [dataInicio, setDataInicio] = useState(inicial.inicio)
  const [dataFim, setDataFim] = useState(inicial.fim)
  const [activePreset, setActivePreset] = useState<PeriodPreset>('tudo')
  const [confirmDelete, setConfirmDelete] = useState<Certificado | null>(null)
  const [deletando, setDeletando] = useState(false)
  const [baixandoId, setBaixandoId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await listarCertificados(dataInicio, dataFim)
    if (error) alert.error('Erro', 'Erro ao carregar certificados.')
    else setCertificados(data)
    setLoading(false)
  }, [dataInicio, dataFim])

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(id)
  }, [load, refreshKey])

  const filtered = useMemo(() => {
    if (!search) return certificados
    const q = search.toLowerCase()
    return certificados.filter((c) =>
      c.numero.toLowerCase().includes(q) ||
      c.cliente_nome?.toLowerCase().includes(q) ||
      c.modelo?.toLowerCase().includes(q),
    )
  }, [certificados, search])

  const { paginated, page, setPage, totalPages, total, from, to } = usePagination(filtered)

  async function handleBaixar(cert: Certificado) {
    setBaixandoId(cert.id)
    try {
      await baixarCertificadoPdf(cert, configuracao)
    } catch {
      alert.error('Erro', 'Não foi possível gerar o PDF.')
    } finally {
      setBaixandoId(null)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setDeletando(true)
    const { error } = await excluirCertificado(confirmDelete.id)
    if (error) {
      alert.error('Erro', 'Erro ao excluir certificado.')
    } else {
      setCertificados((prev) => prev.filter((c) => c.id !== confirmDelete.id))
      alert.success('Certificado Excluído!', 'O certificado foi removido do histórico.')
    }
    setDeletando(false)
    setConfirmDelete(null)
  }

  return (
    <Card padding="none">
      <div className="flex flex-col gap-3 p-4 border-b border-gold-100">
        <PeriodFilter
          dataInicio={dataInicio}
          dataFim={dataFim}
          activePreset={activePreset}
          onChange={({ inicio, fim, preset }) => { setDataInicio(inicio); setDataFim(fim); setActivePreset(preset) }}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nº, cliente ou modelo..." />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={24} /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum certificado encontrado"
          description={search ? 'Tente ajustar a busca.' : 'Nenhum certificado emitido no período selecionado.'}
        />
      ) : (
        <>
          {/* Mobile */}
          <div className="sm:hidden divide-y divide-gold-50">
            {paginated.map((c) => (
              <div key={c.id} className="p-4 hover:bg-cream-50/30 transition-colors cursor-pointer" onClick={() => onVisualizar(c)}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-dark-400 bg-cream-100 border border-gold-100 px-1.5 py-0.5 rounded flex-shrink-0">
                        {c.numero}
                      </span>
                      <p className="font-medium text-dark-700 text-sm truncate">
                        {c.cliente_nome || <span className="text-dark-300 italic">Sem nome</span>}
                      </p>
                    </div>
                    <p className="text-xs text-dark-500 mt-0.5 truncate">{c.modelo || '—'} · {c.material || '—'}</p>
                    <p className="text-xs text-dark-300 mt-0.5">{formatDate(c.created_at)}</p>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <ActionMenu
                      items={[
                        { label: 'Visualizar', icon: <Eye size={14} />, onClick: () => onVisualizar(c) },
                        { label: 'Baixar PDF', icon: <Download size={14} />, onClick: () => handleBaixar(c) },
                        { label: 'Editar', icon: <Pencil size={14} />, onClick: () => onEditar(c) },
                        { label: 'Excluir', icon: <Trash2 size={14} />, onClick: () => setConfirmDelete(c), variant: 'danger' },
                      ]}
                    />
                  </div>
                </div>
                {c.valor != null && (
                  <div className="flex items-center justify-end mt-2.5 pt-2 border-t border-gold-50">
                    <span className="font-medium text-dark-700">{formatMoney(c.valor)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold-100 bg-cream-50/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Número</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Cliente</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Modelo</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Material</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Valor</th>
                  <th className="hidden md:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Data</th>
                  <th className="px-5 py-3 w-32" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gold-50">
                {paginated.map((c) => (
                  <tr key={c.id} className="hover:bg-cream-50/40 transition-colors cursor-pointer" onClick={() => onVisualizar(c)}>
                    <td className="px-5 py-3 text-dark-400 font-mono text-xs">{c.numero}</td>
                    <td className="px-5 py-3 font-medium text-dark-700 max-w-[160px]">
                      <span className="block truncate">
                        {c.cliente_nome || <span className="text-dark-300 italic font-normal">Sem nome</span>}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-dark-600 max-w-[140px]"><span className="block truncate">{c.modelo || '—'}</span></td>
                    <td className="px-5 py-3 text-dark-500">{c.material || '—'}</td>
                    <td className="px-5 py-3 text-right font-medium text-dark-700">{c.valor != null ? formatMoney(c.valor) : '—'}</td>
                    <td className="hidden md:table-cell px-5 py-3 text-dark-400">{formatDate(c.created_at)}</td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1 justify-end">
                        <button type="button" onClick={() => onVisualizar(c)} className="p-1.5 rounded-lg text-dark-300 hover:text-dark-600 hover:bg-cream-100 transition-colors" title="Visualizar">
                          <Eye size={14} />
                        </button>
                        <button type="button" onClick={() => handleBaixar(c)} disabled={baixandoId === c.id} className="p-1.5 rounded-lg text-dark-300 hover:text-gold-600 hover:bg-gold-50 transition-colors disabled:opacity-50" title="Baixar PDF">
                          <Download size={14} />
                        </button>
                        <button type="button" onClick={() => onEditar(c)} className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Editar">
                          <Pencil size={14} />
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(c)} className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Excluir">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} from={from} to={to} total={total} />
        </>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Excluir certificado"
        description={`Deseja excluir o certificado ${confirmDelete?.numero}? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deletando}
      />
    </Card>
  )
}
