'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Ticket, Ban, RotateCcw, CheckCircle2 } from 'lucide-react'
import { useAlert } from '@/hooks/use-alert'
import { useAuth } from '@/context/auth-context'
import { cn } from '@/lib/cn'
import {
  PageHeader, Card, Button, SearchInput, Spinner, EmptyState, Modal, Input, Select, Badge, Pagination, ActionMenu,
} from '@/components/ui'
import { SearchableSelect, type SelectOption } from '@/components/forms/searchable-select'
import { usePagination } from '@/hooks/use-pagination'
import { buscarClientes } from '@/services/busca'
import { ordenarPorRelevancia } from '@/utils/search'
import { formatDate } from '@/utils'
import {
  listarCupons, criarCupom, alterarStatusCupom, descricaoCupom, CUPOM_STATUS_LABEL,
  type Cupom, type CupomStatus, type CupomTipo,
} from '@/services/loja-site'

const FILTROS: { key: CupomStatus | 'todos'; label: string }[] = [
  { key: 'ativo', label: 'Ativos' },
  { key: 'usado', label: 'Usados' },
  { key: 'cancelado', label: 'Cancelados' },
  { key: 'todos', label: 'Todos' },
]

const STATUS_VARIANT: Record<CupomStatus, 'success' | 'gray' | 'danger'> = {
  ativo: 'success',
  usado: 'gray',
  cancelado: 'danger',
}

const EMPTY_FORM = { cliente_id: null as string | null, codigo: '', descricao: '', tipo: 'percentual' as CupomTipo, valor: '', validade: '' }

export default function CuponsPage() {
  const alert = useAlert()
  const { user } = useAuth()
  const [cupons, setCupons] = useState<Cupom[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<CupomStatus | 'todos'>('ativo')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [clienteLabel, setClienteLabel] = useState<string | undefined>()
  const [salvando, setSalvando] = useState(false)

  async function load() {
    const { data, error } = await listarCupons()
    if (error) alert.error('Erro', 'Erro ao carregar cupons. Verifique se a migração 014 foi aplicada.')
    else setCupons(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrados = useMemo(() => {
    const porStatus = filtro === 'todos' ? cupons : cupons.filter((c) => c.status === filtro)
    return ordenarPorRelevancia(porStatus, search, (c) => [c.codigo, c.cliente?.nome, c.cliente?.telefone, c.descricao])
  }, [cupons, filtro, search])

  const { paginated, page, setPage, totalPages, total, from, to } = usePagination(filtrados)

  const searchClientes = useCallback(async (q: string): Promise<SelectOption[]> => {
    const { data } = await buscarClientes(q, { limit: 20 })
    return (data ?? []).map((c: { id: string; nome: string; telefone: string | null }) => ({
      id: c.id, label: c.nome, sublabel: c.telefone ?? undefined,
    }))
  }, [])

  function abrirNovo() {
    setForm(EMPTY_FORM)
    setClienteLabel(undefined)
    setModalOpen(true)
  }

  async function salvar() {
    const valor = Number(form.valor.replace(',', '.'))
    if (!form.cliente_id) { alert.error('Atenção', 'Selecione o cliente.'); return }
    if (!form.codigo.trim()) { alert.error('Atenção', 'Informe o código do cupom.'); return }
    if (!valor || valor <= 0 || (form.tipo === 'percentual' && valor > 100)) {
      alert.error('Atenção', form.tipo === 'percentual' ? 'Informe um percentual entre 1 e 100.' : 'Informe um valor maior que zero.')
      return
    }
    if (!user) return
    setSalvando(true)
    const { error } = await criarCupom({
      cliente_id: form.cliente_id,
      codigo: form.codigo.trim().toUpperCase(),
      descricao: form.descricao.trim() || null,
      tipo: form.tipo,
      valor,
      validade: form.validade || null,
    }, user.id)
    setSalvando(false)
    if (error) { alert.error('Erro', error); return }
    alert.success('Cupom criado!', 'O cupom já aparece no perfil do cliente no site.', { onConfirm: () => setModalOpen(false) })
    void load()
  }

  async function mudarStatus(c: Cupom, status: CupomStatus) {
    const { error } = await alterarStatusCupom(c.id, status)
    if (error) { alert.error('Erro', error); return }
    setCupons((prev) => prev.map((x) => (x.id === c.id ? { ...x, status } : x)))
  }

  return (
    <div>
      <PageHeader
        title="Cupons"
        subtitle="Cupons por cliente — aparecem no perfil do site e são marcados como usados ao lançar a venda"
        actions={<Button variant="primary" leftIcon={<Plus size={14} />} onClick={abrirNovo}>Novo Cupom</Button>}
      />

      <Card padding="none">
        <div className="p-4 border-b border-gold-100 space-y-3">
          <div className="flex gap-2 overflow-x-auto">
            {FILTROS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFiltro(f.key)}
                className={cn(
                  'flex-shrink-0 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                  filtro === f.key ? 'border-gold-400 bg-gold-50 text-gold-600' : 'border-gold-100 text-dark-400 hover:border-gold-200',
                )}
              >
                {f.label}
                <span className="ml-1.5 text-[10px] tabular-nums opacity-70">
                  {f.key === 'todos' ? cupons.length : cupons.filter((c) => c.status === f.key).length}
                </span>
              </button>
            ))}
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar por código ou cliente..." className="w-full" />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={24} /></div>
        ) : filtrados.length === 0 ? (
          <EmptyState imageSrc="/images/Profile Interface-rafiki.svg" title="Nenhum cupom encontrado" description="Os cupons de boas-vindas são criados automaticamente quando alguém se cadastra no site." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold-100 bg-cream-50/50">
                    {['Código', 'Cliente', 'Desconto', 'Validade', 'Status', ''].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-50">
                  {paginated.map((c) => (
                    <tr key={c.id} className="hover:bg-cream-100 transition-colors">
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-2 font-mono font-semibold text-dark-700">
                          <Ticket size={13} className="text-gold-500" /> {c.codigo}
                        </span>
                        {c.origem === 'boas_vindas' && <span className="text-[10px] text-dark-300">Boas-vindas (site)</span>}
                      </td>
                      <td className="px-5 py-3 text-dark-600">{c.cliente?.nome ?? '—'}</td>
                      <td className="px-5 py-3 text-dark-500">{descricaoCupom(c)}</td>
                      <td className="px-5 py-3 text-dark-400 text-xs">{c.validade ? formatDate(c.validade) : 'Sem validade'}</td>
                      <td className="px-5 py-3">
                        <Badge variant={STATUS_VARIANT[c.status]} className="!px-2 !py-0.5 text-[10px]">{CUPOM_STATUS_LABEL[c.status]}</Badge>
                        {c.usado_em && <p className="text-[10px] text-dark-300 mt-0.5">{formatDate(c.usado_em.slice(0, 10))}</p>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <ActionMenu
                          items={c.status === 'ativo'
                            ? [
                                { label: 'Marcar como usado', icon: <CheckCircle2 size={14} />, onClick: () => void mudarStatus(c, 'usado') },
                                { label: 'Cancelar cupom', icon: <Ban size={14} />, onClick: () => void mudarStatus(c, 'cancelado'), variant: 'danger' },
                              ]
                            : [{ label: 'Reativar', icon: <RotateCcw size={14} />, onClick: () => void mudarStatus(c, 'ativo') }]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} from={from} to={to} total={total} />
          </>
        )}
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novo Cupom"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={salvando}>Cancelar</Button>
            <Button variant="primary" onClick={() => void salvar()} loading={salvando}>Criar cupom</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <SearchableSelect
              label="Cliente *"
              value={form.cliente_id}
              displayValue={clienteLabel}
              onChange={(id, option) => {
                setForm((f) => ({ ...f, cliente_id: id }))
                setClienteLabel(option?.label)
                return true
              }}
              onSearch={searchClientes}
              placeholder="Buscar cliente..."
            />
          </div>
          <Input
            label="Código *"
            placeholder="Ex: ANIVERSARIO15"
            value={form.codigo}
            onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value.toUpperCase().replace(/\s/g, '') }))}
            maxLength={40}
          />
          <Input
            label="Descrição"
            placeholder="Ex: Presente de aniversário"
            value={form.descricao}
            onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))}
          />
          <Select label="Tipo" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as CupomTipo }))}>
            <option value="percentual">Percentual (%)</option>
            <option value="valor">Valor fixo (R$)</option>
          </Select>
          <Input
            label={form.tipo === 'percentual' ? 'Desconto (%) *' : 'Desconto (R$) *'}
            inputMode="decimal"
            value={form.valor}
            onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value.replace(/[^\d.,]/g, '') }))}
          />
          <Input
            label="Validade"
            type="date"
            hint="Deixe vazio para não expirar"
            value={form.validade}
            onChange={(e) => setForm((f) => ({ ...f, validade: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  )
}
