import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Pagination from '../components/ui/Pagination'
import { useAuth } from '../context/AuthContext'
import { getOrderedCollection, removeRecord } from '../services/dataService'
import { dateTime, money } from '../utils/formatters'
import { isManagement } from '../utils/permissions'

export default function SalesHistory() {
  const { profile } = useAuth()
  const [sales, setSales] = useState([])
  const [page, setPage] = useState(1)
  const perPage = 8

  const load = async () => setSales(await getOrderedCollection('sales'))
  useEffect(() => { load() }, [])
  const totalPages = Math.max(1, Math.ceil(sales.length / perPage))
  const current = useMemo(() => sales.slice((page - 1) * perPage, page * perPage), [sales, page])

  return (
    <>
      <PageHeader eyebrow="REGISTROS" title="Histórico de vendas" description="Consulte os registros realizados pela equipe." />
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Vendedor</th><th>Tipo</th><th>Itens</th><th>Total</th>{isManagement(profile?.role) && <th>Ações</th>}</tr></thead>
            <tbody>
              {current.map(sale => (
                <tr key={sale.id}>
                  <td>{dateTime(sale.createdAt)}</td>
                  <td>{sale.sellerName} <span className="muted">#{sale.sellerId}</span></td>
                  <td><span className="badge">{sale.type}</span></td>
                  <td>{sale.items?.map(i => `${i.qty}x ${i.name}`).join(', ')}</td>
                  <td>{money(sale.total)}</td>
                  {isManagement(profile?.role) && <td><button className="icon-button danger-text" onClick={async () => { await removeRecord('sales', sale.id); load() }}><Trash2 size={17} /></button></td>}
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
