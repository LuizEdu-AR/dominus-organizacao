import { useEffect, useState } from 'react'
import { updateOwnPassword } from '../../services/authService'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  BarChart3, Bell, Boxes, ChevronRight, CircleDollarSign, ClipboardList, Crown, Handshake,
  Factory, Home, LogOut, Menu, PackageOpen, ScrollText, Swords, UserRound, Users, X
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { logoutUser } from '../../services/authService'
import { isApproved, isManagement, ROLE_LABELS } from '../../utils/permissions'
import NotificationCenter from '../notifications/NotificationCenter'
import './ProtectedLayout.css'

const groups = [
  {
    label: 'GERAL',
    links: [
      ['/', 'Início', Home],
      ['/hierarquia', 'Membros', Users],
    ],
  },
  {
    label: 'COMERCIAL',
    links: [
      ['/tabela-de-precos', 'Preços', CircleDollarSign],
      ['/registradora', 'Vendas', ClipboardList],
      ['/historico-vendas', 'Histórico de Vendas', ScrollText, true],
      ['/parcerias', 'Parcerias', Handshake],
    ],
  },
  {
    label: 'OPERAÇÕES',
    links: [
      ['/producao', 'Produção', Factory],
      ['/farm', 'Farm', Boxes],
      ['/historico-farm', 'Histórico de Farm', PackageOpen, true],
      ['/registro-de-acao', 'Ações', Swords],
    ],
  },
  {
    label: 'GESTÃO',
    links: [
      ['/avisos', 'Avisos', Bell],
      ['/relatorios', 'Relatórios', BarChart3, true],
    ],
  },
  {
    label: 'CONTA',
    links: [
      ['/perfil', 'Meu Perfil', UserRound],
    ],
  },
]

export default function ProtectedLayout() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const approved = isApproved(profile)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  async function changeInitialPassword(event) {
    event.preventDefault()
    if (newPassword.length < 6) return setPasswordError('A senha deve ter pelo menos 6 caracteres.')
    if (newPassword !== confirmPassword) return setPasswordError('As senhas não coincidem.')
    setSavingPassword(true); setPasswordError('')
    try { await updateOwnPassword(newPassword, true); setNewPassword(''); setConfirmPassword('') }
    catch (error) { setPasswordError(error.message || 'Não foi possível alterar a senha.') }
    finally { setSavingPassword(false) }
  }

  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!sidebarOpen) return undefined
    function handleKeyDown(event) { if (event.key === 'Escape') setSidebarOpen(false) }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [sidebarOpen])

  if (profile && !approved && location.pathname !== '/aguardando' && location.pathname !== '/perfil') {
    navigate('/aguardando', { replace: true })
  }

  async function handleLogout() {
    await logoutUser()
    navigate('/login')
  }

  const visibleGroups = approved
    ? groups.map(group => ({ ...group, links: group.links.filter(([, , , managementOnly]) => !managementOnly || isManagement(profile?.role)) })).filter(group => group.links.length)
    : groups.map(group => ({ ...group, links: group.links.filter(([path]) => path === '/perfil') })).filter(group => group.links.length)

  if (profile?.mustChangePassword) return (
    <div className="auth-screen">
      <div className="auth-card" role="dialog" aria-modal="true" aria-labelledby="initial-password-title">
        <h1 id="initial-password-title">Atualizar senha</h1>
        <p>Este é seu primeiro acesso. Defina uma senha pessoal para continuar.</p>
        <form className="form-stack" onSubmit={changeInitialPassword}>
          <label>Nova senha<input type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} /></label>
          <label>Confirmar senha<input type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} /></label>
          {passwordError && <p role="alert">{passwordError}</p>}
          <button className="btn primary full" disabled={savingPassword}>{savingPassword ? 'Salvando...' : 'Salvar nova senha'}</button>
        </form>
        <button className="btn ghost" type="button" onClick={handleLogout}>Sair da conta</button>
      </div>
    </div>
  )

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-is-open' : ''}`}>
      <button type="button" className="mobile-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Abrir menu" aria-expanded={sidebarOpen}><Menu size={22} /></button>
      <button type="button" className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`} onClick={() => setSidebarOpen(false)} aria-label="Fechar menu" tabIndex={sidebarOpen ? 0 : -1} />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <img src="/images/dominus-logo-v2.png" alt="Dominus" />
          <div className="brand-copy"><strong>DOMINUS</strong><span>Organização</span></div>
          <NotificationCenter />
          <button type="button" className="mobile-menu-close" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu"><X size={21} /></button>
        </div>

        <nav>
          {visibleGroups.map(group => (
            <div className="nav-group" key={group.label}>
              <span className="nav-group-title">{group.label}</span>
              <div className="nav-group-links">
                {group.links.map(([path, label, Icon]) => (
                  <NavLink key={path} to={path} end={path === '/'} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'} onClick={() => setSidebarOpen(false)}>
                    <Icon size={18} /><span>{label}</span><ChevronRight size={15} className="nav-arrow" />
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-user">
          <Crown size={18} />
          <div><strong>{profile?.name || 'Usuário'}</strong><span>{ROLE_LABELS[profile?.role] || 'Sem cargo'}</span></div>
          <button className="icon-button" onClick={handleLogout} title="Sair"><LogOut size={18} /></button>
        </div>
      </aside>

      <main className="main-content"><Outlet /></main>
    </div>
  )
}
