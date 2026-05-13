'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { Modal, Button, Input } from '@/components/ui'
import { MaskedInput } from '@/components/forms/masked-input'
import { useAuth } from '@/context/auth-context'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: (cliente: { id: string; nome: string; telefone: string | null }) => void
}

export function ModalQuickCliente({ open, onClose, onSuccess }: Props) {
  const { user } = useAuth()
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function handleSave() {
    if (!nome.trim()) {
      toast.error('Nome é obrigatório.')
      return
    }
    setSalvando(true)
    const { data, error } = await supabase
      .from('clientes')
      .insert([{
        nome: nome.trim(),
        telefone: telefone.trim() || null,
        ativo: true,
        created_by: user?.id ?? null,
      }])
      .select('id, nome, telefone')
      .single()

    if (error) {
      toast.error('Erro ao cadastrar cliente.')
    } else if (data) {
      toast.success('Cliente cadastrado.')
      onSuccess({ id: data.id as string, nome: data.nome as string, telefone: data.telefone as string | null })
      setNome('')
      setTelefone('')
      onClose()
    }
    setSalvando(false)
  }

  function handleClose() {
    setNome('')
    setTelefone('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Novo Cliente"
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
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome completo"
        />
        <MaskedInput
          mask="phone"
          label="Telefone"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          placeholder="(00) 00000-0000"
        />
      </div>
    </Modal>
  )
}
