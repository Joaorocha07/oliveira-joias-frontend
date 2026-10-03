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
  const { data, error } = await supabase
    .from('clientes')
    .select('*, origem:origens_cliente(id, nome)')
    .eq('ativo', true)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return { data: null, error: error.message }

  const filtered = (data as Cliente[]).filter((c) => {
    const o = (c as unknown as { origem?: { nome?: string } }).origem
    return o?.nome?.toLowerCase() === 'whatsapp'
  })

  return { data: filtered, error: null }
}
