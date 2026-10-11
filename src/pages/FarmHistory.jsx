import { useEffect, useMemo, useState } from 'react'
import { Trash2, Image as ImageIcon, X, ExternalLink } from 'lucide-react'
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
  const [selectedReceipt, setSelectedReceipt] = useState(null)
  const perPage = 8
  const totalPages = Math.max(1, Math.ceil(farms.length / perPage))
  const load = async () => setFarms(await getOrderedCollection('farms'))

  useEffect(() => { load() }, [])
  useEffect(() => {
    if (!selectedReceipt) return
    const onKey = event => { if (event.key === 'Escape') setSelectedReceipt(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedReceipt])
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])
  const current = useMemo(() => farms.slice((page - 1) * perPage, page * perPage), [farms, page])

  return (
    <>
      <PageHeader eyebrow="REGISTROS" title="Histórico de Farm" description="Depósitos realizados no baú da organização." />
      <div className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Membro</th><th>Itens</th><th>Comprovante</th>{isManagement(profile?.role) && <th>Ações</th>}</tr></thead>
            <tbody>
              {current.map(farm => (
                <tr key={farm.id}>
                  <td>{dateTime(farm.createdAt)}</td>
                  <td>{farm.memberName} <span className="muted">#{farm.memberId}</span></td>
                  <td>{farm.items?.map(i => `${i.qty}x ${i.name}`).join(', ')}</td>
                  <td>{farm.imageUrl ? <button type="button" className="btn ghost small" onClick={() => setSelectedReceipt(farm)}><ImageIcon size={15} /> Ver comprovante</button> : <span className="muted">Sem anexo</span>}</td>
                  {isManagement(profile?.role) && <td><button className="icon-button danger-text" onClick={async () => { await removeRecord('farms', farm.id); load() }}><Trash2 size={17} /></button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selectedReceipt && <div className="receipt-modal-backdrop" onClick={() => setSelectedReceipt(null)} role="presentation">
        <div className="receipt-modal panel" role="dialog" aria-modal="true" aria-label="Comprovante do Farm" onClick={event => event.stopPropagation()}>
          <div className="receipt-modal-header">
            <div><h3>Comprovante do Farm</h3><span className="muted">{selectedReceipt.memberName} · ID {selectedReceipt.memberId} · {dateTime(selectedReceipt.createdAt)}</span></div>
            <button type="button" className="icon-button" aria-label="Fechar" onClick={() => setSelectedReceipt(null)}><X size={20} /></button>
          </div>
          <img src={selectedReceipt.imageUrl} alt="Comprovante anexado ao Farm" />
          <a className="btn ghost small" href={selectedReceipt.imageUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} /> Abrir imagem original</a>
        </div>
      </div>}
      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </>
  )
}
