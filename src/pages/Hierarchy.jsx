import { useEffect, useState } from 'react'
import { Crown, Pencil, Send, ShieldCheck, Trash2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import ConfirmModal from '../components/modais/ConfirmModal'
import { useAuth } from '../context/AuthContext'
import { getCollection } from '../services/dataService'
import { approveUser, dismissUser, updateUserByLeader } from '../services/userAdminService'
import { sendDiscordEvent } from '../services/discordService'
import { isLeader, isManagement, ROLE_LABELS } from '../utils/permissions'
import { useToast } from '../components/toasts/ToastProvider'
import LoadingButton from '../components/ui/LoadingButton'

const roleOptions = [
  ['member', 'Membro'],
  ['manager_finance', 'Gerente de Finanças'],
  ['manager_partnerships', 'Gerente de Parcerias'],
  ['manager_actions', 'Gerente de Ações'],
  ['manager_general', 'Gerente Geral'],
  ['leader', 'Líder'],
]

export default function Hierarchy() {
  const { profile } = useAuth()
  const { notify } = useToast()
  const [users, setUsers] = useState([])
  const [confirm, setConfirm] = useState(null)
  const [editing, setEditing] = useState(null)
  const [editRole, setEditRole] = useState('member')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busyAction, setBusyAction] = useState(null)

  const load = async () => setUsers(await getCollection('users'))
  useEffect(() => { load() }, [])

  async function approve(uid) {
    if (busyAction) return
    setBusyAction(`approve:${uid}`)
    try { await approveUser(uid); notify('Acesso liberado.'); await load() }
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
      await updateUserByLeader(editing.uid, editRole, newPassword)
      notify(newPassword ? 'Cargo e senha atualizados.' : 'Cargo atualizado.')
      setEditing(null); setNewPassword(''); setConfirmPassword(''); await load()
    } catch (e) { notify(e.message, 'error') }
    finally { setBusyAction(null) }
  }

  async function dismiss() {
    if (!confirm || busyAction) return
    setBusyAction(`dismiss:${confirm.uid}`)
    try { await dismissUser(confirm.uid); notify('Usuário demitido e conta excluída.'); setConfirm(null); await load() }
    catch (e) { notify(e.message, 'error') }
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

  const order = ['leader', 'manager_general', 'manager_actions', 'manager_partnerships', 'manager_finance', 'member', 'pending']
  const sorted = [...users].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))

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
                        !(user.role === 'leader' && !isLeader(profile?.role)) && (
                          <button
                            className="icon-button danger-text"
                            onClick={() => setConfirm(user)}
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

      <ConfirmModal
        open={Boolean(confirm)}
        title="Demitir usuário?"
        description={confirm ? `A conta de ${confirm.name} será removida do Firebase Auth e do Firestore.` : ''}
        confirmLabel="Demitir"
        danger
        onCancel={() => !busyAction && setConfirm(null)}
        onConfirm={dismiss}
        loading={Boolean(confirm && busyAction === `dismiss:${confirm.uid}`)}
      />
    </>
  )
}
