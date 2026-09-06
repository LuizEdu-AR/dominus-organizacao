import crypto from 'node:crypto'
import { adminDb } from './_firebaseAdmin.js'

const RETENTION_DAYS = 30
const PAGE_SIZE = 100
const COLLECTIONS = ['farms', 'actions']

function makeSignature(params, secret) {
  const source = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  return crypto.createHash('sha1').update(`${source}${secret}`).digest('hex')
}

async function deleteCloudinaryImage(publicId) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error('Cloudinary não configurado.')
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const params = {
    invalidate: 'true',
    public_id: publicId,
    timestamp,
  }
  const signature = makeSignature(params, apiSecret)

  const form = new FormData()
  form.append('public_id', publicId)
  form.append('timestamp', String(timestamp))
  form.append('invalidate', 'true')
  form.append('api_key', apiKey)
  form.append('signature', signature)

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: 'POST',
    body: form,
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result?.error?.message || `Cloudinary respondeu ${response.status}.`)
  }

  if (!['ok', 'not found'].includes(result.result)) {
    throw new Error(`Cloudinary retornou: ${result.result || 'resultado desconhecido'}.`)
  }

  return result.result
}

async function cleanupCollection(collectionName, cutoff) {
  let cursor = null
  let scanned = 0
  let deleted = 0
  let skipped = 0
  const errors = []

  while (true) {
    let query = adminDb
      .collection(collectionName)
      .where('createdAt', '<=', cutoff)
      .orderBy('createdAt', 'asc')
      .limit(PAGE_SIZE)

    if (cursor) query = query.startAfter(cursor)

    const snapshot = await query.get()
    if (snapshot.empty) break

    for (const doc of snapshot.docs) {
      scanned += 1
      const data = doc.data()
      const publicId = data.imagePublicId

      if (!publicId) {
        skipped += 1
        continue
      }

      try {
        const cloudinaryResult = await deleteCloudinaryImage(publicId)

        await doc.ref.update({
          imageUrl: '',
          imagePublicId: '',
          imageDeletedAt: new Date(),
          imageDeleteStatus: cloudinaryResult,
        })

        deleted += 1
      } catch (error) {
        errors.push({
          collection: collectionName,
          documentId: doc.id,
          message: error.message,
        })
      }
    }

    cursor = snapshot.docs[snapshot.docs.length - 1]
    if (snapshot.size < PAGE_SIZE) break
  }

  return { scanned, deleted, skipped, errors }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Método não permitido.' })
  }

  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return res.status(500).json({ error: 'CRON_SECRET não configurado.' })
  }

  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Não autorizado.' })
  }

  try {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
    const results = {}

    for (const collectionName of COLLECTIONS) {
      results[collectionName] = await cleanupCollection(collectionName, cutoff)
    }

    const totals = Object.values(results).reduce(
      (acc, item) => ({
        scanned: acc.scanned + item.scanned,
        deleted: acc.deleted + item.deleted,
        skipped: acc.skipped + item.skipped,
        errors: acc.errors + item.errors.length,
      }),
      { scanned: 0, deleted: 0, skipped: 0, errors: 0 },
    )

    return res.status(200).json({
      ok: totals.errors === 0,
      retentionDays: RETENTION_DAYS,
      cutoff: cutoff.toISOString(),
      totals,
      collections: results,
    })
  } catch (error) {
    console.error('Falha na limpeza do Cloudinary:', error)
    return res.status(500).json({ error: error.message || 'Erro interno.' })
  }
}
