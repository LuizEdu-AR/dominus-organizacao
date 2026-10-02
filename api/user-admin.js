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

const roleLabels = {
  leader: 'Líder', manager_general: 'Gerente Geral', manager_actions: 'Gerente de Ações',
  manager_partnerships: 'Gerente de Parcerias', manager_finance: 'Gerente de Finanças', member: 'Membro', pending: 'Pendente',
}

async function sendAdminLog(caller, action, details) {
  const webhook = process.env.DISCORD_ADMIN_LOGS_WEBHOOK
  if (!webhook) return
  try {
    const response = await fetch(webhook, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Dominus • Logs Administrativos',
        embeds: [{ color: 0x6D28D9, author: { name: 'DOMINUS • LOG ADMINISTRATIVO' }, title: action, description: details,
          fields: [{ name: 'Responsável', value: `${caller.name || 'Gestão'}${caller.id ? ` • ID ${caller.id}` : ''}` }], timestamp: new Date().toISOString() }],
      }),
    })
    if (!response.ok) console.error('Falha ao enviar log administrativo:', response.status)
  } catch (error) { console.error('Falha ao enviar log administrativo:', error) }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  try {
    const caller = await requireUser(req)
    if (caller.status !== 'active' || !isManagement(caller.role)) {
      return res.status(403).json({ error: 'Sem permissão.' })
    }

    const { action, uid, role, password } = req.body || {}
    if (!uid) return res.status(400).json({ error: 'UID obrigatório.' })
    if (uid === caller.uid && action === 'dismiss') return res.status(400).json({ error: 'Você não pode demitir a si mesmo.' })

    const userRef = adminDb.collection('users').doc(uid)
    const snap = await userRef.get()
    if (!snap.exists) return res.status(404).json({ error: 'Usuário não encontrado.' })
    const target = snap.data()

    if (action === 'approve') {
      if (target.status !== 'pending') return res.status(400).json({ error: 'Conta já liberada.' })
      await userRef.update({ status: 'active', role: 'member' })
      await sendAdminLog(caller, 'Acesso aprovado', `**Membro:** ${target.name || 'Usuário'}${target.id ? ` • ID ${target.id}` : ''}\n**Cargo inicial:** Membro`)
      return res.status(200).json({ ok: true })
    }

    if (action === 'change-role') {
      if (caller.role !== 'leader') return res.status(403).json({ error: 'Apenas líderes podem alterar cargos.' })
      if (!validRoles.includes(role)) return res.status(400).json({ error: 'Cargo inválido.' })
      await userRef.update({ role, status: 'active' })
      await sendAdminLog(caller, 'Cargo alterado', `**Membro:** ${target.name || 'Usuário'}${target.id ? ` • ID ${target.id}` : ''}\n**Alteração:** ${roleLabels[target.role] || target.role} → ${roleLabels[role] || role}`)
      return res.status(200).json({ ok: true })
    }

    if (action === 'leader-edit') {
      if (caller.role !== 'leader') return res.status(403).json({ error: 'Apenas líderes podem editar usuários.' })
      if (uid === caller.uid) return res.status(400).json({ error: 'Use Meu perfil para alterar os seus próprios dados.' })
      if (!validRoles.includes(role)) return res.status(400).json({ error: 'Cargo inválido.' })
      if (password && password.length < 8) return res.status(400).json({ error: 'A senha deve possuir no mínimo 8 caracteres.' })
      await userRef.update({ role, status: 'active' })
      if (password) await adminAuth.updateUser(uid, { password })
      const changes = []
      if (target.role !== role) changes.push(`**Cargo:** ${roleLabels[target.role] || target.role} → ${roleLabels[role] || role}`)
      if (password) changes.push('**Senha:** redefinida pelo Líder (valor não registrado)')
      if (changes.length) await sendAdminLog(caller, 'Usuário editado', `**Membro:** ${target.name || 'Usuário'}${target.id ? ` • ID ${target.id}` : ''}\n${changes.join('\n')}`)
      return res.status(200).json({ ok: true })
    }

    if (action === 'dismiss') {
      if (target.role === 'leader' && caller.role !== 'leader') {
        return res.status(403).json({ error: 'Gerentes não podem demitir líderes.' })
      }
      await adminAuth.deleteUser(uid)
      await userRef.delete()
      await sendAdminLog(caller, 'Membro removido', `**Membro:** ${target.name || 'Usuário'}${target.id ? ` • ID ${target.id}` : ''}\n**Cargo:** ${roleLabels[target.role] || target.role}`)
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Ação inválida.' })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro interno.' })
  }
}
