import { useEffect, useRef, useState } from 'react'
import { ClipboardPaste, ImagePlus, Megaphone, Plus, Trash2, X } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { addRecord, getOrderedCollection, removeRecord } from '../services/dataService'
import { sendDiscordEvent } from '../services/discordService'
import { dateTime } from '../utils/formatters'
import { isManagement } from '../utils/permissions'
import { useToast } from '../components/toasts/ToastProvider'
import LoadingButton from '../components/ui/LoadingButton'
import { uploadImage } from '../services/imageUploadService'

export default function Notices() {
  const { profile } = useAuth()
  const { notify } = useToast()
  const [notices, setNotices] = useState([])
  const [form, setForm] = useState({ title: '', text: '' })
  const [photo, setPhoto] = useState(null)
  const [publishing, setPublishing] = useState(false)
  const fileInputRef = useRef(null)
  const load = async () => setNotices(await getOrderedCollection('notices'))
  useEffect(() => { load() }, [])


  function readImage(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) return notify('O anexo deve ser uma imagem.', 'error')
    if (file.size > 3 * 1024 * 1024) return notify('A imagem deve ter no máximo 3 MB.', 'error')

    const reader = new FileReader()
    reader.onload = () => setPhoto({
      name: file.name || 'aviso.png',
      type: file.type,
      dataUrl: reader.result,
    })
    reader.onerror = () => notify('Não foi possível carregar a imagem.', 'error')
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    function handlePaste(event) {
      const image = [...(event.clipboardData?.items || [])]
        .find(item => item.type.startsWith('image/'))
      if (!image) return

      event.preventDefault()
      readImage(image.getAsFile())
    }

    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [])

  async function add() {
    if (publishing) return
    if (!form.title || !form.text) return notify('Preencha título e aviso.', 'error')
    setPublishing(true)
    try {
      let imageUrl = ''
      let imagePublicId = ''

      if (photo?.dataUrl) {
        const uploaded = await uploadImage(photo, 'dominus/notices')
        imageUrl = uploaded.url
        imagePublicId = uploaded.publicId
      }

      const record = {
        ...form,
        authorName: profile.name,
        authorUid: profile.uid,
        authorId: profile.id,
        imageUrl,
        imagePublicId,
      }

      await addRecord('notices', record)

      try {
        await sendDiscordEvent('notice', record)
        notify('Aviso publicado no site e enviado ao Discord.')
      } catch (discordError) {
        notify('Aviso publicado no site, mas não foi possível enviar ao Discord.', 'error')
      }

      setForm({ title: '', text: '' })
      setPhoto(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
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

            <div className="action-upload notice-upload">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={e => readImage(e.target.files?.[0])}
              />
              <button type="button" className="btn secondary" onClick={() => fileInputRef.current?.click()}>
                <ImagePlus size={17} /> Anexar imagem
              </button>
              <div className="paste-hint">
                <ClipboardPaste size={17} />
                <span>Opcional — você também pode colar uma imagem com <strong>CTRL + V</strong></span>
              </div>
            </div>

            {photo && (
              <div className="action-preview notice-preview">
                <img src={photo.dataUrl} alt="Prévia da imagem do aviso" />
                <div>
                  <strong>{photo.name}</strong>
                  <span>Será armazenada no Cloudinary e enviada junto ao aviso no Discord.</span>
                </div>
                <button type="button" className="icon-button danger-text" onClick={() => setPhoto(null)} title="Remover imagem">
                  <X size={17} />
                </button>
              </div>
            )}

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
              <h3>{notice.title}</h3>
              <p>{notice.text}</p>
              {notice.imageUrl && <img className="notice-image" src={notice.imageUrl} alt={`Imagem do aviso ${notice.title}`} />}
            </div>
            {isManagement(profile?.role) && <button className="icon-button danger-text" onClick={async () => { await removeRecord('notices', notice.id); load() }}><Trash2 size={16} /></button>}
          </article>
        ))}
      </div>
    </>
  )
}
