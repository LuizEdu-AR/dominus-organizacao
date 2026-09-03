import { Link } from 'react-router-dom'
import { Bell, Boxes, CircleDollarSign, ClipboardList, ScrollText, Users } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { ROLE_LABELS } from '../utils/permissions'

const shortcuts = [
  ['/registradora', 'Registradora', 'Registrar uma nova venda.', ClipboardList],
  ['/farm', 'Farm', 'Registrar itens depositados no baú.', Boxes],
  ['/hierarquia', 'Hierarquia', 'Consultar membros e cargos.', Users],
  ['/tabela-de-precos', 'Tabela de preços', 'Consultar produtos e valores.', CircleDollarSign],
  ['/historico-vendas', 'Histórico', 'Consultar vendas registradas.', ScrollText],
  ['/avisos', 'Avisos', 'Ver comunicados da organização.', Bell],
]

export default function Home() {
  const { profile } = useAuth()
  return (
    <>
      <PageHeader eyebrow="PAINEL PRINCIPAL" title={`Bem-vindo, ${profile?.name || 'membro'}`} description={`Cargo atual: ${ROLE_LABELS[profile?.role] || '-'}`} />
      <div className="hero-panel">
        <div>
          <span className="eyebrow">DOMINUS</span>
          <h2>Poder. Organização. Luxo. Autoridade.</h2>
          <p>Acesse rapidamente as principais operações da organização.</p>
        </div>
        <img src="/images/dominus-logo.png" alt="" />
      </div>
      <div className="shortcut-grid">
        {shortcuts.map(([path, title, description, Icon]) => (
          <Link className="shortcut-card" key={path} to={path}>
            <div className="shortcut-icon"><Icon size={22} /></div>
            <strong>{title}</strong>
            <span>{description}</span>
          </Link>
        ))}
      </div>
    </>
  )
}
