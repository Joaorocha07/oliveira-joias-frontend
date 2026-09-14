export interface MenuConfig {
  key: string
  label: string
  section: string
  defaultOn: boolean
}

export const MENUS_FUNCIONARIO_CONFIG: MenuConfig[] = [
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

export const FUNCIONARIO_DEFAULT_MENUS: string[] = MENUS_FUNCIONARIO_CONFIG
  .filter((m) => m.defaultOn)
  .map((m) => m.key)

// Menus always blocked for funcionario regardless of menus_permitidos
export const FUNCIONARIO_ALWAYS_BLOCKED = ['caixa', 'contas_pagar', 'equipe']
