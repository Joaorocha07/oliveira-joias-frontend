'use client'

import { useState } from 'react'
import { User, Mail, Phone, Shield } from 'lucide-react'
import { useAlert } from '@/hooks/use-alert'
import { useAuth } from '@/context/auth-context'
import { PageHeader, Card, CardHeader, Button, Input, Divider } from '@/components/ui'
import { getInitials } from '@/utils'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  caixa: 'Caixa',
  visualizador: 'Visualizador',
}

export default function ConfiguracoesPage() {
  const { profile, updateProfile, user } = useAuth()
  const alert = useAlert()
  const [salvando, setSalvando] = useState(false)

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const nome = String(formData.get('nome') ?? '')
    const telefone = String(formData.get('telefone') ?? '')

    if (!nome.trim()) {
      alert.error('Atenção', 'Nome é obrigatório.')
      return
    }

    setSalvando(true)
    const { error } = await updateProfile({ nome, telefone: telefone || null })
    if (error) {
      alert.error('Erro', 'Erro ao salvar configurações.')
    } else {
      alert.success('Perfil Atualizado!', 'Suas informações foram salvas com sucesso.')
    }
    setSalvando(false)
  }

  const roleLabel = profile?.role ? (ROLE_LABEL[profile.role] ?? profile.role) : '—'

  return (
    <div>
      <PageHeader title="Configurações" subtitle="Gerencie seu perfil e preferências" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Card: Resumo do perfil */}
        <Card className="lg:col-span-1">
          <div className="flex flex-col items-center text-center py-2">
            <div className="w-20 h-20 rounded-full bg-gold-500 flex items-center justify-center text-2xl font-medium text-dark-800 shadow-sm mb-4">
              {profile ? getInitials(profile.nome) : '?'}
            </div>
            <p className="font-display text-lg font-medium text-dark-800 leading-tight">
              {profile?.nome || 'Usuário'}
            </p>
            <p className="text-xs text-dark-300 mt-1 break-all">{user?.email}</p>
            <span className="mt-3 text-xs bg-gold-100 text-gold-700 px-3 py-1 rounded-full font-medium capitalize">
              {roleLabel}
            </span>
          </div>

          <Divider className="my-4" />

          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5 text-sm text-dark-500 min-w-0">
              <User size={14} className="text-dark-300 flex-shrink-0" />
              <span className="truncate">{profile?.nome || '—'}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-dark-500 min-w-0">
              <Mail size={14} className="text-dark-300 flex-shrink-0" />
              <span className="truncate text-xs">{user?.email || '—'}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-dark-500">
              <Phone size={14} className="text-dark-300 flex-shrink-0" />
              <span>{profile?.telefone || '—'}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-dark-500">
              <Shield size={14} className="text-dark-300 flex-shrink-0" />
              <span>{roleLabel}</span>
            </div>
          </div>
        </Card>

        {/* Card: Editar perfil */}
        <Card className="lg:col-span-2">
          <CardHeader title="Editar Perfil" subtitle="Atualize suas informações pessoais" />

          <form key={profile?.id ?? 'empty'} onSubmit={handleSave}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nome completo *"
                name="nome"
                defaultValue={profile?.nome ?? ''}
                required
                className="sm:col-span-2"
              />
              <Input
                label="Email"
                type="email"
                value={user?.email ?? ''}
                disabled
                hint="O email não pode ser alterado aqui."
                className="sm:col-span-2"
              />
              <Input
                label="Telefone"
                name="telefone"
                defaultValue={profile?.telefone ?? ''}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="flex justify-end pt-5 mt-2 border-t border-gold-50">
              <Button type="submit" variant="primary" loading={salvando}>
                Salvar Alterações
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
