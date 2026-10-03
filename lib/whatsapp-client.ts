import path from 'path'
import { createClient } from '@supabase/supabase-js'

// Server-only — importado apenas por Route Handlers.

const SLOT_COUNT = 2
const SESSION_BASE = path.join(process.cwd(), '.whatsapp-session')

export type ConnectionStatus = 'disconnected' | 'connecting' | 'waiting_qr' | 'connected'

export interface SlotState {
  status: ConnectionStatus
  qrBase64: string | null
  phone: string | null
  adminUserId: string | null
  adminToken: string | null
  originId: string | null
}

declare global {
  // eslint-disable-next-line no-var
  var __waSlots: SlotState[] | undefined
  // eslint-disable-next-line no-var
  var __waSockets: unknown[]
}

if (!global.__waSlots) {
  global.__waSlots = Array.from({ length: SLOT_COUNT }, () => ({
    status: 'disconnected' as ConnectionStatus,
    qrBase64: null,
    phone: null,
    adminUserId: null,
    adminToken: null,
    originId: null,
  }))
}
if (!global.__waSockets) {
  global.__waSockets = Array(SLOT_COUNT).fill(null)
}

function slot(index: number): SlotState {
  return global.__waSlots![index]
}

function sessionDir(index: number): string {
  return path.join(SESSION_BASE, `slot-${index}`)
}

export function getSlotStatus(index: number) {
  const s = slot(index)
  return { status: s.status, qrBase64: s.qrBase64, phone: s.phone }
}

export function getAllSlotsStatus() {
  return Array.from({ length: SLOT_COUNT }, (_, i) => getSlotStatus(i))
}

function getSupabase(s: SlotState) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(s.adminToken
      ? { global: { headers: { Authorization: `Bearer ${s.adminToken}` } } }
      : {}),
  })
}

async function resolveOriginId(s: SlotState): Promise<string | null> {
  if (s.originId) return s.originId
  const sb = getSupabase(s)
  const { data } = await sb
    .from('origens_cliente')
    .select('id')
    .ilike('nome', 'whatsapp')
    .maybeSingle()
  s.originId = data?.id ?? null
  return s.originId
}

async function saveContact(s: SlotState, rawPhone: string, pushName: string | null) {
  const phone = rawPhone.replace(/\D/g, '')
  const whatsappNumber = `+${phone}`
  const sb = getSupabase(s)

  const { data: existing } = await sb
    .from('clientes')
    .select('id')
    .or(`whatsapp.eq.${whatsappNumber},telefone.eq.${whatsappNumber}`)
    .maybeSingle()

  if (existing) return

  const originId = await resolveOriginId(s)

  await sb.from('clientes').insert({
    nome: pushName?.trim() || `WhatsApp ${whatsappNumber}`,
    whatsapp: whatsappNumber,
    telefone: whatsappNumber,
    status_funil: 'novo_lead',
    status_qualificacao: 'novo_lead',
    lead_score: 1,
    ativo: true,
    origem_id: originId,
    ...(s.adminUserId ? { created_by: s.adminUserId } : {}),
  })
}

const noopLogger = {
  level: 'silent',
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  child: () => noopLogger,
}

export function connectWhatsApp(index: number, adminUserId?: string, adminToken?: string): void {
  const s = slot(index)
  if (s.status === 'connected' || s.status === 'connecting') return

  if (adminUserId) s.adminUserId = adminUserId
  if (adminToken) s.adminToken = adminToken

  s.status = 'connecting'
  s.qrBase64 = null

  doConnect(index).catch((err) => {
    console.error(`[WhatsApp slot-${index}] Erro:`, err)
    const st = slot(index)
    st.status = 'disconnected'
    st.qrBase64 = null
  })
}

async function doConnect(index: number): Promise<void> {
  const s = slot(index)

  const baileys = await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ '@whiskeysockets/baileys' as string)
  const makeWASocket = baileys.default ?? (baileys as unknown as { default: typeof baileys.default }).default
  const { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = baileys as unknown as {
    useMultiFileAuthState: (dir: string) => Promise<{ state: unknown; saveCreds: () => void }>
    fetchLatestBaileysVersion: () => Promise<{ version: [number, number, number] }>
    DisconnectReason: Record<string, number>
  }
  const { toDataURL } = await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ 'qrcode' as string)

  const { state: authState, saveCreds } = await useMultiFileAuthState(sessionDir(index))

  let version: [number, number, number]
  try {
    const v = await fetchLatestBaileysVersion()
    version = v.version
  } catch {
    version = [2, 3000, 1023372854]
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sock = (makeWASocket as any)({
    version,
    auth: authState,
    printQRInTerminal: false,
    logger: noopLogger,
    generateHighQualityLinkPreview: false,
    syncFullHistory: false,
  })

  global.__waSockets[index] = sock

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sock.ev.on('connection.update', async (update: any) => {
    const st = slot(index)
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      st.status = 'waiting_qr'
      try {
        st.qrBase64 = await toDataURL(qr, { width: 280, margin: 2 })
      } catch {
        st.qrBase64 = null
      }
    }

    if (connection === 'close') {
      const code = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode
      const shouldReconnect = code !== DisconnectReason.loggedOut

      st.status = 'disconnected'
      st.qrBase64 = null
      st.phone = null
      global.__waSockets[index] = null

      if (shouldReconnect) {
        setTimeout(() => connectWhatsApp(index), 3000)
      }
    } else if (connection === 'open') {
      st.status = 'connected'
      st.qrBase64 = null
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const jid: string = (sock as any).user?.id ?? ''
        const cleaned = jid.split(':')[0].replace(/\D/g, '')
        if (cleaned) st.phone = `+${cleaned}`
      } catch {}
    }
  })

  sock.ev.on('creds.update', saveCreds)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sock.ev.on('messages.upsert', async ({ messages }: any) => {
    const st = slot(index)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const msg of messages as any[]) {
      if (msg.key?.fromMe) continue
      const jid: string = msg.key?.remoteJid ?? ''
      if (!jid || jid.endsWith('@g.us') || jid.endsWith('@broadcast')) continue

      const phone = jid.replace('@s.whatsapp.net', '')
      const name: string | null = msg.pushName ?? null

      try {
        await saveContact(st, phone, name)
      } catch (err) {
        console.error(`[WhatsApp slot-${index}] Erro ao salvar contato:`, err)
      }
    }
  })
}

export async function disconnectWhatsApp(index: number): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sock = global.__waSockets[index] as any
    if (sock) {
      await sock.logout().catch(() => {})
      global.__waSockets[index] = null
    }
  } catch {}

  const s = slot(index)
  s.status = 'disconnected'
  s.qrBase64 = null
  s.phone = null

  try {
    const { rm } = await import('fs/promises')
    await rm(sessionDir(index), { recursive: true, force: true })
  } catch {}
}
