'use client'

import { useEffect, useState } from 'react'
import { Download, Plus, RefreshCw, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Badge, Button, Input, Modal, Select, Spinner } from '@/components/ui'
import { CurrencyInput } from '@/components/forms/currency-input'
import { FORMAS_PAGAMENTO_FOLHA } from '@/components/folha/formas-pagamento'
import { useAuth } from '@/context/auth-context'
import { useAlert } from '@/hooks/use-alert'
import {
  adicionarItemFolha,
  buscarFolhaDetalhe,
  estornarPagamentoFolha,
  excluirFolha,
  mesLabel,
  pagarFolha,
  recalcularFolha,
  removerItemFolha,
} from '@/services/folha'
import { getOrcamentoConfiguracoes } from '@/services/orcamentos'
import { gerarHoleritePdf, nomeArquivoHolerite } from '@/utils/holerite-pdf'
import { FORMA_PAGAMENTO_LABEL, formatDate, formatMoney } from '@/utils'
import type { FolhaDetalhe, FolhaItemTipo, FormaPagamento } from '@/types'

interface ModalDetalheFolhaProps {
  folhaId: string | null
  cpf: string | null
  onClose: () => void
  onChanged: () => void
}

export function ModalDetalheFolha({ folhaId, ...props }: ModalDetalheFolhaProps) {
  if (!folhaId) return null
  return <DetalheFolha key={folhaId} folhaId={folhaId} {...props} />
}

function Linha({ label, sublabel, valor, negativo, onRemove }: {
  label: string
  sublabel?: string
  valor: number
  negativo?: boolean
  onRemove?: () => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-sm text-dark-700 truncate">{label}</p>
        {sublabel && <p className="text-xs text-dark-400">{sublabel}</p>}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-sm font-medium tabular-nums ${negativo ? 'text-[#C75B5B]' : 'text-dark-700'}`}>
          {negativo ? '− ' : ''}{formatMoney(valor)}
        </span>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-dark-300 hover:text-[#C75B5B]" aria-label="Remover">
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

function DetalheFolha({ folhaId, cpf, onClose, onChanged }: Omit<ModalDetalheFolhaProps, 'folhaId'> & { folhaId: string }) {
  const { user } = useAuth()
  const alert = useAlert()
  const [detalhe, setDetalhe] = useState<FolhaDetalhe | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [forma, setForma] = useState<string>(FORMAS_PAGAMENTO_FOLHA[0].value)
  const [novoTipo, setNovoTipo] = useState<FolhaItemTipo>('provento')
  const [novaDescricao, setNovaDescricao] = useState('')
  const [novoValor, setNovoValor] = useState(0)

  useEffect(() => {
    let cancelado = false
    // Abrir já recalcula: a comissão reflete as vendas lançadas até agora.
    recalcularFolha(folhaId).then(({ data, error }) => {
      if (cancelado) return
      setDetalhe(data)
      setErro(error)
    })
    return () => { cancelado = true }
  }, [folhaId])

  async function executar(acao: () => Promise<{ data?: FolhaDetalhe | null; error: string | null }>, sucesso?: string) {
    setOcupado(true)
    const { data, error } = await acao()
    if (!error && data === undefined) {
      const atualizado = await buscarFolhaDetalhe(folhaId)
      setDetalhe(atualizado.data)
    } else if (data) {
      setDetalhe(data)
    }
    setOcupado(false)
    // Toast em vez de alert: várias ações rodam dentro do onConfirm de um alert,
    // que se fecha logo depois e levaria junto um alert novo aberto aqui.
    if (error) { toast.error(error); return false }
    if (sucesso) toast.success(sucesso)
    onChanged()
    return true
  }

  async function handleAdicionarItem() {
    if (!novaDescricao.trim()) { alert.error('Campo obrigatório', 'Informe a descrição.'); return }
    if (novoValor <= 0) { alert.error('Campo obrigatório', 'Informe um valor maior que zero.'); return }
    if (!user?.id) return
    const ok = await executar(() => adicionarItemFolha(
      { folha_id: folhaId, tipo: novoTipo, descricao: novaDescricao.trim(), valor: novoValor },
      user.id,
    ))
    if (ok) { setNovaDescricao(''); setNovoValor(0) }
  }

  function handlePagar() {
    if (!detalhe || !user?.id) return
    const { folha } = detalhe
    alert.warning(
      'Confirmar pagamento?',
      folha.valor_liquido > 0
        ? `${formatMoney(folha.valor_liquido)} sairá do caixa como "Folha de pagamento".`
        : 'O líquido é zero ou negativo: a folha será marcada como paga sem lançamento no caixa.',
      {
        showCancel: true,
        confirmText: 'Pagar',
        cancelText: 'Voltar',
        onConfirm: () => { void executar(() => pagarFolha(folhaId, forma, user.id), 'Folha paga e lançada no caixa.') },
      },
    )
  }

  function handleEstornar() {
    if (!detalhe) return
    const { folha } = detalhe
    alert.warning('Estornar pagamento?', 'O lançamento no caixa será removido e a folha volta a ficar aberta.', {
      showCancel: true,
      confirmText: 'Estornar',
      cancelText: 'Voltar',
      onConfirm: () => { void executar(() => estornarPagamentoFolha(folha), 'Pagamento estornado.') },
    })
  }

  function handleExcluir() {
    if (!detalhe) return
    const { folha } = detalhe
    alert.warning('Excluir folha?', `A folha de ${folha.funcionario_nome} será removida. Os vales voltam a ficar pendentes.`, {
      showCancel: true,
      confirmText: 'Excluir',
      cancelText: 'Voltar',
      onConfirm: async () => {
        setOcupado(true)
        const { error } = await excluirFolha(folha)
        setOcupado(false)
        if (error) { toast.error(error); return }
        toast.success('Folha excluída.')
        onChanged()
        onClose()
      },
    })
  }

  async function handleHolerite() {
    if (!detalhe) return
    setOcupado(true)
    try {
      const { data: config } = await getOrcamentoConfiguracoes()
      const doc = await gerarHoleritePdf(detalhe, config, cpf)
      doc.save(nomeArquivoHolerite(detalhe))
    } catch (err) {
      alert.error('Erro ao gerar holerite', err instanceof Error ? err.message : 'Tente novamente.')
    } finally {
      setOcupado(false)
    }
  }

  const folha = detalhe?.folha
  const aberta = folha?.status === 'aberta'
  const proventos = detalhe?.itens.filter((i) => i.tipo === 'provento') ?? []
  const descontos = detalhe?.itens.filter((i) => i.tipo === 'desconto') ?? []

  return (
    <Modal
      open
      onClose={onClose}
      title={folha ? `Folha ${mesLabel(folha.mes)} — ${folha.funcionario_nome}` : 'Folha de pagamento'}
      size="lg"
      footer={folha && (
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {aberta ? (
              <Button variant="danger-ghost" size="sm" leftIcon={<Trash2 size={14} />} onClick={handleExcluir} disabled={ocupado}>
                Excluir
              </Button>
            ) : (
              <Button variant="danger-ghost" size="sm" onClick={handleEstornar} disabled={ocupado}>
                Estornar pagamento
              </Button>
            )}
            <Button variant="ghost" size="sm" leftIcon={<Download size={14} />} onClick={handleHolerite} disabled={ocupado}>
              Holerite PDF
            </Button>
          </div>
          {aberta && (
            <div className="flex items-center gap-2">
              <Select value={forma} onChange={(e) => setForma(e.target.value)} aria-label="Forma de pagamento">
                {FORMAS_PAGAMENTO_FOLHA.map((fp) => <option key={fp.value} value={fp.value}>{fp.label}</option>)}
              </Select>
              <Button variant="primary" onClick={handlePagar} loading={ocupado}>Pagar</Button>
            </div>
          )}
        </div>
      )}
    >
      {!detalhe && !erro && (
        <div className="flex h-40 items-center justify-center"><Spinner size={28} /></div>
      )}
      {erro && !detalhe && (
        <p className="py-10 text-center text-sm text-[#C75B5B]">{erro}</p>
      )}
      {detalhe && folha && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={aberta ? 'warning' : 'success'}>{aberta ? 'Aberta' : 'Paga'}</Badge>
            {folha.cargo && <span className="text-xs text-dark-400">{folha.cargo}</span>}
            {!aberta && folha.data_pagamento && (
              <span className="text-xs text-dark-400">
                Paga em {formatDate(folha.data_pagamento)}
                {folha.forma_pagamento && ` · ${FORMA_PAGAMENTO_LABEL[folha.forma_pagamento as FormaPagamento] ?? folha.forma_pagamento}`}
              </span>
            )}
            {aberta && (
              <button
                type="button"
                onClick={() => void executar(() => recalcularFolha(folhaId), 'Folha recalculada.')}
                disabled={ocupado}
                className="ml-auto flex items-center gap-1 text-xs text-gold-600 hover:text-gold-700 disabled:opacity-50"
              >
                <RefreshCw size={12} className={ocupado ? 'animate-spin' : ''} /> Recalcular
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-dark-400 mb-1">Proventos</p>
              <div className="divide-y divide-gold-50">
                <Linha label="Salário base" valor={folha.salario_base} />
                <Linha
                  label="Comissão sobre vendas"
                  sublabel={`${folha.comissao_percentual}% de ${formatMoney(folha.base_comissao)}`}
                  valor={folha.valor_comissao}
                />
                {proventos.map((i) => (
                  <Linha
                    key={i.id}
                    label={i.descricao}
                    valor={i.valor}
                    onRemove={aberta ? () => void executar(() => removerItemFolha(i)) : undefined}
                  />
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-dark-400 mb-1">Descontos</p>
              <div className="divide-y divide-gold-50">
                {descontos.length === 0 && detalhe.vales.length === 0 && (
                  <p className="py-2 text-sm text-dark-300">Nenhum desconto.</p>
                )}
                {descontos.map((i) => (
                  <Linha
                    key={i.id}
                    label={i.descricao}
                    valor={i.valor}
                    negativo
                    onRemove={aberta ? () => void executar(() => removerItemFolha(i)) : undefined}
                  />
                ))}
                {detalhe.vales.map((v) => (
                  <Linha
                    key={v.id}
                    label={`Vale${v.descricao ? ` — ${v.descricao}` : ''}`}
                    sublabel={`${formatDate(v.data_vale)} · remova na aba Vales`}
                    valor={v.valor}
                    negativo
                  />
                ))}
              </div>
            </div>
          </div>

          {aberta && (
            <div className="rounded-xl border border-gold-100 bg-cream-50 p-3">
              <p className="text-xs font-semibold text-dark-500 mb-2">Adicionar provento ou desconto</p>
              <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr_140px_auto] gap-2 items-end">
                <Select value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as FolhaItemTipo)} aria-label="Tipo">
                  <option value="provento">Provento</option>
                  <option value="desconto">Desconto</option>
                </Select>
                <Input
                  placeholder={novoTipo === 'provento' ? 'Ex: Bônus de meta, hora extra' : 'Ex: Falta, quebra de caixa'}
                  value={novaDescricao}
                  onChange={(e) => setNovaDescricao(e.target.value)}
                  aria-label="Descrição"
                />
                <CurrencyInput value={novoValor} onChange={setNovoValor} aria-label="Valor" placeholder="0,00" />
                <Button variant="secondary" size="md" leftIcon={<Plus size={14} />} onClick={handleAdicionarItem} disabled={ocupado}>
                  Adicionar
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 rounded-xl border border-gold-100 p-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-dark-400">Proventos</p>
              <p className="text-base font-semibold text-dark-700 tabular-nums">{formatMoney(folha.total_proventos)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider text-dark-400">Descontos</p>
              <p className="text-base font-semibold text-[#C75B5B] tabular-nums">{formatMoney(folha.total_descontos)}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-dark-400">Líquido</p>
              <p className={`text-xl font-bold tabular-nums ${folha.valor_liquido < 0 ? 'text-[#C75B5B]' : 'text-[#5B8C5B]'}`}>
                {formatMoney(folha.valor_liquido)}
              </p>
            </div>
          </div>
          {folha.valor_liquido < 0 && (
            <p className="text-xs text-[#C75B5B]">
              Os descontos passam dos proventos. Ao pagar, nada sai do caixa — ajuste os vales/descontos se necessário.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
