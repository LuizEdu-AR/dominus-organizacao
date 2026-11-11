import { adminAuth, adminDb } from './_firebaseAdmin.js'

const VALID_ROLES = ['member', 'manager', 'leader']

function authorized(req) {
  const received = req.headers['x-dominus-bot-secret']
  return Boolean(process.env.DOMINUS_BOT_SECRET && received === process.env.DOMINUS_BOT_SECRET)
}

async function findUserByDiscordId(discordId) {
  const snapshot = await adminDb.collection('users').where('discordId', '==', String(discordId)).limit(2).get()
  if (snapshot.size !== 1) return null
  const doc = snapshot.docs[0]
  return { ref: doc.ref, uid: doc.id, ...doc.data() }
}

async function findAndLinkLegacyUser({ discordId, discordUsername = '', gameId = '' }) {
  const linked = await findUserByDiscordId(discordId)
  if (linked) return linked
  // Recupera somente vínculo pré-existente comprovado pelo convite original.
  const onboarding = await adminDb.collection('memberOnboarding').where('discordId', '==', String(discordId)).limit(2).get()
  if (onboarding.size === 1) {
    const data = onboarding.docs[0].data()
    if (data.activatedUid) {
      const doc = await adminDb.collection('users').doc(data.activatedUid).get()
      if (doc.exists && doc.data().status === 'active' && (!doc.data().discordId || String(doc.data().discordId) === String(discordId))) {
        await doc.ref.update({ discordId: String(discordId), discordUsername: String(discordUsername || ''), discordVerified: true, discordLinkedAt: new Date(), discordLinkedFrom: 'onboarding-recovery' })
        return { ref: doc.ref, uid: doc.id, ...doc.data(), discordId: String(discordId) }
      }
    }
  }
  // Não associar automaticamente pelo apelido: um ID incorreto pode desligar outra conta.
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  if (!authorized(req)) return res.status(401).json({ error: 'Bot não autorizado.' })

  try {
    const { action } = req.body || {}

    if (action === 'set-role-from-discord') {
      const { discordId, discordUsername = '', gameId = '', role, actorDiscordId = '', actorUsername = '' } = req.body || {}
      if (!discordId || !VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Dados inválidos.' })

      const target = await findAndLinkLegacyUser({ discordId, discordUsername, gameId })
      if (!target) return res.status(404).json({ error: 'Conta sem vínculo confirmado com o Discord. Utilize /vincular-membro antes de continuar.' })
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
      const { discordId, discordUsername = '', actorDiscordId = '', actorUsername = '', actorGameId = '', reason = '' } = req.body || {}
      if (!/^\d{15,22}$/.test(String(discordId || ''))) return res.status(400).json({ error: 'Discord ID inválido.' })

      const dismissalReason = String(reason || '').trim()
      if (!dismissalReason) return res.status(400).json({ error: 'Informe o motivo do desligamento.' })
      if (dismissalReason.length > 1000) return res.status(400).json({ error: 'O motivo deve possuir no máximo 1000 caracteres.' })

      // Não usar ID do jogo nem apelido como fallback: poderiam atingir outra conta.
      // Um Discord sem cadastro não impede a remoção dos cargos no servidor.
      const matches = await adminDb.collection('users').where('discordId', '==', String(discordId)).limit(3).get()
      if (matches.empty) return res.status(200).json({ ok: true, matched: false, changed: false })
      if (matches.size !== 1) return res.status(409).json({ error: 'Vínculo duplicado com o Discord. Corrija os cadastros no site.' })
      const doc = matches.docs[0]
      const target = { ref: doc.ref, uid: doc.id, ...doc.data() }
      if (target.status === 'dismissed') return res.status(200).json({ ok: true, matched: true, changed: false, memberName: target.name || '', memberGameId: target.id || '' })

      const dismissedAt = new Date()
      await adminAuth.updateUser(target.uid, { disabled: true })
      await target.ref.update({
        status: 'dismissed',
        dismissalReason,
        dismissedAt,
        dismissedFrom: 'discord',
        dismissedByDiscordId: String(actorDiscordId || ''),
        dismissedByDiscordUsername: String(actorUsername || ''),
        dismissedByName: String(actorUsername || ''),
        dismissedById: String(actorGameId || ''),
      })

      return res.status(200).json({ ok: true, matched: true, changed: true, uid: target.uid, memberName: target.name || '', memberGameId: target.id || '', dismissedAt: dismissedAt.toISOString() })
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
