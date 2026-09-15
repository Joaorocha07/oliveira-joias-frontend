import { NextResponse } from 'next/server'
import { getSupabaseAdminConfigError, supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(request: Request) {
  const configError = getSupabaseAdminConfigError()
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    return NextResponse.json({ error: 'Nao autenticado.' }, { status: 401 })
  }

  const { data: { user: callerUser }, error: callerError } = await supabaseAdmin.auth.getUser(token)
  if (callerError || !callerUser) {
    return NextResponse.json({ error: 'Sessao invalida ou expirada. Faca login novamente.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const vendedorId = typeof body?.vendedorId === 'string' ? body.vendedorId : null
  if (!vendedorId) {
    return NextResponse.json({ error: 'Vendedor invalido.' }, { status: 400 })
  }

  const { data: callerProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, nome, role, ativo')
    .eq('id', callerUser.id)
    .maybeSingle()

  if (!callerProfile || callerProfile.role !== 'admin' || !callerProfile.ativo) {
    return NextResponse.json({ error: 'Apenas administradores podem fazer isso.' }, { status: 403 })
  }

  const { data: vendedorProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, nome, email, role, ativo')
    .eq('id', vendedorId)
    .maybeSingle()

  if (!vendedorProfile || vendedorProfile.role !== 'vendedor' || !vendedorProfile.ativo) {
    return NextResponse.json({ error: 'Vendedor nao encontrado ou inativo.' }, { status: 404 })
  }

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: vendedorProfile.email,
  })

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: 'Nao foi possivel gerar o acesso do vendedor.' }, { status: 500 })
  }

  await supabaseAdmin.from('admin_impersonacoes').insert({
    admin_id: callerProfile.id,
    admin_nome: callerProfile.nome,
    vendedor_id: vendedorProfile.id,
    vendedor_nome: vendedorProfile.nome,
  })

  return NextResponse.json({ tokenHash: linkData.properties.hashed_token })
}
