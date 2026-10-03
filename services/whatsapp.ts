import { supabase } from '@/lib/supabase'
import type { Cliente } from '@/types'
import type { ConnectionStatus } from '@/lib/whatsapp-client'

export interface SlotStatus {
  status: ConnectionStatus
  qrBase64: string | null
  phone: string | null
}

export interface WhatsAppAllStatus {
  slots: [SlotStatus, SlotStatus]
}

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

export async function getAllStatus(): Promise<WhatsAppAllStatus> {
  const res = await fetch('/api/whatsapp/status', { cache: 'no-store' })
  if (!res.ok) throw new Error('Falha ao buscar status')
  return res.json()
}

export async function conectarSlot(slot: 0 | 1): Promise<WhatsAppAllStatus> {
  const headers = await authHeader()
  const res = await fetch('/api/whatsapp/connect', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Falha ao conectar')
  }
  return res.json()
}

export async function desconectarSlot(slot: 0 | 1): Promise<WhatsAppAllStatus> {
  const headers = await authHeader()
  const res = await fetch('/api/whatsapp/disconnect', {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Falha ao desconectar')
  }
  return res.json()
}

export async function listarContatosWhatsApp(): Promise<{ data: Cliente[] | null; error: string | null }> {
  // Busca o id da origem WhatsApp primeiro
  const { data: origem } = await supabase
    .from('origens_cliente')
    .select('id')
    .ilike('nome', 'whatsapp')
    .maybeSingle()

  if (!origem) return { data: [], error: null }

  const { data, error } = await supabase
    .from('clientes')
    .select('*')
    .eq('ativo', true)
    .eq('origem_id', (origem as { id: string }).id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return { data: null, error: error.message }
  return { data: data as Cliente[], error: null }
}
