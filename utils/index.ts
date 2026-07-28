import { format, parseISO, isValid, isBefore, startOfDay, differenceInCalendarDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type {
  FormaPagamento, VendaStatus, ServicoStatus,
  ParcelaStatus, CrediarioStatus, ProdutoCategoria,
  StatusFunil, ProdutoInteresse, FollowUpStatus, StatusQualificacao,
} from '@/types'

// ── FORMATAÇÃO MONETÁRIA ───────────────────────────────────────
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function parseMoney(str: string): number {
  return parseFloat(str.replace(/[R$\s.]/g, '').replace(',', '.')) || 0
}

// ── FORMATAÇÃO DE DATA ─────────────────────────────────────────
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    if (!isValid(d)) return '—'
    return format(d, 'dd/MM/yyyy', { locale: ptBR })
  } catch {
    return '—'
  }
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  try {
    const d = typeof date === 'string' ? parseISO(date) : date
    if (!isValid(d)) return '—'
    return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch {
    return '—'
  }
}

export function toInputDate(date: string | null | undefined): string {
  if (!date) return ''
  try {
    const d = parseISO(date)
    if (!isValid(d)) return ''
    return format(d, 'yyyy-MM-dd')
  } catch {
    return ''
  }
}

export function today(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

// ── LABELS ─────────────────────────────────────────────────────
export const FORMA_PAGAMENTO_LABEL: Record<FormaPagamento, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao_debito: 'Cartão Débito',
  cartao_credito: 'Cartão Crédito',
  crediario: 'Crediário',
  transferencia: 'Transferência',
  cheque: 'Cheque',
  misto: 'Misto',
}

export const VENDA_STATUS_LABEL: Record<VendaStatus, string> = {
  orcamento: 'Orçamento',
  pendente: 'Pendente',
  pago: 'Pago',
  crediario: 'Crediário',
  cancelado: 'Cancelado',
}

export const SERVICO_STATUS_LABEL: Record<ServicoStatus, string> = {
  orcamento: 'Orçamento',
  aguardando: 'Aguardando',
  em_andamento: 'Em Andamento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export const PARCELA_STATUS_LABEL: Record<ParcelaStatus, string> = {
  pendente: 'Pendente',
  pago: 'Pago',
  vencido: 'Vencido',
  cancelado: 'Cancelado',
}

export const CREDIARIO_STATUS_LABEL: Record<CrediarioStatus, string> = {
  em_dia: 'Em Dia',
  vencido: 'Atrasado',
  quitado: 'Quitado',
  cancelado: 'Cancelado',
}

export const PRODUTO_CATEGORIA_LABEL: Record<ProdutoCategoria, string> = {
  anel: 'Anel',
  colar: 'Colar',
  brinco: 'Brinco',
  pulseira: 'Pulseira',
  alianca: 'Aliança',
  pingente: 'Pingente',
  relogio: 'Relógio',
  kit: 'Kit',
  outro: 'Outro',
}

export const STATUS_FUNIL_LABEL: Record<StatusFunil, string> = {
  novo_lead: 'Novo Lead',
  primeiro_atendimento: 'Primeiro Atendimento',
  orcamento: 'Orçamento',
  negociacao: 'Negociação',
  follow_up: 'Follow-up',
  pedido_confirmado: 'Pedido Confirmado',
  producao: 'Produção',
  pedido_entregue: 'Pedido Entregue',
  pos_venda: 'Pós-venda',
  lead_perdido: 'Lead Perdido',
}

// Ordem das colunas do Kanban — "lead_perdido" sempre por último
export const STATUS_FUNIL_ORDEM: StatusFunil[] = [
  'novo_lead', 'primeiro_atendimento', 'orcamento', 'negociacao', 'follow_up',
  'pedido_confirmado', 'producao', 'pedido_entregue', 'pos_venda', 'lead_perdido',
]

export const PRODUTO_INTERESSE_LABEL: Record<ProdutoInteresse, string> = {
  alianca_prata: 'Aliança de Prata',
  alianca_ouro: 'Aliança de Ouro',
  alianca_moeda_antiga: 'Aliança de Moeda Antiga',
  alianca_aco: 'Aliança de Aço',
  semijoias: 'Semi Joias',
  outro: 'Outro',
}

export const FOLLOWUP_STATUS_LABEL: Record<FollowUpStatus, string> = {
  pendente: 'Pendente',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

// Seção 3 do documento — status de qualificação/atendimento, independente do
// estágio no funil (Kanban). Cores seguem os "circulos coloridos" do doc.
export const STATUS_QUALIFICACAO_LABEL: Record<StatusQualificacao, string> = {
  novo_lead: 'Novo Lead',
  em_atendimento: 'Em Atendimento',
  fazendo_orcamento: 'Fazendo Orçamento',
  interessado: 'Interessado',
  aguardando_resposta: 'Aguardando Resposta',
  follow_up_agendado: 'Follow-up Agendado',
  venda_concluida: 'Venda Concluída',
  lead_perdido: 'Lead Perdido',
  nao_respondeu: 'Não Respondeu',
}

export const STATUS_QUALIFICACAO_COR: Record<StatusQualificacao, string> = {
  novo_lead: '#22C55E',
  em_atendimento: '#D4A72C',
  fazendo_orcamento: '#F97316',
  interessado: '#5B8EB8',
  aguardando_resposta: '#8B5CF6',
  follow_up_agendado: '#92603A',
  venda_concluida: '#5B8C5B',
  lead_perdido: '#C75B5B',
  nao_respondeu: '#4B5563',
}

// ── CPF / CNPJ / TELEFONE ──────────────────────────────────────
export function formatCPF(cpf: string): string {
  const n = cpf.replace(/\D/g, '')
  return n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
}

export function formatCNPJ(cnpj: string): string {
  const n = cnpj.replace(/\D/g, '')
  return n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
}

export function formatPhone(phone: string): string {
  const n = phone.replace(/\D/g, '')
  if (n.length === 11) return n.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (n.length === 10) return n.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return phone
}

// ── WHATSAPP ───────────────────────────────────────────────────
export function buildWhatsAppLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, '')
  const withCountry = digits.length <= 11 ? `55${digits}` : digits
  const query = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${withCountry}${query}`
}

// ── INICIAIS ───────────────────────────────────────────────────
export function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

// ── NÚMEROS ────────────────────────────────────────────────────
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100
}

// ── STATUS → BADGE VARIANT ─────────────────────────────────────
type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'gray' | 'gold'

export function vendaStatusVariant(status: VendaStatus): BadgeVariant {
  const map: Record<VendaStatus, BadgeVariant> = {
    orcamento: 'gray',
    pendente: 'warning',
    pago: 'success',
    crediario: 'info',
    cancelado: 'danger',
  }
  return map[status]
}

export function servicoStatusVariant(status: ServicoStatus): BadgeVariant {
  const map: Record<ServicoStatus, BadgeVariant> = {
    orcamento: 'gray',
    aguardando: 'warning',
    em_andamento: 'info',
    concluido: 'success',
    cancelado: 'danger',
  }
  return map[status]
}

export function followUpStatusVariant(status: FollowUpStatus): BadgeVariant {
  const map: Record<FollowUpStatus, BadgeVariant> = {
    pendente: 'warning',
    concluido: 'success',
    cancelado: 'gray',
  }
  return map[status]
}

export function statusFunilVariant(status: StatusFunil): BadgeVariant {
  const map: Record<StatusFunil, BadgeVariant> = {
    novo_lead: 'gray',
    primeiro_atendimento: 'info',
    orcamento: 'info',
    negociacao: 'warning',
    follow_up: 'warning',
    pedido_confirmado: 'gold',
    producao: 'gold',
    pedido_entregue: 'success',
    pos_venda: 'success',
    lead_perdido: 'danger',
  }
  return map[status]
}

export function parcelaStatusVariant(status: ParcelaStatus): BadgeVariant {
  const map: Record<ParcelaStatus, BadgeVariant> = {
    pendente: 'warning',
    pago: 'success',
    vencido: 'danger',
    cancelado: 'gray',
  }
  return map[status]
}

export function crediarioStatusVariant(status: CrediarioStatus): BadgeVariant {
  const map: Record<CrediarioStatus, BadgeVariant> = {
    em_dia: 'success',
    vencido: 'danger',
    quitado: 'gray',
    cancelado: 'gray',
  }
  return map[status]
}

// ── GERAR DATAS DE PARCELAS ────────────────────────────────────
export function gerarDatasParcelas(
  numParcelas: number,
  diaVencimento: number,
  dataBase?: Date,
  forcarProximoMes = false
): string[] {
  const base = dataBase || new Date()
  const dates: string[] = []
  // Este mês se diaVencimento >= dia da base; próximo mês se já passou ou forçado
  const startOffset = !forcarProximoMes && base.getDate() <= diaVencimento ? 0 : 1
  for (let i = 0; i < numParcelas; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + startOffset + i, diaVencimento)
    dates.push(format(d, 'yyyy-MM-dd'))
  }
  return dates
}

export function parcelaVencida(dataVencimento: string): boolean {
  return isBefore(startOfDay(parseISO(dataVencimento)), startOfDay(new Date()))
}

// ── ORÇAMENTOS: CONDIÇÃO DE PAGAMENTO ──────────────────────────
// Regra fixa: Ouro → +20% em 12x sem juros. Outros materiais → +10% em 3x sem
// juros. Valor da parcela sempre arredondado para o número inteiro mais
// próximo (sem centavos).
export function calcularCondicaoOrcamento(valorVista: number, material: string | null | undefined) {
  const isOuro = /ouro/i.test(material ?? '')
  const percentual = isOuro ? 20 : 10
  const parcelas = isOuro ? 12 : 3
  const valorParcelado = round2(valorVista * (1 + percentual / 100))
  const valorParcela = Math.round(valorParcelado / parcelas)
  return { percentual, parcelas, valorParcelado, valorParcela }
}

// ── CRM: LEAD SCORE ─────────────────────────────────────────────
interface LeadScoreInput {
  data_casamento?: string | null
  data_noivado?: string | null
  modelo_desejado?: string | null
  valor_pretendido?: number | null
  numeracao?: string | null
  perguntou_pagamento?: boolean
  solicitou_gravacao?: boolean
  demonstrou_intencao?: boolean
}

function dataProxima(data: string | null | undefined, dias: number): boolean {
  if (!data) return false
  try {
    const diff = differenceInCalendarDays(parseISO(data), startOfDay(new Date()))
    return diff >= 0 && diff <= dias
  } catch {
    return false
  }
}

// Heurística simples: cada sinal de intenção de compra soma 1 ponto (máx. 7),
// convertido para 1–5 estrelas. Não persiste em trigger — recalculado a cada save.
export function calcularLeadScore(lead: LeadScoreInput): number {
  let pontos = 0
  if (dataProxima(lead.data_casamento, 90) || dataProxima(lead.data_noivado, 90)) pontos++
  if (lead.modelo_desejado) pontos++
  if (lead.valor_pretendido) pontos++
  if (lead.numeracao) pontos++
  if (lead.perguntou_pagamento) pontos++
  if (lead.solicitou_gravacao) pontos++
  if (lead.demonstrou_intencao) pontos++
  return clamp(Math.ceil((pontos / 7) * 5), 1, 5)
}

// ── CATEGORIAS DE DESPESA ──────────────────────────────────────
export const CATEGORIAS_DESPESA = [
  'Reposição / aumento de estoque',
  'Investimentos',
  'Contas fixas',
  'Pró-labore',
  'Retiradas pessoais',
  'Marketing',
  'Comissão',
  'Serviços',
  'Transporte',
  'Logística',
  'Comida',
  'Limpeza / manutenção da loja',
  'Outros',
] as const

export type CategoriaDespesa = typeof CATEGORIAS_DESPESA[number]

// ── EXPORTAÇÃO CSV (Excel) ──────────────────────────────────────
export function exportarCsv(nomeArquivo: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const escapar = (valor: string | number | null | undefined) => {
    const texto = String(valor ?? '')
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
  }
  const linhas = [headers, ...rows].map((linha) => linha.map(escapar).join(';'))
  const conteudo = '﻿' + linhas.join('\r\n')
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo.endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`
  link.click()
  URL.revokeObjectURL(url)
}
