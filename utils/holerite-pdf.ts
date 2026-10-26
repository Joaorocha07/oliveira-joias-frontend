import type { FolhaDetalhe, OrcamentoConfiguracao } from '@/types'
import { FORMA_PAGAMENTO_LABEL } from '@/utils'
import type { FormaPagamento } from '@/types'

type RGB = [number, number, number]

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function fmtValor(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR')
}

function competencia(mes: string): string {
  const [y, m] = mes.split('-')
  return `${m}/${y}`
}

export function nomeArquivoHolerite({ folha }: FolhaDetalhe): string {
  return `Holerite_${competencia(folha.mes).replace('/', '-')}_${folha.funcionario_nome.replace(/\s+/g, '_')}.pdf`
}

interface Linha {
  descricao: string
  referencia: string
  provento: number | null
  desconto: number | null
}

/**
 * Recibo de pagamento (holerite simples, controle interno) em 1 página A4 com
 * duas vias — empresa e funcionário. Dados da empresa vêm de
 * `orcamento_configuracoes` (nome, endereço, cor).
 */
export async function gerarHoleritePdf(
  detalhe: FolhaDetalhe,
  config: OrcamentoConfiguracao,
  cpf: string | null,
): Promise<import('jspdf').jsPDF> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const { folha, itens, vales } = detalhe

  const gold = hexToRgb(config.cor_principal || '#C9A227')
  const black: RGB = [20, 18, 16]
  const gray: RGB = [107, 103, 95]
  const pageW = 210
  const margin = 14
  const contentW = pageW - 2 * margin

  const linhas: Linha[] = [
    { descricao: 'Salário base', referencia: '', provento: folha.salario_base, desconto: null },
  ]
  if (folha.valor_comissao > 0) {
    linhas.push({
      descricao: 'Comissão sobre vendas',
      referencia: `${folha.comissao_percentual}% de ${fmtValor(folha.base_comissao)}`,
      provento: folha.valor_comissao,
      desconto: null,
    })
  }
  for (const item of itens) {
    linhas.push({
      descricao: item.descricao,
      referencia: '',
      provento: item.tipo === 'provento' ? item.valor : null,
      desconto: item.tipo === 'desconto' ? item.valor : null,
    })
  }
  for (const vale of vales) {
    linhas.push({
      descricao: `Vale / adiantamento${vale.descricao ? ` — ${vale.descricao}` : ''}`,
      referencia: fmtData(vale.data_vale),
      provento: null,
      desconto: vale.valor,
    })
  }

  function via(top: number, titulo: string): void {
    let y = top

    doc.setFillColor(...gold)
    doc.rect(margin, y, contentW, 1.2, 'F')
    y += 7

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...black)
    doc.text(config.nome_empresa || 'Oliveira Joias', margin, y)
    doc.setFontSize(10)
    doc.text('RECIBO DE PAGAMENTO', pageW - margin, y, { align: 'right' })
    y += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...gray)
    if (config.endereco) doc.text(config.endereco, margin, y)
    doc.text(`Competência ${competencia(folha.mes)} · ${titulo}`, pageW - margin, y, { align: 'right' })
    y += 7

    doc.setFontSize(9)
    doc.setTextColor(...black)
    doc.setFont('helvetica', 'bold')
    doc.text(folha.funcionario_nome, margin, y)
    doc.setFont('helvetica', 'normal')
    const infos = [folha.cargo, cpf ? `CPF ${cpf}` : null].filter(Boolean).join(' · ')
    if (infos) doc.text(infos, pageW - margin, y, { align: 'right' })
    y += 5

    // Cabeçalho da tabela
    const colRef = margin + 86
    const colProv = margin + 140
    const colDesc = pageW - margin
    doc.setFillColor(245, 240, 228)
    doc.rect(margin, y, contentW, 6, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.text('Descrição', margin + 2, y + 4)
    doc.text('Referência', colRef, y + 4)
    doc.text('Proventos', colProv, y + 4, { align: 'right' })
    doc.text('Descontos', colDesc - 2, y + 4, { align: 'right' })
    y += 10

    doc.setFont('helvetica', 'normal')
    for (const l of linhas) {
      const desc = doc.splitTextToSize(l.descricao, 80) as string[]
      doc.text(desc[0] ?? '', margin + 2, y)
      if (l.referencia) doc.text(l.referencia, colRef, y)
      if (l.provento != null) doc.text(fmtValor(l.provento), colProv, y, { align: 'right' })
      if (l.desconto != null) doc.text(fmtValor(l.desconto), colDesc - 2, y, { align: 'right' })
      y += 5
    }

    y += 1
    doc.setDrawColor(...gray)
    doc.setLineWidth(0.2)
    doc.line(margin, y, pageW - margin, y)
    y += 5
    doc.setFont('helvetica', 'bold')
    doc.text('Totais', margin + 2, y)
    doc.text(fmtValor(folha.total_proventos), colProv, y, { align: 'right' })
    doc.text(fmtValor(folha.total_descontos), colDesc - 2, y, { align: 'right' })
    y += 7

    doc.setFillColor(...gold)
    doc.rect(pageW - margin - 70, y - 5, 70, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(10)
    doc.text(`Líquido: ${fmtValor(folha.valor_liquido)}`, pageW - margin - 2, y + 0.5, { align: 'right' })
    doc.setTextColor(...gray)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const pagamento = folha.data_pagamento
      ? `Pago em ${fmtData(folha.data_pagamento)}${folha.forma_pagamento ? ` · ${FORMA_PAGAMENTO_LABEL[folha.forma_pagamento as FormaPagamento] ?? folha.forma_pagamento}` : ''}`
      : 'Pagamento pendente'
    doc.text(pagamento, margin, y)
    y += 14

    doc.setTextColor(...black)
    doc.text(
      `Declaro ter recebido a importância líquida de ${fmtValor(folha.valor_liquido)} referente à competência ${competencia(folha.mes)}.`,
      margin, y,
    )
    y += 12
    doc.line(margin, y, margin + 80, y)
    doc.line(pageW - margin - 50, y, pageW - margin, y)
    y += 4
    doc.setTextColor(...gray)
    doc.text('Assinatura do funcionário', margin, y)
    doc.text('Data', pageW - margin - 50, y)
  }

  via(12, 'Via da empresa')
  // Até ~12 linhas as duas vias cabem na mesma folha (meia A4 cada); acima disso, uma por página.
  if (linhas.length <= 12) {
    doc.setDrawColor(...gray)
    doc.setLineDashPattern([1.5, 1.5], 0)
    doc.line(margin, 148.5, pageW - margin, 148.5)
    doc.setLineDashPattern([], 0)
    via(156, 'Via do funcionário')
  } else {
    doc.addPage()
    via(12, 'Via do funcionário')
  }

  return doc
}
