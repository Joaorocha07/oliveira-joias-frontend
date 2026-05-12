import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

function getSupabaseConfigError() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return 'Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no arquivo .env.'
  }

  try {
    const url = new URL(supabaseUrl)
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co')) {
      return 'NEXT_PUBLIC_SUPABASE_URL deve ser uma URL HTTPS valida do Supabase.'
    }
  } catch {
    return 'NEXT_PUBLIC_SUPABASE_URL deve ser uma URL valida.'
  }

  return null
}

export const supabaseConfigError = getSupabaseConfigError()

const globalForSupabase = globalThis as typeof globalThis & {
  __oliveiraSupabaseClient?: SupabaseClient
}

// O client precisa existir durante build/dev, mas as operacoes devem bloquear
// chamadas reais quando a configuracao publica do Supabase estiver ausente.
export const supabase =
  globalForSupabase.__oliveiraSupabaseClient ??
  createClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  )

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.__oliveiraSupabaseClient = supabase
}
