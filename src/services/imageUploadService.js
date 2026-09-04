import { auth } from './firebase'

export async function uploadImage(file, folder = 'dominus') {
  const user = auth.currentUser
  if (!user) throw new Error('Usuário não autenticado.')

  const token = await user.getIdToken()
  const response = await fetch('/api/upload-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      dataUrl: file?.dataUrl,
      fileName: file?.name || 'imagem.png',
      folder,
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || 'Não foi possível enviar a imagem.')

  return data
}
