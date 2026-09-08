import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Bell, Boxes, ChevronRight, CircleDollarSign, ClipboardList, Crown, Handshake,
  Home, LogOut, Menu, PackageOpen, ScrollText, Swords, UserRound, Users, X
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { logoutUser } from '../../services/authService'
import { isApproved, isManagement, ROLE_LABELS } from '../../utils/permissions'
import './ProtectedLayout.css'

const links = [
  ['/', 'Início', Home],
  ['/hierarquia', 'Hierarquia', Users],
  ['/tabela-de-precos', 'Tabela de preços', CircleDollarSign],
  ['/registradora', 'Registradora', ClipboardList],
  ['/parcerias', 'Parcerias', Handshake],
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
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!sidebarOpen) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') setSidebarOpen(false)
    }

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

  return (
    <div className={`app-shell ${sidebarOpen ? 'sidebar-is-open' : ''}`}>
      <button
        type="button"
        className="mobile-menu-button"
        onClick={() => setSidebarOpen(true)}
        aria-label="Abrir menu"
        aria-expanded={sidebarOpen}
      >
        <Menu size={22} />
      </button>

      <button
        type="button"
        className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-label="Fechar menu"
        tabIndex={sidebarOpen ? 0 : -1}
      />

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand">
          <img src="/images/dominus-logo-v2.png" alt="Dominus" />
          <div><strong>DOMINUS</strong><span>Organização</span></div>

          <button
            type="button"
            className="mobile-menu-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            <X size={21} />
          </button>
        </div>

        <nav>
          {(approved
            ? links.filter(([path]) => !['/historico-vendas', '/historico-farm'].includes(path) || isManagement(profile?.role))
            : links.filter(([path]) => path === '/perfil')).map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
              onClick={() => setSidebarOpen(false)}
            >
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
