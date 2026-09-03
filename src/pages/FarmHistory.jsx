import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Pagination from '../components/ui/Pagination'
import { useAuth } from '../context/AuthContext'
import { getOrderedCollection, removeRecord } from '../services/dataService'
import { dateTime } from '../utils/formatters'
import { isManagement } from '../utils/permissions'

export default function FarmHistory() {
  const { profile } = useAuth()
  const [farms, setFarms] = useState([])
  const [page, setPage] = useState(1)
  const perPage = 8
  const load = async () => setFarms(await getOrderedCollection('farms'))

  useEffect(() => { load() }, [])
  const totalPages = Math.max(1, Math.ceil(farms.length / perPage))
  const current = useMemo(() => farms.slice((page - 1) * perPage, page * perPage), [farms, page])

  return (
    <>
      <PageHeader eyebrow="REGISTROS" title="Histórico de farm" description="Depósitos realizados no baú da organização." />
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Membro</th><th>Itens</th>{isManagement(profile?.role) && <th>Ações</th>}</tr></thead>
            <tbody>
              {current.map(farm => (
                <tr key={farm.id}>
                  <td>{dateTime(farm.createdAt)}</td>
                  <td>{farm.memberName} <span className="muted">#{farm.memberId}</span></td>
                  <td>{farm.items?.map(i => `${i.qty}x ${i.name}`).join(', ')}</td>
                  {isManagement(profile?.role) && <td><button className="icon-button danger-text" onClick={async () => { await removeRecord('farms', farm.id); load() }}><Trash2 size={17} /></button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </>
  )
}
