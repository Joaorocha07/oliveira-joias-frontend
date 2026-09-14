import type { UserRole } from '@/types'

export interface MenuConfig {
  key: string
  label: string
  section: string
  defaultOn: boolean
}

export const MENUS_VENDEDOR_CONFIG: MenuConfig[] = [
  { key: 'vendas',        label: 'Vendas',          section: 'Principal',  defaultOn: true  },
  { key: 'crediario',     label: 'Crediário',        section: 'Principal',  defaultOn: true  },
  { key: 'estoque',       label: 'Estoque',          section: 'Cadastros',  defaultOn: true  },
  { key: 'servicos',      label: 'Serviços',         section: 'Cadastros',  defaultOn: true  },
  { key: 'orcamentos',    label: 'Orçamentos',       section: 'Cadastros',  defaultOn: true  },
  { key: 'clientes',      label: 'Clientes',         section: 'Cadastros',  defaultOn: true  },
  { key: 'fornecedores',  label: 'Fornecedores',     section: 'Cadastros',  defaultOn: false },
  { key: 'crm_dashboard', label: 'Dashboard CRM',    section: 'CRM',        defaultOn: true  },
  { key: 'crm_funil',     label: 'Funil de Vendas',  section: 'CRM',        defaultOn: true  },
  { key: 'crm_followup',  label: 'Follow-up',        section: 'CRM',        defaultOn: true  },
  { key: 'crm_calendario',label: 'Calendário',       section: 'CRM',        defaultOn: true  },
  { key: 'crm_posvenda',  label: 'Pós-venda',        section: 'CRM',        defaultOn: true  },
  { key: 'crm_mensagens', label: 'Mensagens',        section: 'CRM',        defaultOn: true  },
  { key: 'crm_relatorios',label: 'Relatórios CRM',   section: 'CRM',        defaultOn: true  },
  { key: 'portfolio',     label: 'Portfólio',        section: 'Site',       defaultOn: false },
  { key: 'popups',        label: 'Pop-ups do Site',  section: 'Site',       defaultOn: false },
  { key: 'relatorios',    label: 'Relatórios',       section: 'Relatórios', defaultOn: true  },
  { key: 'certificados',  label: 'Certificados',     section: 'Extra',      defaultOn: true  },
]

export const VENDEDOR_DEFAULT_MENUS: string[] = MENUS_VENDEDOR_CONFIG
  .filter((m) => m.defaultOn)
  .map((m) => m.key)

// Menus always blocked for vendedor regardless of menus_permitidos
export const VENDEDOR_ALWAYS_BLOCKED = ['caixa', 'contas_pagar', 'equipe']

const CAIXA_ALLOWED = ['vendas', 'crediario', 'caixa', 'contas_pagar']

/**
 * Regra única de acesso por tela, usada tanto para esconder itens no menu lateral
 * quanto para bloquear o acesso direto por URL (ver app-shell.tsx).
 */
export function canAccessMenu(
  role: UserRole,
  menusPermitidos: string[] | null | undefined,
  menuKey: string | undefined,
): boolean {
  if (role === 'admin') return true
  if (!menuKey) return true

  if (role === 'vendedor') {
    if (VENDEDOR_ALWAYS_BLOCKED.includes(menuKey)) return false
    const allowed = menusPermitidos ?? VENDEDOR_DEFAULT_MENUS
    return allowed.includes(menuKey)
  }

  if (role === 'caixa') {
    return CAIXA_ALLOWED.includes(menuKey)
  }

  if (role === 'visualizador') {
    return false
  }

  return true
}

interface RouteMenu {
  path: string
  menuKey: string
}

const ROUTE_MENU_MAP: RouteMenu[] = [
  { path: '/vendas',            menuKey: 'vendas' },
  { path: '/crediario',         menuKey: 'crediario' },
  { path: '/estoque',           menuKey: 'estoque' },
  { path: '/servicos',          menuKey: 'servicos' },
  { path: '/orcamentos',        menuKey: 'orcamentos' },
  { path: '/clientes',          menuKey: 'clientes' },
  { path: '/fornecedores',      menuKey: 'fornecedores' },
  { path: '/vendedores',        menuKey: 'equipe' },
  { path: '/crm/dashboard',     menuKey: 'crm_dashboard' },
  { path: '/crm/follow-up',     menuKey: 'crm_followup' },
  { path: '/crm/calendario',    menuKey: 'crm_calendario' },
  { path: '/crm/pos-venda',     menuKey: 'crm_posvenda' },
  { path: '/crm/mensagens',     menuKey: 'crm_mensagens' },
  { path: '/crm/relatorios',    menuKey: 'crm_relatorios' },
  { path: '/crm',               menuKey: 'crm_funil' },
  { path: '/certificados',      menuKey: 'certificados' },
  { path: '/portfolio',         menuKey: 'portfolio' },
  { path: '/popups',            menuKey: 'popups' },
  { path: '/caixa',             menuKey: 'caixa' },
  { path: '/contas-pagar',      menuKey: 'contas_pagar' },
  { path: '/relatorios',        menuKey: 'relatorios' },
].sort((a, b) => b.path.length - a.path.length)

export function getMenuKeyForPath(pathname: string): string | undefined {
  const match = ROUTE_MENU_MAP.find(
    (route) => pathname === route.path || pathname.startsWith(`${route.path}/`)
  )
  return match?.menuKey
}
