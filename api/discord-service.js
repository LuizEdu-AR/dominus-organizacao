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
      await send(process.env.DISCORD_FARM_WEBHOOK, {
        username: 'Dominus • Farm',
        avatar_url: icon,
        embeds: [{
          color: 0xD4AF37,
          author: { name: 'DOMINUS • FARM REGISTRADO', icon_url: icon },
          description: lines,
          fields: [{ name: 'Membro', value: `${payload.memberName} • ID ${payload.memberId}` }],
          thumbnail: { url: icon },
          timestamp: new Date().toISOString(),
        }],
      })
    } else if (type === 'hierarchy') {
      if (caller.role !== 'leader') return res.status(403).json({ error: 'Apenas líderes podem enviar a hierarquia.' })
      const users = payload.users || []
      const order = ['leader', 'manager_general', 'manager_actions', 'manager_partnerships', 'manager_finance', 'member']
      const sorted = [...users].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))
      const lines = sorted.map(u => `**${ROLE_LABELS[u.role] || u.role}** — ${u.name} • ID ${u.id}`).join('\n')
      await send(process.env.DISCORD_HIERARCHY_WEBHOOK, {
        username: 'Dominus • Hierarquia',
        avatar_url: icon,
        embeds: [{
          color: 0xD4AF37,
          author: { name: 'DOMINUS • HIERARQUIA ATUALIZADA', icon_url: icon },
          description: lines || 'Nenhum membro ativo.',
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
