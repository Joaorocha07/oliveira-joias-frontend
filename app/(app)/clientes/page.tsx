'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Users, Phone, Mail, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, Card, Button, SearchInput, Spinner, EmptyState,
  Modal, Input, Textarea, ConfirmDialog, ActionMenu,
} from '@/components/ui'
import { formatPhone, formatCPF } from '@/utils'
import type { Cliente, ClienteInsert } from '@/types'
import { useAuth } from '@/context/auth-context'

const EMPTY_FORM: ClienteInsert = {
  nome: '', cpf: null, rg: null, email: null, telefone: null, whatsapp: null,
  data_nascimento: null, endereco: null, numero: null, complemento: null,
  bairro: null, cidade: null, estado: null, cep: null, observacoes: null,
  ativo: true, created_by: null,
}

export default function ClientesPage() {
  const { user } = useAuth()
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [form, setForm] = useState<ClienteInsert>(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Cliente | null>(null)
  const [deletando, setDeletando] = useState(false)

  async function loadClientes() {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('ativo', true)
      .order('nome')

    if (error) {
      toast.error('Erro ao carregar clientes.')
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
      toast.error('Nome é obrigatório.')
      return
    }
    setSalvando(true)

    if (editando) {
      const { error } = await supabase.from('clientes').update(form).eq('id', editando.id)
      if (error) {
        toast.error('Erro ao atualizar cliente.')
      } else {
        toast.success('Cliente atualizado.')
        setClientes((prev) => prev.map((c) => c.id === editando.id ? { ...c, ...form } : c))
        setModalOpen(false)
      }
    } else {
      const { data, error } = await supabase.from('clientes').insert([form]).select().single()
      if (error) {
        toast.error('Erro ao cadastrar cliente.')
      } else {
        toast.success('Cliente cadastrado.')
        setClientes((prev) => [...prev, data as Cliente])
        setModalOpen(false)
      }
    }
    setSalvando(false)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setDeletando(true)
    const { error } = await supabase
      .from('clientes').update({ ativo: false }).eq('id', confirmDelete.id)
    if (error) {
      toast.error('Erro ao excluir cliente.')
    } else {
      toast.success('Cliente removido.')
      setClientes((prev) => prev.filter((c) => c.id !== confirmDelete.id))
    }
    setDeletando(false)
    setConfirmDelete(null)
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
            className="max-w-sm"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users size={24} />}
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
                <div key={cliente.id} className="p-4 hover:bg-cream-50/30 transition-colors">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-dark-700 text-sm truncate">{cliente.nome}</p>
                      {cliente.telefone && (
                        <p className="flex items-center gap-1.5 text-xs text-dark-400 mt-1">
                          <Phone size={11} className="text-dark-300 flex-shrink-0" />
                          {formatPhone(cliente.telefone)}
                        </p>
                      )}
                      {cliente.email && (
                        <p className="flex items-center gap-1.5 text-xs text-dark-400 mt-0.5 truncate">
                          <Mail size={11} className="text-dark-300 flex-shrink-0" />
                          {cliente.email}
                        </p>
                      )}
                    </div>
                    <ActionMenu
                      items={[
                        { label: 'Editar', icon: <Pencil size={14} />, onClick: () => openEdit(cliente) },
                        { label: 'Excluir', icon: <Trash2 size={14} />, onClick: () => setConfirmDelete(cliente), variant: 'danger' },
                      ]}
                    />
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
                    <tr key={cliente.id} className="hover:bg-cream-50/40 transition-colors">
                      <td className="px-5 py-3 font-medium text-dark-700 max-w-[180px]">
                        <span className="block truncate">{cliente.nome}</span>
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
                      <td className="px-5 py-3">
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
                            onClick={() => setConfirmDelete(cliente)}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Excluir cliente"
                          >
                            <Trash2 size={14} />
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
        title="Remover cliente"
        description={`Deseja remover "${confirmDelete?.nome}"?`}
        confirmLabel="Remover"
        loading={deletando}
      />
    </div>
  )
}
