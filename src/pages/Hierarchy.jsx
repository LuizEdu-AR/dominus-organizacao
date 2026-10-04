import { useEffect, useState } from 'react'
import { Crown, Pencil, Send, ShieldCheck, Trash2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { getCollection } from '../services/dataService'
import { approveUser, dismissUser, migrateLegacyManagerRoles, updateUserByLeader } from '../services/userAdminService'
import { sendDiscordEvent } from '../services/discordService'
import { isLeader, isManagement, ROLE_LABELS } from '../utils/permissions'
import { useToast } from '../components/toasts/ToastProvider'
import LoadingButton from '../components/ui/LoadingButton'
import { createNotification } from '../services/notificationService'

const HIERARCHY_CACHE_KEY = 'dominus:hierarchy-users:v1'

function readHierarchyCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(HIERARCHY_CACHE_KEY) || 'null')
    return Array.isArray(cached?.users) ? cached.users : []
  } catch {
    return []
  }
}

function writeHierarchyCache(users) {
  try {
    localStorage.setItem(HIERARCHY_CACHE_KEY, JSON.stringify({ users, savedAt: Date.now() }))
  } catch {}
}

const roleOptions = [
  ['member', 'Membro'],
  ['manager', 'Gerente'],
  ['leader', 'Líder'],
]

export default function Hierarchy() {
  const { profile } = useAuth()
  const { notify } = useToast()
  const [users, setUsers] = useState(() => readHierarchyCache())
  const [loadingUsers, setLoadingUsers] = useState(() => readHierarchyCache().length === 0)
  const [confirm, setConfirm] = useState(null)
  const [dismissalReason, setDismissalReason] = useState('')
  const [editing, setEditing] = useState(null)
  const [editRole, setEditRole] = useState('member')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busyAction, setBusyAction] = useState(null)

  const load = async () => {
    const freshUsers = await getCollection('users')
    setUsers(freshUsers)
    writeHierarchyCache(freshUsers)
    setLoadingUsers(false)
    return freshUsers
  }

  useEffect(() => {
    let active = true

    async function initializeHierarchy() {
      // A lista não espera mais a migração administrativa: Firestore começa a carregar imediatamente.
      const usersPromise = getCollection('users')

      if (isLeader(profile?.role)) {
        migrateLegacyManagerRoles().catch(error => {
          console.error('Falha ao migrar cargos antigos de gerente:', error)
        })
      }

      try {
        const freshUsers = await usersPromise
        if (!active) return
        setUsers(freshUsers)
        writeHierarchyCache(freshUsers)
      } catch (error) {
        console.error('Falha ao carregar membros:', error)
      } finally {
        if (active) setLoadingUsers(false)
      }
    }

    initializeHierarchy()
    return () => { active = false }
  }, [profile?.role])

  async function approve(uid) {
    if (busyAction) return
    setBusyAction(`approve:${uid}`)
    try {
      await approveUser(uid)
      const approvedUser = users.find(user => user.uid === uid)
      await createNotification({ title: 'Acesso liberado', message: 'Seu acesso à Dominus foi aprovado.', type: 'role', link: '/', audience: 'individual', targetUid: uid, authorUid: profile.uid })
      notify(`Acesso de ${approvedUser?.name || 'usuário'} liberado.`)
      await load()
    }
    catch (e) { notify(e.message, 'error') }
    finally { setBusyAction(null) }
  }

  function openEdit(user) {
    setEditing(user)
    setEditRole(user.role === 'pending' ? 'member' : user.role)
    setNewPassword('')
    setConfirmPassword('')
  }

  function closeEdit() {
    if (busyAction) return
    setEditing(null)
    setNewPassword('')
    setConfirmPassword('')
  }

  async function saveEdit() {
    if (!editing || busyAction) return
    if (newPassword && newPassword.length < 8) return notify('A senha deve possuir no mínimo 8 caracteres.', 'error')
    if (newPassword !== confirmPassword) return notify('As senhas não coincidem.', 'error')
    setBusyAction(`edit:${editing.uid}`)
    try {
      const roleChanged = editing.role !== editRole
      await updateUserByLeader(editing.uid, editRole, newPassword)
      if (roleChanged) await createNotification({ title: 'Cargo atualizado', message: `Seu novo cargo é ${ROLE_LABELS[editRole] || editRole}.`, type: 'role', link: '/perfil', audience: 'individual', targetUid: editing.uid, authorUid: profile.uid })
      notify(newPassword ? 'Cargo e senha atualizados.' : 'Cargo atualizado.')
      setEditing(null); setNewPassword(''); setConfirmPassword(''); await load()
    } catch (e) { notify(e.message, 'error') }
    finally { setBusyAction(null) }
  }

  async function dismiss() {
    if (!confirm || busyAction) return
    const reason = dismissalReason.trim()
    if (!reason) return notify('Informe o motivo do desligamento.', 'error')
    setBusyAction(`dismiss:${confirm.uid}`)
    try {
      await dismissUser(confirm.uid, reason)
      notify('Membro desligado. O histórico foi preservado e a exoneração será enviada ao Discord.')
      setConfirm(null)
      setDismissalReason('')
      await load()
    } catch (e) { notify(e.message, 'error') }
    finally { setBusyAction(null) }
  }

  async function sendHierarchy() {
    if (busyAction) return
    setBusyAction('hierarchy')
    try {
      await sendDiscordEvent('hierarchy', { users: users.filter(u => u.status === 'active').map(({ name, id, role }) => ({ name, id, role })) })
      notify('Hierarquia enviada ao Discord.')
    } catch (e) { notify(e.message, 'error') }
    finally { setBusyAction(null) }
  }

  const order = ['leader', 'manager', 'member', 'pending']
  const sorted = users.filter(user => user.status !== 'dismissed').sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))

  return (
    <>
      <PageHeader
        eyebrow="ORGANIZAÇÃO"
        title="Membros"
        description="Gerencie acessos e acompanhe a estrutura atual da Dominus."
        actions={isLeader(profile?.role) && <LoadingButton className="btn primary" onClick={sendHierarchy} loading={busyAction === 'hierarchy'} disabled={Boolean(busyAction)} loadingText="Enviando..."><Send size={16} /> Enviar ao Discord</LoadingButton>}
      />

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Membro</th><th>ID</th><th>Cargo</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody>
              {loadingUsers && sorted.length === 0 && Array.from({ length: 5 }).map((_, index) => (
                <tr className="hierarchy-skeleton-row" key={`hierarchy-skeleton-${index}`}>
                  <td><span className="hierarchy-skeleton wide" /></td>
                  <td><span className="hierarchy-skeleton short" /></td>
                  <td><span className="hierarchy-skeleton medium" /></td>
                  <td><span className="hierarchy-skeleton medium" /></td>
                  <td><span className="hierarchy-skeleton short" /></td>
                </tr>
              ))}
              {sorted.map(user => (
                <tr key={user.uid}>
                  <td><div className="member-name">{user.role === 'leader' ? <Crown size={16} /> : <ShieldCheck size={16} />}{user.name}</div></td>
                  <td>{user.id}</td>
                  <td>{ROLE_LABELS[user.role] || user.role}</td>
                  <td><span className={`status ${user.status}`}>{user.status === 'active' ? 'Ativo' : 'Pendente'}</span></td>
                  <td>
                    <div className="row-actions">
                      {user.status === 'pending' && isManagement(profile?.role) && (
                        <LoadingButton className="btn small" onClick={() => approve(user.uid)} loading={busyAction === `approve:${user.uid}`} disabled={Boolean(busyAction)} loadingText="Liberando...">Liberar acesso</LoadingButton>
                      )}
                      {user.uid !== profile?.uid && isLeader(profile?.role) && (
                        <button className="icon-button" onClick={() => openEdit(user)} title="Editar usuário" disabled={Boolean(busyAction)}>
                          <Pencil size={17} />
                        </button>
                      )}
                      {user.uid !== profile?.uid &&
                        isManagement(profile?.role) &&
                        (isLeader(profile?.role) || user.role === 'member') && (
                          <button
                            className="icon-button danger-text"
                            onClick={() => { setConfirm(user); setDismissalReason('') }}
                            title="Demitir"
                          >
                            <Trash2 size={17} />
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>


      {editing && (
        <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && closeEdit()}>
          <div className="modal-card hierarchy-edit-modal">
            <h3>Editar usuário</h3>
            <p className="muted">{editing.name} · ID {editing.id}</p>
            <div className="hierarchy-edit-fields">
              <label>Cargo<select value={editRole} onChange={event => setEditRole(event.target.value)} disabled={Boolean(busyAction)}>{roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <div className="hierarchy-password-block"><strong>Redefinir senha</strong><span className="muted">Deixe os campos vazios para manter a senha atual.</span></div>
              <label>Nova senha<input type="password" value={newPassword} onChange={event => setNewPassword(event.target.value)} autoComplete="new-password" disabled={Boolean(busyAction)} /></label>
              <label>Confirmar nova senha<input type="password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} autoComplete="new-password" disabled={Boolean(busyAction)} /></label>
            </div>
            <div className="modal-actions"><button className="btn ghost" onClick={closeEdit} disabled={Boolean(busyAction)}>Cancelar</button><LoadingButton className="btn primary" onClick={saveEdit} loading={busyAction === `edit:${editing.uid}`} loadingText="Salvando...">Salvar alterações</LoadingButton></div>
          </div>
        </div>
      )}

      {confirm && (
        <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !busyAction && setConfirm(null)}>
          <div className="modal-card">
            <h3>Desligar membro?</h3>
            <p className="muted">A conta de {confirm.name} será desativada. Os registros e históricos serão preservados.</p>
            <label>
              Motivo do desligamento
              <textarea
                rows="5"
                maxLength="1000"
                value={dismissalReason}
                onChange={event => setDismissalReason(event.target.value)}
                placeholder="Informe o motivo do desligamento"
                disabled={Boolean(busyAction)}
              />
            </label>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => { setConfirm(null); setDismissalReason('') }} disabled={Boolean(busyAction)}>Cancelar</button>
              <LoadingButton className="btn danger" onClick={dismiss} loading={busyAction === `dismiss:${confirm.uid}`} disabled={!dismissalReason.trim()} loadingText="Desligando...">Confirmar desligamento</LoadingButton>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
