const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''

export type ProdutoCatalogo = {
  id: string
  nome: string
  slug: string
  categoria: string
  linha: string | null
  material: string
  largura: string | null
  descricao: string
  valor: number
  parcelas: number | null
  valor_parcela: number | null
  imagens: string[]
  destaque: boolean
  ativo: boolean
  created_at: string
}

export async function listarProdutosCatalogo(): Promise<{
  data: ProdutoCatalogo[] | null
  error: string | null
}> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/produtos`)
    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error ?? 'Erro ao carregar produtos.' }
    return { data: json.data, error: null }
  } catch {
    return { data: null, error: 'Não foi possível conectar ao servidor de produtos.' }
  }
}

export async function criarProdutoCatalogo(
  formData: FormData,
): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/produtos`, { method: 'POST', body: formData })
    const json = await res.json()
    if (!res.ok) return { error: json.error ?? 'Erro ao cadastrar produto.' }
    return { error: null }
  } catch {
    return { error: 'Não foi possível conectar ao servidor de produtos.' }
  }
}

export async function atualizarProdutoCatalogo(
  id: string,
  formData: FormData,
): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/produtos/${id}`, { method: 'PUT', body: formData })
    const json = await res.json()
    if (!res.ok) return { error: json.error ?? 'Erro ao atualizar produto.' }
    return { error: null }
  } catch {
    return { error: 'Não foi possível conectar ao servidor de produtos.' }
  }
}

export async function excluirProdutoCatalogo(id: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/produtos/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      return { error: json.error ?? 'Erro ao excluir produto.' }
    }
    return { error: null }
  } catch {
    return { error: 'Não foi possível conectar ao servidor de produtos.' }
  }
}
