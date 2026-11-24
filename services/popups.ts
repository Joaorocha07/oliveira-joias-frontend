const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? ''

export type SitePopup = {
  id: string
  tipo: 'boas_vindas' | 'promocao' | 'saida' | 'cadastro'
  titulo: string
  mensagem: string
  imagem_url: string | null
  produto_slug: string | null
  cta_texto: string | null
  cta_url: string | null
  // Só no tipo 'cadastro': cupom mostrado ao visitante depois que ele se cadastra
  cupom_codigo: string | null
  cupom_percentual: number | null
  ativo: boolean
  delay_segundos: number
  created_at: string
  updated_at: string
}

export const TIPO_LABELS: Record<SitePopup['tipo'], string> = {
  boas_vindas: 'Boas-vindas',
  promocao: 'Promoção',
  saida: 'Saída',
  cadastro: 'Cadastro (lead)',
}

export const TIPO_CORES: Record<SitePopup['tipo'], string> = {
  boas_vindas: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  promocao: 'bg-amber-50 text-amber-700 border-amber-200',
  saida: 'bg-red-50 text-red-700 border-red-200',
  cadastro: 'bg-violet-50 text-violet-700 border-violet-200',
}

export async function listarPopups(): Promise<{ data: SitePopup[] | null; error: string | null }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/popups`)
    const json = await res.json()
    if (!res.ok) return { data: null, error: json.error ?? 'Erro ao carregar pop-ups.' }
    return { data: json.data, error: null }
  } catch {
    return { data: null, error: 'Não foi possível conectar ao servidor.' }
  }
}

export async function criarPopup(formData: FormData): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/popups`, { method: 'POST', body: formData })
    const json = await res.json()
    if (!res.ok) return { error: json.error ?? 'Erro ao criar pop-up.' }
    return { error: null }
  } catch {
    return { error: 'Não foi possível conectar ao servidor.' }
  }
}

export async function atualizarPopup(id: string, formData: FormData): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/popups/${id}`, { method: 'PUT', body: formData })
    const json = await res.json()
    if (!res.ok) return { error: json.error ?? 'Erro ao atualizar pop-up.' }
    return { error: null }
  } catch {
    return { error: 'Não foi possível conectar ao servidor.' }
  }
}

export async function excluirPopup(id: string): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/popups/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      return { error: json.error ?? 'Erro ao excluir pop-up.' }
    }
    return { error: null }
  } catch {
    return { error: 'Não foi possível conectar ao servidor.' }
  }
}
