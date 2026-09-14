'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, CreditCard, Diamond, Wrench,
  Users, Truck, Wallet, BarChart3, Settings, LogOut, ChevronLeft, Menu, UserCog, Receipt, FileText,
  Kanban, CalendarClock, Gauge, Calendar, LineChart, Gift, MessageSquareText, Globe, Layers, Award,
} from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { AlertDialog } from '@/components/ui'
import { getInitials } from '@/utils'
import { cn } from '@/lib/cn'
import { canAccessMenu } from '@/lib/menus-config'
import type { UserRole } from '@/types'

interface NavItem {
  href: string
  icon: React.ReactNode
  label: string
  sectionLabel: string
  menuKey?: string
  external?: boolean
}

const navItems: NavItem[] = [
  { sectionLabel: 'Principal',   href: '/dashboard',         icon: <LayoutDashboard size={18} />,     label: 'Painel Geral' },
  { sectionLabel: 'Principal',   href: '/vendas',            icon: <ShoppingCart size={18} />,        label: 'Vendas',              menuKey: 'vendas' },
  { sectionLabel: 'Principal',   href: '/crediario',         icon: <CreditCard size={18} />,          label: 'Crediário',           menuKey: 'crediario' },
  { sectionLabel: 'Cadastros',   href: '/estoque',           icon: <Diamond size={18} />,             label: 'Estoque',             menuKey: 'estoque' },
  { sectionLabel: 'Cadastros',   href: '/servicos',          icon: <Wrench size={18} />,              label: 'Serviços',            menuKey: 'servicos' },
  { sectionLabel: 'Cadastros',   href: '/orcamentos',        icon: <FileText size={18} />,            label: 'Orçamentos',          menuKey: 'orcamentos' },
  { sectionLabel: 'Cadastros',   href: '/clientes',          icon: <Users size={18} />,               label: 'Clientes',            menuKey: 'clientes' },
  { sectionLabel: 'Cadastros',   href: '/fornecedores',      icon: <Truck size={18} />,               label: 'Fornecedores',        menuKey: 'fornecedores' },
  { sectionLabel: 'Cadastros',   href: '/vendedores',        icon: <UserCog size={18} />,             label: 'Equipe de Vendas',    menuKey: 'equipe' },
  { sectionLabel: 'CRM',         href: '/crm/dashboard',     icon: <Gauge size={18} />,               label: 'Dashboard',           menuKey: 'crm_dashboard' },
  { sectionLabel: 'CRM',         href: '/crm',               icon: <Kanban size={18} />,              label: 'Funil de Vendas',     menuKey: 'crm_funil' },
  { sectionLabel: 'CRM',         href: '/crm/follow-up',     icon: <CalendarClock size={18} />,       label: 'Follow-up',           menuKey: 'crm_followup' },
  { sectionLabel: 'CRM',         href: '/crm/calendario',    icon: <Calendar size={18} />,            label: 'Calendário',          menuKey: 'crm_calendario' },
  { sectionLabel: 'CRM',         href: '/crm/pos-venda',     icon: <Gift size={18} />,                label: 'Pós-venda',           menuKey: 'crm_posvenda' },
  { sectionLabel: 'CRM',         href: '/crm/mensagens',     icon: <MessageSquareText size={18} />,   label: 'Mensagens',           menuKey: 'crm_mensagens' },
  { sectionLabel: 'CRM',         href: '/crm/relatorios',    icon: <LineChart size={18} />,           label: 'Relatórios CRM',      menuKey: 'crm_relatorios' },
  { sectionLabel: 'Site',        href: '/portfolio',         icon: <Globe size={18} />,               label: 'Produtos do Portfólio', menuKey: 'portfolio' },
  { sectionLabel: 'Site',        href: '/popups',            icon: <Layers size={18} />,              label: 'Pop-ups do Site',     menuKey: 'popups' },
  { sectionLabel: 'Site',        href: 'https://oliveirajoias.vercel.app/certificados', icon: <Award size={18} />, label: 'Certificados', menuKey: 'certificados', external: true },
  { sectionLabel: 'Financeiro',  href: '/caixa',             icon: <Wallet size={18} />,              label: 'Caixa & Financeiro',  menuKey: 'caixa' },
  { sectionLabel: 'Financeiro',  href: '/contas-pagar',      icon: <Receipt size={18} />,             label: 'Contas a Pagar',      menuKey: 'contas_pagar' },
  { sectionLabel: 'Financeiro',  href: '/relatorios',        icon: <BarChart3 size={18} />,           label: 'Relatórios',          menuKey: 'relatorios' },
]

function isItemVisible(item: NavItem, role: UserRole, menusPerm: string[] | null | undefined): boolean {
  return canAccessMenu(role, menusPerm, item.menuKey)
}

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Administrador',
  vendedor: 'Vendedor',
  caixa: 'Caixa',
  visualizador: 'Visualizador',
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  onMobileClose?: () => void
}

export function Sidebar({ collapsed, onToggle, onMobileClose }: SidebarProps) {
  const { profile, signOut } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const [signOutOpen, setSignOutOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    await signOut()
    router.replace('/login')
    setSigningOut(false)
  }

  const visibleItems = navItems.filter((item) =>
    isItemVisible(item, profile?.role ?? 'visualizador', profile?.menus_permitidos)
  )

  // Compute which items show their section header (first per section in filtered list)
  const seenSections = new Set<string>()
  const processedItems = visibleItems.map((item) => {
    const showSection = !seenSections.has(item.sectionLabel)
    seenSections.add(item.sectionLabel)
    return { ...item, showSection }
  })

  return (
    <>
      <aside className={cn(
        'flex flex-col bg-dark-800 border-r border-white/[0.04] transition-all duration-200 flex-shrink-0',
        collapsed ? 'w-14' : 'w-56'
      )}>
        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/[0.06] flex items-center justify-between">
          {!collapsed && (
            <div>
              <p className="font-display text-lg text-gold-500 leading-tight tracking-wide">Oliveira Joias</p>
              <p className="text-[10px] text-dark-300 tracking-[1.5px] uppercase mt-0.5">Sistema de Gestão</p>
            </div>
          )}
          <button
            onClick={onToggle}
            className="p-1 rounded-lg text-dark-300 hover:text-gold-500 hover:bg-white/[0.04] transition-colors ml-auto"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
          {processedItems.map((item) => {
            const isActive = !item.external && (
              pathname === item.href
              || (pathname.startsWith(item.href + '/') && !navItems.some((o) => o.href === pathname))
            )

            const itemContent = (
              <>
                <span className={cn(
                  'flex-shrink-0 transition-colors duration-150',
                  isActive ? 'text-gold-500' : 'text-dark-300'
                )}>
                  {item.icon}
                </span>
                {!collapsed && <span className="leading-none">{item.label}</span>}
              </>
            )

            return (
              <div key={item.href}>
                {item.showSection && !collapsed && (
                  <p className="px-2.5 pt-4 pb-1.5 text-[10px] uppercase tracking-[1.5px] text-dark-400 select-none font-semibold">
                    {item.sectionLabel}
                  </p>
                )}
                {item.external ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={collapsed ? item.label : undefined}
                    onClick={onMobileClose}
                    className={cn(
                      'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-all duration-150',
                      'text-dark-300 hover:text-dark-200/80 hover:bg-white/[0.04]',
                      collapsed && 'justify-center px-0'
                    )}
                  >
                    {itemContent}
                  </a>
                ) : (
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    onClick={onMobileClose}
                    className={cn(
                      'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-all duration-150',
                      isActive
                        ? 'bg-[rgba(201,168,76,0.12)] text-gold-500 border-l-[3px] border-l-gold-500 pl-[7px]'
                        : 'text-dark-300 hover:text-dark-200/80 hover:bg-white/[0.04]',
                      collapsed && 'justify-center px-0'
                    )}
                  >
                    {itemContent}
                  </Link>
                )}
              </div>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="px-2 py-3 border-t border-white/[0.06]">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 px-2 py-2">
              <div className="w-7 h-7 rounded-full bg-gold-500 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
                {profile ? getInitials(profile.nome) : '?'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-medium text-white/80 truncate">{profile?.nome || 'Usuário'}</p>
                <p className="text-[10px] text-dark-300 capitalize mt-0.5">
                  {profile ? ROLE_LABEL[profile.role] : ''}
                </p>
              </div>
              <div className="flex gap-1">
                <Link
                  href="/configuracoes"
                  onClick={onMobileClose}
                  className="p-1.5 rounded text-dark-300 hover:text-gold-500 transition-colors"
                  title="Configurações"
                >
                  <Settings size={13} />
                </Link>
                <button
                  type="button"
                  onClick={() => setSignOutOpen(true)}
                  className="p-1.5 rounded text-dark-300 hover:text-[#C75B5B] transition-colors"
                  title="Sair"
                >
                  <LogOut size={13} />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setSignOutOpen(true)}
              className="w-full flex justify-center p-2 text-dark-300 hover:text-[#C75B5B] transition-colors"
              title="Sair"
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      </aside>

      <AlertDialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        onConfirm={handleSignOut}
        icon={<LogOut size={28} />}
        iconVariant="danger"
        title="Sair da conta?"
        description={
          profile?.nome
            ? `Olá, ${profile.nome.split(' ')[0]}. Você será desconectado do sistema Oliveira Joias.`
            : 'Você será desconectado do sistema Oliveira Joias.'
        }
        confirmLabel="Sair"
        cancelLabel="Cancelar"
        loading={signingOut}
      />
    </>
  )
}
