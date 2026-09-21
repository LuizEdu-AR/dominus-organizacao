import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, BellRing, CheckCheck, ChevronRight, Megaphone, ShieldCheck, Handshake, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { markAllNotificationsRead, markNotificationRead, subscribeNotifications } from '../../services/notificationService'
import { dateTime } from '../../utils/formatters'
import { useToast } from '../toasts/ToastProvider'

const ICONS = { notice: Megaphone, role: ShieldCheck, partnership: Handshake }

export default function NotificationCenter() {
  const { profile } = useAuth()
  const { notify } = useToast()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const initialized = useRef(false)
  const knownIds = useRef(new Set())

  useEffect(() => {
    if (!profile?.uid || profile?.status !== 'active') return undefined
    return subscribeNotifications(profile.uid, (items, ready) => {
      setNotifications(items)
      if (!ready) return
      if (initialized.current) {
        const fresh = items.find(item => !knownIds.current.has(item.id) && !item.read)
        if (fresh) notify(`${fresh.title}: ${fresh.message}`)
      }
      knownIds.current = new Set(items.map(item => item.id))
      initialized.current = true
    }, error => console.error('Falha ao carregar notificações:', error))
  }, [profile?.uid, profile?.status])

  const unread = useMemo(() => notifications.filter(item => !item.read).length, [notifications])
  const recent = notifications.slice(0, 6)

  async function openNotification(item) {
    if (!item.read) await markNotificationRead(profile.uid, item.id)
    setOpen(false)
    navigate(item.link || '/notificacoes')
  }

  async function markAll() { await markAllNotificationsRead(profile.uid, notifications) }

  if (profile?.status !== 'active') return null

  return (
    <div className="notification-center">
      <button className={`notification-bell ${unread ? 'has-unread' : ''}`} type="button" onClick={() => setOpen(current => !current)} aria-label={`Notificações${unread ? `, ${unread} não lidas` : ''}`}>
        {unread ? <BellRing size={21} /> : <Bell size={21} />}
        {unread > 0 && <span className="notification-count">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && <button type="button" className="notification-dismiss" aria-label="Fechar notificações" onClick={() => setOpen(false)} />}
      {open && (
        <section className="notification-popover">
          <div className="notification-popover-head">
            <div><strong>Notificações</strong><span>{unread ? `${unread} não lida${unread > 1 ? 's' : ''}` : 'Tudo em dia'}</span></div>
            <div className="notification-head-actions">
              {unread > 0 && <button type="button" title="Marcar todas como lidas" onClick={markAll}><CheckCheck size={17} /></button>}
              <button type="button" title="Fechar" onClick={() => setOpen(false)}><X size={17} /></button>
            </div>
          </div>
          <div className="notification-popover-list">
            {recent.length === 0 ? <div className="notification-empty"><Bell size={26} /><strong>Nenhuma notificação</strong><span>As novidades importantes aparecerão aqui.</span></div> : recent.map(item => {
              const Icon = ICONS[item.type] || Bell
              return <button type="button" className={`notification-item ${item.read ? '' : 'unread'}`} key={item.id} onClick={() => openNotification(item)}><span className="notification-item-icon"><Icon size={17} /></span><span className="notification-item-copy"><strong>{item.title}</strong><span>{item.message}</span><small>{dateTime(item.createdAt)}</small></span><ChevronRight size={15} /></button>
            })}
          </div>
          <button type="button" className="notification-view-all" onClick={() => { setOpen(false); navigate('/notificacoes') }}>Ver todas as notificações <ChevronRight size={15} /></button>
        </section>
      )}
    </div>
  )
}
