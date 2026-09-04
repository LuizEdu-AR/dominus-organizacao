import crypto from 'node:crypto'
import { requireUser } from './_firebaseAdmin.js'

function makeSignature(params, secret) {
  const source = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  return crypto.createHash('sha1').update(`${source}${secret}`).digest('hex')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  try {
    const caller = await requireUser(req)
    if (caller.status !== 'active') return res.status(403).json({ error: 'Acesso não liberado.' })

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET

    if (!cloudName || !apiKey || !apiSecret) {
      throw new Error('Cloudinary não configurado.')
    }

    const { dataUrl, folder = 'dominus/farm' } = req.body || {}
    if (!dataUrl || !/^data:image\//.test(dataUrl)) {
      return res.status(400).json({ error: 'Imagem inválida.' })
    }

    const approxBytes = Math.ceil((dataUrl.length - (dataUrl.indexOf(',') + 1)) * 3 / 4)
    if (approxBytes > 3 * 1024 * 1024) {
      return res.status(400).json({ error: 'A imagem deve ter no máximo 3 MB.' })
    }

    const timestamp = Math.floor(Date.now() / 1000)
    const params = { folder, timestamp }
    const signature = makeSignature(params, apiSecret)

    const form = new FormData()
    form.append('file', dataUrl)
    form.append('api_key', apiKey)
    form.append('timestamp', String(timestamp))
    form.append('folder', folder)
    form.append('signature', signature)

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: form,
    })

    const result = await response.json()
    if (!response.ok) {
      throw new Error(result?.error?.message || 'Falha no upload para o Cloudinary.')
    }

    return res.status(200).json({
      url: result.secure_url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
    })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro interno.' })
  }
}
