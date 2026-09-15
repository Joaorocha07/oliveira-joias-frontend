import { createClient } from '@supabase/supabase-js'

// Server-only: NUNCA importar este arquivo em componente/hook com 'use client'.
// A env var não tem prefixo NEXT_PUBLIC_, então o Next.js nunca a injeta no
// bundle do navegador — mas o import em si só deve acontecer em Route Handlers.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export function getSupabaseAdminConfigError() {
  if (!supabaseUrl || !serviceRoleKey) {
    return 'Configure SUPABASE_SERVICE_ROLE_KEY no arquivo .env (chave server-only, nunca NEXT_PUBLIC_).'
  }
  return null
}

// Client privilegiado (service_role) — ignora RLS. Só pode ser importado em
// código server-side (Route Handlers). O pacote "server-only" quebra o build
// se este arquivo acabar sendo importado por um componente client.
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  serviceRoleKey || 'placeholder-key',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)
