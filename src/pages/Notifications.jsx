import { useEffect, useMemo, useState } from 'react'
import { Bell, CheckCheck, Handshake, Megaphone, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { markAllNotificationsRead, markNotificationRead, subscribeNotifications } from '../services/notificationService'
import { dateTime } from '../utils/formatters'

const ICONS = { notice: Megaphone, role: ShieldCheck, partnership: Handshake }

export default function Notifications() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('all')

  useEffect(() => subscribeNotifications(profile?.uid, setItems, error => console.error(error)), [profile?.uid])
  const unread = useMemo(() => items.filter(item => !item.read).length, [items])
  const visible = filter === 'unread' ? items.filter(item => !item.read) : items

  async function openItem(item) {
    if (!item.read) await markNotificationRead(profile.uid, item.id)
    if (item.link && item.link !== '/notificacoes') navigate(item.link)
  }

  return (
    <>
      <PageHeader eyebrow="COMUNICAÇÃO" title="Notificações" description="Acompanhe novidades, alterações e informações importantes da Dominus." actions={unread > 0 && <button type="button" className="btn ghost" onClick={() => markAllNotificationsRead(profile.uid, items)}><CheckCheck size={17} /> Marcar todas como lidas</button>} />
      <div className="notification-page-filter segmented"><button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Todas</button><button type="button" className={filter === 'unread' ? 'active' : ''} onClick={() => setFilter('unread')}>Não lidas {unread > 0 && `(${unread})`}</button></div>
      <div className="notification-page-list">
        {visible.length === 0 ? <div className="empty-card"><Bell size={36} /><h2>{filter === 'unread' ? 'Nenhuma notificação não lida' : 'Nenhuma notificação'}</h2><p>As novidades importantes da organização aparecerão aqui.</p></div> : visible.map(item => {
          const Icon = ICONS[item.type] || Bell
          return <button type="button" className={`notification-page-item ${item.read ? '' : 'unread'}`} key={item.id} onClick={() => openItem(item)}><span className="notification-item-icon"><Icon size={19} /></span><span className="notification-page-copy"><span className="notification-page-title"><strong>{item.title}</strong>{!item.read && <i>Nova</i>}</span><span>{item.message}</span><small>{dateTime(item.createdAt)}</small></span></button>
        })}
      </div>
    </>
  )
}
