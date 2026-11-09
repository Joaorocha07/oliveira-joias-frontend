'use client'

import { useState } from 'react'
import { Check, Pencil, Plus, X } from 'lucide-react'
import { useAlert } from '@/hooks/use-alert'
import { Modal, Button, Input } from '@/components/ui'
import { criarCategoriaLancamento, renomearCategoriaLancamento } from '@/services/categorias-lancamento'
import type { CategoriaLancamento } from '@/types'

interface ModalGerenciarCategoriasLancamentoProps {
  open: boolean
  onClose: () => void
  categorias: CategoriaLancamento[]
  onCriada: (categoria: CategoriaLancamento) => void
  onRenomeada: (categoria: CategoriaLancamento, nomeAnterior: string) => void
}

function normalizar(nome: string) {
  return nome.trim().toLocaleLowerCase('pt-BR')
}

export function ModalGerenciarCategoriasLancamento({
  open,
  onClose,
  categorias,
  onCriada,
  onRenomeada,
}: ModalGerenciarCategoriasLancamentoProps) {
  const alert = useAlert()
  const [novoNome, setNovoNome] = useState('')
  const [criando, setCriando] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nomeEditado, setNomeEditado] = useState('')
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  function nomeJaExiste(nome: string, ignorarId?: string) {
    return categorias.some((c) => c.id !== ignorarId && normalizar(c.nome) === normalizar(nome))
  }

  function handleClose() {
    setNovoNome('')
    setEditandoId(null)
    setNomeEditado('')
    onClose()
  }

  async function handleCriar() {
    if (!novoNome.trim() || criando) return
    if (nomeJaExiste(novoNome)) {
      alert.error('Atenção', 'Já existe uma categoria com esse nome.')
      return
    }
    setCriando(true)
    const { data, error } = await criarCategoriaLancamento(novoNome)
    setCriando(false)
    if (error || !data) {
      alert.error('Erro', error ?? 'Erro ao criar categoria.')
      return
    }
    setNovoNome('')
    onCriada(data)
  }

  function iniciarEdicao(categoria: CategoriaLancamento) {
    setEditandoId(categoria.id)
    setNomeEditado(categoria.nome)
  }

  async function handleSalvarEdicao(categoria: CategoriaLancamento) {
    if (!nomeEditado.trim() || salvandoEdicao) return
    if (nomeJaExiste(nomeEditado, categoria.id)) {
      alert.error('Atenção', 'Já existe uma categoria com esse nome.')
      return
    }
    setSalvandoEdicao(true)
    const { data, error } = await renomearCategoriaLancamento(categoria.id, nomeEditado)
    setSalvandoEdicao(false)
    if (error || !data) {
      alert.error('Erro', error ?? 'Erro ao renomear categoria.')
      return
    }
    setEditandoId(null)
    onRenomeada(data, categoria.nome)
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Categorias de Lançamento"
      size="sm"
      footer={<Button variant="secondary" onClick={handleClose}>Fechar</Button>}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-end gap-2">
          <Input
            label="Nova categoria"
            placeholder="Ex: Impostos"
            value={novoNome}
            wrapperClassName="flex-1"
            onChange={(e) => setNovoNome(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleCriar() } }}
          />
          <Button
            variant="primary"
            leftIcon={<Plus size={14} />}
            onClick={handleCriar}
            loading={criando}
            disabled={!novoNome.trim()}
          >
            Criar
          </Button>
        </div>

        {categorias.length === 0 ? (
          <p className="py-4 text-center text-sm text-dark-400">Nenhuma categoria cadastrada.</p>
        ) : (
          <div className="flex flex-col divide-y divide-gold-50 rounded-xl border border-gold-100">
            {categorias.map((categoria) => (
              <div key={categoria.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-dark-700">
                {editandoId === categoria.id ? (
                  <>
                    <Input
                      autoFocus
                      aria-label={`Novo nome de ${categoria.nome}`}
                      value={nomeEditado}
                      wrapperClassName="flex-1"
                      onChange={(e) => setNomeEditado(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); void handleSalvarEdicao(categoria) }
                        if (e.key === 'Escape') setEditandoId(null)
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      loading={salvandoEdicao}
                      disabled={!nomeEditado.trim()}
                      onClick={() => void handleSalvarEdicao(categoria)}
                      aria-label="Salvar nome"
                    >
                      <Check size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={salvandoEdicao}
                      onClick={() => setEditandoId(null)}
                      aria-label="Cancelar edição"
                    >
                      <X size={14} />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 truncate">{categoria.nome}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => iniciarEdicao(categoria)}
                      aria-label={`Editar ${categoria.nome}`}
                    >
                      <Pencil size={13} />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-dark-300">
          Ao renomear, os lançamentos já feitos com a categoria passam a usar o novo nome.
        </p>
      </div>
    </Modal>
  )
}
