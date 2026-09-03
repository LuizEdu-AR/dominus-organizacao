import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../services/firebase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => onAuthStateChanged(auth, (firebaseUser) => {
    setUser(firebaseUser)
    if (!firebaseUser) {
      setProfile(null)
      setLoading(false)
      return
    }

    const unsub = onSnapshot(doc(db, 'users', firebaseUser.uid), (snap) => {
      setProfile(snap.exists() ? { uid: snap.id, ...snap.data() } : null)
      setLoading(false)
    })

    return unsub
  }), [])

  const value = useMemo(() => ({ user, profile, loading }), [user, profile, loading])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
