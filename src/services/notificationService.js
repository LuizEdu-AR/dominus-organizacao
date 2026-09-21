import {
  addDoc, collection, doc, limit, onSnapshot, query, serverTimestamp, setDoc, where, writeBatch,
} from 'firebase/firestore'
import { db } from './firebase'

const sortNotifications = items => [...items].sort((a, b) => {
  const aTime = a.createdAt?.toMillis?.() || 0
  const bTime = b.createdAt?.toMillis?.() || 0
  return bTime - aTime
})

export async function createNotification({ title, message, type = 'info', link = '/notificacoes', audience = 'global', targetUid = '', authorUid = '' }) {
  return addDoc(collection(db, 'notifications'), {
    title,
    message,
    type,
    link,
    audience,
    targetUid,
    authorUid,
    createdAt: serverTimestamp(),
  })
}

export function subscribeNotifications(uid, onChange, onError) {
  if (!uid) return () => {}

  let globalItems = []
  let personalItems = []
  let reads = new Set()
  let globalReady = false
  let personalReady = false
  let readsReady = false

  const emit = () => {
    const merged = new Map()
    ;[...globalItems, ...personalItems].forEach(item => merged.set(item.id, item))
    onChange(sortNotifications([...merged.values()]).map(item => ({ ...item, read: reads.has(item.id) })), globalReady && personalReady && readsReady)
  }

  const globalQuery = query(collection(db, 'notifications'), where('audience', '==', 'global'), limit(100))
  const personalQuery = query(collection(db, 'notifications'), where('targetUid', '==', uid), limit(100))
  const readsRef = collection(db, 'users', uid, 'notificationReads')

  const unsubGlobal = onSnapshot(globalQuery, snap => {
    globalItems = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    globalReady = true
    emit()
  }, onError)
  const unsubPersonal = onSnapshot(personalQuery, snap => {
    personalItems = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    personalReady = true
    emit()
  }, onError)
  const unsubReads = onSnapshot(readsRef, snap => {
    reads = new Set(snap.docs.map(d => d.id))
    readsReady = true
    emit()
  }, onError)

  return () => { unsubGlobal(); unsubPersonal(); unsubReads() }
}

export async function markNotificationRead(uid, notificationId) {
  if (!uid || !notificationId) return
  await setDoc(doc(db, 'users', uid, 'notificationReads', notificationId), { readAt: serverTimestamp() }, { merge: true })
}

export async function markAllNotificationsRead(uid, notifications) {
  if (!uid) return
  const unread = notifications.filter(item => !item.read)
  if (!unread.length) return
  const batch = writeBatch(db)
  unread.forEach(item => batch.set(doc(db, 'users', uid, 'notificationReads', item.id), { readAt: serverTimestamp() }, { merge: true }))
  await batch.commit()
}
