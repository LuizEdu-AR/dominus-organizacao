import { useEffect, useState } from 'react'
import { Crown, Send, ShieldCheck, Trash2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import ConfirmModal from '../components/modais/ConfirmModal'
import { useAuth } from '../context/AuthContext'
import { getCollection } from '../services/dataService'
import { approveUser, changeUserRole, dismissUser } from '../services/userAdminService'
import { sendDiscordEvent } from '../services/discordService'
import { isLeader, isManagement, ROLE_LABELS } from '../utils/permissions'
import { useToast } from '../components/toasts/ToastProvider'

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

  const load = async () => setUsers(await getCollection('users'))
  useEffect(() => { load() }, [])

  async function approve(uid) {
    try { await approveUser(uid); notify('Acesso liberado.'); load() }
    catch (e) { notify(e.message, 'error') }
  }

  async function role(uid, nextRole) {
    try { await changeUserRole(uid, nextRole); notify('Cargo atualizado.'); load() }
    catch (e) { notify(e.message, 'error') }
  }

  async function dismiss() {
    try { await dismissUser(confirm.uid); notify('Usuário demitido e conta excluída.'); setConfirm(null); load() }
    catch (e) { notify(e.message, 'error') }
  }

  async function sendHierarchy() {
    try {
      await sendDiscordEvent('hierarchy', { users: users.filter(u => u.status === 'active').map(({ name, id, role }) => ({ name, id, role })) })
      notify('Hierarquia enviada ao Discord.')
    } catch (e) { notify(e.message, 'error') }
  }

  const order = ['leader', 'manager_general', 'manager_actions', 'manager_partnerships', 'manager_finance', 'member', 'pending']
  const sorted = [...users].sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role))

  return (
    <>
      <PageHeader
        eyebrow="ORGANIZAÇÃO"
        title="Hierarquia"
        description="Gerencie acessos e acompanhe a estrutura atual da Dominus."
        actions={isLeader(profile?.role) && <button className="btn primary" onClick={sendHierarchy}><Send size={16} /> Enviar ao Discord</button>}
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
                  <td>
                    {isLeader(profile?.role) && user.uid !== profile?.uid ? (
                      <select value={user.role} onChange={e => role(user.uid, e.target.value)} disabled={user.status === 'pending'}>
                        {roleOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    ) : ROLE_LABELS[user.role] || user.role}
                  </td>
                  <td><span className={`status ${user.status}`}>{user.status === 'active' ? 'Ativo' : 'Pendente'}</span></td>
                  <td>
                    <div className="row-actions">
                      {user.status === 'pending' && isManagement(profile?.role) && (
                        <button className="btn small" onClick={() => approve(user.uid)}>Liberar acesso</button>
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

      <ConfirmModal
        open={Boolean(confirm)}
        title="Demitir usuário?"
        description={confirm ? `A conta de ${confirm.name} será removida do Firebase Auth e do Firestore.` : ''}
        confirmLabel="Demitir"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={dismiss}
      />
    </>
  )
}
