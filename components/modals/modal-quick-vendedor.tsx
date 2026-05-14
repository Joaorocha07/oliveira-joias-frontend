'use client'

import { useState } from 'react'
import { useAlert } from '@/hooks/use-alert'
import { supabase } from '@/lib/supabase'
import { Modal, Button, Input, Select } from '@/components/ui'
import { MaskedInput } from '@/components/forms/masked-input'
import type { UserRole } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (vendedor: { id: string; nome: string; role: UserRole }) => void
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
  nome: '',
  email: '',
  senha: '',
  cpf: '',
  telefone: '',
  role: 'vendedor',
}

export function ModalQuickVendedor({ open, onClose, onSuccess }: Props) {
  const alert = useAlert()
  const [form, setForm] = useState<VendedorForm>(EMPTY_FORM)
  const [salvando, setSalvando] = useState(false)

  function setField<K extends keyof VendedorForm>(key: K, value: VendedorForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleClose() {
    setForm(EMPTY_FORM)
    onClose()
  }

  async function handleSave() {
    if (!form.nome.trim()) { alert.error('Atenção', 'Nome é obrigatório.'); return }
    if (!form.email.trim()) { alert.error('Atenção', 'E-mail é obrigatório.'); return }
    if (!form.senha.trim()) { alert.error('Atenção', 'Senha é obrigatória.'); return }
    if (form.senha.length < 6) { alert.error('Atenção', 'Senha deve ter ao menos 6 caracteres.'); return }

    setSalvando(true)

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim(),
      password: form.senha,
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
      const payload = {
        id: authData.user.id,
        nome: form.nome.trim(),
        email: form.email.trim(),
        cpf: form.cpf.trim() || null,
        telefone: form.telefone.trim() || null,
        role: form.role,
        ativo: true,
      }
      const { error: profileError } = await supabase.from('profiles').upsert(payload)

      if (profileError) {
        alert.error('Atenção', `Usuário criado, mas erro ao salvar perfil: ${profileError.message}`)
      } else {
        const vendedor = { id: payload.id, nome: payload.nome, role: payload.role }
        alert.success('Vendedor Cadastrado!', 'O usuário foi cadastrado com sucesso.', {
          onConfirm: () => {
            onSuccess(vendedor)
            setForm(EMPTY_FORM)
            onClose()
          },
        })
      }
    }

    setSalvando(false)
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Novo Vendedor"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSave} loading={salvando}>
            Cadastrar
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
        />
        <Input
          label="Senha *"
          type="password"
          value={form.senha}
          onChange={(e) => setField('senha', e.target.value)}
          placeholder="Mínimo 6 caracteres"
          hint="O vendedor receberá um e-mail para confirmar o acesso."
        />
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
  )
}
