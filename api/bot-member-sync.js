import { adminAuth, adminDb } from './_firebaseAdmin.js'

const VALID_ROLES = ['member', 'manager', 'leader']

function authorized(req) {
  const received = req.headers['x-dominus-bot-secret']
  return Boolean(process.env.DOMINUS_BOT_SECRET && received === process.env.DOMINUS_BOT_SECRET)
}

async function findUserByDiscordId(discordId) {
  const snapshot = await adminDb.collection('users').where('discordId', '==', String(discordId)).limit(1).get()
  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  return { ref: doc.ref, uid: doc.id, ...doc.data() }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  if (!authorized(req)) return res.status(401).json({ error: 'Bot não autorizado.' })

  try {
    const { action } = req.body || {}

    if (action === 'set-role-from-discord') {
      const { discordId, role, actorDiscordId = '', actorUsername = '' } = req.body || {}
      if (!discordId || !VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Dados inválidos.' })

      const target = await findUserByDiscordId(discordId)
      if (!target) return res.status(404).json({ error: 'Conta vinculada ao Discord não encontrada.' })
      if (target.status !== 'active') return res.status(409).json({ error: 'A conta do membro não está ativa.' })

      if (target.role !== role) {
        await target.ref.update({
          role,
          roleSyncedFrom: 'discord',
          roleSyncedAt: new Date(),
          roleSyncedByDiscordId: String(actorDiscordId || ''),
          roleSyncedByDiscordUsername: String(actorUsername || ''),
        })
      }

      return res.status(200).json({ ok: true, changed: target.role !== role, uid: target.uid })
    }

    if (action === 'dismiss-from-discord') {
      const { discordId, actorDiscordId = '', actorUsername = '' } = req.body || {}
      if (!discordId) return res.status(400).json({ error: 'Discord ID obrigatório.' })

      const target = await findUserByDiscordId(discordId)
      if (!target) return res.status(404).json({ error: 'Conta vinculada ao Discord não encontrada.' })
      if (target.status === 'dismissed') return res.status(200).json({ ok: true, changed: false })

      await adminAuth.updateUser(target.uid, { disabled: true })
      await target.ref.update({
        status: 'dismissed',
        dismissedAt: new Date(),
        dismissedFrom: 'discord',
        dismissedByDiscordId: String(actorDiscordId || ''),
        dismissedByDiscordUsername: String(actorUsername || ''),
      })

      return res.status(200).json({ ok: true, changed: true, uid: target.uid })
    }

    if (action === 'next-jobs') {
      const snapshot = await adminDb.collection('discordSyncJobs').where('status', '==', 'pending').limit(10).get()
      const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate?.()?.toISOString?.() || null }))
      return res.status(200).json({ ok: true, jobs })
    }

    if (action === 'complete-job') {
      const { jobId, success = true, error = '' } = req.body || {}
      if (!jobId) return res.status(400).json({ error: 'Job ID obrigatório.' })
      await adminDb.collection('discordSyncJobs').doc(jobId).update({
        status: success ? 'completed' : 'failed',
        completedAt: new Date(),
        error: success ? '' : String(error || 'Falha desconhecida').slice(0, 500),
      })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Ação inválida.' })
  } catch (error) {
    console.error('Erro na sincronização bot/site:', error)
    return res.status(500).json({ error: error.message || 'Erro interno.' })
  }
}
