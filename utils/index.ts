import { format, parseISO, isValid, isBefore, startOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type {
  FormaPagamento, VendaStatus, ServicoStatus,
  ParcelaStatus, CrediarioStatus, ProdutoCategoria,
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
  entregue: 'Entregue',
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
    entregue: 'gold',
    cancelado: 'danger',
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
  dataBase?: Date
): string[] {
  const base = dataBase || new Date()
  const dates: string[] = []
  // Start from current month if due day hasn't passed yet; otherwise next month
  const startOffset = base.getDate() < diaVencimento ? 0 : 1
  for (let i = 0; i < numParcelas; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + startOffset + i, diaVencimento)
    dates.push(format(d, 'yyyy-MM-dd'))
  }
  return dates
}

export function parcelaVencida(dataVencimento: string): boolean {
  return isBefore(startOfDay(parseISO(dataVencimento)), startOfDay(new Date()))
}
