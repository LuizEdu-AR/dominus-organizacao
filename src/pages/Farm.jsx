import { useEffect, useRef, useState } from 'react'
import { ClipboardPaste, ImagePlus, Minus, Plus, X } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { addRecord } from '../services/dataService'
import { sendDiscordEvent } from '../services/discordService'
import { useToast } from '../components/toasts/ToastProvider'
import LoadingButton from '../components/ui/LoadingButton'
import { uploadImage } from '../services/imageUploadService'

const FARM_ITEMS = [
  'Pano',
  'Chip',
  'Ferro de Solda',
  'Aço',
  'Plástico Processado',
  'Materiais Reciclados',
  'Cabo',
  'Cinta',
  'Borracha Processada',
  'Fibra de Carbono',
  'Transponder',
  'Alumínio Chapado',
  'Módulo ECU',
  'Cobre Escovado',
]

export default function Farm() {
  const { profile } = useAuth()
  const { notify } = useToast()
  const [quantities, setQuantities] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [photo, setPhoto] = useState(null)
  const fileInputRef = useRef(null)

  const change = (name, delta) => setQuantities(q => ({ ...q, [name]: Math.max(0, Number(q[name] || 0) + delta) }))

  const setQuantity = (name, value) => {
    if (value === '') {
      setQuantities(q => ({ ...q, [name]: '' }))
      return
    }

    const quantity = Math.max(0, Math.floor(Number(value) || 0))
    setQuantities(q => ({ ...q, [name]: quantity }))
  }

  function readImage(file) {
    if (!file) return
    if (!file.type.startsWith('image/')) return notify('O anexo deve ser uma imagem.', 'error')
    if (file.size > 3 * 1024 * 1024) return notify('A imagem deve ter no máximo 3 MB.', 'error')

    const reader = new FileReader()
    reader.onload = () => setPhoto({
      name: file.name || 'farm.png',
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

  async function submit() {
    if (!photo?.dataUrl) {
      notify('Anexe uma imagem do seu baú pessoal para registrar o Farm.', 'error')
      return
    }

    if (submitting) return
    const items = Object.entries(quantities).filter(([, qty]) => qty > 0).map(([name, qty]) => ({ name, qty }))
    if (!items.length) return notify('Informe pelo menos um item.', 'error')

    setSubmitting(true)
    try {
      let imageUrl = ''
      let imagePublicId = ''

      if (photo?.dataUrl) {
        const uploaded = await uploadImage(photo, 'dominus/farm')
        imageUrl = uploaded.url
        imagePublicId = uploaded.publicId
      }

      const record = {
        memberUid: profile.uid,
        memberName: profile.name,
        memberId: profile.id,
        items,
        imageUrl,
        imagePublicId,
      }

      const ref = await addRecord('farms', record)
      await sendDiscordEvent('farm', { ...record, farmId: ref.id })
      setQuantities({})
      setPhoto(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      notify('Farm registrado e enviado ao Discord.')
    } catch (e) { notify(e.message, 'error') }
    finally { setSubmitting(false) }
  }

  return (
    <>
      <PageHeader eyebrow="BAÚ" title="Farm" description="Informe os itens depositados no baú da organização." />
      <div className="farm-grid">
        {FARM_ITEMS.map((name, index) => (
          <div className="farm-card" key={name}>
            <div className="farm-icon">{String(index + 1).padStart(2, '0')}</div>
            <strong>{name}</strong>
            <div className="qty-control">
              <button type="button" onClick={() => change(name, -1)}><Minus size={15} /></button>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={quantities[name] ?? 0}
                onChange={event => setQuantity(name, event.target.value)}
                onBlur={() => {
                  if (quantities[name] === '') setQuantity(name, 0)
                }}
                aria-label={`Quantidade de ${name}`}
              />
              <button type="button" onClick={() => change(name, 1)}><Plus size={15} /></button>
            </div>
          </div>
        ))}
      </div>
      <section className="panel farm-photo-panel">
        <div className="farm-photo-header">
          <div>
            <strong>Comprovante do Farm</strong>
            <span>Imagem obrigatória. Faça o print mostrando apenas os itens no seu baú pessoal, evitando capturar áreas desnecessárias da tela. Assim, o comprovante fica mais leve, nítido e fácil de conferir. Você também pode colar a imagem com CTRL + V.</span>
          </div>
        </div>

        <div className="action-upload">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={event => readImage(event.target.files?.[0])}
          />
          <button type="button" className="btn secondary" onClick={() => fileInputRef.current?.click()}>
            <ImagePlus size={17} /> Anexar foto
          </button>
          <div className="paste-hint">
            <ClipboardPaste size={17} />
            <span>Cole uma imagem com <strong>CTRL + V</strong></span>
          </div>
        </div>

        {photo && (
          <div className="action-preview">
            <img src={photo.dataUrl} alt="Prévia do comprovante do farm" />
            <div>
              <strong>{photo.name}</strong>
              <span>Será armazenada no Cloudinary ao confirmar o depósito.</span>
            </div>
            <button type="button" className="icon-button danger-text" onClick={() => setPhoto(null)} title="Remover imagem">
              <X size={17} />
            </button>
          </div>
        )}
      </section>

      <div className="farm-actions"><LoadingButton className="btn primary" onClick={submit} loading={submitting} loadingText="Registrando...">Confirmar depósito</LoadingButton></div>
    </>
  )
}
