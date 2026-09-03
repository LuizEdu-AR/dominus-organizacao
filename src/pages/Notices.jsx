import { useEffect, useState } from 'react'
import { Megaphone, Plus, Trash2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { addRecord, getOrderedCollection, removeRecord } from '../services/dataService'
import { dateTime } from '../utils/formatters'
import { isManagement } from '../utils/permissions'
import { useToast } from '../components/toasts/ToastProvider'
import LoadingButton from '../components/ui/LoadingButton'

export default function Notices() {
  const { profile } = useAuth()
  const { notify } = useToast()
  const [notices, setNotices] = useState([])
  const [form, setForm] = useState({ title: '', text: '' })
  const [publishing, setPublishing] = useState(false)
  const load = async () => setNotices(await getOrderedCollection('notices'))
  useEffect(() => { load() }, [])

  async function add() {
    if (publishing) return
    if (!form.title || !form.text) return notify('Preencha título e aviso.', 'error')
    setPublishing(true)
    try {
      await addRecord('notices', { ...form, authorName: profile.name, authorUid: profile.uid })
    setForm({ title: '', text: '' })
    notify('Aviso publicado.')
      load()
    } catch (e) { notify(e.message, 'error') }
    finally { setPublishing(false) }
  }

  return (
    <>
      <PageHeader eyebrow="COMUNICAÇÃO" title="Quadro de avisos" description="Comunicados importantes para todos os membros." />
      {isManagement(profile?.role) && (
        <div className="panel form-panel">
          <h3>Novo aviso</h3>
          <div className="form-stack">
            <label>Título<input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
            <label>Mensagem<textarea rows="4" value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} /></label>
            <LoadingButton className="btn primary" onClick={add} loading={publishing} loadingText="Publicando..."><Plus size={16} /> Publicar aviso</LoadingButton>
          </div>
        </div>
      )}
      <div className="notice-grid">
        {notices.map(notice => (
          <article className="notice-card" key={notice.id}>
            <div className="notice-icon"><Megaphone size={20} /></div>
            <div className="notice-body">
              <div className="notice-meta">{notice.authorName} • {dateTime(notice.createdAt)}</div>
              <h3>{notice.title}</h3><p>{notice.text}</p>
            </div>
            {isManagement(profile?.role) && <button className="icon-button danger-text" onClick={async () => { await removeRecord('notices', notice.id); load() }}><Trash2 size={16} /></button>}
          </article>
        ))}
      </div>
    </>
  )
}
