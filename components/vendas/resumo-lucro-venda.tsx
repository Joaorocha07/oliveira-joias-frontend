import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatMoney } from '@/utils'
import type { AnaliseLucroVenda } from '@/types'

interface ResumoLucroVendaProps {
  analise: AnaliseLucroVenda
  className?: string
}

// Quebra faturamento → custo dos produtos → custos adicionais → lucro líquido de uma venda.
// Só deve ser exibido para quem não é vendedor (mesma regra dos relatórios).
export function ResumoLucroVenda({ analise, className }: ResumoLucroVendaProps) {
  const positivo = analise.lucro >= 0
  const linhas = [
    { label: 'Faturamento', value: analise.faturamento, negativo: false },
    { label: 'Custo dos produtos', value: analise.custoProdutos, negativo: true },
    { label: 'Custos adicionais', value: analise.custosAdicionais, negativo: true },
  ]

  return (
    <div className={cn('rounded-xl border border-gold-100 bg-cream-50/60 p-4', className)}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[1px] text-dark-400">Análise de lucro</p>
      <div className="flex flex-col gap-1">
        {linhas.map(({ label, value, negativo }) => (
          <div key={label} className="flex justify-between text-sm text-dark-500">
            <span>{label}</span>
            <span className="tabular-nums">
              {negativo && value > 0 ? `− ${formatMoney(value)}` : formatMoney(value)}
            </span>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-gold-100 pt-2">
          <span className="flex items-center gap-1.5 text-sm font-medium text-dark-700">
            {positivo ? <TrendingUp size={14} className="text-[#5B8C5B]" /> : <TrendingDown size={14} className="text-[#C75B5B]" />}
            Lucro líquido
          </span>
          <span className={cn('font-display text-lg font-semibold tabular-nums', positivo ? 'text-[#5B8C5B]' : 'text-[#C75B5B]')}>
            {formatMoney(analise.lucro)}
            {analise.faturamento > 0 && (
              <span className="ml-1.5 text-xs font-medium">({analise.margem.toFixed(1)}%)</span>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
