'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Truck, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, Card, Button, SearchInput, Spinner, EmptyState,
  Modal, Input, Textarea, ConfirmDialog, ActionMenu,
} from '@/components/ui'
import { formatPhone, formatCNPJ } from '@/utils'
import type { Fornecedor, FornecedorInsert } from '@/types'
import { useAuth } from '@/context/auth-context'

const EMPTY_FORM: FornecedorInsert = {
  nome: '', razao_social: null, cnpj: null, cpf: null,
  email: null, telefone: null, contato_nome: null,
  endereco: null, numero: null, complemento: null,
  bairro: null, cidade: null, estado: null, cep: null,
  categoria: null, observacoes: null, ativo: true, created_by: null,
}

export default function FornecedoresPage() {
  const { user } = useAuth()
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Fornecedor | null>(null)
  const [form, setForm] = useState<FornecedorInsert>(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Fornecedor | null>(null)
  const [deletando, setDeletando] = useState(false)

  async function loadFornecedores() {
    const { data, error } = await supabase
      .from('fornecedores').select('*').eq('ativo', true).order('nome')

    if (error) { toast.error('Erro ao carregar fornecedores.') }
    else { setFornecedores(data ?? []) }
    setLoading(false)
  }

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadFornecedores(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [])

  const filtered = useMemo(() => {
    if (!search) return fornecedores
    const q = search.toLowerCase()
    return fornecedores.filter((f) =>
      f.nome.toLowerCase().includes(q) ||
      f.cnpj?.includes(q) ||
      f.email?.toLowerCase().includes(q) ||
      f.categoria?.toLowerCase().includes(q)
    )
  }, [fornecedores, search])

  function openCreate() {
    setEditando(null)
    setForm({ ...EMPTY_FORM, created_by: user?.id ?? null })
    setModalOpen(true)
  }

  function setField<K extends keyof FornecedorInsert>(key: K, value: FornecedorInsert[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório.'); return }
    setSalvando(true)
    if (editando) {
      const { error } = await supabase.from('fornecedores').update(form).eq('id', editando.id)
      if (error) { toast.error('Erro ao atualizar.') }
      else { toast.success('Fornecedor atualizado.'); setFornecedores((p) => p.map((f) => f.id === editando.id ? { ...f, ...form } : f)); setModalOpen(false) }
    } else {
      const { data, error } = await supabase.from('fornecedores').insert([form]).select().single()
      if (error) { toast.error('Erro ao cadastrar.') }
      else { toast.success('Fornecedor cadastrado.'); setFornecedores((p) => [...p, data as Fornecedor]); setModalOpen(false) }
    }
    setSalvando(false)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setDeletando(true)
    const { error } = await supabase.from('fornecedores').update({ ativo: false }).eq('id', confirmDelete.id)
    if (error) { toast.error('Erro ao remover.') }
    else { toast.success('Fornecedor removido.'); setFornecedores((p) => p.filter((f) => f.id !== confirmDelete.id)) }
    setDeletando(false)
    setConfirmDelete(null)
  }

  return (
    <div>
      <PageHeader
        title="Fornecedores"
        subtitle="Cadastro de fornecedores"
        actions={
          <Button variant="primary" leftIcon={<Plus size={14} />} onClick={openCreate}>
            Novo Fornecedor
          </Button>
        }
      />

      <Card padding="none">
        <div className="p-4 border-b border-gold-100">
          <SearchInput value={search} onChange={setSearch} placeholder="Buscar fornecedor..." className="max-w-sm" />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Truck size={24} />} title="Nenhum fornecedor encontrado"
            description={search ? 'Tente outro termo.' : 'Cadastre o primeiro fornecedor.'}
            action={!search && <Button variant="primary" size="sm" leftIcon={<Plus size={12} />} onClick={openCreate}>Novo</Button>}
          />
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden divide-y divide-gold-50">
              {filtered.map((f) => (
                <div key={f.id} className="p-4 hover:bg-cream-50/30 transition-colors">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-dark-700 text-sm truncate">{f.nome}</p>
                      {f.telefone && (
                        <p className="text-xs text-dark-400 mt-0.5">{formatPhone(f.telefone)}</p>
                      )}
                      {f.cnpj && (
                        <p className="text-xs text-dark-400 font-mono mt-0.5">{formatCNPJ(f.cnpj)}</p>
                      )}
                      {f.categoria && (
                        <p className="text-xs text-dark-300 mt-0.5">{f.categoria}</p>
                      )}
                    </div>
                    <ActionMenu
                      items={[
                        {
                          label: 'Editar',
                          icon: <Pencil size={14} />,
                          onClick: () => {
                            setEditando(f)
                            setForm({ nome: f.nome, razao_social: f.razao_social, cnpj: f.cnpj, cpf: f.cpf, email: f.email, telefone: f.telefone, contato_nome: f.contato_nome, endereco: f.endereco, numero: f.numero, complemento: f.complemento, bairro: f.bairro, cidade: f.cidade, estado: f.estado, cep: f.cep, categoria: f.categoria, observacoes: f.observacoes, ativo: f.ativo, created_by: f.created_by })
                            setModalOpen(true)
                          },
                        },
                        { label: 'Excluir', icon: <Trash2 size={14} />, onClick: () => setConfirmDelete(f), variant: 'danger' },
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
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">CNPJ</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Contato</th>
                    <th className="hidden md:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Categoria</th>
                    <th className="px-5 py-3 w-20" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-50">
                  {filtered.map((f) => (
                    <tr key={f.id} className="hover:bg-cream-50/40 transition-colors">
                      <td className="px-5 py-3 font-medium text-dark-700 max-w-[180px]">
                        <span className="block truncate">{f.nome}</span>
                      </td>
                      <td className="px-5 py-3 text-dark-400 font-mono text-xs">{f.cnpj ? formatCNPJ(f.cnpj) : '—'}</td>
                      <td className="px-5 py-3 text-dark-400">{f.telefone ? formatPhone(f.telefone) : '—'}</td>
                      <td className="hidden md:table-cell px-5 py-3 text-dark-400">{f.categoria || '—'}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => { setEditando(f); setForm({ nome: f.nome, razao_social: f.razao_social, cnpj: f.cnpj, cpf: f.cpf, email: f.email, telefone: f.telefone, contato_nome: f.contato_nome, endereco: f.endereco, numero: f.numero, complemento: f.complemento, bairro: f.bairro, cidade: f.cidade, estado: f.estado, cep: f.cep, categoria: f.categoria, observacoes: f.observacoes, ativo: f.ativo, created_by: f.created_by }); setModalOpen(true) }}
                            className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Editar fornecedor"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(f)}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Excluir fornecedor"
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editando ? 'Editar Fornecedor' : 'Novo Fornecedor'} size="lg"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)} disabled={salvando}>Cancelar</Button><Button variant="primary" onClick={handleSave} loading={salvando}>{editando ? 'Salvar' : 'Cadastrar'}</Button></>}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nome *" value={form.nome} onChange={(e) => setField('nome', e.target.value)} className="sm:col-span-2" />
          <Input label="Razão Social" value={form.razao_social ?? ''} onChange={(e) => setField('razao_social', e.target.value || null)} className="sm:col-span-2" />
          <Input label="CNPJ" value={form.cnpj ?? ''} onChange={(e) => setField('cnpj', e.target.value || null)} />
          <Input label="CPF" value={form.cpf ?? ''} onChange={(e) => setField('cpf', e.target.value || null)} />
          <Input label="Telefone" value={form.telefone ?? ''} onChange={(e) => setField('telefone', e.target.value || null)} />
          <Input label="Email" type="email" value={form.email ?? ''} onChange={(e) => setField('email', e.target.value || null)} />
          <Input label="Contato" value={form.contato_nome ?? ''} onChange={(e) => setField('contato_nome', e.target.value || null)} />
          <Input label="Categoria" value={form.categoria ?? ''} onChange={(e) => setField('categoria', e.target.value || null)} />
          <Textarea label="Observações" value={form.observacoes ?? ''} onChange={(e) => setField('observacoes', e.target.value || null)} className="sm:col-span-2" />
        </div>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={handleDelete}
        title="Remover fornecedor" description={`Deseja remover "${confirmDelete?.nome}"?`} confirmLabel="Remover" loading={deletando} />
    </div>
  )
}
