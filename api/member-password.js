import { adminAuth, adminDb, requireUser } from './_firebaseAdmin.js'
import { hashPassword } from './_memberCredentials.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })
  res.setHeader('Cache-Control', 'no-store')
  try {
    const user = await requireUser(req)
    const credential = await adminDb.collection('memberCredentials').doc(user.uid).get()
    if (user.status !== 'active' || !credential.exists) return res.status(403).json({ error: 'Conta não habilitada para esta operação.' })
    const password = String(req.body?.password || '')
    if (password.length < 6 || password.length > 128) return res.status(400).json({ error: 'A senha deve ter entre 6 e 128 caracteres.' })
    if (password === String(user.id)) return res.status(400).json({ error: 'Escolha uma senha diferente do ID.' })
    await adminDb.collection('memberCredentials').doc(user.uid).update({ passwordHash: hashPassword(password), passwordChangedAt: new Date() })
    await adminDb.collection('users').doc(user.uid).update({ mustChangePassword: false, credentialVersion: Number(user.credentialVersion || 1) + 1, passwordChangedAt: new Date() })
    // Invalida sessões anteriores (o cliente atual continua até renovar o token).
    await adminAuth.revokeRefreshTokens(user.uid)
    return res.status(200).json({ ok: true })
  } catch (error) { console.error('Erro ao trocar senha:', error); return res.status(401).json({ error: 'Não foi possível alterar a senha. Entre novamente.' }) }
}
