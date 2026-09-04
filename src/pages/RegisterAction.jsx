import { useEffect, useRef, useState } from 'react'
import { ClipboardPaste, ImagePlus, Swords, X } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import LoadingButton from '../components/ui/LoadingButton'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/toasts/ToastProvider'
import { addRecord } from '../services/dataService'
import { sendDiscordEvent } from '../services/discordService'
import { uploadImage } from '../services/imageUploadService'

const INITIAL_FORM = {
  action: '',
  date: '',
  time: '',
  result: '',
  summary: 'Opcional',
  reason: 'Ação',
  participants: '',
  mediaLink: '',
}

export default function RegisterAction() {
  const { profile } = useAuth()
  const { notify } = useToast()
  const [form, setForm] = useState(INITIAL_FORM)
  const [photo, setPhoto] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef(null)

  const update = (field, value) => setForm(current => ({ ...current, [field]: value }))

  function readImage(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) return notify('O anexo deve ser uma imagem.', 'error')
    if (file.size > 3 * 1024 * 1024) return notify('A imagem deve ter no máximo 3 MB.', 'error')

    const reader = new FileReader()
    reader.onload = () => setPhoto({ name: file.name || 'acao.png', type: file.type, dataUrl: reader.result })
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

  async function submit() {
    if (submitting) return
    if (!form.action.trim() || !form.date.trim() || !form.time.trim() || !form.result.trim() || !form.participants.trim()) {
      return notify('Preencha Ação, Data, Hora, Resultado e Participantes.', 'error')
    }

    setSubmitting(true)
    try {
      let imageUrl = ''
      let imagePublicId = ''

      if (photo?.dataUrl) {
        const uploaded = await uploadImage(photo, 'dominus/actions')
        imageUrl = uploaded.url
        imagePublicId = uploaded.publicId
      }

      const record = {
        ...form,
        authorUid: profile.uid,
        authorName: profile.name,
        authorId: profile.id,
        photoAttached: Boolean(photo),
        photoName: photo?.name || '',
        imageUrl,
        imagePublicId,
      }

      const ref = await addRecord('actions', record)
      await sendDiscordEvent('action', {
        ...record,
        actionId: ref.id,
      })
      setForm(INITIAL_FORM)
      setPhoto(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      notify('Registro de ação salvo e enviado ao Discord.')
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader eyebrow="OPERAÇÕES" title="Registro de Ação" description="Registre as informações da ação e envie o relatório para o Discord." />

      <section className="panel form-panel action-form-panel">
        <div className="action-form-title"><Swords size={20} /><h3>Novo registro</h3></div>

        <div className="form-grid action-form-grid">
          <label>Ação<input value={form.action} onChange={e => update('action', e.target.value)} placeholder="Nome da ação" /></label>
          <label>Data<input value={form.date} onChange={e => update('date', e.target.value)} placeholder="Ex.: 04/09/2026" /></label>
          <label>Hora<input value={form.time} onChange={e => update('time', e.target.value)} placeholder="Ex.: 22:30" /></label>
          <label>Resultado<input value={form.result} onChange={e => update('result', e.target.value)} placeholder="Resultado da ação" /></label>
          <label>Resumo <span className="optional-label">Opcional</span><textarea rows="4" value={form.summary} onChange={e => update('summary', e.target.value)} /></label>
          <label>Motivo<input value={form.reason} onChange={e => update('reason', e.target.value)} /></label>
          <label className="action-wide">Participantes<textarea rows="3" value={form.participants} onChange={e => update('participants', e.target.value)} placeholder="Nomes/IDs dos participantes" /></label>
          <label className="action-wide">Foto/Vídeo <span className="optional-label">Opcional</span><input value={form.mediaLink} onChange={e => update('mediaLink', e.target.value)} placeholder="Cole aqui o link da foto ou vídeo" /></label>
        </div>

        <div className="action-upload">
          <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={e => readImage(e.target.files?.[0])} />
          <button type="button" className="btn secondary" onClick={() => fileInputRef.current?.click()}><ImagePlus size={17} /> Anexar foto</button>
          <div className="paste-hint"><ClipboardPaste size={17} /><span>Você também pode colar uma imagem com <strong>CTRL + V</strong></span></div>
        </div>

        {photo && (
          <div className="action-preview">
            <img src={photo.dataUrl} alt="Prévia do anexo" />
            <div><strong>{photo.name}</strong><span>Será armazenada no Cloudinary ao enviar o registro</span></div>
            <button type="button" className="icon-button danger-text" onClick={() => setPhoto(null)} title="Remover imagem"><X size={17} /></button>
          </div>
        )}

        <div className="action-submit">
          <LoadingButton className="btn primary" onClick={submit} loading={submitting} loadingText="Enviando...">Enviar registro</LoadingButton>
        </div>
      </section>
    </>
  )
}
