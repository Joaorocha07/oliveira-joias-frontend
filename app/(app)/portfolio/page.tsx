'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, ImageOff, Star, Pencil, Trash2, X } from 'lucide-react'
import { useAlert } from '@/hooks/use-alert'
import { cn } from '@/lib/cn'
import {
  PageHeader, Card, Button, Spinner, EmptyState, Modal, Input, Select, Textarea,
  SearchInput, Pagination, ActionMenu, ConfirmDialog,
} from '@/components/ui'
import { usePagination } from '@/hooks/use-pagination'
import { formatMoney, formatDate } from '@/utils'
import {
  listarProdutosCatalogo, criarProdutoCatalogo, atualizarProdutoCatalogo,
  excluirProdutoCatalogo, type ProdutoCatalogo,
} from '@/services/catalogo'

const CATEGORIAS = ['alianças', 'anéis', 'correntes', 'serviços'] as const

const EMPTY_FORM = {
  nome: '',
  categoria: '' as (typeof CATEGORIAS)[number] | '',
  linha: '',
  material: '',
  largura: '',
  descricao: '',
  valor: '',
  parcelas: '',
  destaque: false,
}

export default function PortfolioPage() {
  const alert = useAlert()
  const [produtos, setProdutos] = useState<ProdutoCatalogo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState<(typeof CATEGORIAS)[number] | ''>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<ProdutoCatalogo | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [modoParcela, setModoParcela] = useState<'quantidade' | 'valor' | 'manual'>('quantidade')
  const [valorParcela, setValorParcela] = useState('')
  const [imagensExistentes, setImagensExistentes] = useState<string[]>([])
  const [imagens, setImagens] = useState<File[]>([])
  const [salvando, setSalvando] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<ProdutoCatalogo | null>(null)
  const [deletando, setDeletando] = useState(false)

  async function loadProdutos() {
    setLoading(true)
    const { data, error } = await listarProdutosCatalogo()
    if (error) alert.error('Erro', error)
    else setProdutos(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadProdutos(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [])

  const filtered = useMemo(() => {
    return produtos.filter((p) => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        p.nome.toLowerCase().includes(q) ||
        (p.linha ?? '').toLowerCase().includes(q) ||
        p.material.toLowerCase().includes(q)
      const matchCategoria = !filtroCategoria || p.categoria === filtroCategoria
      return matchSearch && matchCategoria
    })
  }, [produtos, search, filtroCategoria])

  const { paginated, page, setPage, totalPages, total, from, to } = usePagination(filtered)

  const qtdCalculada = modoParcela === 'valor' && form.valor && valorParcela && Number(valorParcela) > 0
    ? Math.max(1, Math.round(Number(form.valor) / Number(valorParcela)))
    : null

  function toggleModoParcela(modo: 'quantidade' | 'valor' | 'manual') {
    if (modo === modoParcela) return
    if (modo === 'valor' && form.valor && form.parcelas && Number(form.parcelas) > 0) {
      setValorParcela((Number(form.valor) / Number(form.parcelas)).toFixed(2))
    }
    if (modo === 'manual') {
      if (modoParcela === 'quantidade' && form.valor && form.parcelas && Number(form.parcelas) > 0) {
        setValorParcela((Number(form.valor) / Number(form.parcelas)).toFixed(2))
      } else if (modoParcela === 'valor' && qtdCalculada) {
        setField('parcelas', String(qtdCalculada))
      }
    }
    setModoParcela(modo)
  }

  function openCreate() {
    setEditando(null)
    setForm(EMPTY_FORM)
    setImagensExistentes([])
    setImagens([])
    setModoParcela('quantidade')
    setValorParcela('')
    setModalOpen(true)
  }

  function openEdit(p: ProdutoCatalogo) {
    setEditando(p)
    setForm({
      nome: p.nome,
      categoria: p.categoria as (typeof CATEGORIAS)[number],
      linha: p.linha ?? '',
      material: p.material,
      largura: p.largura ?? '',
      descricao: p.descricao,
      valor: String(p.valor),
      parcelas: p.parcelas ? String(p.parcelas) : '',
      destaque: p.destaque,
    })
    setImagensExistentes(p.imagens)
    setImagens([])
    if (p.valor_parcela != null) {
      setModoParcela('manual')
      setValorParcela(String(p.valor_parcela))
    } else {
      setModoParcela('quantidade')
      setValorParcela('')
    }
    setModalOpen(true)
  }

  function removerImagemExistente(url: string) {
    setImagensExistentes((prev) => prev.filter((u) => u !== url))
  }

  function setField<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!form.nome.trim()) { alert.error('Atenção', 'Nome é obrigatório.'); return }
    if (!form.categoria) { alert.error('Atenção', 'Categoria é obrigatória.'); return }
    if (!form.material.trim()) { alert.error('Atenção', 'Material é obrigatório.'); return }
    if (!form.descricao.trim()) { alert.error('Atenção', 'Descrição é obrigatória.'); return }
    if (!form.valor || Number(form.valor) < 0) { alert.error('Atenção', 'Valor é obrigatório.'); return }

    setSalvando(true)

    const data = new FormData()
    data.append('nome', form.nome.trim())
    data.append('categoria', form.categoria)
    data.append('material', form.material.trim())
    data.append('descricao', form.descricao.trim())
    data.append('valor', form.valor)
    data.append('destaque', String(form.destaque))
    if (form.linha.trim()) data.append('linha', form.linha.trim())
    if (form.largura.trim()) data.append('largura', form.largura.trim())
    const parcelasFinal = modoParcela === 'valor' ? (qtdCalculada ? String(qtdCalculada) : '') : form.parcelas.trim()
    if (parcelasFinal) data.append('parcelas', parcelasFinal)
    if (modoParcela === 'manual' && valorParcela && Number(valorParcela) > 0) {
      data.append('valor_parcela', valorParcela)
    } else if (editando) {
      data.append('valor_parcela', '')
    }
    imagens.forEach((file) => data.append('imagens', file))

    let error: string | null
    if (editando) {
      data.append('imagens_manter', JSON.stringify(imagensExistentes))
      error = (await atualizarProdutoCatalogo(editando.id, data)).error
    } else {
      error = (await criarProdutoCatalogo(data)).error
    }

    if (error) {
      alert.error('Erro', error)
    } else {
      alert.success(
        editando ? 'Produto Atualizado!' : 'Produto Cadastrado!',
        editando ? 'As alterações foram salvas.' : 'O produto foi adicionado ao portfólio.',
        { onConfirm: () => setModalOpen(false) },
      )
      void loadProdutos()
    }
    setSalvando(false)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setDeletando(true)
    const { error } = await excluirProdutoCatalogo(confirmDelete.id)
    if (error) {
      alert.error('Erro', error)
    } else {
      setProdutos((prev) => prev.filter((p) => p.id !== confirmDelete.id))
      alert.success('Produto Excluído!', 'O produto foi removido do portfólio.')
    }
    setDeletando(false)
    setConfirmDelete(null)
  }

  return (
    <div>
      <PageHeader
        title="Produtos do Portfólio"
        subtitle="Catálogo público exibido no site oliveira-joias-portfolio"
        actions={
          <Button variant="primary" leftIcon={<Plus size={14} />} onClick={openCreate}>
            Novo Produto
          </Button>
        }
      />

      <Card padding="none">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-gold-100">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nome, linha ou material..."
            className="flex-1"
          />
          <Select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value as (typeof CATEGORIAS)[number] | '')}
            placeholder="Todas as categorias"
            className="w-full sm:w-48"
          >
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            imageSrc="/images/Profile Interface-rafiki.svg"
            title={search || filtroCategoria ? 'Nenhum produto encontrado' : 'Nenhum produto cadastrado'}
            description={search || filtroCategoria ? 'Ajuste a busca ou o filtro.' : 'Cadastre o primeiro produto do portfólio.'}
            action={!search && !filtroCategoria && (
              <Button variant="primary" size="sm" leftIcon={<Plus size={12} />} onClick={openCreate}>Novo</Button>
            )}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold-100 bg-cream-50/50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Produto</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Categoria</th>
                    <th className="hidden md:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Material</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Valor</th>
                    <th className="hidden sm:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Cadastrado em</th>
                    <th className="px-5 py-3 w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-50">
                  {paginated.map((p) => (
                    <tr key={p.id} className="hover:bg-cream-50/40 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-cream-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                            {p.imagens[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.imagens[0]} alt={p.nome} className="w-full h-full object-cover" />
                            ) : (
                              <ImageOff size={16} className="text-dark-300" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-dark-700 truncate max-w-[220px]">{p.nome}</p>
                            {p.linha && <p className="text-xs text-dark-300 truncate">{p.linha}</p>}
                          </div>
                          {p.destaque && <Star size={13} className="text-gold-500 flex-shrink-0" fill="currentColor" />}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-dark-400 capitalize">{p.categoria}</td>
                      <td className="hidden md:table-cell px-5 py-3 text-dark-400">{p.material}</td>
                      <td className="px-5 py-3 text-dark-700 font-medium">{formatMoney(p.valor)}</td>
                      <td className="hidden sm:table-cell px-5 py-3 text-dark-400">{formatDate(p.created_at)}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end">
                          <ActionMenu
                            items={[
                              { label: 'Editar', icon: <Pencil size={14} />, onClick: () => openEdit(p) },
                              { label: 'Excluir', icon: <Trash2 size={14} />, onClick: () => setConfirmDelete(p), variant: 'danger' },
                            ]}
                          />
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
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? 'Editar Produto do Portfólio' : 'Novo Produto do Portfólio'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={salvando}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave} loading={salvando}>{editando ? 'Salvar' : 'Cadastrar'}</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nome *" value={form.nome} onChange={(e) => setField('nome', e.target.value)} wrapperClassName="sm:col-span-2" />

          <Select label="Categoria *" value={form.categoria} onChange={(e) => setField('categoria', e.target.value as typeof form.categoria)} placeholder="Selecione">
            {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Input label="Linha" hint='ex: "Aurora"' value={form.linha} onChange={(e) => setField('linha', e.target.value)} />

          <Input label="Material *" hint='ex: "Prata"' value={form.material} onChange={(e) => setField('material', e.target.value)} />
          <Input label="Largura" hint='ex: "3mm"' value={form.largura} onChange={(e) => setField('largura', e.target.value)} />

          <Input label="Valor (à vista) *" type="number" min={0} step="0.01" leftAddon="R$" value={form.valor} onChange={(e) => setField('valor', e.target.value)} wrapperClassName="sm:col-span-2" />

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <div className="flex items-center justify-between">
              <label className="label-base">Parcelamento</label>
              <div className="flex gap-1 rounded-lg bg-gold-50 p-0.5">
                <button
                  type="button"
                  onClick={() => toggleModoParcela('quantidade')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    modoParcela === 'quantidade' ? 'bg-white text-gold-700 shadow-sm' : 'text-dark-300 hover:text-dark-500'
                  )}
                >
                  Por quantidade
                </button>
                <button
                  type="button"
                  onClick={() => toggleModoParcela('valor')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    modoParcela === 'valor' ? 'bg-white text-gold-700 shadow-sm' : 'text-dark-300 hover:text-dark-500'
                  )}
                >
                  Por valor da parcela
                </button>
                <button
                  type="button"
                  onClick={() => toggleModoParcela('manual')}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                    modoParcela === 'manual' ? 'bg-white text-gold-700 shadow-sm' : 'text-dark-300 hover:text-dark-500'
                  )}
                >
                  Manual
                </button>
              </div>
            </div>

            {modoParcela === 'quantidade' ? (
              <Input
                type="number"
                min={1}
                step={1}
                value={form.parcelas}
                onChange={(e) => setField('parcelas', e.target.value)}
                hint={
                  form.valor && form.parcelas && Number(form.parcelas) > 0
                    ? `${form.parcelas}x de ${formatMoney(Number(form.valor) / Number(form.parcelas))}`
                    : undefined
                }
              />
            ) : modoParcela === 'valor' ? (
              <Input
                type="number"
                min={0}
                step="0.01"
                leftAddon="R$"
                value={valorParcela}
                onChange={(e) => setValorParcela(e.target.value)}
                hint={
                  qtdCalculada
                    ? `≈ ${qtdCalculada}x de ${formatMoney(Number(form.valor) / qtdCalculada)}`
                    : 'Informe o valor de cada parcela — a quantidade é calculada automaticamente'
                }
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Quantidade"
                  type="number"
                  min={1}
                  step={1}
                  value={form.parcelas}
                  onChange={(e) => setField('parcelas', e.target.value)}
                />
                <Input
                  label="Valor da parcela"
                  type="number"
                  min={0}
                  step="0.01"
                  leftAddon="R$"
                  value={valorParcela}
                  onChange={(e) => setValorParcela(e.target.value)}
                />
                <p className="col-span-2 text-xs text-dark-300">
                  {form.parcelas && valorParcela && Number(form.parcelas) > 0 && Number(valorParcela) > 0 ? (
                    <>
                      Total parcelado: {formatMoney(Number(form.parcelas) * Number(valorParcela))}
                      {form.valor && Number(form.valor) > 0 &&
                        Math.abs(Number(form.parcelas) * Number(valorParcela) - Number(form.valor)) > 0.01 && (
                          <> — difere do valor à vista ({formatMoney(Number(form.valor))})</>
                        )}
                    </>
                  ) : (
                    'Quantidade e valor da parcela definidos livremente, sem cálculo automático entre si.'
                  )}
                </p>
              </div>
            )}
          </div>

          <Textarea label="Descrição *" value={form.descricao} onChange={(e) => setField('descricao', e.target.value)} wrapperClassName="sm:col-span-2" rows={3} />

          {editando && imagensExistentes.length > 0 && (
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className="label-base">Imagens atuais</label>
              <div className="flex flex-wrap gap-2">
                {imagensExistentes.map((url) => (
                  <div key={url} className="relative w-16 h-16 rounded-lg overflow-hidden border border-gold-100 flex-shrink-0 group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removerImagemExistente(url)}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      title="Remover imagem"
                    >
                      <X size={18} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="sm:col-span-2 flex flex-col gap-1.5">
            <label className="label-base">{editando ? 'Adicionar imagens' : 'Imagens'}</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setImagens(Array.from(e.target.files ?? []))}
              className="input-base cursor-pointer file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gold-100 file:text-gold-700 file:text-xs file:font-medium"
            />
            {imagens.length > 0 && (
              <p className="text-xs text-dark-300">{imagens.length} imagem(ns) selecionada(s)</p>
            )}
          </div>

          <label className="sm:col-span-2 flex items-center gap-2 text-sm text-dark-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.destaque}
              onChange={(e) => setField('destaque', e.target.checked)}
              className="w-4 h-4 rounded border-gold-300 text-gold-600 focus:ring-gold-500"
            />
            Exibir em &quot;Produtos em Destaque&quot; na home do site
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Excluir produto"
        description={`Deseja excluir "${confirmDelete?.nome}" do portfólio? Esta ação é irreversível.`}
        confirmLabel="Excluir"
        loading={deletando}
      />
    </div>
  )
}
