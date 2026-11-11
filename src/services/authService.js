import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  signOut,
  updatePassword,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db } from './firebase'

const normalizeId = (id) => id.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')
const idToEmail = (id) => `${normalizeId(id)}@dominus.local`

export async function registerUser({ id, name, password }) {
  const credential = await createUserWithEmailAndPassword(auth, idToEmail(id), password)
  await setDoc(doc(db, 'users', credential.user.uid), {
    uid: credential.user.uid,
    id: id.trim(),
    name: name.trim(),
    role: 'pending',
    status: 'pending',
    createdAt: serverTimestamp(),
  })
  return credential.user
}

export async function loginUser(id, password) {
  const response = await fetch('/api/member-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, password }) })
  if (response.ok) { const { token } = await response.json(); return signInWithCustomToken(auth, token) }
  if (response.status === 429) throw new Error('Muitas tentativas. Aguarde 15 minutos.')
  // Compatibilidade com contas antigas que ainda usam Firebase Authentication.
  if (response.status === 401) return signInWithEmailAndPassword(auth, idToEmail(id), password)
  const data = await response.json().catch(() => ({}))
  throw new Error(data.error || 'Não foi possível entrar.')
}

export function logoutUser() {
  return signOut(auth)
}

export async function updateOwnProfile(uid, name) {
  await updateDoc(doc(db, 'users', uid), { name: name.trim() })
}

export async function updateOwnPassword(password, custom = false) {
  if (!auth.currentUser) throw new Error('Usuário não autenticado.')
  if (!custom) return updatePassword(auth.currentUser, password)
  const token = await auth.currentUser.getIdToken()
  const response = await fetch('/api/member-password', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ password }) })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Erro ao alterar senha.')
}
