'use client'

import { useState, useEffect, useMemo } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Plus, Pencil, ToggleLeft, ToggleRight, ShieldCheck, User, LayoutGrid, KeyRound } from 'lucide-react'
import { useAlert } from '@/hooks/use-alert'
import { useAuth } from '@/context/auth-context'
import { supabase } from '@/lib/supabase'
import {
  PageHeader, Card, Button, SearchInput, Spinner, EmptyState,
  Modal, Input, Select, ConfirmDialog, Badge, type BadgeVariant,
} from '@/components/ui'
import { MaskedInput } from '@/components/forms/masked-input'
import { formatPhone } from '@/utils'
import { listarMetasMensais, upsertMetaMensal } from '@/services/metas'
import { MENUS_VENDEDOR_CONFIG, VENDEDOR_DEFAULT_MENUS } from '@/lib/menus-config'
import type { Profile, UserRole } from '@/types'

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  caixa: 'Caixa',
  visualizador: 'Visualizador',
}

const ROLE_VARIANT: Record<UserRole, BadgeVariant> = {
  admin: 'gold',
  vendedor: 'success',
  caixa: 'warning',
  visualizador: 'gray',
}

interface VendedorForm {
  nome: string
  email: string
  cpf: string
  telefone: string
  role: UserRole
  comissao_percentual: string
  menus_permitidos: string[] | null
  meta_mes: string
}

const MES_ATUAL = format(new Date(), 'yyyy-MM-01')

const EMPTY_FORM: VendedorForm = {
  nome: '', email: '', cpf: '', telefone: '',
  role: 'vendedor', comissao_percentual: '0', menus_permitidos: null, meta_mes: '',
}

const MENUS_POR_SECAO = MENUS_VENDEDOR_CONFIG.reduce<Record<string, typeof MENUS_VENDEDOR_CONFIG>>(
  (acc, menu) => {
    if (!acc[menu.section]) acc[menu.section] = []
    acc[menu.section].push(menu)
    return acc
  },
  {}
)

export default function VendedoresPage() {
  const { user, sendPasswordResetEmail } = useAuth()
  const alert = useAlert()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Profile | null>(null)
  const [form, setForm] = useState<VendedorForm>(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)
  const [confirmToggle, setConfirmToggle] = useState<Profile | null>(null)
  const [toggling, setToggling] = useState(false)
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [enviandoReset, setEnviandoReset] = useState<string | null>(null)

  async function loadProfiles() {
    const { data, error } = await supabase.from('profiles').select('*').order('nome')
    if (error) {
      alert.error('Erro', 'Erro ao carregar equipe.')
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

  function handleRoleChange(novoRole: UserRole) {
    setForm((prev) => ({
      ...prev,
      role: novoRole,
      menus_permitidos: novoRole === 'vendedor'
        ? (prev.menus_permitidos ?? VENDEDOR_DEFAULT_MENUS)
        : null,
    }))
  }

  function toggleMenu(key: string) {
    setForm((prev) => {
      const current = prev.menus_permitidos ?? VENDEDOR_DEFAULT_MENUS
      const next = current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key]
      return { ...prev, menus_permitidos: next }
    })
  }

  function openCreate() {
    setEditando(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  async function openEdit(p: Profile) {
    setEditando(p)
    setForm({
      nome: p.nome,
      email: p.email,
      cpf: p.cpf ?? '',
      telefone: p.telefone ?? '',
      role: p.role,
      comissao_percentual: String(p.comissao_percentual ?? 0),
      menus_permitidos: p.menus_permitidos ?? null,
      meta_mes: '',
    })
    setModalOpen(true)

    if (p.role === 'vendedor') {
      setLoadingMeta(true)
      const { data: metas } = await listarMetasMensais(MES_ATUAL)
      const meta = metas?.find((m) => m.vendedor_id === p.id)
      if (meta) setForm((prev) => ({ ...prev, meta_mes: String(meta.valor_meta) }))
      setLoadingMeta(false)
    }
  }

  async function handleSave() {
    if (!form.nome.trim()) { alert.error('Atenção', 'Nome é obrigatório.'); return }
    if (!form.email.trim()) { alert.error('Atenção', 'E-mail é obrigatório.'); return }

    setSalvando(true)

    const comissao = parseFloat(form.comissao_percentual.replace(',', '.')) || 0

    if (editando) {
      const { error } = await supabase
        .from('profiles')
        .update({
          nome: form.nome.trim(),
          cpf: form.cpf.trim() || null,
          telefone: form.telefone.trim() || null,
          role: form.role,
          comissao_percentual: comissao,
          menus_permitidos: form.role === 'vendedor' ? form.menus_permitidos : null,
        })
        .eq('id', editando.id)

      if (error) {
        alert.error('Erro', `Erro ao atualizar: ${error.message}`)
        setSalvando(false)
        return
      }

      if (form.role === 'vendedor' && form.meta_mes.trim() && user) {
        const valorMeta = parseFloat(form.meta_mes.replace(',', '.')) || 0
        if (valorMeta > 0) await upsertMetaMensal(MES_ATUAL, editando.id, valorMeta, user.id)
      }

      setProfiles((prev) => prev.map((p) =>
        p.id === editando.id
          ? {
              ...p,
              nome: form.nome.trim(),
              cpf: form.cpf.trim() || null,
              telefone: form.telefone.trim() || null,
              role: form.role,
              comissao_percentual: comissao,
              menus_permitidos: form.role === 'vendedor' ? form.menus_permitidos : null,
            }
          : p
      ))
      alert.success('Perfil Atualizado!', 'As informações foram salvas com sucesso.', {
        onConfirm: () => setModalOpen(false),
      })
    } else {
      // Senha descartável e aleatória: o admin nunca precisa criar/comunicar uma senha —
      // o vendedor define a própria em seguida pelo link de redefinição enviado por e-mail.
      const senhaTemporaria = crypto.randomUUID() + crypto.randomUUID()

      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: senhaTemporaria,
        options: {
          data: { nome: form.nome.trim() },
          emailRedirectTo: window.location.origin,
        },
      })

      if (signUpError) {
        alert.error('Erro ao Criar Usuário', signUpError.message)
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
            menus_permitidos: form.role === 'vendedor' ? form.menus_permitidos : null,
          })

        if (profileError) {
          alert.error('Atenção', `Usuário criado, mas erro ao salvar perfil: ${profileError.message}`)
        } else {
          if (form.role === 'vendedor' && form.meta_mes.trim() && user) {
            const valorMeta = parseFloat(form.meta_mes.replace(',', '.')) || 0
            if (valorMeta > 0) await upsertMetaMensal(MES_ATUAL, authData.user.id, valorMeta, user.id)
          }
          await sendPasswordResetEmail(form.email.trim())
          await loadProfiles()
          alert.success('Cadastrado!', 'Um e-mail foi enviado para o novo usuário definir a senha de acesso.', {
            onConfirm: () => setModalOpen(false),
          })
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
      alert.error('Erro', 'Erro ao alterar status.')
    } else {
      setProfiles((prev) => prev.map((p) =>
        p.id === confirmToggle.id ? { ...p, ativo: !confirmToggle.ativo } : p
      ))
      setConfirmToggle(null)
      alert.success(
        confirmToggle.ativo ? 'Acesso Desativado' : 'Acesso Reativado',
        confirmToggle.ativo ? 'O usuário não poderá mais acessar o sistema.' : 'O usuário pode acessar o sistema novamente.',
      )
    }
    setToggling(false)
  }

  async function handleEnviarReset(p: Profile) {
    setEnviandoReset(p.id)
    const { error } = await sendPasswordResetEmail(p.email)
    setEnviandoReset(null)
    if (error) {
      alert.error('Erro', `Erro ao enviar o link: ${error}`)
    } else {
      alert.success('Link enviado!', `Um e-mail de redefinição de senha foi enviado para ${p.email}.`)
    }
  }

  const menusPermitidosAtual = form.menus_permitidos ?? VENDEDOR_DEFAULT_MENUS

  return (
    <div>
      <PageHeader
        title="Equipe de Vendas"
        subtitle="Gerenciamento de vendedores e administradores"
        actions={
          <Button variant="primary" leftIcon={<Plus size={14} />} onClick={openCreate}>
            Novo Membro
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
            imageSrc="/images/Team goals-rafiki.svg"
            title="Nenhum membro encontrado"
            description={search ? 'Tente outro termo.' : 'Cadastre o primeiro membro da equipe.'}
            action={!search && (
              <Button variant="primary" size="sm" leftIcon={<Plus size={12} />} onClick={openCreate}>
                Novo Membro
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
                    <Badge variant={ROLE_VARIANT[p.role]}>{ROLE_LABEL[p.role]}</Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gold-50">
                    <Button size="sm" variant="secondary" leftIcon={<Pencil size={12} />} onClick={() => void openEdit(p)}>
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      leftIcon={<KeyRound size={12} />}
                      loading={enviandoReset === p.id}
                      onClick={() => void handleEnviarReset(p)}
                    >
                      Redefinir senha
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
                    <th className="px-5 py-3 w-28" />
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
                            onClick={() => void openEdit(p)}
                            className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Editar"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleEnviarReset(p)}
                            disabled={enviandoReset === p.id}
                            className="p-1.5 rounded-lg text-gold-500 hover:text-gold-700 hover:bg-gold-50 transition-colors disabled:opacity-50"
                            title="Enviar link de redefinição de senha"
                          >
                            {enviandoReset === p.id ? <Spinner size={14} /> : <KeyRound size={14} />}
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
        title={editando ? 'Editar Membro' : 'Novo Membro'}
        size="md"
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
            <p className="text-xs text-dark-300 -mt-2">
              O acesso é liberado por e-mail: assim que cadastrar, enviamos um link para o
              próprio usuário definir a senha.
            </p>
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
            onChange={(e) => handleRoleChange(e.target.value as UserRole)}
          >
            <option value="vendedor">Vendedor</option>
            <option value="admin">Administrador</option>
            <option value="caixa">Caixa</option>
            <option value="visualizador">Visualizador</option>
          </Select>

          {form.role === 'vendedor' && (
            <Input
              label="Comissão (%)"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={form.comissao_percentual}
              onChange={(e) => setField('comissao_percentual', e.target.value)}
              hint="Usada no cálculo de comissão do CRM."
            />
          )}

          {form.role === 'vendedor' && (
            <Input
              label={`Meta do mês — ${format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}`}
              type="number"
              step="0.01"
              min="0"
              value={form.meta_mes}
              onChange={(e) => setField('meta_mes', e.target.value)}
              placeholder="Ex: 5000.00"
              hint={loadingMeta ? 'Carregando meta atual...' : 'Deixe em branco para não definir meta mensal.'}
            />
          )}

          {form.role === 'vendedor' && (
            <div>
              <p className="text-xs font-medium text-dark-600 mb-2 flex items-center gap-1.5">
                <LayoutGrid size={13} className="text-gold-500" />
                Menus disponíveis para este vendedor
              </p>
              <div className="border border-gold-100 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                {Object.entries(MENUS_POR_SECAO).map(([secao, menus]) => (
                  <div key={secao} className="px-3 py-2 border-b border-gold-50 last:border-0">
                    <p className="text-[10px] uppercase tracking-[1px] text-dark-400 font-semibold mb-2">{secao}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {menus.map((menu) => (
                        <label key={menu.key} className="flex items-center gap-2 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={menusPermitidosAtual.includes(menu.key)}
                            onChange={() => toggleMenu(menu.key)}
                            className="w-3.5 h-3.5 accent-gold-500 cursor-pointer flex-shrink-0"
                          />
                          <span className="text-xs text-dark-600 group-hover:text-dark-800 transition-colors leading-tight">
                            {menu.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-dark-300 mt-1.5">
                Sempre bloqueados: Caixa & Financeiro, Contas a Pagar, Equipe de Vendas.
              </p>
            </div>
          )}
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
