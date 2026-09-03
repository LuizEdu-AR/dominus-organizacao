import { useState } from 'react'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { updateOwnPassword, updateOwnProfile } from '../services/authService'
import { ROLE_LABELS } from '../utils/permissions'
import { useToast } from '../components/toasts/ToastProvider'

export default function Profile() {
  const { profile } = useAuth()
  const { notify } = useToast()
  const [name, setName] = useState(profile?.name || '')
  const [password, setPassword] = useState('')

  async function saveName() {
    try { await updateOwnProfile(profile.uid, name); notify('Nome atualizado.') }
    catch (e) { notify(e.message, 'error') }
  }

  async function savePassword() {
    if (password.length < 8) return notify('A senha deve possuir no mínimo 8 caracteres.', 'error')
    try { await updateOwnPassword(password); setPassword(''); notify('Senha atualizada.') }
    catch { notify('Faça login novamente antes de alterar a senha, se necessário.', 'error') }
  }

  return (
    <>
      <PageHeader eyebrow="CONTA" title="Meu perfil" description="Seu ID é permanente e não pode ser alterado." />
      <div className="profile-grid">
        <div className="panel profile-card">
          <img src="/images/dominus-logo.png" alt="" />
          <h2>{profile?.name}</h2>
          <span className="badge">{ROLE_LABELS[profile?.role] || 'Sem cargo'}</span>
          <div className="profile-id">ID: <strong>{profile?.id}</strong></div>
        </div>
        <div className="panel form-panel">
          <h3>Dados pessoais</h3>
          <div className="form-stack">
            <label>ID<input value={profile?.id || ''} disabled /></label>
            <label>Nome<input value={name} onChange={e => setName(e.target.value.replace(/[0-9]/g, ''))} /></label>
            <button className="btn primary" onClick={saveName}>Salvar nome</button>
            <hr />
            <label>Nova senha<input type="password" value={password} onChange={e => setPassword(e.target.value)} /></label>
            <button className="btn ghost" onClick={savePassword}>Alterar senha</button>
          </div>
        </div>
      </div>
    </>
  )
}
