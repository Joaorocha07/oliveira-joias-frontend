'use client'

import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { Badge, EmptyState, Modal, Spinner } from '@/components/ui'
import { listarHistoricoFuncionario, mesLabel } from '@/services/folha'
import { formatMoney } from '@/utils'
import type { FolhaPagamento, FuncionarioFolha } from '@/types'

interface ModalHistoricoFuncionarioFolhaProps {
  funcionario: FuncionarioFolha | null
  onClose: () => void
  onAbrirFolha: (folha: FolhaPagamento) => void
}

export function ModalHistoricoFuncionarioFolha({ funcionario, ...props }: ModalHistoricoFuncionarioFolhaProps) {
  if (!funcionario) return null
  return <Historico key={funcionario.profile.id} funcionario={funcionario} {...props} />
}

function Historico({ funcionario, onClose, onAbrirFolha }: Omit<ModalHistoricoFuncionarioFolhaProps, 'funcionario'> & { funcionario: FuncionarioFolha }) {
  const [folhas, setFolhas] = useState<FolhaPagamento[] | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let cancelado = false
    listarHistoricoFuncionario(funcionario.profile.id).then(({ data, error }) => {
      if (cancelado) return
      setFolhas(data)
      setErro(error)
    })
    return () => { cancelado = true }
  }, [funcionario.profile.id])

  const totalPago = (folhas ?? []).filter((f) => f.status === 'paga').reduce((s, f) => s + f.valor_liquido, 0)

  return (
    <Modal open onClose={onClose} title={`Histórico — ${funcionario.profile.nome}`} size="md">
      {!folhas && !erro && <div className="flex h-32 items-center justify-center"><Spinner size={24} /></div>}
      {erro && <p className="py-8 text-center text-sm text-[#C75B5B]">{erro}</p>}
      {folhas && folhas.length === 0 && (
        <EmptyState imageSrc="/images/Analytics-rafiki.svg" title="Nenhuma folha ainda" description="Gere a folha do mês na aba Folha do mês." />
      )}
      {folhas && folhas.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-dark-400">
            {folhas.length} folha(s) · total pago <strong className="text-dark-600">{formatMoney(totalPago)}</strong>
          </p>
          <div className="divide-y divide-gold-50">
            {folhas.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onAbrirFolha(f)}
                className="flex w-full items-center gap-3 py-3 text-left hover:bg-cream-50 px-1 rounded-lg"
              >
                <span className="w-16 text-sm font-semibold text-dark-700">{mesLabel(f.mes)}</span>
                <Badge variant={f.status === 'paga' ? 'success' : 'warning'}>{f.status === 'paga' ? 'Paga' : 'Aberta'}</Badge>
                <span className="ml-auto text-sm font-semibold tabular-nums text-dark-700">{formatMoney(f.valor_liquido)}</span>
                <ChevronRight size={14} className="text-dark-300" />
              </button>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}
