import { useEffect, useState } from 'react'
import { Handshake, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import LoadingButton from '../components/ui/LoadingButton'
import { useAuth } from '../context/AuthContext'
import { addRecord, getCollection, removeRecord, setRecord } from '../services/dataService'
import { isLeader } from '../utils/permissions'
import { useToast } from '../components/toasts/ToastProvider'

const EMPTY_FORM = {
  type: 'organization',
  name: '',
  chat: '',
  chatPassword: '',
  product: '',
}

const PARTNERSHIP_TYPES = {
  organization: 'Organização',
  fraternity: 'Fraternidade',
}

const getPartnershipType = partnership =>
  partnership?.type === 'fraternity' ? 'fraternity' : 'organization'

export default function Partnerships() {
  const { profile } = useAuth()
  const { notify } = useToast()
  const leader = isLeader(profile?.role)
  const [partnerships, setPartnerships] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('all')

  async function load() {
    try {
      setLoading(true)
      const list = await getCollection('partnerships')
      setPartnerships([...list].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')))
    } catch (error) {
      notify(error.message || 'Não foi possível carregar as parcerias.', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  function edit(partnership) {
    setEditingId(partnership.id)
    setForm({
      type: getPartnershipType(partnership),
      name: partnership.name || '',
      chat: partnership.chat || '',
      chatPassword: partnership.chatPassword || '',
      product: partnership.product || '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save() {
    if (busy) return
    if (!form.name.trim() || !form.chat.trim() || !form.chatPassword.trim() || !form.product.trim()) {
      return notify('Preencha nome, chat, senha do chat e produto.', 'error')
    }

    setBusy(true)
    try {
      const payload = {
        type: form.type,
        name: form.name.trim(),
        chat: form.chat.trim(),
        chatPassword: form.chatPassword.trim(),
        product: form.product.trim(),
      }

      if (editingId) {
        await setRecord('partnerships', editingId, payload)
        notify('Parceria atualizada.')
      } else {
        await addRecord('partnerships', payload)
        notify('Parceria adicionada.')
      }

      resetForm()
      await load()
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function remove(partnership) {
    if (busy) return
    if (!window.confirm(`Remover a parceria com ${partnership.name}?`)) return

    setBusy(true)
    try {
      await removeRecord('partnerships', partnership.id)
      if (editingId === partnership.id) resetForm()
      notify('Parceria removida.')
      await load()
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="COMERCIAL"
        title="Parcerias"
        description="Consulte organizações e fraternidades parceiras, seus chats, senhas e produtos comercializados."
      />

      {leader && (
        <section className="panel partnership-editor">
          <div className="panel-title">
            <h3>{editingId ? 'Editar parceria' : 'Nova parceria'}</h3>
            {editingId && <button type="button" className="btn ghost small" onClick={resetForm}><X size={15} /> Cancelar edição</button>}
          </div>
          <div className="partnership-form-grid partnership-form-grid-with-type">
            <label>Tipo de parceria<select value={form.type} onChange={event => setForm(current => ({ ...current, type: event.target.value }))}><option value="organization">Organização</option><option value="fraternity">Fraternidade</option></select></label>
            <label>{PARTNERSHIP_TYPES[form.type]}<input value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} placeholder={`Nome da ${PARTNERSHIP_TYPES[form.type].toLowerCase()}`} /></label>
            <label>Chat<input value={form.chat} onChange={event => setForm(current => ({ ...current, chat: event.target.value }))} placeholder="Chat da parceria" /></label>
            <label>Senha do chat<input value={form.chatPassword} onChange={event => setForm(current => ({ ...current, chatPassword: event.target.value }))} placeholder="Senha" /></label>
            <label>Produto que vende<input value={form.product} onChange={event => setForm(current => ({ ...current, product: event.target.value }))} placeholder="Produto comercializado" /></label>
            <LoadingButton className="btn primary" onClick={save} loading={busy} loadingText="Salvando...">
              {editingId ? <><Save size={16} /> Salvar parceria</> : <><Plus size={16} /> Adicionar parceria</>}
            </LoadingButton>
          </div>
        </section>
      )}

      {!loading && partnerships.length > 0 && (
        <div className="partnership-filter" role="group" aria-label="Filtrar parcerias">
          <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todas</button>
          <button type="button" className={filter === 'organization' ? 'active' : ''} onClick={() => setFilter('organization')}>Organizações</button>
          <button type="button" className={filter === 'fraternity' ? 'active' : ''} onClick={() => setFilter('fraternity')}>Fraternidades</button>
        </div>
      )}

      {loading ? (
        <div className="screen-center partnership-loading"><div className="spinner" /></div>
      ) : partnerships.length === 0 ? (
        <div className="empty-card">
          <Handshake size={36} />
          <h2>Nenhuma parceria ativa</h2>
          <p>Quando uma parceria for cadastrada por um Líder, ela aparecerá aqui e também na Registradora.</p>
        </div>
      ) : (
        <div className="partnership-grid">
          {partnerships.filter(partnership => filter === 'all' || getPartnershipType(partnership) === filter).map(partnership => (
            <article className={`partnership-card partnership-card-${getPartnershipType(partnership)}`} key={partnership.id}>
              <div className="partnership-card-head">
                <div className="partnership-icon"><Handshake size={20} /></div>
                <div><span className="eyebrow">PARCERIA • {PARTNERSHIP_TYPES[getPartnershipType(partnership)].toUpperCase()}</span><h3>{partnership.name}</h3></div>
                {leader && (
                  <div className="row-actions partnership-actions">
                    <button className="icon-button" onClick={() => edit(partnership)} title="Editar"><Pencil size={16} /></button>
                    <button className="icon-button danger-text" onClick={() => remove(partnership)} disabled={busy} title="Remover"><Trash2 size={16} /></button>
                  </div>
                )}
              </div>
              <div className="partnership-info"><span>Chat</span><strong>{partnership.chat}</strong></div>
              <div className="partnership-info"><span>Senha do chat</span><strong>{partnership.chatPassword}</strong></div>
              <div className="partnership-info"><span>Produto que vende</span><strong>{partnership.product}</strong></div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}
