'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Users, Phone, Mail, Pencil, Trash2 } from 'lucide-react'
import { useAlert } from '@/hooks/use-alert'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, Card, Button, SearchInput, Spinner, EmptyState,
  Modal, Input, Textarea, ConfirmDialog, ActionMenu,
} from '@/components/ui'
import { formatPhone, formatCPF } from '@/utils'
import type { Cliente, ClienteInsert } from '@/types'
import { useAuth } from '@/context/auth-context'
import { deleteVenda } from '@/services/vendas'
import { ModalHistoricoCliente } from '@/components/modals/modal-historico-cliente'

const EMPTY_FORM: ClienteInsert = {
  nome: '', cpf: null, rg: null, email: null, telefone: null, whatsapp: null,
  data_nascimento: null, endereco: null, numero: null, complemento: null,
  bairro: null, cidade: null, estado: null, cep: null, observacoes: null,
  ativo: true, created_by: null,
}

export default function ClientesPage() {
  const { user } = useAuth()
  const alert = useAlert()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [form, setForm] = useState<ClienteInsert>(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Cliente | null>(null)
  const [deletando, setDeletando] = useState(false)
  const [checandoVinculos, setChecandoVinculos] = useState<string | null>(null)
  const [vinculos, setVinculos] = useState<{ vendas: number; servicos: number } | null>(null)
  const [dangerCliente, setDangerCliente] = useState<Cliente | null>(null)
  const [senha, setSenha] = useState('')
  const [verificando, setVerificando] = useState(false)
  const [historicoCliente, setHistoricoCliente] = useState<Cliente | null>(null)

  async function loadClientes() {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('ativo', true)
      .order('nome')

    if (error) {
      alert.error('Erro', 'Erro ao carregar clientes.')
    } else {
      setClientes(data ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadClientes(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [])

  const filtered = useMemo(() => {
    if (!search) return clientes
    const q = search.toLowerCase()
    return clientes.filter((c) =>
      c.nome.toLowerCase().includes(q) ||
      c.telefone?.includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.cpf?.includes(q)
    )
  }, [clientes, search])

  function openCreate() {
    setEditando(null)
    setForm({ ...EMPTY_FORM, created_by: user?.id ?? null })
    setModalOpen(true)
  }

  function openEdit(cliente: Cliente) {
    setEditando(cliente)
    setForm({
      nome: cliente.nome, cpf: cliente.cpf, rg: cliente.rg,
      email: cliente.email, telefone: cliente.telefone, whatsapp: cliente.whatsapp,
      data_nascimento: cliente.data_nascimento, endereco: cliente.endereco,
      numero: cliente.numero, complemento: cliente.complemento,
      bairro: cliente.bairro, cidade: cliente.cidade, estado: cliente.estado,
      cep: cliente.cep, observacoes: cliente.observacoes,
      ativo: cliente.ativo, created_by: cliente.created_by,
    })
    setModalOpen(true)
  }

  function setField<K extends keyof ClienteInsert>(key: K, value: ClienteInsert[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      alert.error('Atenção', 'Nome é obrigatório.')
      return
    }
    setSalvando(true)

    if (editando) {
      const { error } = await supabase.from('clientes').update(form).eq('id', editando.id)
      if (error) {
        alert.error('Erro', 'Erro ao atualizar cliente.')
      } else {
        setClientes((prev) => prev.map((c) => c.id === editando.id ? { ...c, ...form } : c))
        alert.success('Cliente Atualizado!', 'Os dados do cliente foram salvos.', {
          onConfirm: () => setModalOpen(false),
        })
      }
    } else {
      const { data, error } = await supabase.from('clientes').insert([form]).select().single()
      if (error) {
        alert.error('Erro', 'Erro ao cadastrar cliente.')
      } else {
        setClientes((prev) => [...prev, data as Cliente])
        alert.success('Cliente Cadastrado!', 'Cliente adicionado com sucesso.', {
          onConfirm: () => setModalOpen(false),
        })
      }
    }
    setSalvando(false)
  }

  async function iniciarDelete(cliente: Cliente) {
    setChecandoVinculos(cliente.id)
    const [{ count: vendasCount }, { count: servicosCount }] = await Promise.all([
      supabase.from('vendas').select('id', { count: 'exact', head: true }).eq('cliente_id', cliente.id),
      supabase.from('servicos').select('id', { count: 'exact', head: true }).eq('cliente_id', cliente.id),
    ])
    setChecandoVinculos(null)
    const total = (vendasCount ?? 0) + (servicosCount ?? 0)
    if (total === 0) {
      setConfirmDelete(cliente)
    } else {
      setVinculos({ vendas: vendasCount ?? 0, servicos: servicosCount ?? 0 })
      setDangerCliente(cliente)
      setSenha('')
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setDeletando(true)
    const { error } = await supabase.from('clientes').delete().eq('id', confirmDelete.id)
    if (error) {
      alert.error('Erro', 'Erro ao excluir cliente.')
    } else {
      setClientes((prev) => prev.filter((c) => c.id !== confirmDelete.id))
      setConfirmDelete(null)
      alert.success('Cliente Excluído!', 'O cliente foi removido com sucesso.')
    }
    setDeletando(false)
  }

  async function handleDeleteCascade() {
    if (!dangerCliente || !user?.email) return
    setVerificando(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: senha,
    })
    if (authError) {
      alert.error('Senha Incorreta', 'Verifique sua senha e tente novamente.')
      setVerificando(false)
      return
    }

    const { data: vendas } = await supabase.from('vendas').select('id').eq('cliente_id', dangerCliente.id)
    for (const v of vendas ?? []) {
      const { error } = await deleteVenda(v.id)
      if (error) { alert.error('Erro', `Erro ao excluir venda: ${error}`); setVerificando(false); return }
    }

    const { error: servicosError } = await supabase.from('servicos').delete().eq('cliente_id', dangerCliente.id)
    if (servicosError) { alert.error('Erro', `Erro ao excluir serviços: ${servicosError.message}`); setVerificando(false); return }

    const { error: clienteError } = await supabase.from('clientes').delete().eq('id', dangerCliente.id)
    if (clienteError) { alert.error('Erro', clienteError.message); setVerificando(false); return }

    setClientes((prev) => prev.filter((c) => c.id !== dangerCliente.id))
    setDangerCliente(null)
    setVinculos(null)
    setSenha('')
    setVerificando(false)
    alert.success('Cliente Excluído!', 'Cliente e todos os registros foram removidos permanentemente.')
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Cadastro de clientes"
        actions={
          <Button variant="primary" leftIcon={<Plus size={14} />} onClick={openCreate}>
            Novo Cliente
          </Button>
        }
      />

      <Card padding="none">
        <div className="p-4 border-b border-gold-100">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nome, telefone, CPF..."
            className="w-full"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            imageSrc="/images/Profile Interface-rafiki.svg"
            title="Nenhum cliente encontrado"
            description={search ? 'Tente outro termo.' : 'Cadastre o primeiro cliente.'}
            action={
              !search && (
                <Button variant="primary" size="sm" leftIcon={<Plus size={12} />} onClick={openCreate}>
                  Novo Cliente
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden divide-y divide-gold-50">
              {filtered.map((cliente) => (
                <div
                  key={cliente.id}
                  className="p-4 hover:bg-[#FAF7F0] active:bg-[#F5ECD0]/60 transition-colors cursor-pointer"
                  onClick={() => setHistoricoCliente(cliente)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setHistoricoCliente(cliente) }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#F5ECD0] flex items-center justify-center flex-shrink-0 text-[#C9A84C] text-xs font-semibold font-display">
                      {cliente.nome.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-dark-700 text-sm truncate">{cliente.nome}</p>
                      <div className="flex flex-wrap gap-x-3 mt-0.5">
                        {cliente.telefone && (
                          <p className="flex items-center gap-1 text-xs text-dark-400">
                            <Phone size={10} className="text-dark-300 flex-shrink-0" />
                            {formatPhone(cliente.telefone)}
                          </p>
                        )}
                        {cliente.email && (
                          <p className="flex items-center gap-1 text-xs text-dark-400 truncate">
                            <Mail size={10} className="text-dark-300 flex-shrink-0" />
                            <span className="truncate">{cliente.email}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <ActionMenu
                        items={[
                          { label: 'Editar', icon: <Pencil size={14} />, onClick: () => openEdit(cliente) },
                          { label: 'Excluir', icon: <Trash2 size={14} />, onClick: () => void iniciarDelete(cliente), variant: 'danger' },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: tabela */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold-100 bg-cream-50/50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Nome</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Telefone</th>
                    <th className="hidden md:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Email</th>
                    <th className="hidden lg:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">CPF</th>
                    <th className="px-5 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-50">
                  {filtered.map((cliente) => (
                    <tr
                      key={cliente.id}
                      className="hover:bg-[#FAF7F0] transition-colors cursor-pointer"
                      onClick={() => setHistoricoCliente(cliente)}
                    >
                      <td className="px-5 py-3 max-w-[200px]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-[#F5ECD0] flex items-center justify-center flex-shrink-0 text-[#C9A84C] text-[10px] font-semibold font-display">
                            {cliente.nome.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')}
                          </div>
                          <span className="font-medium text-dark-700 truncate">{cliente.nome}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-dark-400">
                        {cliente.telefone ? (
                          <span className="flex items-center gap-1.5">
                            <Phone size={12} className="text-dark-300" />
                            {formatPhone(cliente.telefone)}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="hidden md:table-cell px-5 py-3 text-dark-400 max-w-[200px]">
                        <span className="block truncate">{cliente.email || '—'}</span>
                      </td>
                      <td className="hidden lg:table-cell px-5 py-3 text-dark-400 font-mono text-xs">
                        {cliente.cpf ? formatCPF(cliente.cpf) : '—'}
                      </td>
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => openEdit(cliente)}
                            className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Editar cliente"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void iniciarDelete(cliente)}
                            disabled={checandoVinculos === cliente.id}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Excluir cliente"
                          >
                            {checandoVinculos === cliente.id
                              ? <span className="block w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                              : <Trash2 size={14} />
                            }
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* Modal de criação/edição */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? 'Editar Cliente' : 'Novo Cliente'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={salvando}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleSave} loading={salvando}>
              {editando ? 'Salvar' : 'Cadastrar'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Nome *"
            value={form.nome}
            onChange={(e) => setField('nome', e.target.value)}
            className="sm:col-span-2"
          />
          <Input
            label="CPF"
            value={form.cpf ?? ''}
            onChange={(e) => setField('cpf', e.target.value || null)}
            placeholder="000.000.000-00"
          />
          <Input
            label="RG"
            value={form.rg ?? ''}
            onChange={(e) => setField('rg', e.target.value || null)}
          />
          <Input
            label="Telefone"
            value={form.telefone ?? ''}
            onChange={(e) => setField('telefone', e.target.value || null)}
            placeholder="(00) 00000-0000"
          />
          <Input
            label="WhatsApp"
            value={form.whatsapp ?? ''}
            onChange={(e) => setField('whatsapp', e.target.value || null)}
            placeholder="(00) 00000-0000"
          />
          <Input
            label="Email"
            type="email"
            value={form.email ?? ''}
            onChange={(e) => setField('email', e.target.value || null)}
            className="sm:col-span-2"
          />
          <Input
            label="Data de Nascimento"
            type="date"
            value={form.data_nascimento ?? ''}
            onChange={(e) => setField('data_nascimento', e.target.value || null)}
          />
          <Input
            label="CEP"
            value={form.cep ?? ''}
            onChange={(e) => setField('cep', e.target.value || null)}
          />
          <Input
            label="Endereço"
            value={form.endereco ?? ''}
            onChange={(e) => setField('endereco', e.target.value || null)}
          />
          <Input
            label="Número"
            value={form.numero ?? ''}
            onChange={(e) => setField('numero', e.target.value || null)}
          />
          <Input
            label="Complemento"
            value={form.complemento ?? ''}
            onChange={(e) => setField('complemento', e.target.value || null)}
          />
          <Input
            label="Bairro"
            value={form.bairro ?? ''}
            onChange={(e) => setField('bairro', e.target.value || null)}
          />
          <Input
            label="Cidade"
            value={form.cidade ?? ''}
            onChange={(e) => setField('cidade', e.target.value || null)}
          />
          <Input
            label="Estado"
            value={form.estado ?? ''}
            onChange={(e) => setField('estado', e.target.value || null)}
            placeholder="UF"
            maxLength={2}
          />
          <Textarea
            label="Observações"
            value={form.observacoes ?? ''}
            onChange={(e) => setField('observacoes', e.target.value || null)}
            className="sm:col-span-2"
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title="Excluir cliente"
        description={`Deseja excluir "${confirmDelete?.nome}" permanentemente? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deletando}
      />

      <ModalHistoricoCliente
        open={!!historicoCliente}
        onClose={() => setHistoricoCliente(null)}
        cliente={historicoCliente}
      />

      <Modal
        open={!!dangerCliente}
        onClose={() => { if (!verificando) { setDangerCliente(null); setVinculos(null); setSenha('') } }}
        title="Excluir cliente e registros"
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setDangerCliente(null); setVinculos(null); setSenha('') }} disabled={verificando}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDeleteCascade} loading={verificando} disabled={!senha.trim()}>
              Excluir tudo
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-700 mb-2">Atenção: esta ação é irreversível!</p>
            <p className="text-sm text-red-600 mb-3">
              Ao excluir <strong>{dangerCliente?.nome}</strong>, os seguintes registros serão apagados permanentemente:
            </p>
            <ul className="text-sm text-red-600 space-y-1">
              {(vinculos?.vendas ?? 0) > 0 && (
                <li>• {vinculos!.vendas} venda(s) — incluindo itens, crediário, parcelas e lançamentos</li>
              )}
              {(vinculos?.servicos ?? 0) > 0 && (
                <li>• {vinculos!.servicos} serviço(s)</li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-sm text-dark-500 mb-3">Para confirmar, insira sua senha de acesso:</p>
            <Input
              label="Senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && senha.trim()) void handleDeleteCascade() }}
              placeholder="••••••••"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
