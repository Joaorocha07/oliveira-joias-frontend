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
  ordem: number | null
  created_at: string
}

export type CategoriaCatalogo = {
  id: string
  nome: string
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

export async function reordenarProdutosCatalogo(
  itens: { id: string; ordem: number }[],
): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/produtos/reordenar`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itens }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      return { error: json.error ?? 'Erro ao reordenar produtos.' }
    }
    return { error: null }
  } catch {
    return { error: 'Não foi possível conectar ao servidor de produtos.' }
  }
}

export async function listarCategoriasCatalogo(): Promise<{
  data: CategoriaCatalogo[] | null
  error: string | null
}> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/categorias`)
    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error ?? 'Erro ao carregar categorias.' }
    return { data: json.data, error: null }
  } catch {
    return { data: null, error: 'Não foi possível conectar ao servidor.' }
  }
}

export async function criarCategoriaCatalogo(nome: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/categorias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    })
    const json = await res.json()
    if (!res.ok) return { error: json.error ?? 'Erro ao criar categoria.' }
    return { error: null }
  } catch {
    return { error: 'Não foi possível conectar ao servidor.' }
  }
}

export async function excluirCategoriaCatalogo(id: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/categorias/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      return { error: json.error ?? 'Erro ao excluir categoria.' }
    }
    return { error: null }
  } catch {
    return { error: 'Não foi possível conectar ao servidor.' }
  }
}

export type AcabamentoCatalogo = {
  id: string
  nome: string
  ativo: boolean
  created_at: string
}

export async function listarAcabamentosCatalogo(): Promise<{
  data: AcabamentoCatalogo[] | null
  error: string | null
}> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/acabamentos`)
    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error ?? 'Erro ao carregar acabamentos.' }
    return { data: json.data, error: null }
  } catch {
    return { data: null, error: 'Não foi possível conectar ao servidor.' }
  }
}

export async function criarAcabamentoCatalogo(nome: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/acabamentos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome }),
    })
    const json = await res.json()
    if (!res.ok) return { error: json.error ?? 'Erro ao criar acabamento.' }
    return { error: null }
  } catch {
    return { error: 'Não foi possível conectar ao servidor.' }
  }
}

export async function excluirAcabamentoCatalogo(id: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/acabamentos/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      return { error: json.error ?? 'Erro ao excluir acabamento.' }
    }
    return { error: null }
  } catch {
    return { error: 'Não foi possível conectar ao servidor.' }
  }
}

export type FaqItem = { pergunta: string; resposta: string }

export type ConfigCatalogo = {
  info_produto: string
  voce_sabia: string
  faq: FaqItem[]
}

export async function buscarConfigCatalogo(): Promise<{
  data: ConfigCatalogo | null
  error: string | null
}> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/config`)
    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error ?? 'Erro ao carregar configuração.' }
    return { data: json.data, error: null }
  } catch {
    return { data: null, error: 'Não foi possível conectar ao servidor.' }
  }
}

export async function atualizarConfigCatalogo(config: ConfigCatalogo): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    const json = await res.json()
    if (!res.ok) return { error: json.error ?? 'Erro ao salvar configuração.' }
    return { error: null }
  } catch {
    return { error: 'Não foi possível conectar ao servidor.' }
  }
}
