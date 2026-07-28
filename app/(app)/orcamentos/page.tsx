'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAlert } from '@/hooks/use-alert'
import { PageHeader, Button } from '@/components/ui'
import { FormOrcamento } from '@/components/orcamentos/form-orcamento'
import { ListaHistorico } from '@/components/orcamentos/lista-historico'
import { CatalogoItens } from '@/components/orcamentos/catalogo-itens'
import { ConfiguracoesOrcamento } from '@/components/orcamentos/configuracoes-orcamento'
import { OrcamentoPreviewModal } from '@/components/orcamentos/orcamento-preview-modal'
import {
  listOrcamentoModelos,
  createOrcamentoModelo,
  deleteOrcamentoModelo,
  listOrcamentoMateriais,
  createOrcamentoMaterial,
  deleteOrcamentoMaterial,
  getOrcamentoConfiguracoes,
} from '@/services/orcamentos'
import type { Orcamento, OrcamentoModelo, OrcamentoMaterial, OrcamentoConfiguracao } from '@/types'
import type { OrcamentoFormData } from '@/schemas/orcamento'

type TabId = 'novo' | 'historico' | 'catalogo' | 'config'

const TABS: { id: TabId; label: string }[] = [
  { id: 'novo', label: 'Novo Orçamento' },
  { id: 'historico', label: 'Histórico' },
  { id: 'catalogo', label: 'Catálogos' },
  { id: 'config', label: 'Configurações' },
]

export default function OrcamentosPage() {
  const alert = useAlert()
  const [activeTab, setActiveTab] = useState<TabId>('novo')

  const [modelos, setModelos] = useState<OrcamentoModelo[]>([])
  const [modelosLoading, setModelosLoading] = useState(true)
  const [materiais, setMateriais] = useState<OrcamentoMaterial[]>([])
  const [materiaisLoading, setMateriaisLoading] = useState(true)
  const [configuracao, setConfiguracao] = useState<OrcamentoConfiguracao | null>(null)

  const [editando, setEditando] = useState<Orcamento | null>(null)
  const [duplicando, setDuplicando] = useState<Partial<OrcamentoFormData> | null>(null)
  const [formNonce, setFormNonce] = useState(0)

  const [historicoRefreshKey, setHistoricoRefreshKey] = useState(0)
  const [previewOrcamento, setPreviewOrcamento] = useState<Orcamento | null>(null)

  const loadModelos = useCallback(async () => {
    setModelosLoading(true)
    const { data, error } = await listOrcamentoModelos()
    if (error) alert.error('Erro', 'Erro ao carregar catálogo de modelos.')
    setModelos(data ?? [])
    setModelosLoading(false)
  }, [])

  const loadMateriais = useCallback(async () => {
    setMateriaisLoading(true)
    const { data, error } = await listOrcamentoMateriais()
    if (error) alert.error('Erro', 'Erro ao carregar catálogo de materiais.')
    setMateriais(data ?? [])
    setMateriaisLoading(false)
  }, [])

  const loadConfiguracao = useCallback(async () => {
    const { data } = await getOrcamentoConfiguracoes()
    setConfiguracao(data)
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadModelos()
      void loadMateriais()
      void loadConfiguracao()
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadModelos, loadMateriais, loadConfiguracao])

  function handleTabClick(tab: TabId) {
    if (tab === 'novo') {
      setEditando(null)
      setDuplicando(null)
      setFormNonce((n) => n + 1)
    }
    setActiveTab(tab)
  }

  function handleSaved(orcamento: Orcamento, isEditing: boolean) {
    setHistoricoRefreshKey((k) => k + 1)
    if (isEditing) {
      setEditando(null)
      setDuplicando(null)
      setActiveTab('historico')
    } else {
      setPreviewOrcamento(orcamento)
    }
  }

  function handleEditar(orcamento: Orcamento) {
    setEditando(orcamento)
    setDuplicando(null)
    setFormNonce((n) => n + 1)
    setActiveTab('novo')
  }

  function handleDuplicar(orcamento: Orcamento) {
    setEditando(null)
    setDuplicando({
      cliente_nome: orcamento.cliente_nome ?? '',
      cliente_telefone: orcamento.cliente_telefone ?? '',
      modelo_nome: orcamento.modelo_nome ?? '',
      material: orcamento.material ?? '',
      largura: orcamento.largura ?? '',
      itens_inclusos: orcamento.itens_inclusos,
      valor_vista: orcamento.valor_vista,
      prazo_fabricacao: orcamento.prazo_fabricacao ?? '',
      observacoes: orcamento.observacoes ?? '',
    })
    setFormNonce((n) => n + 1)
    setActiveTab('novo')
  }

  return (
    <div>
      <PageHeader title="Orçamentos" subtitle="Gere orçamentos de peças sob encomenda para seus clientes" />

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
        <FormOrcamento
          key={`form-${formNonce}`}
          orcamento={editando}
          initialValues={duplicando}
          modelos={modelos}
          materiais={materiais}
          onModelosChanged={loadModelos}
          onMateriaisChanged={loadMateriais}
          onSaved={handleSaved}
          onCancelEdit={editando ? () => handleTabClick('novo') : undefined}
        />
      )}

      {activeTab === 'historico' && (
        <ListaHistorico
          refreshKey={historicoRefreshKey}
          onEditar={handleEditar}
          onDuplicar={handleDuplicar}
          onVisualizar={setPreviewOrcamento}
        />
      )}

      {activeTab === 'catalogo' && (
        <div className="flex flex-col gap-6">
          <CatalogoItens
            titulo="Catálogo de Modelos"
            subtitulo="Modelos sugeridos ao criar um novo orçamento"
            label="modelo"
            placeholder="Ex: Tradicional 5mm"
            itens={modelos}
            loading={modelosLoading}
            onAdd={createOrcamentoModelo}
            onDelete={deleteOrcamentoModelo}
            onChanged={loadModelos}
          />
          <CatalogoItens
            titulo="Catálogo de Materiais"
            subtitulo="Materiais sugeridos ao criar um novo orçamento"
            label="material"
            placeholder="Ex: Ouro 18k"
            itens={materiais}
            loading={materiaisLoading}
            onAdd={createOrcamentoMaterial}
            onDelete={deleteOrcamentoMaterial}
            onChanged={loadMateriais}
          />
        </div>
      )}

      {activeTab === 'config' && configuracao && (
        <ConfiguracoesOrcamento configuracao={configuracao} onSaved={setConfiguracao} />
      )}

      {configuracao && (
        <OrcamentoPreviewModal
          open={!!previewOrcamento}
          onClose={() => setPreviewOrcamento(null)}
          orcamento={previewOrcamento}
          configuracao={configuracao}
        />
      )}
    </div>
  )
}
