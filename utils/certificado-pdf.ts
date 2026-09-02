import type { Certificado, CertificadoConfiguracao } from '@/types'

type RGB = [number, number, number]

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function fmtData(iso: string | null | undefined): string {
  if (!iso) return '____/____/______'
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return '____/____/______'
  return d.toLocaleDateString('pt-BR')
}

function fmtValor(v: number | null | undefined): string | null {
  if (v == null || Number.isNaN(v)) return null
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function materialAdj(material: string | null | undefined): string {
  const m = (material ?? '').toLowerCase()
  if (m.includes('ouro')) return 'ouro'
  if (m.includes('prata')) return 'prata'
  return 'material utilizado'
}

function aplicarPlaceholders(texto: string, empresa: string): string {
  return texto.replace(/\{empresa\}/gi, empresa)
}

const TERMOS_PADRAO = [
  'Autenticidade do material utilizado na fabricação da joia.',
  'Defeitos de fabricação decorrentes do processo produtivo, com reparo ou substituição sem custo ao cliente.',
]
const BENEFICIOS_PADRAO = [
  'Até 3 (três) polimentos profissionais gratuitos para restauração do brilho e acabamento.',
  'Durante 1 (um) ano a partir da compra: ajustes de tamanho, modificações e reparos com mão de obra gratuita. Material adicional é cobrado apenas mediante aprovação prévia.',
]
const NAO_COBRE_PADRAO = [
  'Danos causados por mau uso, quedas, impactos ou amassados.',
  'Arranhões decorrentes do uso diário e desgaste natural.',
  'Quebras provocadas por esforço excessivo.',
  'Perda, roubo ou furto da joia.',
  'Danos causados por produtos químicos ou agentes corrosivos.',
  'Alterações realizadas por terceiros não autorizados pela {empresa}.',
]
const RECOMENDACOES_PADRAO = [
  'Evitar contato com cloro, água sanitária, solventes e produtos de limpeza.',
  'Retirar as alianças durante atividades de impacto ou esforço físico intenso.',
  'Guardar a joia em local seco e protegido quando não estiver em uso.',
]

async function gerarQrDataUrl(texto: string): Promise<string | null> {
  try {
    const QRCode = (await import('qrcode')).default
    return await QRCode.toDataURL(texto, { margin: 0, width: 240 })
  } catch {
    return null
  }
}

export function nomeArquivoCertificado(cert: Certificado): string {
  const cliente = cert.cliente_nome ? `_${cert.cliente_nome.replace(/\s+/g, '_')}` : ''
  return `${cert.numero}${cliente}.pdf`
}

/**
 * Gera o PDF do certificado de garantia (2 páginas), replicando o layout do
 * modelo impresso. Todo o conteúdo textual vem da configuração (`certificado_configuracoes`).
 */
export async function gerarCertificadoPdf(
  cert: Certificado,
  config: CertificadoConfiguracao,
): Promise<import('jspdf').jsPDF> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const empresa = config.nome_empresa || 'Oliveira Joias'
  const gold = hexToRgb(config.cor_principal || '#C9A227')
  const black: RGB = [20, 18, 16]
  const gray: RGB = [107, 103, 95]
  const pageW = 210
  const margin = 16
  const contentW = pageW - 2 * margin
  let y = 0

  const termos = (config.termos_garantia?.length ? config.termos_garantia : TERMOS_PADRAO)
    .map((t) => aplicarPlaceholders(t, empresa))
  const beneficios = (config.beneficios?.length ? config.beneficios : BENEFICIOS_PADRAO)
    .map((t) => aplicarPlaceholders(t, empresa))
  const naoCobre = (config.nao_cobre?.length ? config.nao_cobre : NAO_COBRE_PADRAO)
    .map((t) => aplicarPlaceholders(t, empresa))
  const recomendacoes = (config.recomendacoes?.length ? config.recomendacoes : RECOMENDACOES_PADRAO)
    .map((t) => aplicarPlaceholders(t, empresa))

  function header(pageTitle: string): number {
    doc.setFillColor(black[0], black[1], black[2])
    doc.rect(0, 0, pageW, 32, 'F')
    doc.setFont('times', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(gold[0], gold[1], gold[2])
    doc.text(empresa.toUpperCase(), margin, 16)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(230, 230, 230)
    if (config.subtitulo) doc.text(config.subtitulo, margin, 23)
    doc.setFont('times', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(gold[0], gold[1], gold[2])
    doc.text(pageTitle, pageW - margin, 16, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(220, 220, 220)
    doc.text(cert.numero, pageW - margin, 23, { align: 'right' })
    return 42
  }

  function sectionHeader(label: string, yy: number): number {
    doc.setDrawColor(gold[0], gold[1], gold[2])
    doc.setLineWidth(0.6)
    doc.line(margin, yy, margin + 34, yy)
    doc.setFont('times', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(black[0], black[1], black[2])
    doc.text(label, margin, yy + 6)
    return yy + 13
  }

  function labelValue(label: string, value: string | null | undefined, x: number, yy: number, w: number): number {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(gray[0], gray[1], gray[2])
    doc.text(label.toUpperCase(), x, yy)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10.5)
    doc.setTextColor(black[0], black[1], black[2])
    const lines = doc.splitTextToSize(value || '—', w)
    doc.text(lines, x, yy + 5)
    return yy + 5 + lines.length * 4.5
  }

  function bullet(text: string, x: number, yy: number, w: number): number {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9.5)
    doc.setTextColor(black[0], black[1], black[2])
    doc.setFillColor(gold[0], gold[1], gold[2])
    doc.circle(x + 1, yy - 1.3, 0.7, 'F')
    const lines = doc.splitTextToSize(text, w - 6)
    doc.text(lines, x + 5, yy)
    return yy + lines.length * 4.6 + 2.5
  }

  function paragraph(text: string, x: number, yy: number, w: number, size = 9): number {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(size)
    doc.setTextColor(black[0], black[1], black[2])
    const lines = doc.splitTextToSize(text, w)
    doc.text(lines, x, yy)
    return yy + lines.length * 4.4
  }

  // ─── PÁGINA 1 ───────────────────────────────────────────────
  y = header('CERTIFICADO DE GARANTIA VITALÍCIA')

  const intro = config.texto_introducao
    ? aplicarPlaceholders(config.texto_introducao, empresa)
    : `A ${empresa} certifica que a joia descrita neste documento foi produzida com matéria-prima de alta qualidade, seguindo rigorosos padrões de fabricação, acabamento e controle de qualidade, garantindo ao cliente a autenticidade do ${materialAdj(cert.material)} e cobertura contra defeitos de fabricação.`
  doc.setFont('times', 'italic')
  doc.setFontSize(9)
  doc.setTextColor(gray[0], gray[1], gray[2])
  y = paragraph(intro, margin, y + 4, contentW, 9)
  y += 6

  y = sectionHeader('Dados do cliente', y)
  const colW = (contentW - 10) / 2
  let y1 = labelValue('Nome do cliente', cert.cliente_nome, margin, y, colW)
  let y2 = labelValue('CPF', cert.cliente_cpf, margin + colW + 10, y, colW)
  y = Math.max(y1, y2) + 4
  y1 = labelValue('Telefone', cert.cliente_telefone, margin, y, colW)
  y2 = labelValue('Data da compra', fmtData(cert.data_compra), margin + colW + 10, y, colW)
  y = Math.max(y1, y2) + 10

  y = sectionHeader('Dados da joia', y)
  const col3 = (contentW - 20) / 3
  y1 = labelValue('Modelo', cert.modelo, margin, y, col3)
  y2 = labelValue('Material', cert.material, margin + col3 + 10, y, col3)
  let y3 = labelValue('Largura', cert.largura, margin + 2 * (col3 + 10), y, col3)
  y = Math.max(y1, y2, y3) + 4
  y1 = labelValue('Gramas (par)', cert.gramas, margin, y, col3)
  y2 = labelValue('Numeração', cert.numeracao, margin + col3 + 10, y, col3)
  y3 = labelValue('Nº do pedido/OS', cert.pedido_os, margin + 2 * (col3 + 10), y, col3)
  y = Math.max(y1, y2, y3) + 10

  const valorFmt = fmtValor(cert.valor)
  if (valorFmt) {
    y = sectionHeader('Investimento', y)
    doc.setFillColor(250, 248, 244)
    doc.setDrawColor(gold[0], gold[1], gold[2])
    doc.setLineWidth(0.4)
    doc.roundedRect(margin, y - 5, contentW, 14, 2, 2, 'FD')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(gray[0], gray[1], gray[2])
    doc.text('VALOR PAGO PELA JOIA', margin + 6, y)
    doc.setFont('times', 'bold')
    doc.setFontSize(14)
    doc.setTextColor(black[0], black[1], black[2])
    doc.text(valorFmt, margin + 6, y + 6.5)
    y += 16
  }

  y = sectionHeader('Termos da garantia', y)
  termos.forEach((t) => { y = bullet(t, margin, y, contentW) })
  y += 4

  if (beneficios.length) {
    y = sectionHeader('Benefícios exclusivos', y)
    beneficios.forEach((t) => { y = bullet(t, margin, y, contentW) })
  }

  doc.setDrawColor(230, 225, 215)
  doc.setLineWidth(0.3)
  doc.line(margin, 282, pageW - margin, 282)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(gray[0], gray[1], gray[2])
  doc.text('Página 1 de 2', pageW - margin, 288, { align: 'right' })
  doc.text(empresa, margin, 288)

  // ─── PÁGINA 2 ───────────────────────────────────────────────
  doc.addPage()
  y = header('CERTIFICADO DE GARANTIA VITALÍCIA')

  if (naoCobre.length) {
    y = sectionHeader('A garantia não cobre', y)
    naoCobre.forEach((t) => { y = bullet(t, margin, y, contentW) })
    y += 4
  }

  if (recomendacoes.length) {
    y = sectionHeader('Recomendações de conservação', y)
    recomendacoes.forEach((t) => { y = bullet(t, margin, y, contentW) })
    y += 4
  }

  const declaracao = config.texto_declaracao
    ? aplicarPlaceholders(config.texto_declaracao, empresa)
    : 'Declaro que recebi a joia descrita neste certificado em perfeitas condições de fabricação e acabamento, que recebi todas as informações referentes à utilização, conservação e garantia do produto, e que concordo integralmente com os termos aqui estabelecidos.'
  y = sectionHeader('Declaração do cliente', y)
  y = paragraph(declaracao, margin, y, contentW, 9)
  if (cert.observacoes) {
    y += 4
    y = paragraph(`Observações: ${cert.observacoes}`, margin, y, contentW, 8.5)
  }
  y += 12

  const sigW = (contentW - 14) / 2
  doc.setDrawColor(black[0], black[1], black[2])
  doc.setLineWidth(0.3)
  doc.line(margin, y, margin + sigW, y)
  doc.line(margin + sigW + 14, y, margin + 2 * sigW + 14, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(black[0], black[1], black[2])
  doc.text(`Cliente${cert.cliente_nome ? ` — ${cert.cliente_nome}` : ''}`, margin, y + 5)
  doc.text(
    `Vendedor responsável${cert.vendedor_nome ? ` — ${cert.vendedor_nome}` : ''}`,
    margin + sigW + 14,
    y + 5,
  )
  const hoje = new Date().toLocaleDateString('pt-BR')
  doc.setTextColor(gray[0], gray[1], gray[2])
  doc.setFontSize(7.5)
  doc.text(`Data: ${hoje}`, margin, y + 10)
  doc.text(`Data: ${hoje}`, margin + sigW + 14, y + 10)

  // Rodapé / dados da empresa
  doc.setFillColor(black[0], black[1], black[2])
  const footY = 250
  doc.rect(0, footY, pageW, 297 - footY, 'F')
  doc.setFont('times', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(gold[0], gold[1], gold[2])
  doc.text(empresa.toUpperCase(), margin, footY + 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(225, 225, 225)
  let fy = footY + 16
  if (config.endereco) { doc.text(`Endereço: ${config.endereco}`, margin, fy); fy += 5 }
  const tels: string[] = []
  if (config.whatsapp) {
    const clean = config.whatsapp.replace(/\D/g, '')
    const d = clean.length > 11 ? clean.slice(2) : clean
    tels.push(d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : config.whatsapp)
  }
  if (config.telefone_secundario) tels.push(config.telefone_secundario)
  if (tels.length) { doc.text(`Telefones: ${tels.join(' / ')}`, margin, fy); fy += 5 }
  if (config.instagram) { doc.text(`Instagram: ${config.instagram}`, margin, fy); fy += 5 }

  if (config.texto_agradecimento) {
    doc.setFont('times', 'italic')
    doc.setFontSize(8)
    doc.setTextColor(gold[0], gold[1], gold[2])
    const thanks = doc.splitTextToSize(aplicarPlaceholders(config.texto_agradecimento, empresa), contentW - 30)
    doc.text(thanks, margin, fy + 4)
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.8)
  doc.setTextColor(190, 190, 190)
  if (config.texto_validade) doc.text(config.texto_validade, margin, 293)
  doc.text('Página 2 de 2', pageW - margin, 293, { align: 'right' })

  if (config.whatsapp) {
    const qr = await gerarQrDataUrl(`https://wa.me/${config.whatsapp.replace(/\D/g, '')}`)
    if (qr) doc.addImage(qr, 'PNG', pageW - margin - 22, footY + 8, 22, 22)
  }

  return doc
}

export async function baixarCertificadoPdf(cert: Certificado, config: CertificadoConfiguracao): Promise<void> {
  const doc = await gerarCertificadoPdf(cert, config)
  doc.save(nomeArquivoCertificado(cert))
}

export async function certificadoPdfBlobUrl(
  cert: Certificado,
  config: CertificadoConfiguracao,
): Promise<string> {
  const doc = await gerarCertificadoPdf(cert, config)
  return doc.output('bloburl').toString()
}
