import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
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

export function loginUser(id, password) {
  return signInWithEmailAndPassword(auth, idToEmail(id), password)
}

export function logoutUser() {
  return signOut(auth)
}

export async function updateOwnProfile(uid, name) {
  await updateDoc(doc(db, 'users', uid), { name: name.trim() })
}

export async function updateOwnPassword(password) {
  if (!auth.currentUser) throw new Error('Usuário não autenticado.')
  await updatePassword(auth.currentUser, password)
}
