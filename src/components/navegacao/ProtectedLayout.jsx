import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, Boxes, ChevronRight, CircleDollarSign, ClipboardList, Crown,
  Home, LogOut, PackageOpen, ScrollText, Swords, UserRound, Users
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { logoutUser } from '../../services/authService'
import { isApproved, ROLE_LABELS } from '../../utils/permissions'

const links = [
  ['/', 'Início', Home],
  ['/hierarquia', 'Hierarquia', Users],
  ['/tabela-de-precos', 'Tabela de preços', CircleDollarSign],
  ['/registradora', 'Registradora', ClipboardList],
  ['/historico-vendas', 'Histórico de vendas', ScrollText],
  ['/farm', 'Farm', Boxes],
  ['/historico-farm', 'Histórico de farm', PackageOpen],
  ['/registro-de-acao', 'Registro de Ação', Swords],
  ['/avisos', 'Quadro de avisos', Bell],
  ['/perfil', 'Meu perfil', UserRound],
]

export default function ProtectedLayout() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const approved = isApproved(profile)

  if (profile && !approved && location.pathname !== '/aguardando' && location.pathname !== '/perfil') {
    navigate('/aguardando', { replace: true })
  }

  async function handleLogout() {
    await logoutUser()
    navigate('/login')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/images/dominus-logo.png" alt="Dominus" />
          <div><strong>DOMINUS</strong><span>Organização</span></div>
        </div>

        <nav>
          {(approved ? links : links.filter(([path]) => path === '/perfil')).map(([path, label, Icon]) => (
            <NavLink key={path} to={path} end={path === '/'} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              <Icon size={18} /><span>{label}</span><ChevronRight size={15} className="nav-arrow" />
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-user">
          <Crown size={18} />
          <div>
            <strong>{profile?.name || 'Usuário'}</strong>
            <span>{ROLE_LABELS[profile?.role] || 'Sem cargo'}</span>
          </div>
          <button className="icon-button" onClick={handleLogout} title="Sair"><LogOut size={18} /></button>
        </div>
      </aside>

      <main className="main-content"><Outlet /></main>
    </div>
  )
}
