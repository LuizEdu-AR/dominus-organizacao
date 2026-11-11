import { adminAuth, adminDb } from './_firebaseAdmin.js'
import { verifyPassword } from './_memberCredentials.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  res.setHeader('Cache-Control', 'no-store')
  const id = String(req.body?.id || '').trim()
  const password = String(req.body?.password || '')
  if (!/^\d{1,20}$/.test(id) || !password || password.length > 256) return res.status(401).json({ error: 'ID ou senha inválidos.' })
  const lockRef = adminDb.collection('loginRateLimits').doc(id)
  try {
    const allowed = await adminDb.runTransaction(async tx => {
      const snap = await tx.get(lockRef); const state = snap.data() || {}; const now = Date.now()
      if (Number(state.blockUntil || 0) > now) return false
      const failures = now - Number(state.windowStart || 0) > 15 * 60_000 ? 0 : Number(state.failures || 0)
      tx.set(lockRef, { failures: failures + 1, windowStart: failures ? state.windowStart : now, blockUntil: failures >= 9 ? now + 15 * 60_000 : 0 }, { merge: true })
      return true
    })
    if (!allowed) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos.' })
    const snapshot = await adminDb.collection('users').where('id', '==', id).limit(2).get()
    if (snapshot.size !== 1) return res.status(401).json({ error: 'ID ou senha inválidos.' })
    const doc = snapshot.docs[0], user = doc.data()
    const credential = await adminDb.collection('memberCredentials').doc(doc.id).get()
    if (user.status !== 'active' || !credential.exists || !verifyPassword(password, credential.data().passwordHash)) return res.status(401).json({ error: 'ID ou senha inválidos.' })
    const authUser = await adminAuth.getUser(doc.id)
    if (authUser.disabled) return res.status(403).json({ error: 'Conta desativada.' })
    await lockRef.delete().catch(() => {})
    const token = await adminAuth.createCustomToken(doc.id)
    return res.status(200).json({ token })
  } catch (error) { console.error('Falha de login:', error); return res.status(500).json({ error: 'Não foi possível entrar agora.' }) }
}
