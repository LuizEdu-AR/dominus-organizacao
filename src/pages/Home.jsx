import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  PackageCheck,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { getAllOrderedCollection, getCollection, getOrderedCollection } from '../services/dataService'
import { dateTime, money } from '../utils/formatters'
import { isManagement, ROLE_LABELS } from '../utils/permissions'

const shortcuts = [
  ['/registradora', 'Vendas', 'Registrar uma nova venda.', ClipboardList],
  ['/farm', 'Farm', 'Registrar itens depositados no baú.', Boxes],
  ['/hierarquia', 'Membros', 'Consultar membros e cargos.', Users],
  ['/tabela-de-precos', 'Preços', 'Consultar produtos e valores.', CircleDollarSign],
  ['/historico-vendas', 'Histórico de Vendas', 'Consultar vendas registradas.', ScrollText],
  ['/avisos', 'Avisos', 'Ver comunicados da organização.', Bell],
]

function toDate(value) {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (value?.seconds) return new Date(value.seconds * 1000)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfWeek() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  const start = new Date(now)
  start.setDate(now.getDate() - diff)
  start.setHours(0, 0, 0, 0)
  return start
}

function totalItems(items = []) {
  return items.reduce((sum, item) => sum + Number(item?.qty || 0), 0)
}

function RecentCard({ title, subtitle, icon: Icon, link, children }) {
  return (
    <section className="panel home-recent-card">
      <div className="home-recent-head">
        <div><Icon size={18} /><div><h3>{title}</h3><span>{subtitle}</span></div></div>
        <Link to={link}>Ver tudo</Link>
      </div>
      <div className="home-recent-list">{children}</div>
    </section>
  )
}

export default function Home() {
  const { profile } = useAuth()
  const management = isManagement(profile?.role)
  const [sales, setSales] = useState([])
  const [farms, setFarms] = useState([])
  const [actions, setActions] = useState([])
  const [notices, setNotices] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function loadDashboard() {
      try {
        const commonRequests = [getOrderedCollection('actions', 'createdAt', 4), getOrderedCollection('notices', 'createdAt', 4)]
        const requests = management
          ? [...commonRequests, getAllOrderedCollection('sales'), getAllOrderedCollection('farms'), getCollection('users', 500)]
          : commonRequests
        const result = await Promise.all(requests)
        if (!active) return

        setActions(result[0])
        setNotices(result[1])
        if (management) {
          setSales(result[2])
          setFarms(result[3])
          setUsers(result[4])
        }
      } catch (err) {
        if (active) setError(err.message || 'Não foi possível carregar o painel.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadDashboard()
    return () => { active = false }
  }, [management])

  const week = useMemo(() => {
    const start = startOfWeek()
    const weekSales = sales.filter(sale => {
      const date = toDate(sale.createdAt)
      return date && date >= start
    })
    const weekFarms = farms.filter(farm => {
      const date = toDate(farm.createdAt)
      return date && date >= start
    })

    return {
      sales: weekSales,
      farms: weekFarms,
      salesCount: weekSales.length,
      salesValue: weekSales.reduce((sum, sale) => sum + Number(sale.total ?? sale.subtotal ?? 0), 0),
      factionFee: weekSales.reduce((sum, sale) => sum + Number(sale.factionFee || 0), 0),
      farmCount: weekFarms.length,
      farmItems: weekFarms.reduce((sum, farm) => sum + totalItems(farm.items), 0),
      activeMembers: users.filter(user => user.status === 'active' && user.role !== 'pending').length,
    }
  }, [sales, farms, users])

  const recentSales = sales.slice(0, 4)
  const recentFarms = farms.slice(0, 4)

  return (
    <>
      <PageHeader eyebrow="PAINEL PRINCIPAL" title={`Bem-vindo, ${profile?.name || 'membro'}`} description={`Cargo atual: ${ROLE_LABELS[profile?.role] || '-'}`} />

      {error && <div className="notice-banner"><span>{error}</span></div>}

      {management && (
        <>
          <div className="home-section-title">
            <div><span className="eyebrow">RESUMO DA SEMANA</span><h2>Visão geral da organização</h2></div>
            <Link className="btn ghost small" to="/relatorios"><BarChart3 size={15} /> Abrir relatórios</Link>
          </div>

          {loading ? <div className="home-dashboard-loading"><div className="spinner" /></div> : (
            <div className="home-kpis">
              <Link to="/historico-vendas" className="home-kpi"><ReceiptText /><span>Vendas</span><strong>{week.salesCount.toLocaleString('pt-BR')}</strong></Link>
              <Link to="/historico-vendas" className="home-kpi"><CircleDollarSign /><span>Valor vendido</span><strong>{money(week.salesValue)}</strong></Link>
              <Link to="/relatorios" className="home-kpi"><BarChart3 /><span>Depósito Dominus</span><strong>{money(week.factionFee)}</strong></Link>
              <Link to="/historico-farm" className="home-kpi"><Boxes /><span>Farms</span><strong>{week.farmCount.toLocaleString('pt-BR')}</strong></Link>
              <Link to="/historico-farm" className="home-kpi"><PackageCheck /><span>Itens farmados</span><strong>{week.farmItems.toLocaleString('pt-BR')}</strong></Link>
              <Link to="/hierarquia" className="home-kpi"><Users /><span>Membros ativos</span><strong>{week.activeMembers.toLocaleString('pt-BR')}</strong></Link>
            </div>
          )}
        </>
      )}

      <div className="home-section-title home-activity-title">
        <div><span className="eyebrow">ATIVIDADE RECENTE</span><h2>O que está acontecendo na Dominus</h2></div>
      </div>

      <div className={`home-recent-grid ${management ? '' : 'member-home-grid'}`}>
        {management && (
          <RecentCard title="Últimas vendas" subtitle="Registros mais recentes" icon={ReceiptText} link="/historico-vendas">
            {recentSales.length ? recentSales.map(sale => (
              <Link to="/historico-vendas" className="home-recent-row" key={sale.id}>
                <div><strong>{sale.sellerName || 'Membro'}</strong><span>{dateTime(sale.createdAt)}</span></div>
                <b>{money(sale.total ?? sale.subtotal ?? 0)}</b>
              </Link>
            )) : <p className="home-empty">Nenhuma venda registrada.</p>}
          </RecentCard>
        )}

        {management && (
          <RecentCard title="Últimos Farms" subtitle="Depósitos mais recentes" icon={Boxes} link="/historico-farm">
            {recentFarms.length ? recentFarms.map(farm => (
              <Link to="/historico-farm" className="home-recent-row" key={farm.id}>
                <div><strong>{farm.memberName || 'Membro'}</strong><span>{dateTime(farm.createdAt)}</span></div>
                <b>{totalItems(farm.items).toLocaleString('pt-BR')} itens</b>
              </Link>
            )) : <p className="home-empty">Nenhum Farm registrado.</p>}
          </RecentCard>
        )}

        <RecentCard title="Últimas ações" subtitle="Atividades registradas" icon={Swords} link="/registro-de-acao">
          {actions.length ? actions.map(action => (
            <Link to="/registro-de-acao" className="home-recent-row" key={action.id}>
              <div><strong>{action.action || 'Ação'}</strong><span>{action.authorName || 'Dominus'} • {dateTime(action.createdAt)}</span></div>
              <b>{action.result || 'Registrada'}</b>
            </Link>
          )) : <p className="home-empty">Nenhuma ação registrada.</p>}
        </RecentCard>

        <RecentCard title="Avisos recentes" subtitle="Comunicados da organização" icon={Bell} link="/avisos">
          {notices.length ? notices.map(notice => (
            <Link to="/avisos" className="home-recent-row" key={notice.id}>
              <div><strong>{notice.title}</strong><span>{notice.authorName || 'Dominus'} • {dateTime(notice.createdAt)}</span></div>
            </Link>
          )) : <p className="home-empty">Nenhum aviso publicado.</p>}
        </RecentCard>
      </div>

      {!management && (
        <div className="shortcut-grid home-shortcuts">
          {shortcuts.map(([path, title, description, Icon]) => (
            <Link className="shortcut-card" key={path} to={path}>
              <div className="shortcut-icon"><Icon size={22} /></div>
              <strong>{title}</strong><span>{description}</span>
            </Link>
          ))}
        </div>
      )}

      <section className="home-about">
        <div className="home-about-copy">
          <span className="eyebrow">SOBRE A DOMINUS</span>
          <h2>Poder. Organização. Luxo. Autoridade.</h2>
          <p>A Dominus é uma organização construída sobre estrutura, compromisso e união. Cada membro desempenha seu papel dentro de uma hierarquia organizada, contribuindo para o crescimento e fortalecimento da organização.</p>
          <div className="home-values">
            <div><ShieldCheck size={19} /><strong>Organização</strong><span>Estrutura, responsabilidade e funções bem definidas.</span></div>
            <div><Users size={19} /><strong>União</strong><span>Trabalho conjunto e compromisso entre os membros.</span></div>
            <div><Sparkles size={19} /><strong>Evolução</strong><span>Crescimento constante da organização e de suas operações.</span></div>
          </div>
        </div>
        <div className="home-about-logo"><img src="/images/dominus-logo-v2.png" alt="Logo Dominus" /></div>
      </section>
    </>
  )
}
