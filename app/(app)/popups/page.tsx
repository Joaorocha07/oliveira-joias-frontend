'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Power, MessageCircle, Link as LinkIcon, Ban } from 'lucide-react'
import { useAlert } from '@/hooks/use-alert'
import { cn } from '@/lib/cn'
import {
  PageHeader, Card, Button, Spinner, Modal, Input, Textarea, ConfirmDialog,
} from '@/components/ui'
import {
  listarPopups, criarPopup, atualizarPopup, excluirPopup,
  TIPO_LABELS, TIPO_CORES, type SitePopup,
} from '@/services/popups'
import { listarProdutosCatalogo, type ProdutoCatalogo } from '@/services/catalogo'

const TIPO_DESCRICOES: Record<SitePopup['tipo'], string> = {
  boas_vindas: 'Aparece após o visitante entrar no site. Máx. 1.',
  promocao: 'Vinculado a um produto específico. Sem limite.',
  saida: 'Aparece quando o visitante tenta sair. Máx. 1.',
}

const EMPTY_FORM = {
  tipo: 'boas_vindas' as SitePopup['tipo'],
  titulo: '',
  mensagem: '',
  produto_slug: '',
  cta_texto: '',
  ativo: true,
  delay_segundos: '3',
}

type CtaTipo = 'nenhum' | 'url' | 'whatsapp'

function gerarUrlWhatsApp(numero: string, mensagem: string): string {
  const num = '55' + numero.replace(/\D/g, '')
  return `https://wa.me/${num}` + (mensagem.trim() ? `?text=${encodeURIComponent(mensagem.trim())}` : '')
}

function parseWhatsApp(url: string): { numero: string; mensagem: string } | null {
  const m = url.match(/^https:\/\/wa\.me\/55(\d+)(?:\?text=(.+))?$/)
  if (!m) return null
  return {
    numero: m[1] ?? '',
    mensagem: m[2] ? decodeURIComponent(m[2]) : '',
  }
}

export default function PopupsPage() {
  const alert = useAlert()
  const [popups, setPopups] = useState<SitePopup[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<SitePopup | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [imagem, setImagem] = useState<File | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<SitePopup | null>(null)
  const [deletando, setDeletando] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // CTA extras
  const [ctaTipo, setCtaTipo] = useState<CtaTipo>('nenhum')
  const [ctaUrl, setCtaUrl] = useState('')
  const [waNumero, setWaNumero] = useState('')
  const [waMensagem, setWaMensagem] = useState('')

  // Produtos
  const [produtos, setProdutos] = useState<ProdutoCatalogo[]>([])
  const [loadingProdutos, setLoadingProdutos] = useState(false)

  async function load() {
    setLoading(true)
    const { data, error } = await listarPopups()
    if (error) alert.error('Erro', error)
    else setPopups(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!modalOpen) return
    setLoadingProdutos(true)
    listarProdutosCatalogo().then(({ data }) => {
      setProdutos(data ?? [])
      setLoadingProdutos(false)
    })
  }, [modalOpen])

  function setField<K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function resetCta() {
    setCtaTipo('nenhum')
    setCtaUrl('')
    setWaNumero('')
    setWaMensagem('')
  }

  function openCreate() {
    setEditando(null)
    setForm(EMPTY_FORM)
    setImagem(null)
    resetCta()
    setModalOpen(true)
  }

  function openEdit(p: SitePopup) {
    setEditando(p)
    setForm({
      tipo: p.tipo,
      titulo: p.titulo,
      mensagem: p.mensagem,
      produto_slug: p.produto_slug ?? '',
      cta_texto: p.cta_texto ?? '',
      ativo: p.ativo,
      delay_segundos: String(p.delay_segundos),
    })
    setImagem(null)

    if (p.cta_url) {
      const wa = parseWhatsApp(p.cta_url)
      if (wa) {
        setCtaTipo('whatsapp')
        setWaNumero(wa.numero)
        setWaMensagem(wa.mensagem)
        setCtaUrl('')
      } else {
        setCtaTipo('url')
        setCtaUrl(p.cta_url)
        setWaNumero('')
        setWaMensagem('')
      }
    } else {
      resetCta()
    }

    setModalOpen(true)
  }

  function tipoTaken(tipo: SitePopup['tipo']): boolean {
    if (editando) return false
    if (tipo === 'promocao') return false
    return popups.some((p) => p.tipo === tipo)
  }

  async function handleSave() {
    if (!form.titulo.trim()) { alert.error('Atenção', 'Título é obrigatório.'); return }
    if (!form.mensagem.trim()) { alert.error('Atenção', 'Mensagem é obrigatória.'); return }
    if (form.tipo === 'promocao' && !form.produto_slug) {
      alert.error('Atenção', 'Selecione o produto para o pop-up de promoção.')
      return
    }

    if (!editando && tipoTaken(form.tipo)) {
      alert.error(
        'Limite atingido',
        `Já existe um pop-up de "${TIPO_LABELS[form.tipo]}". Edite o existente ou exclua-o antes de criar um novo.`,
      )
      return
    }

    let finalCtaUrl = ''
    if (ctaTipo === 'url') {
      finalCtaUrl = ctaUrl.trim()
    } else if (ctaTipo === 'whatsapp') {
      if (!waNumero.replace(/\D/g, '')) {
        alert.error('Atenção', 'Informe o número de WhatsApp.')
        return
      }
      finalCtaUrl = gerarUrlWhatsApp(waNumero, waMensagem)
    }

    setSalvando(true)
    const fd = new FormData()
    fd.append('tipo', form.tipo)
    fd.append('titulo', form.titulo.trim())
    fd.append('mensagem', form.mensagem.trim())
    fd.append('ativo', String(form.ativo))
    fd.append('delay_segundos', form.delay_segundos || '3')
    if (form.tipo === 'promocao' && form.produto_slug) fd.append('produto_slug', form.produto_slug)
    if (form.cta_texto.trim()) fd.append('cta_texto', form.cta_texto.trim())
    if (finalCtaUrl) fd.append('cta_url', finalCtaUrl)
    if (imagem) fd.append('imagem', imagem)

    const { error } = editando
      ? await atualizarPopup(editando.id, fd)
      : await criarPopup(fd)

    if (error) {
      alert.error('Erro', error)
    } else {
      alert.success(
        editando ? 'Pop-up atualizado!' : 'Pop-up criado!',
        editando ? 'As alterações foram salvas.' : 'O pop-up foi adicionado.',
        { onConfirm: () => setModalOpen(false) },
      )
      void load()
    }
    setSalvando(false)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setDeletando(true)
    const { error } = await excluirPopup(confirmDelete.id)
    if (error) alert.error('Erro', error)
    else setPopups((prev) => prev.filter((p) => p.id !== confirmDelete.id))
    setDeletando(false)
    setConfirmDelete(null)
  }

  async function toggleAtivo(p: SitePopup) {
    setTogglingId(p.id)
    const fd = new FormData()
    fd.append('ativo', String(!p.ativo))
    const { error } = await atualizarPopup(p.id, fd)
    if (error) alert.error('Erro', error)
    else setPopups((prev) => prev.map((x) => x.id === p.id ? { ...x, ativo: !x.ativo } : x))
    setTogglingId(null)
  }

  const waPreviewUrl = waNumero.replace(/\D/g, '')
    ? gerarUrlWhatsApp(waNumero, waMensagem)
    : ''

  return (
    <div>
      <PageHeader
        title="Pop-ups do Site"
        subtitle="Configure mensagens automáticas exibidas para os visitantes do portfólio"
        actions={
          <Button variant="primary" leftIcon={<Plus size={14} />} onClick={openCreate}>
            Novo Pop-up
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-20"><Spinner size={28} /></div>
      ) : popups.length === 0 ? (
        <Card className="text-center py-20">
          <p className="font-serif text-xl text-dark-400 mb-2">Nenhum pop-up cadastrado</p>
          <p className="text-sm text-dark-300 mb-6">Crie o primeiro pop-up para engajar os visitantes do site.</p>
          <Button variant="primary" leftIcon={<Plus size={14} />} onClick={openCreate}>Novo Pop-up</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {popups.map((p) => (
            <Card key={p.id} padding="none" className="flex flex-col">
              {p.imagem_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imagem_url} alt={p.titulo} className="w-full aspect-video object-cover rounded-t-xl" />
              )}
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border',
                    TIPO_CORES[p.tipo],
                  )}>
                    {TIPO_LABELS[p.tipo]}
                  </span>
                  <button
                    type="button"
                    onClick={() => void toggleAtivo(p)}
                    disabled={togglingId === p.id}
                    title={p.ativo ? 'Desativar' : 'Ativar'}
                    className={cn(
                      'flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors',
                      p.ativo
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-gray-50 text-gray-400 border-gray-200 hover:bg-gray-100',
                      togglingId === p.id && 'opacity-50 cursor-wait',
                    )}
                  >
                    <Power size={11} />
                    {p.ativo ? 'Ativo' : 'Inativo'}
                  </button>
                </div>

                <h3 className="font-serif text-dark-700 font-semibold text-base leading-snug mb-1 line-clamp-2">
                  {p.titulo}
                </h3>
                <p className="text-xs text-dark-300 line-clamp-2 mb-3">{p.mensagem}</p>

                <div className="flex flex-col gap-1 mb-3">
                  {p.tipo === 'promocao' && p.produto_slug && (
                    <p className="text-[10px] text-dark-300">
                      Produto: <span className="font-medium text-dark-500">{p.produto_slug}</span>
                    </p>
                  )}
                  {p.tipo === 'boas_vindas' && (
                    <p className="text-[10px] text-dark-300">
                      Delay: <span className="font-medium text-dark-500">{p.delay_segundos}s</span>
                    </p>
                  )}
                  {p.cta_url?.startsWith('https://wa.me/') ? (
                    <p className="text-[10px] text-emerald-600 flex items-center gap-1">
                      <MessageCircle size={10} /> Abre WhatsApp
                    </p>
                  ) : p.cta_url ? (
                    <p className="text-[10px] text-blue-500 flex items-center gap-1">
                      <LinkIcon size={10} /> {p.cta_url}
                    </p>
                  ) : null}
                </div>

                <div className="flex gap-2 mt-auto pt-3 border-t border-gold-50">
                  <Button variant="secondary" size="sm" leftIcon={<Pencil size={12} />} onClick={() => openEdit(p)} className="flex-1">
                    Editar
                  </Button>
                  <Button variant="danger" size="sm" leftIcon={<Trash2 size={12} />} onClick={() => setConfirmDelete(p)}>
                    Excluir
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modal criar/editar */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? 'Editar Pop-up' : 'Novo Pop-up'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={salvando}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave} loading={salvando}>
              {editando ? 'Salvar' : 'Criar Pop-up'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Tipo */}
          <div>
            <label className="label-base mb-2 block">Tipo de pop-up *</label>
            <div className="grid grid-cols-3 gap-2">
              {(['boas_vindas', 'promocao', 'saida'] as const).map((tipo) => {
                const taken = tipoTaken(tipo)
                return (
                  <button
                    key={tipo}
                    type="button"
                    disabled={taken}
                    onClick={() => setField('tipo', tipo)}
                    className={cn(
                      'flex flex-col items-start p-3 rounded-xl border-2 text-left transition-all',
                      form.tipo === tipo && !taken
                        ? 'border-gold-400 bg-gold-50/60'
                        : 'border-gold-100 hover:border-gold-200 bg-white',
                      taken && 'opacity-40 cursor-not-allowed',
                    )}
                  >
                    <span className={cn(
                      'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border mb-2',
                      TIPO_CORES[tipo],
                    )}>
                      {TIPO_LABELS[tipo]}
                    </span>
                    <span className="text-[11px] text-dark-400 leading-snug">{TIPO_DESCRICOES[tipo]}</span>
                    {taken && (
                      <span className="text-[10px] text-dark-300 mt-1.5 font-medium flex items-center gap-1">
                        <Ban size={9} /> Já cadastrado
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Título + Mensagem */}
          <Input
            label="Título *"
            value={form.titulo}
            onChange={(e) => setField('titulo', e.target.value)}
            placeholder="Ex: Bem-vindo à Oliveira Joias!"
          />
          <Textarea
            label="Mensagem *"
            value={form.mensagem}
            onChange={(e) => setField('mensagem', e.target.value)}
            placeholder="Texto exibido no pop-up..."
            rows={3}
          />

          {/* Imagem */}
          <div className="flex flex-col gap-1.5">
            <label className="label-base">Imagem (opcional)</label>
            {editando?.imagem_url && !imagem && (
              <div className="mb-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={editando.imagem_url} alt="Imagem atual" className="h-20 rounded-lg object-cover border border-gold-100" />
                <p className="text-[10px] text-dark-300 mt-1">Envie outra para substituir.</p>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setImagem(e.target.files?.[0] ?? null)}
              className="input-base cursor-pointer file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gold-100 file:text-gold-700 file:text-xs file:font-medium"
            />
          </div>

          {/* Produto (promoção) */}
          {form.tipo === 'promocao' && (
            <div className="flex flex-col gap-1.5">
              <label className="label-base">Produto vinculado *</label>
              {loadingProdutos ? (
                <div className="input-base flex items-center gap-2 text-dark-300 text-sm">
                  <Spinner size={13} /> Carregando produtos...
                </div>
              ) : produtos.length === 0 ? (
                <p className="input-base text-sm text-dark-300">Nenhum produto encontrado no catálogo.</p>
              ) : (
                <select
                  value={form.produto_slug}
                  onChange={(e) => setField('produto_slug', e.target.value)}
                  className="input-base w-full cursor-pointer"
                >
                  <option value="">Selecione um produto...</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.slug}>
                      {p.nome}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[10px] text-dark-300">
                O pop-up aparece quando o visitante acessar a página deste produto.
              </p>
            </div>
          )}

          {/* Delay (boas_vindas) */}
          {form.tipo === 'boas_vindas' && (
            <Input
              label="Delay (segundos)"
              hint="Tempo de espera antes de exibir o pop-up"
              type="number"
              min={0}
              max={60}
              value={form.delay_segundos}
              onChange={(e) => setField('delay_segundos', e.target.value)}
            />
          )}

          {/* ─── Seção CTA ─── */}
          <div className="border-t border-gold-100 pt-4 flex flex-col gap-3">
            <p className="text-xs font-semibold text-dark-500 uppercase tracking-wide">Botão de ação (opcional)</p>

            <Input
              label="Texto do botão"
              placeholder="Ex: Ver alianças, Falar conosco..."
              value={form.cta_texto}
              onChange={(e) => setField('cta_texto', e.target.value)}
            />

            {/* Destino toggle */}
            <div>
              <label className="label-base mb-1.5 block">Destino ao clicar</label>
              <div className="flex gap-2">
                {([
                  { key: 'nenhum' as CtaTipo, label: 'Nenhum', icon: <Ban size={12} /> },
                  { key: 'url' as CtaTipo, label: 'Link / Página', icon: <LinkIcon size={12} /> },
                  { key: 'whatsapp' as CtaTipo, label: 'WhatsApp', icon: <MessageCircle size={12} /> },
                ]).map(({ key, label, icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setCtaTipo(key)}
                    className={cn(
                      'flex-1 py-2 px-2 rounded-lg text-xs font-medium border-2 transition-all flex items-center justify-center gap-1.5',
                      ctaTipo === key
                        ? key === 'whatsapp'
                          ? 'border-emerald-400 bg-emerald-50 text-emerald-700'
                          : 'border-gold-400 bg-gold-50/60 text-dark-700'
                        : 'border-gold-100 text-dark-300 hover:border-gold-200 bg-white',
                    )}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {ctaTipo === 'url' && (
              <Input
                label="URL"
                placeholder="Ex: /aliancas ou https://seusite.com..."
                value={ctaUrl}
                onChange={(e) => setCtaUrl(e.target.value)}
              />
            )}

            {ctaTipo === 'whatsapp' && (
              <div className="flex flex-col gap-3">
                <Input
                  label="Número do WhatsApp"
                  placeholder="Ex: 34999999999"
                  hint="Apenas números — DDD + número, sem +55"
                  value={waNumero}
                  onChange={(e) => setWaNumero(e.target.value.replace(/\D/g, ''))}
                />
                <Textarea
                  label="Mensagem pré-preenchida"
                  placeholder="Ex: Olá! Tenho interesse nas alianças..."
                  value={waMensagem}
                  onChange={(e) => setWaMensagem(e.target.value)}
                  rows={2}
                />
                {waPreviewUrl && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wide mb-1">
                      Link gerado automaticamente
                    </p>
                    <p className="text-[10px] text-emerald-700 break-all font-mono leading-relaxed">
                      {waPreviewUrl}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Ativo */}
          <label className="flex items-center gap-2 text-sm text-dark-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={form.ativo}
              onChange={(e) => setField('ativo', e.target.checked)}
              className="w-4 h-4 rounded border-gold-300 text-gold-600 focus:ring-gold-500"
            />
            Ativar imediatamente após salvar
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Excluir pop-up"
        description={`Deseja excluir o pop-up "${confirmDelete?.titulo}"? Esta ação é irreversível.`}
        confirmLabel="Excluir"
        loading={deletando}
      />
    </div>
  )
}
