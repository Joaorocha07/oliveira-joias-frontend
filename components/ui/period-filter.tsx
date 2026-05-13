import { format, startOfMonth, subDays, subMonths } from 'date-fns'
import { Button } from './button'
import { Input } from './input'

export type PeriodPreset = 'hoje' | 'sete_dias' | 'mes' | 'tres_meses' | 'tudo' | 'custom'

interface PeriodFilterProps {
  dataInicio: string
  dataFim: string
  activePreset: PeriodPreset
  onChange: (periodo: { inicio: string; fim: string; preset: PeriodPreset }) => void
  className?: string
}

function toDateStr(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

export function getPeriodRange(preset: Exclude<PeriodPreset, 'custom'>) {
  const hoje = new Date()
  if (preset === 'hoje') return { inicio: toDateStr(hoje), fim: toDateStr(hoje) }
  if (preset === 'sete_dias') return { inicio: toDateStr(subDays(hoje, 6)), fim: toDateStr(hoje) }
  if (preset === 'mes') return { inicio: toDateStr(startOfMonth(hoje)), fim: toDateStr(hoje) }
  if (preset === 'tres_meses') return { inicio: toDateStr(startOfMonth(subMonths(hoje, 2))), fim: toDateStr(hoje) }
  return { inicio: '2000-01-01', fim: toDateStr(hoje) }
}

const PRESETS: { key: Exclude<PeriodPreset, 'custom'>; label: string }[] = [
  { key: 'hoje', label: 'Hoje' },
  { key: 'sete_dias', label: '7 dias' },
  { key: 'mes', label: 'Mês' },
  { key: 'tres_meses', label: '3 meses' },
  { key: 'tudo', label: 'Tudo' },
]

export function PeriodFilter({ dataInicio, dataFim, activePreset, onChange, className }: PeriodFilterProps) {
  function applyPreset(preset: Exclude<PeriodPreset, 'custom'>) {
    const { inicio, fim } = getPeriodRange(preset)
    onChange({ inicio, fim, preset })
  }

  function setInicio(inicio: string) {
    onChange({ inicio, fim: inicio > dataFim ? inicio : dataFim, preset: 'custom' })
  }

  function setFim(fim: string) {
    onChange({ inicio: fim < dataInicio ? fim : dataInicio, fim, preset: 'custom' })
  }

  return (
    <div className={className ?? 'flex flex-col lg:flex-row gap-3 lg:items-end'}>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.key}
            type="button"
            variant={activePreset === preset.key ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => applyPreset(preset.key)}
          >
            {preset.label}
          </Button>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:ml-auto">
        <Input label="De" type="date" value={dataInicio} onChange={(e) => setInicio(e.target.value)} />
        <Input label="Ate" type="date" value={dataFim} onChange={(e) => setFim(e.target.value)} />
      </div>
    </div>
  )
}
