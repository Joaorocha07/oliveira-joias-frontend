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
    <Card className={cn(accent && 'border-l-4 border-l-gold-500', className)}>
      <p className="text-[10px] sm:text-xs uppercase tracking-wide text-dark-300 mb-1">{label}</p>
      <p className="font-display text-xl sm:text-2xl font-medium text-dark-700">{value}</p>
      {change && (
        <p className={cn(
          'text-xs mt-1',
          changeType === 'up'      && 'text-green-600',
          changeType === 'down'    && 'text-red-600',
          changeType === 'neutral' && 'text-dark-300',
        )}>
          {change}
        </p>
      )}
    </Card>
  )
}
