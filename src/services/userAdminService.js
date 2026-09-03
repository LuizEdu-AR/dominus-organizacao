import { auth } from './firebase'

async function adminRequest(action, payload) {
  const token = await auth.currentUser?.getIdToken()
  const response = await fetch('/api/user-admin', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token || ''}`,
    },
    body: JSON.stringify({ action, ...payload }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Falha na operação administrativa.')
  return data
}

export const approveUser = (uid) => adminRequest('approve', { uid })
export const changeUserRole = (uid, role) => adminRequest('change-role', { uid, role })
export const dismissUser = (uid) => adminRequest('dismiss', { uid })
