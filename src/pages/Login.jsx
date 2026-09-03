import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginUser } from '../services/authService'
import { useToast } from '../components/toasts/ToastProvider'
import LoadingButton from '../components/ui/LoadingButton'

export default function Login() {
  const [form, setForm] = useState({ id: '', password: '' })
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { notify } = useToast()

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await loginUser(form.id, form.password)
      navigate('/')
    } catch {
      notify('ID ou senha inválidos.', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img className="auth-logo" src="/images/dominus-logo.png" alt="Dominus" />
        <span className="eyebrow">ACESSO RESTRITO</span>
        <h1>DOMINUS</h1>
        <p>Organização, disciplina e controle em um único painel.</p>

        <form onSubmit={submit} className="form-stack">
          <label>ID<input value={form.id} onChange={e => setForm({ ...form, id: e.target.value })} required /></label>
          <label>Senha<input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required /></label>
          <LoadingButton className="btn primary full" loading={loading} loadingText="Entrando...">Entrar</LoadingButton>
        </form>

        <div className="auth-footer">Ainda não possui conta? <Link to="/cadastro">Cadastrar</Link></div>
      </div>
    </div>
  )
}
