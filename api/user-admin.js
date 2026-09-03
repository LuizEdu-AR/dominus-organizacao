import { adminAuth, adminDb, requireUser } from './_firebaseAdmin.js'

const managerRoles = [
  'manager_general',
  'manager_actions',
  'manager_partnerships',
  'manager_finance',
]

const validRoles = [
  'member',
  ...managerRoles,
  'leader',
]

const isManagement = role => role === 'leader' || managerRoles.includes(role)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  try {
    const caller = await requireUser(req)
    if (caller.status !== 'active' || !isManagement(caller.role)) {
      return res.status(403).json({ error: 'Sem permissão.' })
    }

    const { action, uid, role } = req.body || {}
    if (!uid) return res.status(400).json({ error: 'UID obrigatório.' })
    if (uid === caller.uid && action === 'dismiss') return res.status(400).json({ error: 'Você não pode demitir a si mesmo.' })

    const userRef = adminDb.collection('users').doc(uid)
    const snap = await userRef.get()
    if (!snap.exists) return res.status(404).json({ error: 'Usuário não encontrado.' })
    const target = snap.data()

    if (action === 'approve') {
      if (target.status !== 'pending') return res.status(400).json({ error: 'Conta já liberada.' })
      await userRef.update({ status: 'active', role: 'member' })
      return res.status(200).json({ ok: true })
    }

    if (action === 'change-role') {
      if (caller.role !== 'leader') return res.status(403).json({ error: 'Apenas líderes podem alterar cargos.' })
      if (!validRoles.includes(role)) return res.status(400).json({ error: 'Cargo inválido.' })
      await userRef.update({ role, status: 'active' })
      return res.status(200).json({ ok: true })
    }

    if (action === 'dismiss') {
      if (target.role === 'leader' && caller.role !== 'leader') {
        return res.status(403).json({ error: 'Gerentes não podem demitir líderes.' })
      }
      await adminAuth.deleteUser(uid)
      await userRef.delete()
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Ação inválida.' })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro interno.' })
  }
}
