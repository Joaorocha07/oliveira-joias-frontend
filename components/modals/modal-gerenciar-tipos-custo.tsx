'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { useAlert } from '@/hooks/use-alert'
import { useAuth } from '@/context/auth-context'
import { Modal, Button, Input, Spinner } from '@/components/ui'
import { listarCustoTipos, criarCustoTipo, desativarCustoTipo } from '@/services/custos'
import type { CustoTipo } from '@/types'

interface ModalGerenciarTiposCustoProps {
  open: boolean
  onClose: () => void
  onChange?: () => void
}

export function ModalGerenciarTiposCusto({ open, onClose, onChange }: ModalGerenciarTiposCustoProps) {
  const { user } = useAuth()
  const alert = useAlert()
  const [tipos, setTipos] = useState<CustoTipo[]>([])
  const [loading, setLoading] = useState(true)
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [removendo, setRemovendo] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const timeoutId = window.setTimeout(() => {
      setLoading(true)
      void listarCustoTipos().then(({ data, error }) => {
        if (error) alert.error('Erro', error)
        setTipos(data)
        setLoading(false)
      })
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [open])

  async function handleAdd() {
    if (!user || !nome.trim()) return
    setSalvando(true)
    const { data, error } = await criarCustoTipo(nome, user.id)
    setSalvando(false)
    if (error || !data) {
      alert.error('Erro', error ?? 'Erro ao cadastrar tipo de custo.')
      return
    }
    setTipos((prev) => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)))
    setNome('')
    onChange?.()
  }

  async function handleRemove(id: string) {
    setRemovendo(id)
    const { error } = await desativarCustoTipo(id)
    setRemovendo(null)
    if (error) {
      alert.error('Erro', error)
      return
    }
    setTipos((prev) => prev.filter((t) => t.id !== id))
    onChange?.()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tipos de Custo"
      size="sm"
      footer={<Button variant="secondary" onClick={onClose}>Fechar</Button>}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-end gap-2">
          <Input
            label="Novo tipo"
            placeholder="Ex: Cravação"
            value={nome}
            wrapperClassName="flex-1"
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAdd() } }}
          />
          <Button variant="primary" leftIcon={<Plus size={14} />} onClick={handleAdd} loading={salvando} disabled={!nome.trim()}>
            Adicionar
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-6"><Spinner size={20} /></div>
        ) : tipos.length === 0 ? (
          <p className="py-4 text-center text-sm text-dark-400">Nenhum tipo cadastrado.</p>
        ) : (
          <div className="flex flex-col divide-y divide-gold-50 rounded-xl border border-gold-100">
            {tipos.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-3 py-2 text-sm text-dark-700">
                {t.nome}
                <Button
                  variant="danger-ghost"
                  size="icon"
                  loading={removendo === t.id}
                  onClick={() => void handleRemove(t.id)}
                  aria-label={`Remover ${t.nome}`}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-dark-300">
          Remover um tipo não altera os custos já lançados com ele.
        </p>
      </div>
    </Modal>
  )
}
