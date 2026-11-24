import { supabase } from '@/lib/supabase'

// Contas de clientes do site, cupons e pedidos feitos pelo carrinho do site
// (tabelas da migração 014 do oliveira-joias-backend).

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''

export type CupomTipo = 'percentual' | 'valor'
export type CupomStatus = 'ativo' | 'usado' | 'cancelado'

export interface Cupom {
  id: string
  cliente_id: string
  codigo: string
  descricao: string | null
  tipo: CupomTipo
  valor: number
  status: CupomStatus
  validade: string | null
  origem: 'boas_vindas' | 'manual'
  venda_id: string | null
  usado_em: string | null
  created_at: string
  cliente?: { id: string; nome: string; telefone: string | null } | null
}

export type PedidoSiteStatus = 'novo' | 'em_atendimento' | 'concluido' | 'cancelado'

export interface PedidoSite {
  id: string
  numero: number
  cliente_id: string
  itens: { slug: string; nome: string; quantidade: number; valor_unitario: number; subtotal: number; aros?: number[] | null; observacao: string | null }[]
  subtotal: number
  cupom_id: string | null
  cupom_codigo: string | null
  desconto: number
  total: number
  observacoes: string | null
  status: PedidoSiteStatus
  created_at: string
  cliente?: { id: string; nome: string; telefone: string | null; whatsapp: string | null } | null
}

export interface ContaSite {
  cliente_id: string
  email: string
  verificado: boolean
}

export const CUPOM_STATUS_LABEL: Record<CupomStatus, string> = {
  ativo: 'Ativo',
  usado: 'Usado',
  cancelado: 'Cancelado',
}

export const PEDIDO_STATUS_LABEL: Record<PedidoSiteStatus, string> = {
  novo: 'Novo',
  em_atendimento: 'Em atendimento',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
}

export function descricaoCupom(c: Pick<Cupom, 'tipo' | 'valor' | 'descricao'>): string {
  if (c.descricao) return c.descricao
  return c.tipo === 'percentual'
    ? `${c.valor}% de desconto`
    : `${c.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} de desconto`
}

export function calcularDescontoCupom(c: Pick<Cupom, 'tipo' | 'valor'>, subtotal: number): number {
  const bruto = c.tipo === 'percentual' ? (subtotal * c.valor) / 100 : c.valor
  return Math.round(Math.min(bruto, subtotal) * 100) / 100
}

// ── Cupons ──────────────────────────────────────────────────────────────────

export async function listarCupons(): Promise<{ data: Cupom[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('cupons')
    .select('*, cliente:clientes(id, nome, telefone)')
    .order('created_at', { ascending: false })
    .limit(1000)
  if (error) return { data: null, error: error.message }
  return { data: (data ?? []).map((c) => ({ ...c, valor: Number(c.valor) })) as Cupom[], error: null }
}

export async function listarCuponsAtivosDoCliente(clienteId: string): Promise<Cupom[]> {
  const hoje = new Date().toISOString().slice(0, 10)
  const { data } = await supabase
    .from('cupons')
    .select('*')
    .eq('cliente_id', clienteId)
    .eq('status', 'ativo')
    .or(`validade.is.null,validade.gte.${hoje}`)
    .order('created_at', { ascending: false })
  return (data ?? []).map((c) => ({ ...c, valor: Number(c.valor) })) as Cupom[]
}

export async function criarCupom(
  input: Pick<Cupom, 'cliente_id' | 'codigo' | 'descricao' | 'tipo' | 'valor' | 'validade'>,
  userId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('cupons').insert({ ...input, origem: 'manual', created_by: userId })
  return { error: error?.message ?? null }
}

export async function alterarStatusCupom(id: string, status: CupomStatus): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('cupons')
    .update({
      status,
      ...(status === 'ativo' ? { usado_em: null, venda_id: null } : {}),
      ...(status === 'usado' ? { usado_em: new Date().toISOString() } : {}),
    })
    .eq('id', id)
  return { error: error?.message ?? null }
}

export async function marcarCupomUsado(id: string, vendaId: string | null): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('cupons')
    .update({ status: 'usado', usado_em: new Date().toISOString(), venda_id: vendaId })
    .eq('id', id)
  return { error: error?.message ?? null }
}

// ── Pedidos do site ─────────────────────────────────────────────────────────

export async function listarPedidosSite(): Promise<{ data: PedidoSite[] | null; error: string | null }> {
  const { data, error } = await supabase
    .from('site_pedidos')
    .select('*, cliente:clientes(id, nome, telefone, whatsapp)')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return { data: null, error: error.message }
  return { data: data as PedidoSite[], error: null }
}

export async function alterarStatusPedidoSite(id: string, status: PedidoSiteStatus): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('site_pedidos')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  return { error: error?.message ?? null }
}

// ── Contas do site ──────────────────────────────────────────────────────────

export async function listarContasSite(): Promise<ContaSite[]> {
  // Colunas explícitas: a equipe não tem acesso ao hash da senha.
  const { data } = await supabase.from('site_contas').select('cliente_id, email, verificado').limit(5000)
  return (data ?? []) as ContaSite[]
}

export async function gerarSenhaTemporaria(clienteId: string): Promise<{ senha: string | null; error: string | null }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { senha: null, error: 'Sessão expirada. Entre novamente.' }
  try {
    const res = await fetch(`${BACKEND_URL}/api/conta/equipe/redefinir-senha`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ cliente_id: clienteId }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return { senha: null, error: json.error ?? 'Erro ao gerar senha.' }
    return { senha: json.data.senha_temporaria as string, error: null }
  } catch {
    return { senha: null, error: 'Não foi possível conectar ao servidor.' }
  }
}
