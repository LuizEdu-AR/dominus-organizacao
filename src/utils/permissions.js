export const ROLE_LABELS = {
  pending: 'Aguardando acesso',
  member: 'Membro',
  manager_general: 'Gerente Geral',
  manager_actions: 'Gerente de Ações',
  manager_partnerships: 'Gerente de Parcerias',
  manager_finance: 'Gerente de Finanças',
  leader: 'Líder',
}

export const MANAGER_ROLES = [
  'manager_general',
  'manager_actions',
  'manager_partnerships',
  'manager_finance',
]

export const isLeader = (role) => role === 'leader'
export const isManager = (role) => MANAGER_ROLES.includes(role)
export const isManagement = (role) => isLeader(role) || isManager(role)
export const isApproved = (profile) => profile?.status === 'active' && profile?.role !== 'pending'
