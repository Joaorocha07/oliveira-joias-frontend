'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Smartphone, Wifi, WifiOff, RefreshCw, LogOut, Users, Clock, CheckCircle2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  getWhatsAppStatus,
  conectarWhatsApp,
  desconectarWhatsApp,
  listarContatosWhatsApp,
  type WhatsAppStatus,
} from '@/services/whatsapp'
import type { Cliente } from '@/types'
import { formatPhone } from '@/utils'

const STATUS_CONFIG = {
  disconnected: { label: 'Desconectado', color: 'text-dark-300', dot: 'bg-dark-400' },
  connecting: { label: 'Conectando…', color: 'text-yellow-400', dot: 'bg-yellow-400' },
  waiting_qr: { label: 'Aguardando QR Code', color: 'text-yellow-400', dot: 'bg-yellow-400 animate-pulse' },
  connected: { label: 'Conectado', color: 'text-[#5B8C5B]', dot: 'bg-[#5B8C5B]' },
}

export default function WhatsAppPage() {
  const [status, setStatus] = useState<WhatsAppStatus>({ status: 'disconnected', qrBase64: null, phone: null })
  const [loading, setLoading] = useState(false)
  const [contatos, setContatos] = useState<Cliente[]>([])
  const [loadingContatos, setLoadingContatos] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const s = await getWhatsAppStatus()
      setStatus(s)
      if (s.status === 'connected') {
        stopPoll()
        fetchContatos()
      } else if (s.status === 'disconnected') {
        stopPoll()
      }
    } catch {}
  // fetchContatos is stable (useCallback with no deps that change often)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopPoll])

  const fetchContatos = useCallback(async () => {
    setLoadingContatos(true)
    const { data } = await listarContatosWhatsApp()
    setContatos(data ?? [])
    setLoadingContatos(false)
  }, [])

  const startPoll = useCallback(() => {
    stopPoll()
    pollRef.current = setInterval(fetchStatus, 2000)
  }, [fetchStatus, stopPoll])

  useEffect(() => {
    fetchStatus()
    return stopPoll
  }, [fetchStatus, stopPoll])

  useEffect(() => {
    if (status.status === 'connected') fetchContatos()
  }, [status.status, fetchContatos])

  async function handleConectar() {
    setLoading(true)
    // Inicia polling imediatamente para capturar a transição connecting → waiting_qr
    startPoll()
    try {
      await conectarWhatsApp()
    } catch (err) {
      stopPoll()
      toast.error(err instanceof Error ? err.message : 'Erro ao conectar')
    } finally {
      setLoading(false)
    }
  }

  async function handleDesconectar() {
    setLoading(true)
    try {
      const s = await desconectarWhatsApp()
      setStatus(s)
      setContatos([])
      toast.success('WhatsApp desconectado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao desconectar')
    } finally {
      setLoading(false)
    }
  }

  const cfg = STATUS_CONFIG[status.status]
  const isActive = status.status === 'connecting' || status.status === 'waiting_qr'

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
          <Smartphone size={20} className="text-[#25D366]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-black">WhatsApp</h1>
          <p className="text-sm text-dark-300">Conecte seu número e receba contatos automaticamente</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Painel de conexão */}
        <div className="bg-dark-800 rounded-2xl border border-white/[0.06] overflow-hidden">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              <span className={`text-sm font-medium ${cfg.color}`}>{cfg.label}</span>
            </div>
            {status.phone && (
              <span className="text-xs text-dark-300 font-mono">{status.phone}</span>
            )}
          </div>

          {/* Corpo */}
          <div className="flex flex-col items-center justify-center p-8 min-h-[320px]">
            {status.status === 'disconnected' && (
              <div className="flex flex-col items-center gap-5 text-center">
                <div className="w-20 h-20 rounded-full bg-dark-700 flex items-center justify-center">
                  <WifiOff size={32} className="text-dark-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Nenhuma sessão ativa</p>
                  <p className="text-sm text-dark-300 mt-1 max-w-[240px]">
                    Conecte seu WhatsApp para receber contatos automaticamente no sistema.
                  </p>
                </div>
                <button
                  onClick={handleConectar}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
                  Conectar WhatsApp
                </button>
              </div>
            )}

            {(status.status === 'connecting') && (
              <div className="flex flex-col items-center gap-4 text-center">
                <Loader2 size={40} className="text-[#25D366] animate-spin" />
                <p className="text-white font-medium">Iniciando conexão…</p>
                <p className="text-sm text-dark-300">Aguarde enquanto preparamos o QR Code.</p>
              </div>
            )}

            {status.status === 'waiting_qr' && status.qrBase64 && (
              <div className="flex flex-col items-center gap-4">
                <div className="bg-white p-3 rounded-2xl shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={status.qrBase64} alt="QR Code WhatsApp" width={240} height={240} />
                </div>
                <div className="text-center">
                  <p className="text-white font-medium text-sm">Escaneie com seu celular</p>
                  <p className="text-xs text-dark-300 mt-1">
                    Abra o WhatsApp → Dispositivos vinculados → Vincular dispositivo
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                  <RefreshCw size={12} className="animate-spin" />
                  Atualizando…
                </div>
              </div>
            )}

            {status.status === 'waiting_qr' && !status.qrBase64 && (
              <div className="flex flex-col items-center gap-4 text-center">
                <Loader2 size={40} className="text-[#25D366] animate-spin" />
                <p className="text-white font-medium">Gerando QR Code…</p>
              </div>
            )}

            {status.status === 'connected' && (
              <div className="flex flex-col items-center gap-5 text-center">
                <div className="w-20 h-20 rounded-full bg-[#25D366]/10 flex items-center justify-center">
                  <CheckCircle2 size={36} className="text-[#25D366]" />
                </div>
                <div>
                  <p className="text-white font-semibold text-lg">Conectado!</p>
                  {status.phone && (
                    <p className="text-sm text-dark-300 mt-0.5 font-mono">{status.phone}</p>
                  )}
                  <p className="text-sm text-dark-300 mt-2 max-w-[240px]">
                    Novos contatos que enviarem mensagem serão salvos automaticamente.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Rodapé com ações */}
          {(status.status === 'connected' || isActive) && (
            <div className="px-5 py-4 border-t border-white/[0.06] flex justify-end gap-2">
              {isActive && (
                <button
                  onClick={() => { stopPoll(); setStatus({ status: 'disconnected', qrBase64: null, phone: null }) }}
                  className="text-xs text-dark-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
                >
                  Cancelar
                </button>
              )}
              {status.status === 'connected' && (
                <button
                  onClick={handleDesconectar}
                  disabled={loading}
                  className="flex items-center gap-1.5 text-xs text-[#C75B5B] hover:text-white hover:bg-[#C75B5B] px-3 py-1.5 rounded-lg border border-[#C75B5B]/30 hover:border-[#C75B5B] transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <LogOut size={12} />}
                  Desconectar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Instruções */}
        <div className="bg-dark-800 rounded-2xl border border-white/[0.06] p-5 space-y-4">
          <p className="text-sm font-semibold text-white">Como funciona</p>
          <ol className="space-y-3">
            {[
              'Clique em "Conectar WhatsApp" para gerar o QR Code.',
              'Abra o WhatsApp no celular, vá em Dispositivos vinculados e escaneie o código.',
              'Após conectar, toda vez que alguém enviar uma mensagem para o número vinculado, o contato é salvo automaticamente como lead no sistema.',
              'O contato fica disponível em Clientes e no Funil de Vendas com a origem "WhatsApp".',
            ].map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-dark-300">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-dark-700 text-[#25D366] text-xs font-semibold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div className="rounded-xl bg-dark-700 border border-white/[0.04] p-4 mt-2">
            <p className="text-xs text-dark-300 leading-relaxed">
              <strong className="text-white">Atenção:</strong> O número que receberá as mensagens deve
              ser um celular com WhatsApp ativo. A sessão fica salva no servidor — não é necessário
              escanear o QR Code toda vez que reiniciar o sistema.
            </p>
          </div>
        </div>
      </div>

      {/* Contatos recebidos */}
      {status.status === 'connected' && (
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
              <p className="text-xs text-dark-400">Quando alguém enviar uma mensagem, aparecerá aqui.</p>
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
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
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
