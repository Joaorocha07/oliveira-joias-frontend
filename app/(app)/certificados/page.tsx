'use client'

import { useState, useEffect, useCallback } from 'react'
import { Award, CalendarDays, Hash } from 'lucide-react'
import { useAlert } from '@/hooks/use-alert'
import { supabase } from '@/lib/supabase'
import { PageHeader, Button, Card } from '@/components/ui'
import { FormCertificado } from '@/components/certificados/form-certificado'
import { ListaHistoricoCertificados } from '@/components/certificados/lista-historico-certificados'
import { ConfiguracoesCertificado } from '@/components/certificados/configuracoes-certificado'
import { CertificadoPreviewModal } from '@/components/certificados/certificado-preview-modal'
import { CatalogoItens } from '@/components/orcamentos/catalogo-itens'
import {
  listarCertificadoModelos,
  criarCertificadoModelo,
  excluirCertificadoModelo,
  listarCertificadoMateriais,
  criarCertificadoMaterial,
  excluirCertificadoMaterial,
  getCertificadoConfiguracoes,
} from '@/services/certificados'
import type {
  Certificado, CertificadoModelo, CertificadoMaterial, CertificadoConfiguracao, Profile,
} from '@/types'

type TabId = 'novo' | 'historico' | 'catalogo' | 'config'

const TABS: { id: TabId; label: string }[] = [
  { id: 'novo', label: 'Novo Certificado' },
  { id: 'historico', label: 'Histórico' },
  { id: 'catalogo', label: 'Catálogos' },
  { id: 'config', label: 'Configurações' },
]

interface Stats { total: number; mes: number; ultimo: string }

export default function CertificadosPage() {
  const alert = useAlert()
  const [activeTab, setActiveTab] = useState<TabId>('novo')

  const [modelos, setModelos] = useState<CertificadoModelo[]>([])
  const [modelosLoading, setModelosLoading] = useState(true)
  const [materiais, setMateriais] = useState<CertificadoMaterial[]>([])
  const [materiaisLoading, setMateriaisLoading] = useState(true)
  const [configuracao, setConfiguracao] = useState<CertificadoConfiguracao | null>(null)
  const [vendedores, setVendedores] = useState<Pick<Profile, 'id' | 'nome'>[]>([])

  const [editando, setEditando] = useState<Certificado | null>(null)
  const [formNonce, setFormNonce] = useState(0)
  const [historicoRefreshKey, setHistoricoRefreshKey] = useState(0)
  const [preview, setPreview] = useState<Certificado | null>(null)
  const [stats, setStats] = useState<Stats>({ total: 0, mes: 0, ultimo: '—' })

  const loadModelos = useCallback(async () => {
    setModelosLoading(true)
    const { data, error } = await listarCertificadoModelos()
    if (error) alert.error('Erro', 'Erro ao carregar catálogo de modelos.')
    setModelos(data)
    setModelosLoading(false)
  }, [])

  const loadMateriais = useCallback(async () => {
    setMateriaisLoading(true)
    const { data, error } = await listarCertificadoMateriais()
    if (error) alert.error('Erro', 'Erro ao carregar catálogo de materiais.')
    setMateriais(data)
    setMateriaisLoading(false)
  }, [])

  const loadConfiguracao = useCallback(async () => {
    const { data } = await getCertificadoConfiguracoes()
    setConfiguracao(data)
  }, [])

  const loadVendedores = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, nome')
      .eq('ativo', true)
      .in('role', ['vendedor', 'admin'])
      .order('nome')
    setVendedores((data as Pick<Profile, 'id' | 'nome'>[]) ?? [])
  }, [])

  const loadStats = useCallback(async () => {
    const { data } = await supabase
      .from('certificados')
      .select('numero, created_at')
      .order('created_at', { ascending: false })
    const lista = data ?? []
    const agora = new Date()
    const mes = lista.filter((c: { created_at: string }) => {
      const d = new Date(c.created_at)
      return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear()
    }).length
    setStats({
      total: lista.length,
      mes,
      ultimo: lista.length ? (lista[0] as { numero: string }).numero : '—',
    })
  }, [])

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadModelos()
      void loadMateriais()
      void loadConfiguracao()
      void loadVendedores()
    }, 0)
    return () => window.clearTimeout(id)
  }, [loadModelos, loadMateriais, loadConfiguracao, loadVendedores])

  useEffect(() => {
    const id = window.setTimeout(() => void loadStats(), 0)
    return () => window.clearTimeout(id)
  }, [loadStats, historicoRefreshKey])

  function handleTabClick(tab: TabId) {
    if (tab === 'novo') {
      setEditando(null)
      setFormNonce((n) => n + 1)
    }
    setActiveTab(tab)
  }

  function handleSaved(cert: Certificado, isEditing: boolean) {
    setHistoricoRefreshKey((k) => k + 1)
    if (isEditing) {
      setEditando(null)
      setActiveTab('historico')
    } else {
      setPreview(cert)
      setActiveTab('historico')
    }
  }

  function handleEditar(cert: Certificado) {
    setEditando(cert)
    setFormNonce((n) => n + 1)
    setActiveTab('novo')
  }

  return (
    <div>
      <PageHeader title="Certificados de Garantia" subtitle="Emita e gerencie os certificados de garantia vitalícia das joias" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        {[
          { icon: <Award size={16} />, label: 'Emitidos', value: stats.total },
          { icon: <CalendarDays size={16} />, label: 'Este mês', value: stats.mes },
          { icon: <Hash size={16} />, label: 'Último número', value: stats.ultimo },
        ].map((s) => (
          <Card key={s.label} className="flex items-center gap-3">
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-gold-50 text-gold-600 flex-shrink-0">{s.icon}</span>
            <div>
              <p className="font-display text-xl font-semibold text-dark-700 leading-none">{s.value}</p>
              <p className="text-xs text-dark-400 uppercase tracking-wide mt-1">{s.label}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            variant={activeTab === tab.id ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => handleTabClick(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {activeTab === 'novo' && (
        <FormCertificado
          key={`form-${formNonce}`}
          certificado={editando}
          modelos={modelos}
          materiais={materiais}
          vendedores={vendedores}
          onModelosChanged={loadModelos}
          onMateriaisChanged={loadMateriais}
          onSaved={handleSaved}
          onCancelEdit={editando ? () => handleTabClick('novo') : undefined}
        />
      )}

      {activeTab === 'historico' && configuracao && (
        <ListaHistoricoCertificados
          refreshKey={historicoRefreshKey}
          configuracao={configuracao}
          onEditar={handleEditar}
          onVisualizar={setPreview}
        />
      )}

      {activeTab === 'catalogo' && (
        <div className="flex flex-col gap-6">
          <CatalogoItens
            titulo="Catálogo de Modelos"
            subtitulo="Modelos sugeridos ao emitir um certificado"
            label="modelo"
            placeholder="Ex: Abaulada"
            itens={modelos}
            loading={modelosLoading}
            onAdd={criarCertificadoModelo}
            onDelete={excluirCertificadoModelo}
            onChanged={loadModelos}
          />
          <CatalogoItens
            titulo="Catálogo de Materiais"
            subtitulo="Materiais sugeridos ao emitir um certificado"
            label="material"
            placeholder="Ex: Ouro 18K"
            itens={materiais}
            loading={materiaisLoading}
            onAdd={criarCertificadoMaterial}
            onDelete={excluirCertificadoMaterial}
            onChanged={loadMateriais}
          />
        </div>
      )}

      {activeTab === 'config' && configuracao && (
        <ConfiguracoesCertificado configuracao={configuracao} onSaved={setConfiguracao} />
      )}

      {configuracao && (
        <CertificadoPreviewModal
          open={!!preview}
          onClose={() => setPreview(null)}
          certificado={preview}
          configuracao={configuracao}
        />
      )}
    </div>
  )
}
