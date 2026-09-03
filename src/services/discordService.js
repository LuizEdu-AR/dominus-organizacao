import { auth } from './firebase'

export async function sendDiscordEvent(type, payload) {
  const token = await auth.currentUser?.getIdToken()
  const response = await fetch('/api/discord-service', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token || ''}`,
    },
    body: JSON.stringify({ type, payload }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Falha ao enviar registro para o Discord.')
  }
}
