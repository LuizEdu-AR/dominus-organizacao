import { auth, db } from './firebase-admin.mjs'

const leaders = [
  { name: 'Chico', id: process.env.CHICO_ID, password: process.env.CHICO_PASSWORD },
  { name: 'Aron', id: process.env.ARON_ID, password: process.env.ARON_PASSWORD },
]

function email(id) {
  return `${id.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '')}@dominus.local`
}

for (const leader of leaders) {
  if (!leader.id || !leader.password) {
    console.log(`Ignorando ${leader.name}: ID/senha não configurados.`)
    continue
  }

  let user
  try {
    user = await auth.getUserByEmail(email(leader.id))
  } catch {
    user = await auth.createUser({ email: email(leader.id), password: leader.password, displayName: leader.name })
  }

  await db.collection('users').doc(user.uid).set({
    uid: user.uid,
    id: leader.id,
    name: leader.name,
    role: 'leader',
    status: 'active',
    createdAt: new Date(),
  }, { merge: true })

  console.log(`${leader.name} configurado como Líder.`)
}
