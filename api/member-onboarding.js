import crypto from 'node:crypto'
import { adminAuth, adminDb } from './_firebaseAdmin.js'
import { hashPassword } from './_memberCredentials.js'

const idToEmail = id => `${String(id).trim()}@dominus.local`
const tokenHash = token => crypto.createHash('sha256').update(token).digest('hex')
const getBody = req => typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  try {
    const body = getBody(req)
    if (body.action !== 'pre-register' && body.action !== 'check' && body.action !== 'activate') return res.status(400).json({ error: 'Ação inválida.' })
    if (body.action === 'pre-register') {
      if (!process.env.DOMINUS_BOT_SECRET || req.headers['x-dominus-bot-secret'] !== process.env.DOMINUS_BOT_SECRET) return res.status(401).json({ error: 'Bot não autorizado.' })
      const gameId = String(body.gameId || '').trim()
      const name = String(body.name || '').trim()
      const discordId = String(body.discordId || '').trim()
      if (!/^\d{1,20}$/.test(gameId) || !name || !/^\d{15,22}$/.test(discordId)) return res.status(400).json({ error: 'Dados obrigatórios inválidos.' })
      const existing = await adminDb.collection('users').where('id', '==', gameId).limit(1).get()
      if (!existing.empty) return res.status(409).json({ error: 'Este ID já possui conta no site.' })
      const byDiscord = await adminDb.collection('users').where('discordId', '==', discordId).limit(1).get()
      if (!byDiscord.empty) return res.status(409).json({ error: 'Esta conta do Discord já possui cadastro.' })
      // A conta do Firebase Auth usa uma senha aleatória; a senha curta é verificada apenas no servidor.
      let userRecord
      try {
        userRecord = await adminAuth.createUser({ email: idToEmail(gameId), password: crypto.randomBytes(36).toString('base64url'), displayName: name })
      } catch (error) {
        if (error.code === 'auth/email-already-exists') return res.status(409).json({ error: 'Este ID já possui conta no site.' })
        throw error
      }
      try {
        await adminDb.collection('memberCredentials').doc(userRecord.uid).create({ passwordHash: hashPassword(gameId), createdAt: new Date() })
        await adminDb.collection('users').doc(userRecord.uid).create({
          uid: userRecord.uid, id: gameId, name, role: 'member', status: 'active',
          discordId, discordUsername: String(body.discordUsername || ''),
          phone: String(body.phone || ''), darkChat: String(body.darkChat || ''),
          discordVerified: true, createdFrom: 'discord', createdAt: new Date(),
          mustChangePassword: true, credentialVersion: 1,
        })
      } catch (error) {
        await adminAuth.deleteUser(userRecord.uid).catch(() => {})
        throw error
      }
      return res.status(200).json({ ok: true, gameId, name })
    }
    // Convites antigos continuam verificáveis, mas novas setagens não emitem convites.
    const token = String(body.token || '')
    if (!token) return res.status(400).json({ error: 'Convite inválido.' })
    const matches = await adminDb.collection('memberOnboarding').where('tokenHash', '==', tokenHash(token)).where('status', '==', 'pending').limit(1).get()
    if (matches.empty) return res.status(404).json({ error: 'Convite inválido ou utilizado.' })
    const ref = matches.docs[0].ref; const data = matches.docs[0].data()
    const expires = data.expiresAt?.toDate?.() || new Date(data.expiresAt)
    if (expires < new Date()) return res.status(410).json({ error: 'Convite expirado.' })
    if (body.action === 'check') return res.status(200).json({ ok: true, gameId: data.gameId, name: data.name })
    const password = String(body.password || '')
    if (password.length < 6) return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' })
    let userRecord
    try { userRecord = await adminAuth.createUser({ email: idToEmail(data.gameId), password, displayName: data.name }) }
    catch (error) { if (error.code === 'auth/email-already-exists') return res.status(409).json({ error: 'ID já cadastrado.' }); throw error }
    try {
      await adminDb.collection('users').doc(userRecord.uid).create({ uid: userRecord.uid, id: data.gameId, name: data.name, role: 'member', status: 'active', discordId: data.discordId, discordUsername: data.discordUsername || '', phone: data.phone || '', darkChat: data.darkChat || '', discordVerified: true, createdFrom: 'discord', createdAt: new Date() })
      await ref.update({ status: 'activated', activatedUid: userRecord.uid, activatedAt: new Date(), tokenHash: null })
    } catch (error) { await adminAuth.deleteUser(userRecord.uid).catch(() => {}); throw error }
    return res.status(200).json({ ok: true, gameId: data.gameId })
  } catch (error) { console.error('Erro no cadastro:', error); return res.status(500).json({ error: 'Não foi possível concluir o cadastro.' }) }
}
