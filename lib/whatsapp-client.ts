import path from 'path'
import { createClient } from '@supabase/supabase-js'

// Server-only — importado apenas por Route Handlers.

const SESSION_DIR = path.join(process.cwd(), '.whatsapp-session')

export type ConnectionStatus = 'disconnected' | 'connecting' | 'waiting_qr' | 'connected'

interface WhatsAppState {
  status: ConnectionStatus
  qrBase64: string | null
  adminUserId: string | null
  adminToken: string | null
  phone: string | null
  originId: string | null
}

declare global {
  // eslint-disable-next-line no-var
  var __waState: WhatsAppState | undefined
  // eslint-disable-next-line no-var
  var __waSocket: unknown
}

if (!global.__waState) {
  global.__waState = {
    status: 'disconnected',
    qrBase64: null,
    adminUserId: null,
    adminToken: null,
    phone: null,
    originId: null,
  }
}

const state = global.__waState!

export function getWhatsAppState() {
  return {
    status: state.status,
    qrBase64: state.qrBase64,
    phone: state.phone,
  }
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const opts = {
    auth: { persistSession: false, autoRefreshToken: false },
    ...(state.adminToken
      ? { global: { headers: { Authorization: `Bearer ${state.adminToken}` } } }
      : {}),
  }
  return createClient(url, key, opts)
}

async function resolveWhatsAppOriginId(): Promise<string | null> {
  if (state.originId) return state.originId
  const sb = getSupabase()
  const { data } = await sb
    .from('origens_cliente')
    .select('id')
    .ilike('nome', 'whatsapp')
    .maybeSingle()
  state.originId = data?.id ?? null
  return state.originId
}

async function saveContact(rawPhone: string, pushName: string | null) {
  const phone = rawPhone.replace(/\D/g, '')
  const whatsappNumber = `+${phone}`
  const sb = getSupabase()

  const { data: existing } = await sb
    .from('clientes')
    .select('id')
    .or(`whatsapp.eq.${whatsappNumber},telefone.eq.${whatsappNumber}`)
    .maybeSingle()

  if (existing) return

  const originId = await resolveWhatsAppOriginId()

  await sb.from('clientes').insert({
    nome: pushName?.trim() || `WhatsApp ${whatsappNumber}`,
    whatsapp: whatsappNumber,
    telefone: whatsappNumber,
    status_funil: 'novo_lead',
    status_qualificacao: 'novo_lead',
    lead_score: 1,
    ativo: true,
    origem_id: originId,
    ...(state.adminUserId ? { created_by: state.adminUserId } : {}),
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

// Inicia conexão em background — retorna imediatamente para não bloquear a API route.
// O frontend detecta mudanças de estado via polling em /api/whatsapp/status.
export function connectWhatsApp(adminUserId?: string, adminToken?: string): void {
  if (state.status === 'connected' || state.status === 'connecting') return

  if (adminUserId) state.adminUserId = adminUserId
  if (adminToken) state.adminToken = adminToken

  state.status = 'connecting'
  state.qrBase64 = null

  doConnect().catch((err) => {
    console.error('[WhatsApp] Erro ao iniciar conexão:', err)
    state.status = 'disconnected'
    state.qrBase64 = null
  })
}

async function doConnect(): Promise<void> {
  const baileys = await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ '@whiskeysockets/baileys' as string)
  const makeWASocket = baileys.default ?? (baileys as unknown as { default: typeof baileys.default }).default
  const { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } = baileys as unknown as {
    useMultiFileAuthState: (dir: string) => Promise<{ state: unknown; saveCreds: () => void }>
    fetchLatestBaileysVersion: () => Promise<{ version: [number, number, number] }>
    DisconnectReason: Record<string, number>
  }
  const { toDataURL } = await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ 'qrcode' as string)

  const { state: authState, saveCreds } = await useMultiFileAuthState(SESSION_DIR)

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

  global.__waSocket = sock

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sock.ev.on('connection.update', async (update: any) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      state.status = 'waiting_qr'
      try {
        state.qrBase64 = await toDataURL(qr, { width: 280, margin: 2 })
      } catch {
        state.qrBase64 = null
      }
    }

    if (connection === 'close') {
      const code = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode
      const shouldReconnect = code !== DisconnectReason.loggedOut

      state.status = 'disconnected'
      state.qrBase64 = null
      state.phone = null
      global.__waSocket = null

      if (shouldReconnect) {
        setTimeout(() => connectWhatsApp(), 3000)
      }
    } else if (connection === 'open') {
      state.status = 'connected'
      state.qrBase64 = null
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const jid: string = (sock as any).user?.id ?? ''
        const cleaned = jid.split(':')[0].replace(/\D/g, '')
        if (cleaned) state.phone = `+${cleaned}`
      } catch {}
    }
  })

  sock.ev.on('creds.update', saveCreds)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sock.ev.on('messages.upsert', async ({ messages }: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const msg of messages as any[]) {
      if (msg.key?.fromMe) continue
      const jid: string = msg.key?.remoteJid ?? ''
      if (!jid || jid.endsWith('@g.us') || jid.endsWith('@broadcast')) continue

      const phone = jid.replace('@s.whatsapp.net', '')
      const name: string | null = msg.pushName ?? null

      try {
        await saveContact(phone, name)
      } catch (err) {
        console.error('[WhatsApp] Erro ao salvar contato:', err)
      }
    }
  })
}

export async function disconnectWhatsApp(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sock = global.__waSocket as any
    if (sock) {
      await sock.logout().catch(() => {})
      global.__waSocket = null
    }
  } catch {}

  state.status = 'disconnected'
  state.qrBase64 = null
  state.phone = null

  // Remove session files so next connect shows QR again
  try {
    const { rm } = await import('fs/promises')
    await rm(SESSION_DIR, { recursive: true, force: true })
  } catch {}
}
