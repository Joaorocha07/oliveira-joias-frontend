'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Modal, Button, Input } from '@/components/ui'
import { cn } from '@/lib/cn'
import { salvarArosCatalogo, type AroEstoque, type ProdutoCatalogo } from '@/services/catalogo'

const ARO_MIN = 1
const ARO_MAX = 40

// Configura os aros que o site oferece para o produto e o estoque de cada um.
// Estoque 0 = aparece riscado no site. Sem aros = o site não pede numeração.
export function ModalArosProduto({
  produto,
  onClose,
  onSaved,
}: {
  produto: ProdutoCatalogo
  onClose: () => void
  onSaved: (aros: AroEstoque[], arosPar: boolean) => void
}) {
  const [aros, setAros] = useState<AroEstoque[]>(() => [...(produto.aros ?? [])].sort((a, b) => a.aro - b.aro))
  const [arosPar, setArosPar] = useState(produto.aros_par ?? true)
  const [de, setDe] = useState('10')
  const [ate, setAte] = useState('30')
  const [estoqueInicial, setEstoqueInicial] = useState('1')
  const [novoAro, setNovoAro] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const disponiveis = aros.filter((a) => a.estoque > 0).length

  function inteiro(v: string) {
    const n = parseInt(v, 10)
    return Number.isFinite(n) ? n : NaN
  }

  function gerarFaixa() {
    setErro(null)
    const inicio = inteiro(de)
    const fim = inteiro(ate)
    const estoque = Math.max(0, inteiro(estoqueInicial) || 0)
    if (!(inicio >= ARO_MIN && fim <= ARO_MAX && inicio <= fim)) {
      setErro(`Informe uma faixa entre ${ARO_MIN} e ${ARO_MAX}.`)
      return
    }
    setAros((prev) => {
      const mapa = new Map(prev.map((a) => [a.aro, a]))
      for (let aro = inicio; aro <= fim; aro++) if (!mapa.has(aro)) mapa.set(aro, { aro, estoque })
      return [...mapa.values()].sort((a, b) => a.aro - b.aro)
    })
  }

  function adicionarAro() {
    setErro(null)
    const aro = inteiro(novoAro)
    if (!(aro >= ARO_MIN && aro <= ARO_MAX)) {
      setErro(`O aro precisa estar entre ${ARO_MIN} e ${ARO_MAX}.`)
      return
    }
    if (aros.some((a) => a.aro === aro)) {
      setErro(`O aro ${aro} já está na lista.`)
      return
    }
    setAros((prev) => [...prev, { aro, estoque: Math.max(0, inteiro(estoqueInicial) || 0) }].sort((a, b) => a.aro - b.aro))
    setNovoAro('')
  }

  function alterarEstoque(aro: number, valor: string) {
    const estoque = Math.min(9999, Math.max(0, inteiro(valor) || 0))
    setAros((prev) => prev.map((a) => (a.aro === aro ? { ...a, estoque } : a)))
  }

  async function salvar() {
    setSalvando(true)
    setErro(null)
    const { error } = await salvarArosCatalogo(produto.id, arosPar, aros)
    setSalvando(false)
    if (error) { setErro(error); return }
    onSaved(aros, arosPar)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Aros — ${produto.nome}`}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button variant="primary" onClick={() => void salvar()} loading={salvando}>Salvar aros</Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-dark-500">
          Os aros aparecem para o cliente na página do produto no site (oliveirajoias.com). Aro com estoque{' '}
          <strong>0</strong> aparece riscado. Sem nenhum aro na lista, o site não pede a numeração.
        </p>

        <label className="flex items-start gap-3 rounded-xl border border-gold-100 p-3 cursor-pointer">
          <input
            type="checkbox"
            checked={arosPar}
            onChange={(e) => setArosPar(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-gold-500"
          />
          <span className="text-sm">
            <span className="font-medium text-dark-700">Vendido em par</span>
            <span className="block text-xs text-dark-400">
              O cliente escolhe 2 aros (um para cada aliança). Desmarcado: escolhe só 1 aro.
            </span>
          </span>
        </label>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
          <Input label="Do aro" type="number" min={ARO_MIN} max={ARO_MAX} value={de} onChange={(e) => setDe(e.target.value)} />
          <Input label="Até o aro" type="number" min={ARO_MIN} max={ARO_MAX} value={ate} onChange={(e) => setAte(e.target.value)} />
          <Input label="Estoque de cada" type="number" min={0} value={estoqueInicial} onChange={(e) => setEstoqueInicial(e.target.value)} />
          <Button variant="secondary" onClick={gerarFaixa}>Gerar faixa</Button>
        </div>

        <div className="flex gap-2 items-end">
          <Input
            label="Adicionar um aro"
            type="number"
            min={ARO_MIN}
            max={ARO_MAX}
            value={novoAro}
            onChange={(e) => setNovoAro(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') adicionarAro() }}
            placeholder="Ex.: 22"
            wrapperClassName="flex-1"
          />
          <Button variant="secondary" leftIcon={<Plus size={14} />} onClick={adicionarAro}>Adicionar</Button>
        </div>

        {erro && <p className="text-sm text-red-600" role="alert">{erro}</p>}

        {aros.length === 0 ? (
          <p className="rounded-xl bg-cream-50 py-6 text-center text-sm text-dark-300">
            Nenhum aro configurado — o site não mostra a seleção de aro para este produto.
          </p>
        ) : (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="label-base">Estoque por aro</span>
              <span className="text-xs text-dark-400">
                {disponiveis} de {aros.length} disponíveis ·{' '}
                <button type="button" onClick={() => setAros([])} className="text-red-600 hover:underline">
                  remover todos
                </button>
              </span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {aros.map((a) => (
                <div
                  key={a.aro}
                  className={cn(
                    'relative rounded-lg border p-2 text-center transition-colors',
                    a.estoque > 0 ? 'border-gold-200 bg-white dark:bg-transparent' : 'border-dashed border-dark-100 bg-cream-50/60',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setAros((prev) => prev.filter((x) => x.aro !== a.aro))}
                    className="absolute right-1 top-1 text-dark-300 hover:text-red-600"
                    aria-label={`Remover aro ${a.aro}`}
                  >
                    <X size={12} />
                  </button>
                  <p className={cn('text-sm font-semibold', a.estoque > 0 ? 'text-dark-700' : 'text-dark-300 line-through')}>
                    {a.aro}
                  </p>
                  <input
                    type="number"
                    min={0}
                    value={a.estoque}
                    onChange={(e) => alterarEstoque(a.aro, e.target.value)}
                    className="input-base mt-1 !px-1 !py-1 text-center !text-xs"
                    aria-label={`Estoque do aro ${a.aro}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
