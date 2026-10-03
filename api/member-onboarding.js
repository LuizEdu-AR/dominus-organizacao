import crypto from 'crypto'
import { adminAuth, adminDb } from './_firebaseAdmin.js'

const normalizeId = (id = '') => id.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
const idToEmail = id => `${normalizeId(id)}@dominus.local`
const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex')

const RUA_2_INVITE = 'https://discord.gg/Yd87XQY6AT'

function getBody(req) {
  return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
}

async function sendRua2RegistrationMessage(discordId) {
  const webhook = process.env.DISCORD_REGISTRATION_WEBHOOK
  if (!webhook || !discordId) return false

  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content:
        `<@${discordId}>, sua conta **Dominus** foi ativada com sucesso!\n\n` +
        'Agora realize seu registro no Discord **Rua 2 - Ilegal**.\n' +
        'No campo **Facção**, utilize **Contrabando 4**.\n\n' +
        `${RUA_2_INVITE}`,
      allowed_mentions: {
        parse: [],
        users: [discordId],
      },
    }),
  })

  if (!response.ok) {
    const details = await response.text().catch(() => '')
    throw new Error(`Falha ao enviar aviso da Rua 2 ao Discord (${response.status}). ${details}`)
  }

  return true
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  try {
    const body = getBody(req)
    const action = body.action

    if (action === 'pre-register') {
      const secret = req.headers['x-dominus-bot-secret']
      if (!process.env.DOMINUS_BOT_SECRET || secret !== process.env.DOMINUS_BOT_SECRET) {
        return res.status(401).json({ error: 'Bot não autorizado.' })
      }

      const gameId = String(body.gameId || '').trim()
      const name = String(body.name || '').trim()
      const discordId = String(body.discordId || '').trim()
      const discordUsername = String(body.discordUsername || '').trim()
      const phone = String(body.phone || '').trim()
      const darkChat = String(body.darkChat || '').trim()

      if (!/^\d+$/.test(gameId) || !name || !discordId) {
        return res.status(400).json({ error: 'Dados obrigatórios inválidos.' })
      }

      const normalizedId = normalizeId(gameId)
      const existingUsers = await adminDb.collection('users').where('id', '==', gameId).limit(1).get()
      if (!existingUsers.empty) return res.status(409).json({ error: 'Este ID já possui conta no site.' })

      const token = crypto.randomBytes(32).toString('hex')
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

      await adminDb.collection('memberOnboarding').doc(normalizedId).set({
        gameId,
        normalizedId,
        name,
        discordId,
        discordUsername,
        phone,
        darkChat,
        tokenHash: tokenHash(token),
        status: 'pending',
        createdAt: now,
        updatedAt: now,
        expiresAt,
      }, { merge: true })

      return res.status(200).json({ ok: true, token, gameId, name })
    }

    if (action === 'check') {
      const token = String(body.token || '')
      if (!token) return res.status(400).json({ error: 'Convite inválido.' })

      const matches = await adminDb.collection('memberOnboarding')
        .where('tokenHash', '==', tokenHash(token))
        .where('status', '==', 'pending')
        .limit(1)
        .get()

      if (matches.empty) return res.status(404).json({ error: 'Convite inválido ou já utilizado.' })
      const data = matches.docs[0].data()
      const expires = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt)
      if (expires < new Date()) return res.status(410).json({ error: 'Este convite expirou. Faça o registro novamente no Discord.' })

      return res.status(200).json({ ok: true, gameId: data.gameId, name: data.name })
    }

    if (action === 'activate') {
      const token = String(body.token || '')
      const password = String(body.password || '')
      if (password.length < 8) return res.status(400).json({ error: 'A senha deve possuir no mínimo 8 caracteres.' })

      const matches = await adminDb.collection('memberOnboarding')
        .where('tokenHash', '==', tokenHash(token))
        .where('status', '==', 'pending')
        .limit(1)
        .get()

      if (matches.empty) return res.status(404).json({ error: 'Convite inválido ou já utilizado.' })
      const onboardingRef = matches.docs[0].ref
      const data = matches.docs[0].data()
      const expires = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt)
      if (expires < new Date()) return res.status(410).json({ error: 'Este convite expirou. Faça o registro novamente no Discord.' })

      let userRecord
      try {
        userRecord = await adminAuth.createUser({
          email: idToEmail(data.gameId),
          password,
          displayName: data.name,
        })
      } catch (error) {
        if (error.code === 'auth/email-already-exists') {
          return res.status(409).json({ error: 'Este ID já possui conta no site.' })
        }
        throw error
      }

      try {
        await adminDb.collection('users').doc(userRecord.uid).set({
          uid: userRecord.uid,
          id: data.gameId,
          name: data.name,
          role: 'member',
          status: 'active',
          discordId: data.discordId,
          discordUsername: data.discordUsername || '',
          phone: data.phone || '',
          darkChat: data.darkChat || '',
          discordVerified: true,
          createdFrom: 'discord',
          createdAt: new Date(),
        })

        await onboardingRef.update({
          status: 'activated',
          activatedUid: userRecord.uid,
          activatedAt: new Date(),
          tokenHash: null,
        })
      } catch (error) {
        await adminAuth.deleteUser(userRecord.uid).catch(() => {})
        throw error
      }

      // A conta já está criada neste ponto. Uma falha no Discord não desfaz a ativação.
      let discordNotificationSent = false
      try {
        discordNotificationSent = await sendRua2RegistrationMessage(data.discordId)
      } catch (discordError) {
        console.error('Conta ativada, mas não foi possível enviar o aviso da Rua 2:', discordError)
      }

      return res.status(200).json({
        ok: true,
        gameId: data.gameId,
        discordNotificationSent,
      })
    }

    return res.status(400).json({ error: 'Ação inválida.' })
  } catch (error) {
    console.error('Erro no onboarding:', error)
    return res.status(500).json({ error: error.message || 'Erro interno.' })
  }
}
