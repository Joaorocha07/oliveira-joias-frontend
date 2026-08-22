'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, ImageOff, Star, Pencil, Trash2, X, ArrowUp, ArrowDown, Tag, AlertTriangle, FileText } from 'lucide-react'
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
  excluirProdutoCatalogo, reordenarProdutosCatalogo,
  listarCategoriasCatalogo, criarCategoriaCatalogo, excluirCategoriaCatalogo,
  buscarConfigCatalogo, atualizarConfigCatalogo,
  type ProdutoCatalogo, type CategoriaCatalogo, type ConfigCatalogo, type FaqItem,
} from '@/services/catalogo'

const EMPTY_FORM = {
  nome: '',
  categoria: '',
  linha: '',
  material: '',
  largura: '',
  descricao: '',
  valor: '',
  parcelas: '',
  destaque: false,
}

type Aba = 'produtos' | 'categorias' | 'descricao'

export default function PortfolioPage() {
  const alert = useAlert()
  const [aba, setAba] = useState<Aba>('produtos')

  // --- Produtos ---
  const [produtos, setProdutos] = useState<ProdutoCatalogo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
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
  const [modoOrdenar, setModoOrdenar] = useState(false)
  const [ordemLocal, setOrdemLocal] = useState<ProdutoCatalogo[]>([])
  const [salvandoOrdem, setSalvandoOrdem] = useState(false)

  // --- Categorias ---
  const [categorias, setCategorias] = useState<CategoriaCatalogo[]>([])
  const [loadingCats, setLoadingCats] = useState(false)
  const [novaCategoria, setNovaCategoria] = useState('')
  const [salvandoCategoria, setSalvandoCategoria] = useState(false)
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<CategoriaCatalogo | null>(null)
  const [deletandoCategoria, setDeletandoCategoria] = useState(false)

  // --- Descrição Geral ---
  const [config, setConfig] = useState<ConfigCatalogo>({ info_produto: '', voce_sabia: '', faq: [] })
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [salvandoConfig, setSalvandoConfig] = useState(false)

  // --- Aviso de categoria não vinculada ---
  const [avisoCategoriaModal, setAvisoCategoriaModal] = useState<{
    tipo: 'sem_cadastro' | 'sem_vinculo'
    pendente: ProdutoCatalogo | null
  } | null>(null)

  async function loadProdutos() {
    setLoading(true)
    const { data, error } = await listarProdutosCatalogo()
    if (error) alert.error('Erro', error)
    else setProdutos(data ?? [])
    setLoading(false)
  }

  async function loadCategorias() {
    setLoadingCats(true)
    const { data, error } = await listarCategoriasCatalogo()
    if (error) alert.error('Erro', error)
    else setCategorias(data ?? [])
    setLoadingCats(false)
  }

  async function loadConfig() {
    setLoadingConfig(true)
    const { data, error } = await buscarConfigCatalogo()
    if (error) alert.error('Erro', error)
    else if (data) setConfig(data)
    setLoadingConfig(false)
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadProdutos()
      void loadCategorias()
      void loadConfig()
    }, 0)
    return () => window.clearTimeout(id)
  }, [])

  const nomesCategoriasSet = useMemo(
    () => new Set(categorias.map((c) => c.nome)),
    [categorias],
  )

  const filtered = useMemo(() => {
    return produtos.filter((p) => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        p.nome.toLowerCase().includes(q) ||
        (p.linha ?? '').toLowerCase().includes(q) ||
        p.material.toLowerCase().includes(q)
      let matchCategoria = true
      if (filtroCategoria === '__sem_categoria__') {
        matchCategoria = !nomesCategoriasSet.has(p.categoria)
      } else if (filtroCategoria) {
        matchCategoria = p.categoria === filtroCategoria
      }
      return matchSearch && matchCategoria
    })
  }, [produtos, search, filtroCategoria, nomesCategoriasSet])

  const { paginated, page, setPage, totalPages, total, from, to } = usePagination(filtered)

  const qtdCalculada = modoParcela === 'valor' && form.valor && valorParcela && Number(valorParcela) > 0
    ? Math.max(1, Math.round(Number(form.valor) / Number(valorParcela)))
    : null

  // --- Ordenação ---
  function entrarModoOrdenar() {
    setOrdemLocal([...produtos])
    setModoOrdenar(true)
  }

  function sairModoOrdenar() {
    setModoOrdenar(false)
    setOrdemLocal([])
  }

  function moverProduto(index: number, direcao: 'up' | 'down') {
    const novaLista = [...ordemLocal]
    const alvo = direcao === 'up' ? index - 1 : index + 1
    if (alvo < 0 || alvo >= novaLista.length) return
    ;[novaLista[index], novaLista[alvo]] = [novaLista[alvo], novaLista[index]]
    setOrdemLocal(novaLista)
  }

  async function salvarOrdem() {
    setSalvandoOrdem(true)
    const itens = ordemLocal.map((p, i) => ({ id: p.id, ordem: i + 1 }))
    const { error } = await reordenarProdutosCatalogo(itens)
    if (error) {
      alert.error('Erro', error)
    } else {
      alert.success('Ordem salva!', 'A ordem de exibição foi atualizada no portfólio.')
      setProdutos(ordemLocal)
      setModoOrdenar(false)
      setOrdemLocal([])
    }
    setSalvandoOrdem(false)
  }

  // --- Form helpers ---
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
    if (categorias.length === 0) {
      setAvisoCategoriaModal({ tipo: 'sem_cadastro', pendente: null })
      return
    }
    setEditando(null)
    setForm(EMPTY_FORM)
    setImagensExistentes([])
    setImagens([])
    setModoParcela('quantidade')
    setValorParcela('')
    setModalOpen(true)
  }

  function openEdit(p: ProdutoCatalogo) {
    if (categorias.length === 0) {
      setAvisoCategoriaModal({ tipo: 'sem_cadastro', pendente: p })
      return
    }
    const categoriaVinculada = nomesCategoriasSet.has(p.categoria)
    if (!categoriaVinculada) {
      setAvisoCategoriaModal({ tipo: 'sem_vinculo', pendente: p })
      return
    }
    _abrirModalEdicao(p)
  }

  function _abrirModalEdicao(p: ProdutoCatalogo) {
    setEditando(p)
    setForm({
      nome: p.nome,
      categoria: p.categoria,
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

  function irParaCategorias(pendente?: ProdutoCatalogo | null) {
    setAvisoCategoriaModal(null)
    setAba('categorias')
    if (pendente) {
      // Guarda o produto para tentar abrir depois que categorias forem carregadas
      // O usuário vai cadastrar a categoria e clicar em editar novamente
    }
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

  // --- Categorias handlers ---
  async function handleCriarCategoria() {
    if (!novaCategoria.trim()) { alert.error('Atenção', 'Nome da categoria é obrigatório.'); return }
    setSalvandoCategoria(true)
    const { error } = await criarCategoriaCatalogo(novaCategoria.trim())
    if (error) {
      alert.error('Erro', error)
    } else {
      setNovaCategoria('')
      void loadCategorias()
    }
    setSalvandoCategoria(false)
  }

  async function handleDeleteCategoria() {
    if (!confirmDeleteCat) return
    setDeletandoCategoria(true)
    const { error } = await excluirCategoriaCatalogo(confirmDeleteCat.id)
    if (error) {
      alert.error('Erro', error)
    } else {
      setCategorias((prev) => prev.filter((c) => c.id !== confirmDeleteCat.id))
    }
    setDeletandoCategoria(false)
    setConfirmDeleteCat(null)
  }

  // --- Config handlers ---
  function addFaqItem() {
    setConfig((prev) => ({ ...prev, faq: [...prev.faq, { pergunta: '', resposta: '' }] }))
  }

  function updateFaqItem(index: number, field: keyof FaqItem, value: string) {
    setConfig((prev) => {
      const faq = prev.faq.map((item, i) => (i === index ? { ...item, [field]: value } : item))
      return { ...prev, faq }
    })
  }

  function removeFaqItem(index: number) {
    setConfig((prev) => ({ ...prev, faq: prev.faq.filter((_, i) => i !== index) }))
  }

  async function handleSaveConfig() {
    setSalvandoConfig(true)
    const { error } = await atualizarConfigCatalogo(config)
    if (error) alert.error('Erro', error)
    else alert.success('Salvo!', 'A descrição geral foi atualizada.')
    setSalvandoConfig(false)
  }

  return (
    <div>
      <PageHeader
        title="Produtos do Portfólio"
        subtitle="Catálogo público exibido no site oliveira-joias-portfolio"
        actions={
          <div className="flex items-center gap-2">
            {aba === 'produtos' && !modoOrdenar && (
              <>
                <Button variant="secondary" leftIcon={<ArrowUp size={14} />} onClick={entrarModoOrdenar}>
                  Ordenar
                </Button>
                <Button variant="primary" leftIcon={<Plus size={14} />} onClick={openCreate}>
                  Novo Produto
                </Button>
              </>
            )}
            {aba === 'produtos' && modoOrdenar && (
              <>
                <Button variant="secondary" onClick={sairModoOrdenar} disabled={salvandoOrdem}>Cancelar</Button>
                <Button variant="primary" onClick={salvarOrdem} loading={salvandoOrdem}>Salvar Ordem</Button>
              </>
            )}
            {aba === 'descricao' && (
              <Button variant="primary" onClick={handleSaveConfig} loading={salvandoConfig}>
                Salvar Descrição
              </Button>
            )}
          </div>
        }
      />

      {/* Abas */}
      <div className="flex gap-1 mb-4 border-b border-gold-100">
        <button
          onClick={() => { setModoOrdenar(false); setAba('produtos') }}
          className={cn(
            'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            aba === 'produtos'
              ? 'border-gold-500 text-gold-700'
              : 'border-transparent text-dark-400 hover:text-dark-600',
          )}
        >
          Produtos
        </button>
        <button
          onClick={() => { setModoOrdenar(false); setAba('categorias') }}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            aba === 'categorias'
              ? 'border-gold-500 text-gold-700'
              : 'border-transparent text-dark-400 hover:text-dark-600',
          )}
        >
          <Tag size={13} />
          Categorias
        </button>
        <button
          onClick={() => { setModoOrdenar(false); setAba('descricao') }}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
            aba === 'descricao'
              ? 'border-gold-500 text-gold-700'
              : 'border-transparent text-dark-400 hover:text-dark-600',
          )}
        >
          <FileText size={13} />
          Descrição Geral
        </button>
      </div>

      {/* --- ABA: PRODUTOS --- */}
      {aba === 'produtos' && (
        <>
          {modoOrdenar ? (
            <Card padding="none">
              <div className="px-5 py-3 border-b border-gold-100 bg-gold-50/30">
                <p className="text-sm text-dark-500">
                  Use as setas para definir a ordem de exibição no portfólio. Clique em <strong>Salvar Ordem</strong> para aplicar.
                </p>
              </div>
              <div className="divide-y divide-gold-50">
                {ordemLocal.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                    <span className="text-xs text-dark-300 w-6 text-center font-medium">{i + 1}</span>
                    <div className="w-9 h-9 rounded-lg bg-cream-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {p.imagens[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.imagens[0]} alt={p.nome} className="w-full h-full object-cover" />
                      ) : (
                        <ImageOff size={14} className="text-dark-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-dark-700 text-sm truncate">{p.nome}</p>
                      <p className="text-xs text-dark-300 capitalize">{p.categoria}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moverProduto(i, 'up')}
                        disabled={i === 0}
                        className="p-1.5 rounded-lg text-dark-400 hover:text-dark-700 hover:bg-gold-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ArrowUp size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => moverProduto(i, 'down')}
                        disabled={i === ordemLocal.length - 1}
                        className="p-1.5 rounded-lg text-dark-400 hover:text-dark-700 hover:bg-gold-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ArrowDown size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
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
                  onChange={(e) => setFiltroCategoria(e.target.value)}
                  placeholder="Todas as categorias"
                  className="w-full sm:w-52"
                >
                  {categorias.map((c) => (
                    <option key={c.id} value={c.nome}>{c.nome}</option>
                  ))}
                  <option value="__sem_categoria__">— Sem categoria —</option>
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
          )}
        </>
      )}

      {/* --- ABA: CATEGORIAS --- */}
      {aba === 'categorias' && (
        <Card padding="none">
          <div className="p-4 border-b border-gold-100">
            <p className="text-sm text-dark-500 mb-4">
              Categorias disponíveis ao cadastrar produtos. Serão exibidas como opções no formulário de novo produto.
            </p>
            <div className="flex gap-2">
              <Input
                value={novaCategoria}
                onChange={(e) => setNovaCategoria(e.target.value)}
                placeholder="Nome da nova categoria..."
                onKeyDown={(e) => { if (e.key === 'Enter') void handleCriarCategoria() }}
                className="flex-1"
              />
              <Button
                variant="primary"
                leftIcon={<Plus size={14} />}
                onClick={handleCriarCategoria}
                loading={salvandoCategoria}
              >
                Adicionar
              </Button>
            </div>
          </div>

          {loadingCats ? (
            <div className="flex justify-center py-12"><Spinner size={24} /></div>
          ) : categorias.length === 0 ? (
            <div className="py-12 text-center text-dark-300 text-sm">
              Nenhuma categoria cadastrada.
            </div>
          ) : (
            <ul className="divide-y divide-gold-50">
              {categorias.map((cat) => (
                <li key={cat.id} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm text-dark-700 capitalize">{cat.nome}</span>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteCat(cat)}
                    className="p-1.5 rounded-lg text-dark-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Excluir categoria"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* --- ABA: DESCRIÇÃO GERAL --- */}
      {aba === 'descricao' && (
        loadingConfig ? (
          <div className="flex justify-center py-16"><Spinner size={24} /></div>
        ) : (
          <div className="space-y-6">
            <Card>
              <p className="text-sm text-dark-500 mb-5">
                Este conteúdo aparece na página de cada produto do portfólio, abaixo das especificações.
                Edite e clique em <strong>Salvar Descrição</strong> para aplicar a todos os produtos.
              </p>

              <div className="space-y-5">
                <div>
                  <label className="label-base mb-1.5 block">Seção &quot;Produto&quot;</label>
                  <p className="text-xs text-dark-300 mb-2">Informações de prazo, composição do pedido e itens inclusos. Use linha em branco para separar parágrafos.</p>
                  <Textarea
                    value={config.info_produto}
                    onChange={(e) => setConfig((prev) => ({ ...prev, info_produto: e.target.value }))}
                    rows={5}
                  />
                </div>

                <div>
                  <label className="label-base mb-1.5 block">Seção &quot;Você sabia?&quot;</label>
                  <p className="text-xs text-dark-300 mb-2">Destaque sobre personalização e diferencial. Use linha em branco para separar parágrafos.</p>
                  <Textarea
                    value={config.voce_sabia}
                    onChange={(e) => setConfig((prev) => ({ ...prev, voce_sabia: e.target.value }))}
                    rows={4}
                  />
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-dark-700">Perguntas Frequentes (FAQ)</h3>
                  <p className="text-xs text-dark-300 mt-0.5">Perguntas exibidas na página de cada produto.</p>
                </div>
                <Button variant="secondary" size="sm" leftIcon={<Plus size={13} />} onClick={addFaqItem}>
                  Adicionar
                </Button>
              </div>

              {config.faq.length === 0 ? (
                <p className="text-sm text-dark-300 text-center py-6">Nenhuma pergunta cadastrada.</p>
              ) : (
                <div className="space-y-4">
                  {config.faq.map((item, i) => (
                    <div key={i} className="border border-gold-100 rounded-xl p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-medium text-gold-600 mt-0.5">Pergunta {i + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeFaqItem(i)}
                          className="p-1 rounded-lg text-dark-300 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                          title="Remover pergunta"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <Input
                        placeholder="Pergunta..."
                        value={item.pergunta}
                        onChange={(e) => updateFaqItem(i, 'pergunta', e.target.value)}
                      />
                      <Textarea
                        placeholder="Resposta... (use linha em branco para separar parágrafos)"
                        value={item.resposta}
                        onChange={(e) => updateFaqItem(i, 'resposta', e.target.value)}
                        rows={4}
                      />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )
      )}

      {/* Modal de aviso — categoria não vinculada ou sem categorias */}
      <Modal
        open={!!avisoCategoriaModal}
        onClose={() => setAvisoCategoriaModal(null)}
        title={
          avisoCategoriaModal?.tipo === 'sem_cadastro'
            ? 'Nenhuma categoria cadastrada'
            : 'Produto sem categoria vinculada'
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAvisoCategoriaModal(null)}>Cancelar</Button>
            <Button
              variant="primary"
              leftIcon={<Tag size={14} />}
              onClick={() => irParaCategorias(avisoCategoriaModal?.pendente)}
            >
              Ir para Categorias
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
            <AlertTriangle size={24} className="text-amber-500" />
          </div>
          {avisoCategoriaModal?.tipo === 'sem_cadastro' ? (
            <p className="text-sm text-dark-500 leading-relaxed">
              Para cadastrar ou editar um produto é necessário ter ao menos uma categoria registrada.
              <br /><br />
              Acesse a aba <strong>Categorias</strong> e adicione uma antes de continuar.
            </p>
          ) : (
            <p className="text-sm text-dark-500 leading-relaxed">
              O produto <strong>{avisoCategoriaModal?.pendente?.nome}</strong> está com a categoria{' '}
              <strong>&quot;{avisoCategoriaModal?.pendente?.categoria}&quot;</strong> que não existe nas categorias cadastradas.
              <br /><br />
              Acesse a aba <strong>Categorias</strong>, cadastre essa categoria e tente editar novamente.
            </p>
          )}
        </div>
      </Modal>

      {/* Modal de produto */}
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

          <Select
            label="Categoria *"
            value={form.categoria}
            onChange={(e) => setField('categoria', e.target.value)}
            placeholder="Selecione"
          >
            {categorias.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
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

      <ConfirmDialog
        open={!!confirmDeleteCat}
        onClose={() => setConfirmDeleteCat(null)}
        onConfirm={handleDeleteCategoria}
        title="Excluir categoria"
        description={`Deseja excluir a categoria "${confirmDeleteCat?.nome}"? Produtos já cadastrados com essa categoria não serão afetados.`}
        confirmLabel="Excluir"
        loading={deletandoCategoria}
      />
    </div>
  )
}
