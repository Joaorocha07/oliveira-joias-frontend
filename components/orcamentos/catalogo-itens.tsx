'use client'

import { useState, type FormEvent } from 'react'
import { useAlert } from '@/hooks/use-alert'
import { useAuth } from '@/context/auth-context'
import { Card, CardHeader, Button, Input, Spinner, EmptyState, ConfirmDialog } from '@/components/ui'

interface CatalogoItem {
  id: string
  nome: string
}

interface CatalogoItensProps<T extends CatalogoItem> {
  titulo: string
  subtitulo: string
  label: string
  placeholder: string
  itens: T[]
  loading: boolean
  onAdd: (nome: string, userId: string) => Promise<{ error: string | null }>
  onDelete: (id: string) => Promise<{ error: string | null }>
  onChanged: () => void
}

export function CatalogoItens<T extends CatalogoItem>({
  titulo,
  subtitulo,
  label,
  placeholder,
  itens,
  loading,
  onAdd,
  onDelete,
  onChanged,
}: CatalogoItensProps<T>) {
  const { user } = useAuth()
  const alert = useAlert()
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<T | null>(null)
  const [deletando, setDeletando] = useState(false)

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!nome.trim() || !user) return
    setSalvando(true)
    const { error } = await onAdd(nome.trim(), user.id)
    if (error) {
      alert.error('Erro', `Erro ao cadastrar ${label}.`)
    } else {
      setNome('')
      onChanged()
    }
    setSalvando(false)
  }

  async function handleDelete() {
    if (!confirmDelete) return
    setDeletando(true)
    const { error } = await onDelete(confirmDelete.id)
    if (error) {
      alert.error('Erro', `Erro ao remover ${label}.`)
    } else {
      onChanged()
    }
    setDeletando(false)
    setConfirmDelete(null)
  }

  return (
    <Card>
      <CardHeader title={titulo} subtitle={subtitulo} />

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 mb-5">
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder={placeholder}
          wrapperClassName="flex-1"
        />
        <Button type="submit" variant="primary" loading={salvando} disabled={!nome.trim()}>
          Adicionar
        </Button>
      </form>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner size={22} /></div>
      ) : itens.length === 0 ? (
        <EmptyState
          title={`Nenhum ${label} cadastrado`}
          description="Adicione itens para sugerir ao criar orçamentos."
        />
      ) : (
        <div className="divide-y divide-gold-50">
          {itens.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-3">
              <span className="text-sm text-dark-700">{item.nome}</span>
              <Button variant="danger-ghost" size="sm" onClick={() => setConfirmDelete(item)}>
                Remover
              </Button>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDelete}
        title={`Remover ${label}`}
        description={`Deseja remover "${confirmDelete?.nome}" do catálogo?`}
        confirmLabel="Remover"
        loading={deletando}
      />
    </Card>
  )
}
