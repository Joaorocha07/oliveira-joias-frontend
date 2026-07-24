'use client'

import { SlidersHorizontal, X } from 'lucide-react'
import { Button, Card, Input, Select } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { PRODUTO_INTERESSE_LABEL, STATUS_QUALIFICACAO_LABEL } from '@/utils'
import type { OrigemCliente, ProdutoInteresse, StatusQualificacao } from '@/types'

interface VendedorOption {
  id: string
  nome: string
}

export interface CrmFiltros {
  cidade: string
  produtoInteresse: ProdutoInteresse | ''
  origemId: string
  statusQualificacao: StatusQualificacao | ''
  vendedorId: string
  valorMin: number | null
  valorMax: number | null
  dataCasamento: string
}

export const FILTROS_VAZIOS: CrmFiltros = {
  cidade: '',
  produtoInteresse: '',
  origemId: '',
  statusQualificacao: '',
  vendedorId: '',
  valorMin: null,
  valorMax: null,
  dataCasamento: '',
}

const PRODUTOS: ProdutoInteresse[] = [
  'alianca_prata', 'alianca_ouro', 'alianca_moeda_antiga', 'alianca_aco', 'semijoias', 'outro',
]

const STATUS_OPTS: StatusQualificacao[] = [
  'novo_lead', 'em_atendimento', 'fazendo_orcamento', 'interessado',
  'aguardando_resposta', 'follow_up_agendado', 'venda_concluida',
  'lead_perdido', 'nao_respondeu',
]

export function contarFiltrosAtivos(f: CrmFiltros): number {
  return Object.entries(f).filter(([, v]) => v !== '' && v !== null).length
}

interface Props {
  filtros: CrmFiltros
  onChange: (filtros: CrmFiltros) => void
  origens: OrigemCliente[]
  vendedores: VendedorOption[]
}

export function CrmFiltrosPanel({ filtros, onChange, origens, vendedores }: Props) {
  function setField<K extends keyof CrmFiltros>(key: K, value: CrmFiltros[K]) {
    onChange({ ...filtros, [key]: value })
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-dark-500 uppercase tracking-wide flex items-center gap-1.5">
          <SlidersHorizontal size={13} /> Filtros
        </p>
        <Button variant="ghost" size="sm" leftIcon={<X size={12} />} onClick={() => onChange(FILTROS_VAZIOS)}>
          Limpar
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Input
          label="Cidade"
          value={filtros.cidade}
          onChange={(e) => setField('cidade', e.target.value)}
        />
        <Select
          label="Produto"
          placeholder="Todos"
          value={filtros.produtoInteresse}
          onChange={(e) => setField('produtoInteresse', e.target.value as ProdutoInteresse | '')}
        >
          {PRODUTOS.map((p) => <option key={p} value={p}>{PRODUTO_INTERESSE_LABEL[p]}</option>)}
        </Select>
        <Select
          label="Origem"
          placeholder="Todas"
          value={filtros.origemId}
          onChange={(e) => setField('origemId', e.target.value)}
        >
          {origens.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </Select>
        <Select
          label="Status"
          placeholder="Todos"
          value={filtros.statusQualificacao}
          onChange={(e) => setField('statusQualificacao', e.target.value as StatusQualificacao | '')}
        >
          {STATUS_OPTS.map((s) => <option key={s} value={s}>{STATUS_QUALIFICACAO_LABEL[s]}</option>)}
        </Select>
        <Select
          label="Vendedor"
          placeholder="Todos"
          value={filtros.vendedorId}
          onChange={(e) => setField('vendedorId', e.target.value)}
        >
          {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
        </Select>
        <CurrencyInput
          label="Valor mínimo"
          value={filtros.valorMin ?? 0}
          onChange={(v) => setField('valorMin', v || null)}
        />
        <CurrencyInput
          label="Valor máximo"
          value={filtros.valorMax ?? 0}
          onChange={(v) => setField('valorMax', v || null)}
        />
        <Input
          label="Data do casamento"
          type="date"
          value={filtros.dataCasamento}
          onChange={(e) => setField('dataCasamento', e.target.value)}
        />
      </div>
    </Card>
  )
}
