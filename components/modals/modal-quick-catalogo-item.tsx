'use client'

import { useState } from 'react'
import { useAlert } from '@/hooks/use-alert'
import { useAuth } from '@/context/auth-context'
import { Modal, Button, Input } from '@/components/ui'

interface CatalogoItem {
  id: string
  nome: string
}

interface Props<T extends CatalogoItem> {
  open: boolean
  title: string
  label: string
  placeholder: string
  onClose: () => void
  onCreate: (nome: string, userId: string) => Promise<{ data: T | null; error: string | null }>
  onSuccess: (item: T) => void
}

export function ModalQuickCatalogoItem<T extends CatalogoItem>({
  open,
  title,
  label,
  placeholder,
  onClose,
  onCreate,
  onSuccess,
}: Props<T>) {
  const { user } = useAuth()
  const alert = useAlert()
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function handleSave() {
    if (!nome.trim() || !user) {
      alert.error('Atenção', `Informe o nome do ${label}.`)
      return
    }
    setSalvando(true)
    const { data, error } = await onCreate(nome.trim(), user.id)

    if (error || !data) {
      alert.error('Erro', `Não foi possível cadastrar o ${label}.`)
    } else {
      alert.success('Cadastrado!', `${title.replace('Novo ', '').replace('Nova ', '')} cadastrado com sucesso.`, {
        onConfirm: () => { onSuccess(data); setNome(''); onClose() },
      })
    }
    setSalvando(false)
  }

  function handleClose() {
    setNome('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
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
      <Input
        label="Nome *"
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder={placeholder}
      />
    </Modal>
  )
}
