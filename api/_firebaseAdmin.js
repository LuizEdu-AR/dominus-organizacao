import dotenv from 'dotenv'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

// Carrega o .env.local durante o desenvolvimento local.
// Na Vercel, as variáveis configuradas no painel continuam funcionando normalmente.
dotenv.config({ path: '.env.local' })

function privateKey() {
  return process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
}

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
const key = privateKey()

if (!projectId || !clientEmail || !key) {
  console.error('Firebase Admin não configurado:', {
    projectId: Boolean(projectId),
    clientEmail: Boolean(clientEmail),
    privateKey: Boolean(key),
  })

  throw new Error('Variáveis do Firebase Admin não foram carregadas.')
}

const app =
  getApps()[0] ||
  initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: key,
    }),
  })

export const adminAuth = getAuth(app)
export const adminDb = getFirestore(app)

export async function requireUser(req) {
  const header = req.headers.authorization || ''

  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : null

  if (!token) {
    throw new Error('Token ausente.')
  }

  const decoded = await adminAuth.verifyIdToken(token)

  const snap = await adminDb
    .collection('users')
    .doc(decoded.uid)
    .get()

  if (!snap.exists) {
    throw new Error('Perfil não encontrado.')
  }

  return {
    uid: decoded.uid,
    ...snap.data(),
  }
}