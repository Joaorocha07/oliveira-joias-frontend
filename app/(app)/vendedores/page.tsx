'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Users, Pencil, ToggleLeft, ToggleRight, ShieldCheck, User } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, Card, Button, SearchInput, Spinner, EmptyState,
  Modal, Input, Select, ConfirmDialog, Badge,
} from '@/components/ui'
import { MaskedInput } from '@/components/forms/masked-input'
import { formatPhone } from '@/utils'
import type { Profile, UserRole } from '@/types'

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  caixa: 'Caixa',
  visualizador: 'Visualizador',
}

const ROLE_VARIANT: Record<UserRole, 'gold' | 'green' | 'blue' | 'default'> = {
  admin: 'gold',
  vendedor: 'green',
  caixa: 'blue',
  visualizador: 'default',
}

interface VendedorForm {
  nome: string
  email: string
  senha: string
  cpf: string
  telefone: string
  role: UserRole
}

const EMPTY_FORM: VendedorForm = {
  nome: '', email: '', senha: '', cpf: '', telefone: '', role: 'vendedor',
}

export default function VendedoresPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Profile | null>(null)
  const [form, setForm] = useState<VendedorForm>(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)
  const [confirmToggle, setConfirmToggle] = useState<Profile | null>(null)
  const [toggling, setToggling] = useState(false)

  async function loadProfiles() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('nome')
    if (error) {
      toast.error('Erro ao carregar equipe.')
    } else {
      setProfiles((data as Profile[]) ?? [])
    }
    setLoading(false)
  }

  useEffect(() => {
    const id = window.setTimeout(() => void loadProfiles(), 0)
    return () => window.clearTimeout(id)
  }, [])

  const filtered = useMemo(() => {
    if (!search) return profiles
    const q = search.toLowerCase()
    return profiles.filter((p) =>
      p.nome.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.telefone?.includes(q)
    )
  }, [profiles, search])

  function setField<K extends keyof VendedorForm>(key: K, value: VendedorForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function openCreate() {
    setEditando(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function openEdit(p: Profile) {
    setEditando(p)
    setForm({
      nome: p.nome,
      email: p.email,
      senha: '',
      cpf: p.cpf ?? '',
      telefone: p.telefone ?? '',
      role: p.role,
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error('Nome é obrigatório.'); return }
    if (!form.email.trim()) { toast.error('E-mail é obrigatório.'); return }
    if (!editando && !form.senha.trim()) { toast.error('Senha é obrigatória.'); return }
    if (!editando && form.senha.length < 6) { toast.error('Senha deve ter ao menos 6 caracteres.'); return }

    setSalvando(true)

    if (editando) {
      const { error } = await supabase
        .from('profiles')
        .update({
          nome: form.nome.trim(),
          cpf: form.cpf.trim() || null,
          telefone: form.telefone.trim() || null,
          role: form.role,
        })
        .eq('id', editando.id)

      if (error) {
        toast.error(`Erro ao atualizar: ${error.message}`)
      } else {
        toast.success('Perfil atualizado.')
        setProfiles((prev) => prev.map((p) =>
          p.id === editando.id
            ? { ...p, nome: form.nome.trim(), cpf: form.cpf.trim() || null, telefone: form.telefone.trim() || null, role: form.role }
            : p
        ))
        setModalOpen(false)
      }
    } else {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.senha,
        options: {
          data: { nome: form.nome.trim() },
          emailRedirectTo: window.location.origin,
        },
      })

      if (signUpError) {
        toast.error(`Erro ao criar usuário: ${signUpError.message}`)
        setSalvando(false)
        return
      }

      if (authData.user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            nome: form.nome.trim(),
            email: form.email.trim(),
            cpf: form.cpf.trim() || null,
            telefone: form.telefone.trim() || null,
            role: form.role,
            ativo: true,
          })

        if (profileError) {
          toast.error(`Usuário criado, mas erro ao salvar perfil: ${profileError.message}`)
        } else {
          toast.success('Vendedor cadastrado. Um e-mail de confirmação foi enviado.')
          await loadProfiles()
          setModalOpen(false)
        }
      }
    }

    setSalvando(false)
  }

  async function handleToggleAtivo() {
    if (!confirmToggle) return
    setToggling(true)
    const { error } = await supabase
      .from('profiles')
      .update({ ativo: !confirmToggle.ativo })
      .eq('id', confirmToggle.id)

    if (error) {
      toast.error('Erro ao alterar status.')
    } else {
      toast.success(confirmToggle.ativo ? 'Acesso desativado.' : 'Acesso reativado.')
      setProfiles((prev) => prev.map((p) =>
        p.id === confirmToggle.id ? { ...p, ativo: !confirmToggle.ativo } : p
      ))
      setConfirmToggle(null)
    }
    setToggling(false)
  }

  return (
    <div>
      <PageHeader
        title="Equipe de Vendas"
        subtitle="Gerenciamento de vendedores e administradores"
        actions={
          <Button variant="primary" leftIcon={<Plus size={14} />} onClick={openCreate}>
            Novo Vendedor
          </Button>
        }
      />

      <Card padding="none">
        <div className="p-4 border-b border-gold-100">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nome, e-mail ou telefone..."
            className="max-w-sm"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size={24} /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Users size={24} />}
            title="Nenhum membro encontrado"
            description={search ? 'Tente outro termo.' : 'Cadastre o primeiro vendedor.'}
            action={!search && (
              <Button variant="primary" size="sm" leftIcon={<Plus size={12} />} onClick={openCreate}>
                Novo Vendedor
              </Button>
            )}
          />
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden divide-y divide-gold-50">
              {filtered.map((p) => (
                <div key={p.id} className="p-4 hover:bg-cream-50/30 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium text-dark-700 text-sm truncate">{p.nome}</p>
                        {!p.ativo && <span className="text-xs text-red-500">(inativo)</span>}
                      </div>
                      <p className="text-xs text-dark-400 truncate">{p.email}</p>
                      {p.telefone && <p className="text-xs text-dark-300 mt-0.5">{formatPhone(p.telefone)}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Badge variant={ROLE_VARIANT[p.role]}>{ROLE_LABEL[p.role]}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gold-50">
                    <Button size="sm" variant="secondary" leftIcon={<Pencil size={12} />} onClick={() => openEdit(p)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant={p.ativo ? 'danger-ghost' : 'ghost'}
                      onClick={() => setConfirmToggle(p)}
                    >
                      {p.ativo ? 'Desativar' : 'Reativar'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gold-100 bg-cream-50/50">
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Nome</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">E-mail</th>
                    <th className="hidden md:table-cell text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Telefone</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Perfil</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-dark-300 uppercase tracking-wide">Status</th>
                    <th className="px-5 py-3 w-24" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-50">
                  {filtered.map((p) => (
                    <tr key={p.id} className={`hover:bg-cream-50/40 transition-colors ${!p.ativo ? 'opacity-60' : ''}`}>
                      <td className="px-5 py-3 font-medium text-dark-700">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gold-100 flex items-center justify-center flex-shrink-0">
                            {p.role === 'admin' ? <ShieldCheck size={13} className="text-gold-600" /> : <User size={13} className="text-dark-400" />}
                          </div>
                          <span className="truncate max-w-[160px]">{p.nome}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-dark-400 max-w-[200px]">
                        <span className="block truncate">{p.email}</span>
                      </td>
                      <td className="hidden md:table-cell px-5 py-3 text-dark-400">
                        {p.telefone ? formatPhone(p.telefone) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={ROLE_VARIANT[p.role]}>{ROLE_LABEL[p.role]}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        {p.ativo ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                            <ToggleRight size={14} /> Ativo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-500 text-xs font-medium">
                            <ToggleLeft size={14} /> Inativo
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => openEdit(p)}
                            className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmToggle(p)}
                            className={`p-1.5 rounded-lg transition-colors ${p.ativo ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-green-500 hover:text-green-700 hover:bg-green-50'}`}
                            title={p.ativo ? 'Desativar acesso' : 'Reativar acesso'}
                          >
                            {p.ativo ? <ToggleLeft size={14} /> : <ToggleRight size={14} />}
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

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editando ? 'Editar Vendedor' : 'Novo Vendedor'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)} disabled={salvando}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave} loading={salvando}>
              {editando ? 'Salvar' : 'Cadastrar'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Nome *"
            value={form.nome}
            onChange={(e) => setField('nome', e.target.value)}
            placeholder="Nome completo"
          />
          <Input
            label="E-mail *"
            type="email"
            value={form.email}
            onChange={(e) => setField('email', e.target.value)}
            placeholder="email@exemplo.com"
            disabled={!!editando}
            hint={editando ? 'O e-mail não pode ser alterado.' : undefined}
          />
          {!editando && (
            <Input
              label="Senha *"
              type="password"
              value={form.senha}
              onChange={(e) => setField('senha', e.target.value)}
              placeholder="Mínimo 6 caracteres"
              hint="O vendedor receberá um e-mail para confirmar o acesso."
            />
          )}
          <MaskedInput
            mask="cpf"
            label="CPF"
            value={form.cpf}
            onChange={(e) => setField('cpf', e.target.value)}
            placeholder="000.000.000-00"
          />
          <MaskedInput
            mask="phone"
            label="Telefone"
            value={form.telefone}
            onChange={(e) => setField('telefone', e.target.value)}
            placeholder="(00) 00000-0000"
          />
          <Select
            label="Perfil de acesso"
            value={form.role}
            onChange={(e) => setField('role', e.target.value as UserRole)}
          >
            <option value="vendedor">Vendedor</option>
            <option value="admin">Administrador</option>
            <option value="caixa">Caixa</option>
            <option value="visualizador">Visualizador</option>
          </Select>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        onConfirm={handleToggleAtivo}
        title={confirmToggle?.ativo ? 'Desativar acesso' : 'Reativar acesso'}
        description={
          confirmToggle?.ativo
            ? `Desativar o acesso de "${confirmToggle.nome}"? O usuário não conseguirá mais entrar no sistema.`
            : `Reativar o acesso de "${confirmToggle?.nome}"?`
        }
        confirmLabel={confirmToggle?.ativo ? 'Desativar' : 'Reativar'}
        variant={confirmToggle?.ativo ? 'danger' : 'warning'}
        loading={toggling}
      />
    </div>
  )
}
