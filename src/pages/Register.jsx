import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { loginUser } from '../services/authService'
import { useToast } from '../components/toasts/ToastProvider'
import LoadingButton from '../components/ui/LoadingButton'

export default function Register() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [member, setMember] = useState(null)
  const [form, setForm] = useState({ password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(Boolean(token))
  const [invalid, setInvalid] = useState(false)
  const { notify } = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    if (!token) return
    let active = true

    async function checkInvite() {
      try {
        const response = await fetch('/api/member-onboarding', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check', token }),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || 'Convite inválido.')
        if (active) setMember(data)
      } catch (error) {
        if (active) {
          setInvalid(true)
          notify(error.message, 'error')
        }
      } finally {
        if (active) setChecking(false)
      }
    }

    checkInvite()
    return () => { active = false }
  }, [token, notify])

  async function submit(e) {
    e.preventDefault()
    if (!member || !token) return
    if (form.password.length < 8) return notify('A senha deve possuir no mínimo 8 caracteres.', 'error')
    if (form.password !== form.confirm) return notify('As senhas não coincidem.', 'error')

    setLoading(true)
    try {
      const response = await fetch('/api/member-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activate', token, password: form.password }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Não foi possível ativar a conta.')

      await loginUser(member.gameId, form.password)
      notify('Conta ativada com sucesso. Bem-vindo à Dominus!')
      navigate('/')
    } catch (error) {
      notify(error.message || 'Não foi possível ativar a conta.', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return <div className="screen-center"><div className="spinner" /></div>
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img className="auth-logo" src="/images/dominus-logo-v2.png" alt="Dominus" />
        <span className="eyebrow2">NOVO MEMBRO</span>

        {!token || invalid ? (
          <>
            <h1>Registro pelo Discord</h1>
            <p>Para criar sua conta, primeiro conclua o registro no Discord da Dominus. Ao finalizar, o bot fornecerá seu acesso de ativação.</p>
            <div className="auth-footer">Já possui conta? <Link to="/login">Entrar</Link></div>
          </>
        ) : (
          <>
            <h1>Finalize sua conta</h1>
            <p>Registro encontrado para <strong>{member?.gameId} | {member?.name}</strong>. Agora defina sua senha de acesso.</p>

            <form onSubmit={submit} className="form-stack">
              <label>ID<input value={member?.gameId || ''} disabled /></label>
              <label>Nome<input value={member?.name || ''} disabled /></label>
              <label>Nova senha<input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={8} /></label>
              <label>Confirmar senha<input type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} required minLength={8} /></label>
              <LoadingButton className="btn primary full" loading={loading} loadingText="Ativando...">Ativar minha conta</LoadingButton>
            </form>

            <div className="auth-footer">Já possui conta? <Link to="/login">Entrar</Link></div>
          </>
        )}
      </div>
    </div>
  )
}
