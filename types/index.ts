// ============================================================
// OLIVEIRA JOIAS — TypeScript Types
// ============================================================

export type UserRole = 'admin' | 'vendedor' | 'caixa' | 'visualizador'
export type VendaTipo = 'normal' | 'livre'
export type VendaStatus = 'orcamento' | 'pendente' | 'pago' | 'crediario' | 'cancelado'
export type FormaPagamento = 'dinheiro' | 'pix' | 'cartao_debito' | 'cartao_credito' | 'crediario' | 'transferencia' | 'cheque' | 'misto'
export type CrediarioStatus = 'em_dia' | 'vencido' | 'quitado' | 'cancelado'
export type ParcelaStatus = 'pendente' | 'pago' | 'vencido' | 'cancelado'
export type LancamentoTipo = 'entrada' | 'saida'
export type ServicoStatus = 'orcamento' | 'aguardando' | 'em_andamento' | 'concluido' | 'cancelado'
export type EstoqueMovimentoTipo = 'entrada' | 'saida' | 'ajuste' | 'devolucao'
export type ProdutoCategoria = 'anel' | 'colar' | 'brinco' | 'pulseira' | 'alianca' | 'pingente' | 'relogio' | 'kit' | 'outro'
export type StatusFunil =
  | 'novo_lead' | 'primeiro_atendimento' | 'orcamento' | 'negociacao' | 'follow_up'
  | 'pedido_confirmado' | 'producao' | 'pedido_entregue' | 'pos_venda' | 'lead_perdido'
export type ProdutoInteresse = 'alianca_prata' | 'alianca_ouro' | 'alianca_moeda_antiga' | 'alianca_aco' | 'semijoias' | 'outro'
export type TimelineTipo = 'nota' | 'status' | 'sistema'
export type FollowUpStatus = 'pendente' | 'concluido' | 'cancelado'
export type StatusQualificacao =
  | 'novo_lead' | 'em_atendimento' | 'fazendo_orcamento' | 'interessado'
  | 'aguardando_resposta' | 'follow_up_agendado' | 'venda_concluida'
  | 'lead_perdido' | 'nao_respondeu'

// ── PROFILE ────────────────────────────────────────────────────
export interface Profile {
  id: string
  nome: string
  email: string
  role: UserRole
  ativo: boolean
  avatar_url: string | null
  telefone: string | null
  cpf: string | null
  comissao_percentual: number
  created_at: string
  updated_at: string
}

// ── ORIGEM CLIENTE ─────────────────────────────────────────────
export interface OrigemCliente {
  id: string
  nome: string
  ativo: boolean
  created_at: string
}

// ── CLIENTE ────────────────────────────────────────────────────
export interface Cliente {
  id: string
  nome: string
  cpf: string | null
  rg: string | null
  email: string | null
  telefone: string | null
  whatsapp: string | null
  data_nascimento: string | null
  endereco: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  observacoes: string | null
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  // CRM
  status_funil: StatusFunil
  lead_score: number
  origem_id: string | null
  origem_outro: string | null
  produto_interesse: ProdutoInteresse | null
  valor_pretendido: number | null
  data_casamento: string | null
  data_noivado: string | null
  quando_pretende_comprar: string | null
  modelo_desejado: string | null
  numeracao: string | null
  vendedor_id: string | null
  instagram: string | null
  perguntou_pagamento: boolean
  solicitou_gravacao: boolean
  demonstrou_intencao: boolean
  motivo_perda: string | null
  ultimo_contato_em: string
  status_qualificacao: StatusQualificacao
  parceiro_nome: string | null
  parceiro_telefone: string | null
  data_inicio_conversa: string | null
  origem?: Pick<OrigemCliente, 'id' | 'nome'> | null
  vendedor?: ProfileResumo | null
}

// Campos de CRM têm default no banco — opcionais ao criar um cliente "simples" em /clientes
type ClienteCrmFields =
  | 'status_funil' | 'lead_score' | 'origem_id' | 'origem_outro' | 'produto_interesse'
  | 'valor_pretendido' | 'data_casamento' | 'data_noivado' | 'quando_pretende_comprar'
  | 'modelo_desejado' | 'numeracao' | 'vendedor_id' | 'instagram'
  | 'perguntou_pagamento' | 'solicitou_gravacao' | 'demonstrou_intencao' | 'motivo_perda'
  | 'ultimo_contato_em' | 'status_qualificacao' | 'parceiro_nome' | 'parceiro_telefone'
  | 'data_inicio_conversa'

type ClienteBase = Omit<Cliente, 'id' | 'created_at' | 'updated_at' | 'origem' | 'vendedor'>
export type ClienteInsert = Omit<ClienteBase, ClienteCrmFields> & Partial<Pick<ClienteBase, ClienteCrmFields>>
export type ClienteUpdate = Partial<ClienteInsert>

// ── CLIENTE TIMELINE ───────────────────────────────────────────
export interface ClienteTimelineEvento {
  id: string
  cliente_id: string
  tipo: TimelineTipo
  descricao: string
  status_anterior: StatusFunil | null
  status_novo: StatusFunil | null
  created_by: string | null
  created_at: string
  autor?: Pick<Profile, 'nome'> | null
}

// ── CLIENTE FOLLOW-UP ──────────────────────────────────────────
export interface ClienteFollowUp {
  id: string
  cliente_id: string
  data_agendada: string
  horario: string | null
  motivo: string
  status: FollowUpStatus
  created_by: string | null
  created_at: string
  updated_at: string
  cliente?: Pick<Cliente, 'id' | 'nome' | 'telefone' | 'produto_interesse' | 'ultimo_contato_em'> & {
    vendedor?: ProfileResumo | null
  }
}

// ── META MENSAL ────────────────────────────────────────────────
export interface MetaMensal {
  id: string
  mes: string
  vendedor_id: string | null
  valor_meta: number
  created_by: string | null
  created_at: string
  updated_at: string
  vendedor?: ProfileResumo | null
}

// ── MENSAGEM MODELO ────────────────────────────────────────────
export interface MensagemModelo {
  id: string
  categoria: string
  titulo: string
  mensagem: string
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}
export type MensagemModeloInsert = Omit<MensagemModelo, 'id' | 'created_at' | 'updated_at'>

// ── CLIENTE ARQUIVO ────────────────────────────────────────────
export type ClienteArquivoTipo = 'foto' | 'documento'
export interface ClienteArquivo {
  id: string
  cliente_id: string
  tipo: ClienteArquivoTipo
  nome: string
  url: string
  created_by: string | null
  created_at: string
}

// ── FORNECEDOR ─────────────────────────────────────────────────
export interface Fornecedor {
  id: string
  nome: string
  razao_social: string | null
  cnpj: string | null
  cpf: string | null
  email: string | null
  telefone: string | null
  contato_nome: string | null
  endereco: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null
  categoria: string | null
  observacoes: string | null
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type FornecedorInsert = Omit<Fornecedor, 'id' | 'created_at' | 'updated_at'>
export type FornecedorUpdate = Partial<FornecedorInsert>

// ── PRODUTO ────────────────────────────────────────────────────
export interface Produto {
  id: string
  codigo: string
  nome: string
  descricao: string | null
  categoria: ProdutoCategoria
  material: string | null
  peso_g: number | null
  fornecedor_id: string | null
  custo: number
  preco_venda: number
  preco_minimo: number | null
  imagem_url: string | null
  ativo: boolean
  is_kit: boolean
  observacoes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  variacoes?: ProdutoVariacao[]
  fornecedor?: Fornecedor
}

export type ProdutoInsert = Omit<Produto, 'id' | 'created_at' | 'updated_at' | 'variacoes' | 'fornecedor'>
export type ProdutoUpdate = Partial<ProdutoInsert>

export interface ProdutoVariacao {
  id: string
  produto_id: string
  nome: string
  valor: string
  estoque_atual: number
  estoque_minimo: number
  custo_adicional: number
  ativo: boolean
  created_at: string
  updated_at: string
}

export type ProdutoVariacaoInsert = Omit<ProdutoVariacao, 'id' | 'created_at' | 'updated_at'>
export type ProdutoVariacaoUpdate = Partial<ProdutoVariacaoInsert>

// ── ESTOQUE ────────────────────────────────────────────────────
export interface EstoqueMovimentacao {
  id: string
  variacao_id: string
  produto_id: string
  tipo: EstoqueMovimentoTipo
  quantidade: number
  quantidade_antes: number
  quantidade_depois: number
  motivo: string | null
  referencia_id: string | null
  referencia_tipo: string | null
  created_by: string | null
  created_at: string
  produto?: Produto
  variacao?: ProdutoVariacao
}

export interface VwEstoqueAtual {
  variacao_id: string
  produto_id: string
  codigo: string
  produto_nome: string
  categoria: ProdutoCategoria
  material: string | null
  variacao_nome: string
  variacao_valor: string
  estoque_atual: number
  estoque_minimo: number
  status_estoque: 'normal' | 'critico' | 'esgotado'
  custo: number
  preco_venda: number
  valor_estoque: number
}

// ── VENDA ──────────────────────────────────────────────────────
export interface Venda {
  id: string
  numero: number
  tipo: VendaTipo
  cliente_id: string | null
  vendedor_id: string | null
  origem_id: string | null
  origem_outro: string | null
  status: VendaStatus
  forma_pagamento: FormaPagamento
  subtotal: number
  desconto: number
  total: number
  valor_pago: number
  troco: number
  descricao_livre: string | null
  custo_livre: number | null
  observacoes: string | null
  data_venda: string
  created_at: string
  updated_at: string
  cliente?: Cliente
  vendedor?: Profile
  origem?: OrigemCliente
  itens?: VendaItem[]
}

export type VendaInsert = Omit<Venda, 'id' | 'numero' | 'created_at' | 'updated_at' | 'cliente' | 'vendedor' | 'itens'>
export type VendaUpdate = Partial<VendaInsert>

export interface VendaItem {
  id: string
  venda_id: string
  produto_id: string
  variacao_id: string | null
  nome_produto: string
  descricao: string | null
  quantidade: number
  preco_unitario: number
  custo_unitario: number
  desconto: number
  subtotal: number
  created_at: string
  produto?: Produto
  variacao?: ProdutoVariacao
}

export type VendaItemInsert = Omit<VendaItem, 'id' | 'created_at' | 'produto' | 'variacao'>

// ── CREDIÁRIO ──────────────────────────────────────────────────
export interface Crediario {
  id: string
  venda_id: string
  cliente_id: string
  total: number
  entrada: number
  saldo: number
  num_parcelas: number
  valor_parcela: number
  dia_vencimento: number
  status: CrediarioStatus
  observacoes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  cliente?: Cliente
  venda?: Venda
  parcelas?: CrediarioParcela[]
}

export type CrediarioInsert = Omit<Crediario, 'id' | 'created_at' | 'updated_at' | 'cliente' | 'venda' | 'parcelas'>

export interface CrediarioParcela {
  id: string
  crediario_id: string
  cliente_id: string
  numero: number
  valor: number
  valor_pago: number
  data_vencimento: string
  data_pagamento: string | null
  forma_pagamento: FormaPagamento | null
  status: ParcelaStatus
  observacoes: string | null
  recebido_por: string | null
  created_at: string
  updated_at: string
  cliente?: Cliente
  crediario?: Crediario
}

export type CrediarioParcelaUpdate = Partial<Omit<CrediarioParcela, 'id' | 'created_at' | 'updated_at' | 'cliente' | 'crediario'>>

// ── SERVIÇO ────────────────────────────────────────────────────
export interface Servico {
  id: string
  numero: number
  cliente_id: string | null
  origem_id: string | null
  origem_outro: string | null
  tipo: string
  descricao: string
  observacoes_internas: string | null
  valor: number
  custo_estimado: number | null
  status: ServicoStatus
  data_entrada: string
  data_previsao: string | null
  data_conclusao: string | null
  data_entrega: string | null
  forma_pagamento: FormaPagamento | null
  pago: boolean
  responsavel_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  cliente?: Cliente
  origem?: OrigemCliente
  responsavel?: Profile
}

export type ServicoInsert = Omit<Servico, 'id' | 'numero' | 'created_at' | 'updated_at' | 'cliente' | 'responsavel'>
export type ServicoUpdate = Partial<ServicoInsert>

// ── FINANCEIRO ─────────────────────────────────────────────────
export interface CategoriaFinanceira {
  id: string
  nome: string
  tipo: LancamentoTipo
  cor: string
  ativo: boolean
  created_at: string
}

export interface Lancamento {
  id: string
  tipo: LancamentoTipo
  descricao: string
  valor: number
  data_lancamento: string
  categoria_id: string | null
  categoria_nome: string | null
  forma_pagamento: string | null
  referencia_id: string | null
  referencia_tipo: string | null
  observacoes: string | null
  editado: boolean
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  categoria?: CategoriaFinanceira
}

export type LancamentoInsert = Omit<Lancamento, 'id' | 'editado' | 'created_at' | 'updated_at' | 'categoria' | 'historico'>
export type LancamentoUpdate = Partial<LancamentoInsert> & { updated_by?: string }

// ── CONTAS A PAGAR ─────────────────────────────────────────────
export type ContaPagarStatus = 'pendente' | 'pago' | 'vencido' | 'cancelado'

export interface ContaPagar {
  id: string
  nome: string
  descricao: string | null
  valor: number
  fixa: boolean
  data_vencimento: string
  status: ContaPagarStatus
  data_pagamento: string | null
  forma_pagamento: string | null
  lancamento_id: string | null
  observacoes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ContaPagarInsert = Omit<ContaPagar, 'id' | 'created_at' | 'updated_at'>
export type ContaPagarUpdate = Partial<ContaPagarInsert>

// ── ORÇAMENTOS ─────────────────────────────────────────────────
export interface OrcamentoModelo {
  id: string
  nome: string
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type OrcamentoModeloInsert = Omit<OrcamentoModelo, 'id' | 'created_at' | 'updated_at'>

export interface OrcamentoMaterial {
  id: string
  nome: string
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type OrcamentoMaterialInsert = Omit<OrcamentoMaterial, 'id' | 'created_at' | 'updated_at'>

export interface OrcamentoConfiguracao {
  id: string
  nome_empresa: string
  contato: string | null
  endereco: string | null
  whatsapp: string | null
  instagram: string | null
  texto_rodape: string | null
  cor_principal: string
  created_at: string
  updated_at: string
}

export type OrcamentoConfiguracaoInsert = Omit<OrcamentoConfiguracao, 'id' | 'created_at' | 'updated_at'>

export interface Orcamento {
  id: string
  numero: number
  cliente_nome: string | null
  cliente_telefone: string | null
  modelo_nome: string | null
  material: string | null
  largura: string | null
  itens_inclusos: string[]
  valor_vista: number
  percentual_acrescimo: number
  num_parcelas: number
  valor_parcelado: number
  valor_parcela: number
  prazo_fabricacao: string | null
  observacoes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type OrcamentoInsert = Omit<Orcamento, 'id' | 'numero' | 'created_at' | 'updated_at'>
export type OrcamentoUpdate = Partial<OrcamentoInsert>

// ── CERTIFICADOS DE GARANTIA ───────────────────────────────────
export interface CertificadoModelo {
  id: string
  nome: string
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CertificadoMaterial {
  id: string
  nome: string
  ativo: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CertificadoConfiguracao {
  id: string
  nome_empresa: string
  subtitulo: string
  endereco: string | null
  whatsapp: string | null
  telefone_secundario: string | null
  instagram: string | null
  cor_principal: string
  texto_introducao: string | null
  termos_garantia: string[]
  beneficios: string[]
  nao_cobre: string[]
  recomendacoes: string[]
  texto_declaracao: string | null
  texto_agradecimento: string | null
  texto_validade: string | null
  created_at: string
  updated_at: string
}

export type CertificadoConfiguracaoInsert = Omit<CertificadoConfiguracao, 'id' | 'created_at' | 'updated_at'>

export interface Certificado {
  id: string
  numero: string
  venda_id: string | null
  cliente_id: string | null
  cliente_nome: string | null
  cliente_cpf: string | null
  cliente_telefone: string | null
  data_compra: string | null
  modelo: string | null
  material: string | null
  largura: string | null
  gramas: string | null
  numeracao: string | null
  pedido_os: string | null
  valor: number | null
  vendedor_id: string | null
  vendedor_nome: string | null
  observacoes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type CertificadoInsert = Omit<Certificado, 'id' | 'numero' | 'created_at' | 'updated_at'>
export type CertificadoUpdate = Partial<CertificadoInsert>

// ── DASHBOARD / RELATÓRIOS ─────────────────────────────────────
export interface DashboardData {
  faturamento_mes: number
  saldo_caixa: number
  crediario_aberto: number
  servicos_andamento: number
  vendas_recentes: Venda[]
  estoque_critico: VwEstoqueAtual[]
  parcelas_vencidas: number
  faturamento_meses: { mes: string; total: number }[]
}

export interface ClienteResumo {
  id?: string
  nome: string
  telefone?: string | null
}

export interface ProfileResumo {
  id?: string
  nome: string
}

export type VendaComCliente = Venda & {
  cliente?: ClienteResumo | null
}

export type ServicoComCliente = Omit<Servico, 'cliente' | 'responsavel'> & {
  cliente?: ClienteResumo | null
  origem?: Pick<OrigemCliente, 'id' | 'nome'> | null
  responsavel?: ProfileResumo | null
}

export type CrediarioComRelacoes = Omit<Crediario, 'cliente' | 'venda' | 'parcelas'> & {
  cliente?: ClienteResumo | null
  venda?: Pick<Venda, 'numero'> | null
  parcelas?: CrediarioParcela[] | null
}

export type CrediarioParcelaComCliente = Omit<CrediarioParcela, 'cliente'> & {
  cliente?: ClienteResumo | null
}

export interface CategoriaVendaRow {
  quantidade: number
  subtotal: number
  produto: { categoria: string } | { categoria: string }[] | null
}

// ── FORMULÁRIOS ────────────────────────────────────────────────
export interface VendaFormItem {
  produto_id: string
  variacao_id: string | null
  nome_produto: string
  quantidade: number
  preco_unitario: number
  custo_unitario: number
  desconto: number
  subtotal: number
}

export interface NovaVendaForm {
  cliente_id: string
  forma_pagamento: FormaPagamento
  data_venda: string
  desconto: number
  observacoes: string
  itens: VendaFormItem[]
  num_parcelas: number
  entrada: number
  dia_vencimento: number
}

// ── FILTROS ────────────────────────────────────────────────────
export interface FiltrosVenda {
  status?: VendaStatus
  cliente_id?: string
  data_inicio?: string
  data_fim?: string
  forma_pagamento?: FormaPagamento
  search?: string
}

export interface FiltrosLancamento {
  tipo?: LancamentoTipo
  categoria_id?: string
  data_inicio?: string
  data_fim?: string
  search?: string
}

export interface FiltrosProduto {
  categoria?: ProdutoCategoria
  status_estoque?: 'normal' | 'critico' | 'esgotado'
  search?: string
  ativo?: boolean
}
