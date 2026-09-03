import { Clock3 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'

export default function PendingAccess() {
  const { profile } = useAuth()
  return (
    <>
      <PageHeader eyebrow="ACESSO" title="Aguardando liberação" description="Seu cadastro foi concluído, mas seu acesso ainda precisa ser aprovado pela gestão." />
      <div className="empty-card">
        <Clock3 size={36} />
        <h2>{profile?.name}, sua conta está pendente.</h2>
        <p>Assim que um Líder ou Gerente liberar seu acesso, as demais seções aparecerão automaticamente.</p>
      </div>
    </>
  )
}
