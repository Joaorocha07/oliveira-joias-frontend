'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Smartphone, Wifi, WifiOff, RefreshCw, LogOut, Users, Clock, CheckCircle2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getAllStatus,
  conectarSlot,
  desconectarSlot,
  listarContatosWhatsApp,
  type SlotStatus,
  type WhatsAppAllStatus,
} from '@/services/whatsapp'
import type { Cliente } from '@/types'
import { formatPhone } from '@/utils'

const STATUS_CONFIG = {
  disconnected: { label: 'Desconectado', color: 'text-dark-300', dot: 'bg-dark-400' },
  connecting:   { label: 'Conectando…',  color: 'text-yellow-400', dot: 'bg-yellow-400' },
  waiting_qr:  { label: 'Aguardando QR', color: 'text-yellow-400', dot: 'bg-yellow-400 animate-pulse' },
  connected:    { label: 'Conectado',    color: 'text-[#5B8C5B]',  dot: 'bg-[#5B8C5B]' },
}

const SLOT_LABELS = ['WhatsApp 1', 'WhatsApp 2']

const emptyStatus: SlotStatus = { status: 'disconnected', qrBase64: null, phone: null }
const emptyAll: WhatsAppAllStatus = { slots: [emptyStatus, emptyStatus] }

interface SlotPanelProps {
  index: 0 | 1
  slotStatus: SlotStatus
  onConnect: (slot: 0 | 1) => void
  onDisconnect: (slot: 0 | 1) => void
  loadingSlot: number | null
}

function SlotPanel({ index, slotStatus, onConnect, onDisconnect, loadingSlot }: SlotPanelProps) {
  const cfg = STATUS_CONFIG[slotStatus.status]
  const isLoading = loadingSlot === index
  const isActive = slotStatus.status === 'connecting' || slotStatus.status === 'waiting_qr'

  return (
    <div className="bg-dark-800 rounded-2xl border border-white/[0.06] overflow-hidden flex flex-col">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
            <Smartphone size={13} className="text-[#25D366]" />
          </div>
          <span className="text-sm font-semibold text-white">{SLOT_LABELS[index]}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
          {slotStatus.phone && (
            <span className="text-xs text-dark-400 font-mono ml-1">{slotStatus.phone}</span>
          )}
        </div>
      </div>

      {/* Corpo */}
      <div className="flex flex-col items-center justify-center p-6 flex-1 min-h-[280px]">
        {slotStatus.status === 'disconnected' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-dark-700 flex items-center justify-center">
              <WifiOff size={26} className="text-dark-400" />
            </div>
            <div>
              <p className="text-white font-medium text-sm">Nenhuma sessão ativa</p>
              <p className="text-xs text-dark-300 mt-1 max-w-[200px]">
                Conecte este número para receber contatos automaticamente.
              </p>
            </div>
            <button
              onClick={() => onConnect(index)}
              disabled={isLoading}
              className="flex items-center gap-2 px-5 py-2 bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Wifi size={14} />}
              Conectar
            </button>
          </div>
        )}

        {slotStatus.status === 'connecting' && (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 size={36} className="text-[#25D366] animate-spin" />
            <p className="text-white font-medium text-sm">Iniciando conexão…</p>
            <p className="text-xs text-dark-300">Aguarde o QR Code aparecer.</p>
          </div>
        )}

        {slotStatus.status === 'waiting_qr' && slotStatus.qrBase64 && (
          <div className="flex flex-col items-center gap-3">
            <div className="bg-white p-2.5 rounded-xl shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slotStatus.qrBase64} alt="QR Code" width={200} height={200} />
            </div>
            <div className="text-center">
              <p className="text-white font-medium text-xs">Escaneie com o celular</p>
              <p className="text-[11px] text-dark-300 mt-0.5">
                WhatsApp → Dispositivos vinculados → Vincular
              </p>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-yellow-400">
              <RefreshCw size={11} className="animate-spin" />
              Atualizando…
            </div>
          </div>
        )}

        {slotStatus.status === 'waiting_qr' && !slotStatus.qrBase64 && (
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 size={36} className="text-[#25D366] animate-spin" />
            <p className="text-white font-medium text-sm">Gerando QR Code…</p>
          </div>
        )}

        {slotStatus.status === 'connected' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[#25D366]/10 flex items-center justify-center">
              <CheckCircle2 size={30} className="text-[#25D366]" />
            </div>
            <div>
              <p className="text-white font-semibold">Conectado!</p>
              {slotStatus.phone && (
                <p className="text-xs text-dark-300 mt-0.5 font-mono">{slotStatus.phone}</p>
              )}
              <p className="text-xs text-dark-300 mt-2 max-w-[200px]">
                Novos contatos serão salvos automaticamente como leads.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Rodapé */}
      {(isActive || slotStatus.status === 'connected') && (
        <div className="px-5 py-3 border-t border-white/[0.06] flex justify-end gap-2">
          {isActive && (
            <button
              onClick={() => onDisconnect(index)}
              className="text-xs text-dark-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              Cancelar
            </button>
          )}
          {slotStatus.status === 'connected' && (
            <button
              onClick={() => onDisconnect(index)}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-xs text-[#C75B5B] hover:text-white hover:bg-[#C75B5B] px-3 py-1.5 rounded-lg border border-[#C75B5B]/30 hover:border-[#C75B5B] transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 size={11} className="animate-spin" /> : <LogOut size={11} />}
              Desconectar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function WhatsAppPage() {
  const [allStatus, setAllStatus] = useState<WhatsAppAllStatus>(emptyAll)
  const [loadingSlot, setLoadingSlot] = useState<number | null>(null)
  const [contatos, setContatos] = useState<Cliente[]>([])
  const [loadingContatos, setLoadingContatos] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const isAnyActive = useCallback((s: WhatsAppAllStatus) =>
    s.slots.some((sl) => sl.status === 'connecting' || sl.status === 'waiting_qr'),
  [])

  const fetchContatos = useCallback(async () => {
    setLoadingContatos(true)
    const { data } = await listarContatosWhatsApp()
    setContatos(data ?? [])
    setLoadingContatos(false)
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const s = await getAllStatus()
      setAllStatus(s)
      if (!isAnyActive(s)) {
        stopPoll()
      }
      if (s.slots.some((sl) => sl.status === 'connected')) {
        fetchContatos()
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopPoll, isAnyActive])

  const startPoll = useCallback(() => {
    stopPoll()
    pollRef.current = setInterval(fetchStatus, 2000)
  }, [fetchStatus, stopPoll])

  useEffect(() => {
    fetchStatus()
    return stopPoll
  }, [fetchStatus, stopPoll])

  useEffect(() => {
    if (allStatus.slots.some((s) => s.status === 'connected')) {
      fetchContatos()
    }
  }, [allStatus.slots, fetchContatos])

  async function handleConnect(slot: 0 | 1) {
    setLoadingSlot(slot)
    startPoll()
    try {
      const s = await conectarSlot(slot)
      setAllStatus(s)
    } catch (err) {
      stopPoll()
      toast.error(err instanceof Error ? err.message : 'Erro ao conectar')
    } finally {
      setLoadingSlot(null)
    }
  }

  async function handleDisconnect(slot: 0 | 1) {
    setLoadingSlot(slot)
    try {
      const s = await desconectarSlot(slot)
      setAllStatus(s)
      if (!s.slots.some((sl) => sl.status === 'connected')) {
        setContatos([])
      }
      toast.success(`${SLOT_LABELS[slot]} desconectado`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao desconectar')
    } finally {
      setLoadingSlot(null)
    }
  }

  const anyConnected = allStatus.slots.some((s) => s.status === 'connected')

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
          <Smartphone size={20} className="text-[#25D366]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">WhatsApp</h1>
          <p className="text-sm text-dark-300">Conecte até 2 números e receba contatos automaticamente</p>
        </div>
      </div>

      {/* Dois painéis lado a lado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {([0, 1] as const).map((i) => (
          <SlotPanel
            key={i}
            index={i}
            slotStatus={allStatus.slots[i] ?? emptyStatus}
            onConnect={handleConnect}
            onDisconnect={handleDisconnect}
            loadingSlot={loadingSlot}
          />
        ))}
      </div>

      {/* Instruções */}
      <div className="bg-dark-800 rounded-2xl border border-white/[0.06] p-5">
        <p className="text-sm font-semibold text-white mb-3">Como funciona</p>
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            'Clique em "Conectar" em cada número que deseja vincular.',
            'Escaneie o QR Code com o celular (WhatsApp → Dispositivos vinculados).',
            'Quando alguém enviar mensagem para qualquer número conectado, o contato é salvo como lead.',
            'Os contatos aparecem em Clientes e no Funil de Vendas com origem "WhatsApp".',
          ].map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-dark-300">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-dark-700 text-[#25D366] text-xs font-semibold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Contatos recebidos */}
      {anyConnected && (
        <div className="bg-dark-800 rounded-2xl border border-white/[0.06]">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-dark-300" />
              <span className="text-sm font-semibold text-white">Contatos recebidos via WhatsApp</span>
            </div>
            <button
              onClick={fetchContatos}
              disabled={loadingContatos}
              className="p-1.5 rounded-lg text-dark-300 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              <RefreshCw size={14} className={loadingContatos ? 'animate-spin' : ''} />
            </button>
          </div>

          {loadingContatos && (
            <div className="flex justify-center py-10">
              <Loader2 size={24} className="animate-spin text-dark-400" />
            </div>
          )}

          {!loadingContatos && contatos.length === 0 && (
            <div className="flex flex-col items-center py-12 gap-2 text-center">
              <Smartphone size={32} className="text-dark-500" />
              <p className="text-sm text-dark-300">Nenhum contato recebido ainda.</p>
              <p className="text-xs text-dark-400">Quando alguém enviar mensagem, aparecerá aqui.</p>
            </div>
          )}

          {!loadingContatos && contatos.length > 0 && (
            <div className="divide-y divide-white/[0.04]">
              {contatos.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#25D366]/10 flex items-center justify-center text-[#25D366] text-sm font-semibold flex-shrink-0">
                      {c.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{c.nome}</p>
                      <p className="text-xs text-dark-300 font-mono">
                        {formatPhone(c.whatsapp ?? c.telefone ?? '')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-dark-400">
                    <Clock size={11} />
                    {new Date(c.created_at).toLocaleDateString('pt-BR', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
