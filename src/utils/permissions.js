export const ROLE_LABELS = {
  pending: 'Aguardando acesso',
  member: 'Membro',
  manager: 'Gerente',
  leader: 'Líder',
}

export const MANAGER_ROLES = ['manager']

export const isLeader = (role) => role === 'leader'
export const isManager = (role) => role === 'manager'
export const isManagement = (role) => isLeader(role) || isManager(role)
export const isApproved = (profile) => profile?.status === 'active' && profile?.role !== 'pending'
