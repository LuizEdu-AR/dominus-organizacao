import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from './firebase'

export async function getCollection(name, max = 200) {
  const snap = await getDocs(query(collection(db, name), limit(max)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getOrderedCollection(name, field = 'createdAt', max = 500) {
  const snap = await getDocs(query(collection(db, name), orderBy(field, 'desc'), limit(max)))
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function getRecord(name, id) {
  const snap = await getDoc(doc(db, name, id))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function addRecord(name, payload) {
  return addDoc(collection(db, name), { ...payload, createdAt: serverTimestamp() })
}

export async function updateRecord(name, id, payload) {
  return updateDoc(doc(db, name, id), payload)
}

export async function setRecord(name, id, payload) {
  return setDoc(doc(db, name, id), payload, { merge: true })
}

export async function removeRecord(name, id) {
  return deleteDoc(doc(db, name, id))
}
