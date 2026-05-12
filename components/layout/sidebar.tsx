'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, ShoppingCart, CreditCard, Diamond, Wrench,
  Users, Truck, Wallet, BarChart3, Settings, LogOut, ChevronLeft, Menu,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/auth-context'
import { AlertDialog } from '@/components/ui'
import { getInitials } from '@/utils'
import { cn } from '@/lib/cn'

interface NavItem {
  href: string
  icon: React.ReactNode
  label: string
  section?: string
}

const navItems: NavItem[] = [
  { section: 'Principal', href: '/dashboard', icon: <LayoutDashboard size={16} />, label: 'Painel Geral' },
  { href: '/vendas',       icon: <ShoppingCart size={16} />, label: 'Vendas' },
  { href: '/crediario',    icon: <CreditCard size={16} />,   label: 'Crediário' },
  { section: 'Cadastros', href: '/estoque',  icon: <Diamond size={16} />,  label: 'Estoque' },
  { href: '/servicos',     icon: <Wrench size={16} />,       label: 'Serviços' },
  { href: '/clientes',     icon: <Users size={16} />,        label: 'Clientes' },
  { href: '/fornecedores', icon: <Truck size={16} />,        label: 'Fornecedores' },
  { section: 'Financeiro', href: '/caixa',  icon: <Wallet size={16} />,   label: 'Caixa & Financeiro' },
  { href: '/relatorios',   icon: <BarChart3 size={16} />,    label: 'Relatórios' },
]

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
    toast.success('Até logo!')
    router.replace('/login')
    setSigningOut(false)
  }

  return (
    <>
      <aside className={cn(
        'flex flex-col bg-dark-800 border-r border-dark-700 transition-all duration-200 flex-shrink-0',
        collapsed ? 'w-14' : 'w-56'
      )}>
        {/* Logo */}
        <div className="px-4 py-5 border-b border-dark-700 flex items-center justify-between">
          {!collapsed && (
            <div>
              <p className="font-display text-lg text-gold-300 leading-tight">Oliveira Joias</p>
              <p className="text-[10px] text-dark-300 tracking-widest uppercase mt-0.5">Sistema de Gestão</p>
            </div>
          )}
          <button
            onClick={onToggle}
            className="p-1 rounded-lg text-dark-300 hover:text-gold-300 hover:bg-dark-700 transition-colors ml-auto"
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {collapsed ? <Menu size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <div key={item.href}>
                {item.section && !collapsed && (
                  <p className="px-2 pt-3 pb-1 text-[10px] uppercase tracking-widest text-dark-300 select-none">
                    {item.section}
                  </p>
                )}
                <Link
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  onClick={onMobileClose}
                  className={cn(
                    'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-all',
                    'text-dark-300 hover:text-gold-300 hover:bg-dark-700',
                    isActive && 'text-gold-300 bg-dark-700 border-l-2 border-gold-500 pl-2',
                    collapsed && 'justify-center px-0'
                  )}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </div>
            )
          })}
        </nav>

        {/* User footer */}
        <div className="px-2 py-3 border-t border-dark-700">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 px-2 py-2">
              <div className="w-7 h-7 rounded-full bg-gold-500 flex items-center justify-center text-xs font-medium text-dark-800 flex-shrink-0">
                {profile ? getInitials(profile.nome) : '?'}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-medium text-dark-100 truncate">{profile?.nome || 'Usuário'}</p>
                <p className="text-[10px] text-dark-300 capitalize">{profile?.role}</p>
              </div>
              <div className="flex gap-1">
                <Link
                  href="/configuracoes"
                  onClick={onMobileClose}
                  className="p-1 rounded text-dark-300 hover:text-gold-300 transition-colors"
                  title="Configurações"
                >
                  <Settings size={13} />
                </Link>
                <button
                  type="button"
                  onClick={() => setSignOutOpen(true)}
                  className="p-1 rounded text-dark-300 hover:text-red-400 transition-colors"
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
              className="w-full flex justify-center p-2 text-dark-300 hover:text-red-400 transition-colors"
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
        icon={<LogOut size={22} />}
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
