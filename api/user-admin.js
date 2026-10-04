import { adminAuth, adminDb, requireUser } from './_firebaseAdmin.js'

const legacyManagerRoles = [
  'manager_general',
  'manager_actions',
  'manager_partnerships',
  'manager_finance',
]

const validRoles = ['member', 'manager', 'leader']

const isManagement = role => role === 'leader' || role === 'manager'

async function enqueueDiscordSync(payload) {
  if (!payload?.discordId && !payload?.gameId) throw new Error('O membro não possui vínculo com o Discord nem ID do jogo para sincronização.')
  await adminDb.collection('discordSyncJobs').add({
    ...payload,
    status: 'pending',
    createdAt: new Date(),
  })
}

const roleLabels = {
  leader: 'Líder', manager: 'Gerente', member: 'Membro', pending: 'Pendente',
  manager_general: 'Gerente Geral', manager_actions: 'Gerente de Ações',
  manager_partnerships: 'Gerente de Parcerias', manager_finance: 'Gerente de Finanças',
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

    const { action, uid, role, password, reason = '' } = req.body || {}

    if (action === 'migrate-manager-roles') {
      if (caller.role !== 'leader') return res.status(403).json({ error: 'Apenas líderes podem executar a migração.' })

      const snapshots = await Promise.all(
        legacyManagerRoles.map(legacyRole =>
          adminDb.collection('users').where('role', '==', legacyRole).get()
        )
      )

      const docs = snapshots.flatMap(snapshot => snapshot.docs)
      if (!docs.length) return res.status(200).json({ ok: true, migrated: 0 })

      const batch = adminDb.batch()
      docs.forEach(doc => batch.update(doc.ref, { role: 'manager' }))
      await batch.commit()

      await sendAdminLog(caller, 'Cargos de gerente unificados', `**Usuários migrados:** ${docs.length}\n**Novo cargo:** Gerente`)
      return res.status(200).json({ ok: true, migrated: docs.length })
    }

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
      if (target.role !== role) {
        await enqueueDiscordSync({ type: 'set-role', discordId: target.discordId || '', gameId: target.id || '', role, uid, requestedBy: caller.uid, requestedByName: caller.name || '', requestedByGameId: caller.id || '' })
      }
      await sendAdminLog(caller, 'Cargo alterado', `**Membro:** ${target.name || 'Usuário'}${target.id ? ` • ID ${target.id}` : ''}\n**Alteração:** ${roleLabels[target.role] || target.role} → ${roleLabels[role] || role}`)
      return res.status(200).json({ ok: true })
    }

    if (action === 'leader-edit') {
      if (caller.role !== 'leader') return res.status(403).json({ error: 'Apenas líderes podem editar usuários.' })
      if (uid === caller.uid) return res.status(400).json({ error: 'Use Meu perfil para alterar os seus próprios dados.' })
      if (!validRoles.includes(role)) return res.status(400).json({ error: 'Cargo inválido.' })
      if (password && password.length < 8) return res.status(400).json({ error: 'A senha deve possuir no mínimo 8 caracteres.' })
      await userRef.update({ role, status: 'active' })
      if (target.role !== role) {
        await enqueueDiscordSync({ type: 'set-role', discordId: target.discordId || '', gameId: target.id || '', role, uid, requestedBy: caller.uid, requestedByName: caller.name || '', requestedByGameId: caller.id || '' })
      }
      if (password) await adminAuth.updateUser(uid, { password })
      const changes = []
      if (target.role !== role) changes.push(`**Cargo:** ${roleLabels[target.role] || target.role} → ${roleLabels[role] || role}`)
      if (password) changes.push('**Senha:** redefinida pelo Líder (valor não registrado)')
      if (changes.length) await sendAdminLog(caller, 'Usuário editado', `**Membro:** ${target.name || 'Usuário'}${target.id ? ` • ID ${target.id}` : ''}\n${changes.join('\n')}`)
      return res.status(200).json({ ok: true })
    }

    if (action === 'dismiss') {
      const dismissalReason = String(reason || '').trim()
      if (!dismissalReason) return res.status(400).json({ error: 'Informe o motivo do desligamento.' })
      if (dismissalReason.length > 1000) return res.status(400).json({ error: 'O motivo deve possuir no máximo 1000 caracteres.' })
      if (caller.role === 'manager' && target.role !== 'member') {
        return res.status(403).json({ error: 'Gerentes só podem desligar membros.' })
      }
      if (target.role === 'leader' && caller.role !== 'leader') {
        return res.status(403).json({ error: 'Gerentes não podem desligar líderes.' })
      }

      const dismissedAt = new Date()
      await adminAuth.updateUser(uid, { disabled: true })
      await userRef.update({
        status: 'dismissed',
        dismissalReason,
        dismissedAt,
        dismissedFrom: 'site',
        dismissedBy: caller.uid,
        dismissedByUid: caller.uid,
        dismissedByName: caller.name || '',
        dismissedById: caller.id || '',
      })
      await enqueueDiscordSync({
        type: 'dismiss',
        discordId: target.discordId || '',
        gameId: target.id || '',
        uid,
        memberName: target.name || 'Usuário',
        memberGameId: target.id || '',
        previousRole: target.role || '',
        reason: dismissalReason,
        requestedBy: caller.uid,
        requestedByName: caller.name || 'Gestão',
        requestedByGameId: caller.id || '',
        origin: 'site',
      })
      await sendAdminLog(caller, 'Membro desligado', `**Membro:** ${target.name || 'Usuário'}${target.id ? ` • ID ${target.id}` : ''}
**Cargo:** ${roleLabels[target.role] || target.role}
**Motivo:** ${dismissalReason}
**Histórico:** preservado`)
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: 'Ação inválida.' })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro interno.' })
  }
}
