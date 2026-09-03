import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerUser } from '../services/authService'
import { useToast } from '../components/toasts/ToastProvider'
import LoadingButton from '../components/ui/LoadingButton'

export default function Register() {
  const [form, setForm] = useState({ id: '', name: '', password: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  const { notify } = useToast()
  const navigate = useNavigate()

  async function submit(e) {
    e.preventDefault()
    if (form.password.length < 8) return notify('A senha deve possuir no mínimo 8 caracteres.', 'error')
    if (form.password !== form.confirm) return notify('As senhas não coincidem.', 'error')

    setLoading(true)
    try {
      await registerUser(form)
      notify('Cadastro realizado. Aguarde a liberação de acesso.')
      navigate('/aguardando')
    } catch (error) {
      notify(error.code === 'auth/email-already-in-use' ? 'Este ID já está em uso.' : 'Não foi possível criar a conta.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img className="auth-logo" src="/images/dominus-logo.png" alt="Dominus" />
        <span className="eyebrow">NOVO MEMBRO</span>
        <h1>Criar conta</h1>
        <p>Após o cadastro, um Líder ou Gerente deverá liberar seu acesso.</p>

        <form onSubmit={submit} className="form-stack">
          <label>ID<input value={form.id} onChange={e => setForm({ ...form, id: e.target.value })} required /></label>
          <label>Nome<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value.replace(/[0-9]/g, '') })} required /></label>
          <label>Senha<input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></label>
          <label>Confirmar senha<input type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} required /></label>
          <LoadingButton className="btn primary full" loading={loading} loadingText="Criando...">Criar conta</LoadingButton>
        </form>

        <div className="auth-footer">Já possui conta? <Link to="/login">Entrar</Link></div>
      </div>
    </div>
  )
}
