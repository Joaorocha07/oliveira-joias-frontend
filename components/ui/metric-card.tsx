import { Card } from './card'
import { cn } from '@/lib/cn'

interface MetricCardProps {
  label: string
  value: string | number
  change?: string
  changeType?: 'up' | 'down' | 'neutral'
  accent?: boolean
  className?: string
}

export function MetricCard({ label, value, change, changeType = 'neutral', accent, className }: MetricCardProps) {
  return (
    <Card className={cn(accent && 'border-l-[3px] border-l-gold-500', className)}>
      <p className="text-[11px] uppercase tracking-[1px] text-dark-400 font-semibold mb-2">{label}</p>
      <p className="font-display text-2xl font-semibold text-dark-500 tabular-nums">{value}</p>
      {change && (
        <p className={cn(
          'text-xs mt-1.5 font-medium',
          changeType === 'up'      && 'text-[#5B8C5B]',
          changeType === 'down'    && 'text-[#C75B5B]',
          changeType === 'neutral' && 'text-dark-300',
        )}>
          {change}
        </p>
      )}
    </Card>
  )
}
