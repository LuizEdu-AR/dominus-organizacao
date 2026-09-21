import { useEffect, useMemo, useState } from 'react'
import { Search, Trash2 } from 'lucide-react'
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
  const [search, setSearch] = useState('')
  const perPage = 8

  const load = async () => setSales(await getOrderedCollection('sales'))
  useEffect(() => { load() }, [])
  const filteredSales = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR')
    if (!term) return sales

    return sales.filter(sale => {
      const seller = `${sale.sellerName || ''} ${sale.sellerId || ''}`.toLocaleLowerCase('pt-BR')
      const partnership = (sale.partnershipName || '').toLocaleLowerCase('pt-BR')
      const formattedDate = dateTime(sale.createdAt).toLocaleLowerCase('pt-BR')

      return seller.includes(term) || partnership.includes(term) || formattedDate.includes(term)
    })
  }, [sales, search])

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / perPage))
  const current = useMemo(() => filteredSales.slice((page - 1) * perPage, page * perPage), [filteredSales, page])

  useEffect(() => { setPage(1) }, [search])
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  return (
    <>
      <PageHeader eyebrow="REGISTROS" title="Histórico de Vendas" description="Consulte os registros realizados pela equipe." />
      <div className="history-toolbar">
        <label className="history-search">
          <Search size={18} />
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Pesquisar por usuário, parceria ou data..."
            aria-label="Pesquisar histórico de vendas"
          />
        </label>
        <span className="history-results">{filteredSales.length} registro(s)</span>
      </div>

      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Vendedor</th><th>Tipo</th><th>Itens</th><th>Total</th>{isManagement(profile?.role) && <th>Ações</th>}</tr></thead>
            <tbody>
              {current.map(sale => (
                <tr key={sale.id}>
                  <td>{dateTime(sale.createdAt)}</td>
                  <td>{sale.sellerName} <span className="muted">#{sale.sellerId}</span></td>
                  <td>
                    <span className="badge">
                      {sale.type === 'PARCERIA' && sale.partnershipName
                        ? `PARCERIA - ${sale.partnershipName}`
                        : sale.type}
                    </span>
                  </td>
                  <td>{sale.items?.map(i => `${i.qty}x ${i.name}`).join(', ')}</td>
                  <td>{money(sale.total)}</td>
                  {isManagement(profile?.role) && <td><button className="icon-button danger-text" onClick={async () => { await removeRecord('sales', sale.id); load() }}><Trash2 size={17} /></button></td>}
                </tr>
              ))}
              {current.length === 0 && (
                <tr>
                  <td colSpan={isManagement(profile?.role) ? 6 : 5} className="history-empty">
                    Nenhum registro encontrado para esta pesquisa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination page={page} totalPages={totalPages} onChange={setPage} compact showPageInput />
    </>
  )
}
