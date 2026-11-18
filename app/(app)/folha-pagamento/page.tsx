'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Banknote, CheckCircle2, History, Pencil, Plus, RefreshCw, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  ActionMenu, Badge, Button, Card, EmptyState, MetricCard, PageHeader, Spinner,
} from '@/components/ui'
import { ModalDetalheFolha } from '@/components/modals/modal-detalhe-folha'
import { ModalEditarFuncionarioFolha } from '@/components/modals/modal-editar-funcionario-folha'
import { ModalHistoricoFuncionarioFolha } from '@/components/modals/modal-historico-funcionario-folha'
import { ModalNovoVale } from '@/components/modals/modal-novo-vale'
import { RelatorioFolha } from '@/components/folha/relatorio-folha'
import { useAuth } from '@/context/auth-context'
import { useAlert } from '@/hooks/use-alert'
import {
  excluirVale,
  fimDoMes,
  gerarFolhaMes,
  listarFolhasMes,
  listarFuncionariosFolha,
  listarVales,
  mesLabel,
  statusFolhasDosVales,
} from '@/services/folha'
import { formatDate, formatMoney, ROLE_LABEL } from '@/utils'
import type { FolhaPagamento, FolhaVale, FuncionarioFolha } from '@/types'

type Aba = 'mes' | 'vales' | 'funcionarios' | 'relatorio'

const ABAS: { key: Aba; label: string }[] = [
  { key: 'mes', label: 'Folha do mês' },
  { key: 'vales', label: 'Vales' },
  { key: 'funcionarios', label: 'Funcionários' },
  { key: 'relatorio', label: 'Relatório' },
]

interface Dados {
  chave: string
  funcionarios: FuncionarioFolha[]
  folhas: FolhaPagamento[]
  vales: FolhaVale[]
  statusFolhaVale: Record<string, FolhaPagamento['status']>
  error: string | null
}

export default function FolhaPagamentoPage() {
  const { user } = useAuth()
  const alert = useAlert()
  const [aba, setAba] = useState<Aba>('mes')
  const [mes, setMes] = useState(() => format(new Date(), 'yyyy-MM-01'))
  const [versao, setVersao] = useState(0)
  const [dados, setDados] = useState<Dados | null>(null)
  const [gerando, setGerando] = useState(false)

  const [folhaAberta, setFolhaAberta] = useState<FolhaPagamento | null>(null)
  const [editarFuncionario, setEditarFuncionario] = useState<FuncionarioFolha | null>(null)
  const [historicoFuncionario, setHistoricoFuncionario] = useState<FuncionarioFolha | null>(null)
  const [novoValeOpen, setNovoValeOpen] = useState(false)

  const chave = `${mes}:${versao}`
  const recarregar = () => setVersao((v) => v + 1)

  useEffect(() => {
    let cancelado = false
    const atual = `${mes}:${versao}`
    Promise.all([listarFuncionariosFolha(), listarFolhasMes(mes), listarVales(mes, fimDoMes(mes))])
      .then(async ([funcRes, folhasRes, valesRes]) => {
        const statusFolhaVale = await statusFolhasDosVales(valesRes.data)
        if (cancelado) return
        setDados({
          chave: atual,
          funcionarios: funcRes.data,
          folhas: folhasRes.data,
          vales: valesRes.data,
          statusFolhaVale,
          error: funcRes.error ?? folhasRes.error ?? valesRes.error,
        })
      })
    return () => { cancelado = true }
  }, [mes, versao])

  // Mantém os dados anteriores na tela enquanto recarrega (evita piscar).
  const carregando = dados?.chave !== chave
  const funcionarios = useMemo(() => dados?.funcionarios ?? [], [dados])
  const folhas = useMemo(() => dados?.folhas ?? [], [dados])
  const vales = dados?.vales ?? []

  const funcionariosAtivos = useMemo(() => funcionarios.filter((f) => f.profile.ativo), [funcionarios])
  const naFolha = funcionariosAtivos.filter((f) => f.folha?.ativo)
  const nomePorId = useMemo(() => new Map(funcionarios.map((f) => [f.profile.id, f.profile.nome])), [funcionarios])
  const cpfPorId = useMemo(() => new Map(funcionarios.map((f) => [f.profile.id, f.profile.cpf])), [funcionarios])

  const metricas = useMemo(() => {
    const bruto = folhas.reduce((s, f) => s + f.total_proventos, 0)
    const descontos = folhas.reduce((s, f) => s + f.total_descontos, 0)
    const liquido = folhas.reduce((s, f) => s + f.valor_liquido, 0)
    const pagas = folhas.filter((f) => f.status === 'paga')
    return {
      bruto, descontos, liquido,
      pago: pagas.reduce((s, f) => s + f.valor_liquido, 0),
      qtdPagas: pagas.length,
    }
  }, [folhas])

  async function handleGerar() {
    if (!user?.id) return
    if (naFolha.length === 0) {
      alert.info('Ninguém na folha', 'Configure o salário dos funcionários na aba Funcionários antes de gerar a folha.')
      setAba('funcionarios')
      return
    }
    setGerando(true)
    const { criadas, error } = await gerarFolhaMes(mes, user.id)
    setGerando(false)
    if (error) { alert.error('Erro ao gerar folha', error); return }
    toast.success(criadas > 0 ? `${criadas} folha(s) criada(s) e valores atualizados.` : 'Valores atualizados.')
    recarregar()
  }

  function handleExcluirVale(vale: FolhaVale) {
    alert.warning(
      'Excluir vale?',
      `O vale de ${formatMoney(vale.valor)} e a saída correspondente no caixa serão removidos.`,
      {
        showCancel: true,
        confirmText: 'Excluir',
        cancelText: 'Voltar',
        onConfirm: async () => {
          const { error } = await excluirVale(vale)
          if (error) { toast.error(error); return }
          toast.success('Vale excluído.')
          recarregar()
        },
      },
    )
  }

  function statusVale(vale: FolhaVale): { label: string; variant: 'gray' | 'warning' | 'success' } {
    if (!vale.folha_id) return { label: 'A descontar', variant: 'gray' }
    return dados?.statusFolhaVale[vale.folha_id] === 'paga'
      ? { label: 'Descontado', variant: 'success' }
      : { label: 'Na folha aberta', variant: 'warning' }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Folha de Pagamento"
        subtitle="Salários, comissões, vales e holerites da equipe"
        actions={
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={mes.slice(0, 7)}
              onChange={(e) => e.target.value && setMes(`${e.target.value}-01`)}
              className="h-9 rounded-lg border border-gold-200 bg-surface px-3 text-sm text-dark-600 focus:border-gold-500 focus:outline-none"
              aria-label="Competência"
            />
            {aba === 'mes' && (
              <Button variant="primary" size="sm" leftIcon={<RefreshCw size={14} />} onClick={handleGerar} loading={gerando}>
                Gerar / atualizar folha
              </Button>
            )}
            {aba === 'vales' && (
              <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setNovoValeOpen(true)}>
                Novo vale
              </Button>
            )}
          </div>
        }
      />

      <div className="flex gap-2 flex-wrap">
        {ABAS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => setAba(a.key)}
            className={[
              'rounded-lg border px-4 py-2 text-sm font-medium transition-all',
              aba === a.key
                ? 'border-gold-500 bg-gold-500 text-dark-800 shadow-sm'
                : 'border-gold-100 bg-surface text-dark-500 hover:bg-cream-50 hover:border-gold-200',
            ].join(' ')}
          >
            {a.label}
          </button>
        ))}
      </div>

      {dados?.error && (
        <Card><p className="text-sm text-[#C75B5B]">Erro ao carregar a folha: {dados.error}</p></Card>
      )}

      {/* ── Folha do mês ─────────────────────────────────────────── */}
      {aba === 'mes' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard label={`Bruto ${mesLabel(mes)}`} value={formatMoney(metricas.bruto)} accent />
            <MetricCard label="Descontos e vales" value={formatMoney(metricas.descontos)} />
            <MetricCard label="Líquido a pagar" value={formatMoney(metricas.liquido)} />
            <MetricCard
              label="Pago"
              value={formatMoney(metricas.pago)}
              change={`${metricas.qtdPagas} de ${folhas.length} folha(s)`}
              changeType={folhas.length > 0 && metricas.qtdPagas === folhas.length ? 'up' : 'neutral'}
            />
          </div>

          <Card>
            {carregando && !dados ? (
              <div className="flex h-40 items-center justify-center"><Spinner size={28} /></div>
            ) : folhas.length === 0 ? (
              <EmptyState
                imageSrc="/images/Analytics-rafiki.svg"
                title={`Nenhuma folha gerada para ${mesLabel(mes)}`}
                description={naFolha.length > 0
                  ? `${naFolha.length} funcionário(s) configurado(s). Clique em "Gerar / atualizar folha".`
                  : 'Configure o salário dos funcionários na aba Funcionários.'}
                action={
                  <Button variant="primary" size="sm" onClick={handleGerar} loading={gerando}>Gerar folha</Button>
                }
              />
            ) : (
              <div className="divide-y divide-gold-50">
                {folhas.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFolhaAberta(f)}
                    className="flex w-full items-center gap-4 py-3.5 px-1 text-left hover:bg-cream-50 rounded-lg"
                  >
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${f.status === 'paga' ? 'bg-green-100' : 'bg-gold-50'}`}>
                      {f.status === 'paga'
                        ? <CheckCircle2 size={16} className="text-green-600" />
                        : <Banknote size={16} className="text-gold-600" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-dark-800 truncate">{f.funcionario_nome}</p>
                        <Badge variant={f.status === 'paga' ? 'success' : 'warning'}>{f.status === 'paga' ? 'Paga' : 'Aberta'}</Badge>
                      </div>
                      <p className="text-xs text-dark-400 mt-0.5">
                        {[f.cargo, `Salário ${formatMoney(f.salario_base)}`, f.valor_comissao > 0 ? `Comissão ${formatMoney(f.valor_comissao)}` : null, f.total_descontos > 0 ? `Descontos ${formatMoney(f.total_descontos)}` : null]
                          .filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className={`text-sm font-bold tabular-nums ${f.valor_liquido < 0 ? 'text-[#C75B5B]' : 'text-dark-800'}`}>
                        {formatMoney(f.valor_liquido)}
                      </p>
                      <p className="text-[11px] text-dark-400">líquido</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
          <p className="text-xs text-dark-400">
            A comissão é calculada sobre as vendas do mês (exceto orçamentos e canceladas) em que a pessoa é a
            vendedora. Folhas abertas são recalculadas ao abrir; folhas pagas ficam congeladas.
          </p>
        </>
      )}

      {/* ── Vales ────────────────────────────────────────────────── */}
      {aba === 'vales' && (
        <Card>
          {carregando && !dados ? (
            <div className="flex h-40 items-center justify-center"><Spinner size={28} /></div>
          ) : vales.length === 0 ? (
            <EmptyState
              imageSrc="/images/Analytics-rafiki.svg"
              title={`Nenhum vale em ${mesLabel(mes)}`}
              description="Vales saem do caixa na hora e são descontados na folha do mês."
              action={<Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setNovoValeOpen(true)}>Novo vale</Button>}
            />
          ) : (
            <div className="divide-y divide-gold-50">
              {vales.map((v) => {
                const st = statusVale(v)
                return (
                  <div key={v.id} className="flex items-center gap-4 py-3.5 px-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-dark-800 truncate">{nomePorId.get(v.funcionario_id) ?? 'Funcionário'}</p>
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </div>
                      <p className="text-xs text-dark-400 mt-0.5">
                        {formatDate(v.data_vale)}{v.descricao ? ` · ${v.descricao}` : ''}
                      </p>
                    </div>
                    <p className="text-sm font-bold tabular-nums text-dark-800">{formatMoney(v.valor)}</p>
                    <ActionMenu items={[{ label: 'Excluir', onClick: () => handleExcluirVale(v), variant: 'danger' }]} />
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}

      {/* ── Funcionários ─────────────────────────────────────────── */}
      {aba === 'funcionarios' && (
        <Card>
          {carregando && !dados ? (
            <div className="flex h-40 items-center justify-center"><Spinner size={28} /></div>
          ) : funcionariosAtivos.length === 0 ? (
            <EmptyState icon={<Users size={28} />} title="Nenhum usuário ativo" description="Cadastre a equipe em Equipe (/vendedores)." />
          ) : (
            <div className="divide-y divide-gold-50">
              {funcionariosAtivos.map((f) => (
                <div key={f.profile.id} className="flex items-center gap-4 py-3.5 px-1">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-dark-800 truncate">{f.profile.nome}</p>
                      <span className="text-xs text-dark-400">{ROLE_LABEL[f.profile.role]}</span>
                      {f.folha?.ativo
                        ? <Badge variant="success">Na folha</Badge>
                        : <Badge variant="gray">{f.folha ? 'Fora da folha' : 'Não configurado'}</Badge>}
                    </div>
                    <p className="text-xs text-dark-400 mt-0.5">
                      {[f.folha?.cargo, `Salário ${formatMoney(f.folha?.salario_base ?? 0)}`, `Comissão ${f.profile.comissao_percentual ?? 0}%`]
                        .filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <ActionMenu
                    items={[
                      { label: f.folha ? 'Editar dados de folha' : 'Configurar folha', icon: <Pencil size={14} />, onClick: () => setEditarFuncionario(f) },
                      { label: 'Histórico', icon: <History size={14} />, onClick: () => setHistoricoFuncionario(f) },
                    ]}
                  />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Relatório ────────────────────────────────────────────── */}
      {aba === 'relatorio' && <RelatorioFolha key={`${mes}:${versao}`} mesFim={mes} />}

      <ModalDetalheFolha
        folhaId={folhaAberta?.id ?? null}
        cpf={folhaAberta ? cpfPorId.get(folhaAberta.funcionario_id) ?? null : null}
        onClose={() => setFolhaAberta(null)}
        onChanged={recarregar}
      />
      <ModalEditarFuncionarioFolha
        funcionario={editarFuncionario}
        onClose={() => setEditarFuncionario(null)}
        onSuccess={recarregar}
      />
      <ModalHistoricoFuncionarioFolha
        funcionario={historicoFuncionario}
        onClose={() => setHistoricoFuncionario(null)}
        onAbrirFolha={(f) => { setHistoricoFuncionario(null); setFolhaAberta(f) }}
      />
      <ModalNovoVale
        open={novoValeOpen}
        onClose={() => setNovoValeOpen(false)}
        onSuccess={recarregar}
        funcionarios={naFolha}
      />
    </div>
  )
}
