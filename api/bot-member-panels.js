import { adminDb } from './_firebaseAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (!process.env.DOMINUS_BOT_SECRET || req.headers['x-dominus-bot-secret'] !== process.env.DOMINUS_BOT_SECRET) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }
  if (req.body?.action !== 'list-active-members') return res.status(400).json({ error: 'Ação inválida.' });
  try {
    const snapshot = await adminDb.collection('users').where('status', '==', 'active').get();
    const members = snapshot.docs.map(doc => {
      const m = doc.data();
      return {
        name: String(m.name || ''), id: String(m.id || ''),
        role: String(m.role || ''),
        discordId: String(m.discordId || ''), darkChat: String(m.darkChat || ''),
      };
    }).filter(m => m.name && ['leader', 'manager', 'member'].includes(m.role));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ members });
  } catch (error) {
    console.error('Falha ao listar integrantes para painéis:', error);
    return res.status(500).json({ error: 'Erro ao consultar integrantes.' });
  }
}
