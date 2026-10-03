import { supabase } from '@/lib/supabase'
import type { Cliente } from '@/types'
import type { ConnectionStatus } from '@/lib/whatsapp-client'

export interface WhatsAppStatus {
  status: ConnectionStatus
  qrBase64: string | null
  phone: string | null
}

async function authHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return {}
  return { Authorization: `Bearer ${session.access_token}` }
}

export async function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  const res = await fetch('/api/whatsapp/status', { cache: 'no-store' })
  if (!res.ok) throw new Error('Falha ao buscar status')
  return res.json()
}

export async function conectarWhatsApp(): Promise<WhatsAppStatus> {
  const headers = await authHeader()
  const res = await fetch('/api/whatsapp/connect', { method: 'POST', headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Falha ao conectar')
  }
  return res.json()
}

export async function desconectarWhatsApp(): Promise<WhatsAppStatus> {
  const headers = await authHeader()
  const res = await fetch('/api/whatsapp/disconnect', { method: 'POST', headers })
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
    .then(async (res) => {
      if (res.error) return res
      // Filter by WhatsApp origin name (case-insensitive)
      const filtered = (res.data as Cliente[]).filter((c) => {
        const o = (c as unknown as { origem?: { nome?: string } }).origem
        return o?.nome?.toLowerCase() === 'whatsapp'
      })
      return { data: filtered, error: null }
    })

  if (error) return { data: null, error: error.message }
  return { data: data as Cliente[], error: null }
}
