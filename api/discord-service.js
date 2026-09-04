import { requireUser } from './_firebaseAdmin.js'

const ROLE_LABELS = {
  leader: 'Líder',
  manager_general: 'Gerente Geral',
  manager_actions: 'Gerente de Ações',
  manager_partnerships: 'Gerente de Parcerias',
  manager_finance: 'Gerente de Finanças',
  member: 'Membro',
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0))
}

function logoUrl(req) {
  if (process.env.DOMINUS_LOGO_URL) return process.env.DOMINUS_LOGO_URL
  const protocol = req.headers['x-forwarded-proto'] || 'https'
  return `${protocol}://${req.headers.host}/images/dominus-logo.png`
}

async function send(webhook, body) {
  if (!webhook) throw new Error('Webhook não configurado.')
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`Discord respondeu ${response.status}.`)
}

async function sendWithAttachment(webhook, body, attachment) {
  if (!attachment?.dataUrl) return send(webhook, body)
  if (!webhook) throw new Error('Webhook não configurado.')

  const match = attachment.dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/)
  if (!match) throw new Error('Imagem anexada inválida.')

  const mime = match[1]
  const buffer = Buffer.from(match[2], 'base64')
  const safeName = (attachment.name || 'acao.png').replace(/[^a-zA-Z0-9._-]/g, '_')
  const form = new FormData()
  form.append('payload_json', JSON.stringify(body))
  form.append('files[0]', new Blob([buffer], { type: mime }), safeName)

  const response = await fetch(webhook, { method: 'POST', body: form })
  if (!response.ok) throw new Error(`Discord respondeu ${response.status}.`)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' })

  try {
    const caller = await requireUser(req)
    if (caller.status !== 'active') return res.status(403).json({ error: 'Acesso não liberado.' })

    const { type, payload } = req.body || {}
    const icon = logoUrl(req)

    if (type === 'sale') {
      const lines = payload.items?.map(i => `• ${i.qty}x **${i.name}** — ${money(i.subtotal)}`).join('\n') || '-'
      await send(process.env.DISCORD_SALES_WEBHOOK, {
        username: 'Dominus • Registradora',
        avatar_url: icon,
        embeds: [{
          color: 0x7C3AED,
          author: { name: 'DOMINUS • NOVA VENDA', icon_url: icon },
          description: lines,
          fields: [
            { name: 'Vendedor', value: `${payload.sellerName} • ID ${payload.sellerId}`, inline: true },
            { name: 'Tipo', value: payload.type, inline: true },
            { name: 'Desconto', value: money(payload.discount), inline: true },
            { name: 'Taxa da facção', value: money(payload.factionFee), inline: true },
            { name: 'Total', value: `**${money(payload.total)}**`, inline: true },
          ],
          thumbnail: { url: icon },
          timestamp: new Date().toISOString(),
        }],
      })
    } else if (type === 'farm') {
      const lines = payload.items?.map(i => `• **${i.qty}x** ${i.name}`).join('\n') || '-'
      const farmEmbed = {
        color: 0xD4AF37,
        author: { name: 'DOMINUS • FARM REGISTRADO', icon_url: icon },
        description: lines,
        fields: [{ name: 'Membro', value: `${payload.memberName} • ID ${payload.memberId}` }],
        thumbnail: { url: icon },
        timestamp: new Date().toISOString(),
      }

      if (payload.imageUrl) {
        farmEmbed.image = { url: payload.imageUrl }
      }

      await send(process.env.DISCORD_FARM_WEBHOOK, {
        username: 'Dominus • Farm',
        avatar_url: icon,
        embeds: [farmEmbed],
      })
    } else if (type === 'action') {
      const fields = [
        { name: '⚔️ Ação', value: payload.action || '-', inline: false },
        { name: '📅 Data', value: payload.date || '-', inline: true },
        { name: '🕒 Hora', value: payload.time || '-', inline: true },
        { name: '🏆 Resultado', value: payload.result || '-', inline: false },
        { name: '📝 Resumo', value: payload.summary || 'Opcional', inline: false },
        { name: '🎯 Motivo', value: payload.reason || 'Ação', inline: true },
        { name: '👥 Participantes', value: payload.participants || '-', inline: false },
      ]

      if (payload.mediaLink) {
        fields.push({ name: '📎 Foto/Vídeo', value: payload.mediaLink, inline: false })
      }
      fields.push({ name: 'Registrado por', value: `${payload.authorName} • ID ${payload.authorId}`, inline: false })

      const embed = {
        color: 0x7C3AED,
        author: { name: 'DOMINUS • REGISTRO DE AÇÃO', icon_url: icon },
        fields,
        thumbnail: { url: icon },
        timestamp: new Date().toISOString(),
      }

      if (payload.imageUrl) {
        embed.image = { url: payload.imageUrl }
      }

      await send(process.env.DISCORD_ACTIONS_WEBHOOK, {
        username: 'Dominus • Registro de Ação',
        avatar_url: icon,
        embeds: [embed],
      })
    } else if (type === 'hierarchy') {
      if (caller.role !== 'leader') return res.status(403).json({ error: 'Apenas líderes podem enviar a hierarquia.' })

      const users = payload.users || []
      const roleGroups = [
        { role: 'leader', title: '👑 LÍDERES' },
        { role: 'manager_general', title: '💼 GERÊNCIA GERAL' },
        { role: 'manager_actions', title: '🎯 GERÊNCIA DE AÇÕES' },
        { role: 'manager_partnerships', title: '🤝 GERÊNCIA DE PARCERIAS' },
        { role: 'manager_finance', title: '💰 GERÊNCIA FINANCEIRA' },
        { role: 'member', title: '👥 MEMBROS' },
      ]

      const fields = roleGroups
        .map(group => {
          const members = users.filter(user => user.role === group.role)
          if (!members.length) return null

          return {
            name: group.title,
            value: members
              .map(user => `${user.name} • ID ${user.id}`)
              .join('\n'),
            inline: false,
          }
        })
        .filter(Boolean)

      await send(process.env.DISCORD_HIERARCHY_WEBHOOK, {
        username: 'Dominus • Hierarquia',
        avatar_url: icon,
        embeds: [{
          color: 0xD4AF37,
          author: { name: 'DOMINUS • HIERARQUIA ATUALIZADA', icon_url: icon },
          description: fields.length ? undefined : 'Nenhum membro ativo.',
          fields,
          thumbnail: { url: icon },
          timestamp: new Date().toISOString(),
        }],
      })
    } else {
      return res.status(400).json({ error: 'Tipo de evento inválido.' })
    }

    return res.status(200).json({ ok: true })
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro interno.' })
  }
}
