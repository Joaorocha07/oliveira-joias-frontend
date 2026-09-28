// Busca "inteligente" usada em todos os campos de pesquisa do sistema:
// - ignora maiúsculas/minúsculas e acentos ("joao" encontra "João")
// - aceita palavras fora de ordem e incompletas ("silva mar" encontra "Maria da Silva")
// - ignora pontuação/formatação em telefone, CPF, CNPJ e códigos
//   ("34997787675" encontra "(34) 9778-7675"; "al0006" encontra "AL-0006")

export type SearchField = string | number | null | undefined

const STOPWORDS = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])
// Consulta que parece telefone/CPF/CNPJ/número: tratada como um único bloco de dígitos
const NUMERIC_QUERY = /^[\d\s()+./-]+$/

export function normalizarTexto(value: SearchField): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

function compactar(value: string): string {
  return value.replace(/[^a-z0-9]/g, '')
}

export function tokensBusca(termo: string): string[] {
  const texto = termo.trim()
  if (!texto) return []
  if (NUMERIC_QUERY.test(texto) && /\d/.test(texto)) return [texto.replace(/\D/g, '')]

  const tokens = normalizarTexto(texto).split(/\s+/).filter(Boolean)
  const semStopwords = tokens.filter((t) => !STOPWORDS.has(t))
  return semStopwords.length > 0 ? semStopwords : tokens
}

interface CampoPreparado {
  normal: string
  compacto: string
  palavras: string[]
}

function prepararCampos(fields: SearchField[]): CampoPreparado[] {
  return fields.map((f) => {
    const normal = normalizarTexto(f)
    return { normal, compacto: compactar(normal), palavras: normal.split(/[^a-z0-9]+/).filter(Boolean) }
  })
}

// Índice do 9º dígito de celular que pode ou não estar no cadastro:
// "34997787675" (11 díg.) / "3497787675" (10 díg., sem o 9) / "997787675" (9 díg., sem DDD)
function posicaoNonoDigito(digitos: string): number | null {
  if (!/^\d+$/.test(digitos)) return null
  if ((digitos.length === 11 || digitos.length === 10) && digitos[2] !== '0') return 2
  if (digitos.length === 9 && digitos[0] === '9') return 0
  return null
}

function variantesToken(token: string): string[] {
  const pos = posicaoNonoDigito(token)
  if (pos === null) return [token]
  if (token.length === 10) return [token, token.slice(0, 2) + '9' + token.slice(2)]
  return token[pos] === '9' ? [token, token.slice(0, pos) + token.slice(pos + 1)] : [token]
}

// 3 = campo começa com o termo, 2 = alguma palavra começa com o termo, 1 = contém, 0 = não encontrado
function pontuarToken(token: string, campo: CampoPreparado): number {
  if (!campo.normal) return 0
  const compactos = variantesToken(compactar(token)).filter(Boolean)
  if (campo.normal.startsWith(token) || compactos.some((t) => campo.compacto.startsWith(t))) return 3
  if (campo.palavras.some((p) => p.startsWith(token))) return 2
  if (campo.normal.includes(token) || compactos.some((t) => campo.compacto.includes(t))) return 1
  return 0
}

/**
 * Relevância do item para o termo (0 = não corresponde). Todos os termos digitados precisam
 * aparecer em algum dos campos. Campos anteriores na lista pesam um pouco mais.
 */
export function pontuarBusca(termo: string, fields: SearchField[]): number {
  const tokens = tokensBusca(termo)
  if (tokens.length === 0) return 1
  const campos = prepararCampos(fields)

  let total = 0
  for (const token of tokens) {
    let melhor = 0
    campos.forEach((campo, idx) => {
      const pontos = pontuarToken(token, campo)
      if (pontos > 0) melhor = Math.max(melhor, pontos + (campos.length - idx) * 0.01)
    })
    if (melhor === 0) return 0
    total += melhor
  }

  const termoNormal = normalizarTexto(termo)
  if (campos[0]?.normal === termoNormal) total += 10
  else if (campos[0]?.normal.startsWith(termoNormal)) total += 5
  return total
}

export function correspondeBusca(termo: string, fields: SearchField[]): boolean {
  return pontuarBusca(termo, fields) > 0
}

/** Filtra mantendo a ordem original da lista (útil para listas ordenadas por data). */
export function filtrarBusca<T>(items: T[], termo: string, getFields: (item: T) => SearchField[]): T[] {
  if (!termo.trim()) return items
  return items.filter((item) => correspondeBusca(termo, getFields(item)))
}

/** Filtra e ordena pelos resultados mais relevantes primeiro (útil para autocomplete). */
export function ordenarPorRelevancia<T>(items: T[], termo: string, getFields: (item: T) => SearchField[]): T[] {
  if (!termo.trim()) return items
  return items
    .map((item, idx) => ({ item, idx, score: pontuarBusca(termo, getFields(item)) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .map((r) => r.item)
}

// ---------------------------------------------------------------------------
// Filtro equivalente no Supabase (PostgREST), para buscas feitas direto no banco.
// ---------------------------------------------------------------------------

const ACENTOS: Record<string, string> = {
  a: '[aáàâãä]',
  e: '[eéèêë]',
  i: '[iíìîï]',
  o: '[oóòôõö]',
  u: '[uúùûü]',
  c: '[cç]',
  n: '[nñ]',
}

function regexTexto(parte: string): string {
  return parte.split('').map((ch) => ACENTOS[ch] ?? ch).join('')
}

// Dígitos podem estar separados por qualquer formatação: "(34) 9778-7675".
// Em números de celular, o 9º dígito é opcional (cadastros antigos não têm).
function regexDigitos(digitos: string): string {
  const sep = '[^0-9]*'
  const pos = posicaoNonoDigito(digitos)
  if (pos === null) return digitos.split('').join(sep)
  const semNove = digitos.length === 10 ? digitos : digitos.slice(0, pos) + digitos.slice(pos + 1)
  if (semNove.length === digitos.length && digitos.length !== 10) return digitos.split('').join(sep)
  const antes = semNove.slice(0, pos).split('').map((d) => d + sep).join('')
  const depois = semNove.slice(pos).split('').join(sep)
  return `${antes}(9${sep})?${depois}`
}

/**
 * Gera um filtro `.or()` por termo digitado (os `.or()` encadeados viram AND no PostgREST).
 * `colunasTexto` são comparadas ignorando acentos; `colunasNumericas` (telefone, cpf...) ignorando
 * a formatação entre os dígitos. Só use colunas do tipo texto.
 */
export function filtrosBuscaSupabase(termo: string, colunasTexto: string[], colunasNumericas: string[] = []): string[] {
  const filtros: string[] = []
  for (const token of tokensBusca(termo)) {
    for (const parte of token.split(/[^a-z0-9]+/).filter(Boolean)) {
      const condicoes = colunasTexto.map((col) => `${col}.imatch."${regexTexto(parte)}"`)
      if (/^\d+$/.test(parte)) {
        condicoes.push(...colunasNumericas.map((col) => `${col}.imatch."${regexDigitos(parte)}"`))
      }
      if (condicoes.length > 0) filtros.push(condicoes.join(','))
    }
  }
  return filtros
}

export function aplicarBuscaSupabase<Q extends { or: (filters: string) => Q }>(
  query: Q,
  termo: string,
  colunasTexto: string[],
  colunasNumericas: string[] = [],
): Q {
  return filtrosBuscaSupabase(termo, colunasTexto, colunasNumericas).reduce((q, f) => q.or(f), query)
}
