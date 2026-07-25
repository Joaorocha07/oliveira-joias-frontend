'use client'

import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, MessageSquareText, Send } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { useAlert } from '@/hooks/use-alert'
import {
  PageHeader, Card, Button, Spinner, EmptyState, Modal, Input, Textarea, Select, ConfirmDialog,
} from '@/components/ui'
import {
  listarMensagensModelo, criarMensagemModelo, atualizarMensagemModelo, excluirMensagemModelo,
} from '@/services/mensagens'
import { ModalEnviarMensagem } from '@/components/modals/modal-enviar-mensagem'
import type { MensagemModelo, MensagemModeloInsert } from '@/types'

const CATEGORIAS = ['atendimento', 'pedido', 'geral', 'pos_venda', 'promocao'] as const
const CATEGORIA_LABEL: Record<string, string> = {
  atendimento: 'Atendimento',
  pedido: 'Pedido',
  geral: 'Geral',
  pos_venda: 'Pós-venda',
  promocao: 'Promoção',
}

const EMPTY_FORM: MensagemModeloInsert = {
  categoria: 'atendimento', titulo: '', mensagem: '', ativo: true, created_by: null,
}

export default function MensagensPage() {
  const { user } = useAuth()
  const alert = useAlert()
  const [mensagens, setMensagens] = useState<MensagemModelo[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<MensagemModelo | null>(null)
  const [form, setForm] = useState<MensagemModeloInsert>(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)
  const [excluindo, setExcluindo] = useState<MensagemModelo | null>(null)
  const [enviando, setEnviando] = useState<MensagemModelo | null>(null)

  async function carregar() {
    setLoading(true)
    const { data, error } = await listarMensagensModelo()
    if (error) alert.error('Erro', 'Erro ao carregar mensagens.')
    else setMensagens(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void carregar(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [])

  function openCreate() {
    setEditando(null)
    setForm({ ...EMPTY_FORM, created_by: user?.id ?? null })
    setModalOpen(true)
  }

  function openEdit(mensagem: MensagemModelo) {
    setEditando(mensagem)
    setForm({
      categoria: mensagem.categoria, titulo: mensagem.titulo, mensagem: mensagem.mensagem,
      ativo: mensagem.ativo, created_by: mensagem.created_by,
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.titulo.trim() || !form.mensagem.trim()) {
      alert.error('Atenção', 'Título e mensagem são obrigatórios.')
      return
    }
    setSalvando(true)
    const { error } = editando
      ? await atualizarMensagemModelo(editando.id, form)
      : await criarMensagemModelo(form)

    if (error) {
      alert.error('Erro', error)
    } else {
      await carregar()
      alert.success(editando ? 'Mensagem Atualizada!' : 'Mensagem Criada!', 'Modelo salvo com sucesso.', {
        onConfirm: () => setModalOpen(false),
      })
    }
    setSalvando(false)
  }

  async function handleDelete() {
    if (!excluindo) return
    const { error } = await excluirMensagemModelo(excluindo.id)
    if (error) alert.error('Erro', error)
    else {
      setMensagens((prev) => prev.filter((m) => m.id !== excluindo.id))
      setExcluindo(null)
    }
  }

  const grupos = CATEGORIAS.map((cat) => ({
    categoria: cat,
    itens: mensagens.filter((m) => m.categoria === cat),
  })).filter((g) => g.itens.length > 0)

  return (
    <div>
      <PageHeader
        title="CRM · Biblioteca de Mensagens"
        subtitle="Modelos prontos para agilizar o atendimento pelo WhatsApp"
        actions={
          <Button variant="primary" leftIcon={<Plus size={14} />} onClick={openCreate}>
            Nova Mensagem
          </Button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size={24} /></div>
      ) : mensagens.length === 0 ? (
        <Card>
          <EmptyState
            imageSrc="/images/No data-cuate.svg"
            title="Nenhuma mensagem cadastrada"
            description="Crie o primeiro modelo de mensagem."
            action={
              <Button variant="primary" size="sm" leftIcon={<Plus size={12} />} onClick={openCreate}>
                Nova Mensagem
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {grupos.map(({ categoria, itens }) => (
            <div key={categoria}>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-dark-400 mb-2.5">
                {CATEGORIA_LABEL[categoria] ?? categoria}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {itens.map((mensagem) => (
                  <Card key={mensagem.id} padding="sm" className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-dark-700 flex items-center gap-1.5">
                        <MessageSquareText size={13} className="text-gold-500 flex-shrink-0" />
                        {mensagem.titulo}
                      </p>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => openEdit(mensagem)}
                          className="p-1 rounded text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Editar"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setExcluindo(mensagem)}
                          className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Excluir"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-dark-400 leading-relaxed line-clamp-3 flex-1">{mensagem.mensagem}</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={<Send size={12} />}
                      onClick={() => setEnviando(mensagem)}
                      className="self-start"
                    >
                      Enviar para cliente
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? 'Editar Mensagem' : 'Nova Mensagem'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSave} loading={salvando}>
              {editando ? 'Salvar' : 'Criar'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Categoria"
              value={form.categoria}
              onChange={(e) => setForm((prev) => ({ ...prev, categoria: e.target.value }))}
            >
              {CATEGORIAS.map((c) => <option key={c} value={c}>{CATEGORIA_LABEL[c]}</option>)}
            </Select>
            <Input
              label="Título"
              value={form.titulo}
              onChange={(e) => setForm((prev) => ({ ...prev, titulo: e.target.value }))}
            />
          </div>
          <Textarea
            label="Mensagem"
            rows={5}
            hint="Use {nome}, {produto}, {empresa}, {endereco} e {instagram} — são substituídos automaticamente ao enviar."
            value={form.mensagem}
            onChange={(e) => setForm((prev) => ({ ...prev, mensagem: e.target.value }))}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!excluindo}
        onClose={() => setExcluindo(null)}
        onConfirm={handleDelete}
        title="Excluir mensagem"
        description={`Deseja excluir o modelo "${excluindo?.titulo}"?`}
        confirmLabel="Excluir"
      />

      <ModalEnviarMensagem
        open={!!enviando}
        onClose={() => setEnviando(null)}
        mensagem={enviando}
      />
    </div>
  )
}
