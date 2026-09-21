import { useEffect, useMemo, useState } from 'react'
import { BarChart3, Boxes, CircleDollarSign, PackageCheck, ReceiptText } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { getAllOrderedCollection } from '../services/dataService'
import { money } from '../utils/formatters'

function toDate(value) {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (value?.seconds) return new Date(value.seconds * 1000)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function userKey(record, prefix) {
  return String(record?.[`${prefix}Uid`] || record?.[`${prefix}Id`] || record?.[`${prefix}Name`] || 'desconhecido')
}

function userLabel(record, prefix) {
  const name = record?.[`${prefix}Name`] || 'Usuário desconhecido'
  const id = record?.[`${prefix}Id`]
  return id ? `${name} #${id}` : name
}

function addItems(target, items = []) {
  items.forEach(item => {
    const name = item?.name || 'Item sem nome'
    target[name] = (target[name] || 0) + Number(item?.qty || 0)
  })
}

function totalItems(items = []) {
  return items.reduce((sum, item) => sum + Number(item?.qty || 0), 0)
}

export default function Reports() {
  const [sales, setSales] = useState([])
  const [farms, setFarms] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedUser, setSelectedUser] = useState('all')

  useEffect(() => {
    Promise.all([
      getAllOrderedCollection('sales'),
      getAllOrderedCollection('farms'),
    ]).then(([saleList, farmList]) => {
      setSales(saleList)
      setFarms(farmList)
    }).catch(err => {
      setError(err.message || 'Não foi possível carregar os dados dos relatórios.')
    }).finally(() => setLoading(false))
  }, [])

  const users = useMemo(() => {
    const map = new Map()
    sales.forEach(sale => map.set(userKey(sale, 'seller'), userLabel(sale, 'seller')))
    farms.forEach(farm => map.set(userKey(farm, 'member'), userLabel(farm, 'member')))
    return [...map.entries()].map(([key, label]) => ({ key, label })).sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
  }, [sales, farms])

  function inPeriod(record) {
    const date = toDate(record.createdAt)
    if (!date) return !startDate && !endDate
    if (startDate) {
      const start = new Date(`${startDate}T00:00:00`)
      if (date < start) return false
    }
    if (endDate) {
      const end = new Date(`${endDate}T23:59:59.999`)
      if (date > end) return false
    }
    return true
  }

  const filteredSales = useMemo(() => sales.filter(sale =>
    inPeriod(sale) && (selectedUser === 'all' || userKey(sale, 'seller') === selectedUser)
  ), [sales, startDate, endDate, selectedUser])

  const filteredFarms = useMemo(() => farms.filter(farm =>
    inPeriod(farm) && (selectedUser === 'all' || userKey(farm, 'member') === selectedUser)
  ), [farms, startDate, endDate, selectedUser])

  const report = useMemo(() => {
    const soldProducts = {}
    const farmItems = {}
    const people = new Map()

    const getPerson = (key, label) => {
      if (!people.has(key)) people.set(key, {
        key, label, salesCount: 0, soldItems: 0, salesValue: 0, factionFee: 0,
        farmCount: 0, farmItems: 0,
      })
      return people.get(key)
    }

    filteredSales.forEach(sale => {
      addItems(soldProducts, sale.items)
      const person = getPerson(userKey(sale, 'seller'), userLabel(sale, 'seller'))
      person.salesCount += 1
      person.soldItems += totalItems(sale.items)
      person.salesValue += Number(sale.total ?? sale.subtotal ?? 0)
      person.factionFee += Number(sale.factionFee || 0)
    })

    filteredFarms.forEach(farm => {
      addItems(farmItems, farm.items)
      const person = getPerson(userKey(farm, 'member'), userLabel(farm, 'member'))
      person.farmCount += 1
      person.farmItems += totalItems(farm.items)
    })

    return {
      salesCount: filteredSales.length,
      salesValue: filteredSales.reduce((sum, sale) => sum + Number(sale.total ?? sale.subtotal ?? 0), 0),
      factionFee: filteredSales.reduce((sum, sale) => sum + Number(sale.factionFee || 0), 0),
      soldItemsCount: filteredSales.reduce((sum, sale) => sum + totalItems(sale.items), 0),
      farmCount: filteredFarms.length,
      farmItemsCount: filteredFarms.reduce((sum, farm) => sum + totalItems(farm.items), 0),
      soldProducts: Object.entries(soldProducts).sort((a, b) => b[1] - a[1]),
      farmItems: Object.entries(farmItems).sort((a, b) => b[1] - a[1]),
      people: [...people.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    }
  }, [filteredSales, filteredFarms])

  function clearFilters() {
    setStartDate('')
    setEndDate('')
    setSelectedUser('all')
  }

  if (loading) return <div className="report-loading"><div className="spinner" /></div>

  return (
    <>
      <PageHeader eyebrow="GESTÃO" title="Relatórios" description="Visão consolidada das vendas e dos registros de Farm da organização." />

      {error && <div className="notice-banner"><span>{error}</span></div>}

      <section className="panel report-filters">
        <div className="report-filter-fields">
          <label>Data inicial<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label>
          <label>Data final<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} /></label>
          <label>Usuário<select value={selectedUser} onChange={event => setSelectedUser(event.target.value)}><option value="all">Todos os usuários</option>{users.map(user => <option key={user.key} value={user.key}>{user.label}</option>)}</select></label>
        </div>
        <button type="button" className="btn ghost" onClick={clearFilters}>Limpar filtros</button>
      </section>

      <div className="report-kpis">
        <article className="report-kpi"><ReceiptText size={20} /><span>Vendas realizadas</span><strong>{report.salesCount.toLocaleString('pt-BR')}</strong></article>
        <article className="report-kpi"><CircleDollarSign size={20} /><span>Valor total vendido</span><strong>{money(report.salesValue)}</strong></article>
        <article className="report-kpi"><BarChart3 size={20} /><span>Depósito da organização</span><strong>{money(report.factionFee)}</strong></article>
        <article className="report-kpi"><PackageCheck size={20} /><span>Itens vendidos</span><strong>{report.soldItemsCount.toLocaleString('pt-BR')}</strong></article>
        <article className="report-kpi"><Boxes size={20} /><span>Registros de Farm</span><strong>{report.farmCount.toLocaleString('pt-BR')}</strong></article>
        <article className="report-kpi"><PackageCheck size={20} /><span>Itens de Farm</span><strong>{report.farmItemsCount.toLocaleString('pt-BR')}</strong></article>
      </div>

      <div className="report-two-columns">
        <section className="panel report-ranking">
          <div className="panel-title"><h3>Itens vendidos</h3><span>{report.soldProducts.length} produto(s)</span></div>
          {report.soldProducts.length ? report.soldProducts.map(([name, qty]) => <div className="report-ranking-row" key={name}><span>{name}</span><strong>{qty.toLocaleString('pt-BR')}</strong></div>) : <p className="muted">Nenhum item vendido no período selecionado.</p>}
        </section>
        <section className="panel report-ranking">
          <div className="panel-title"><h3>Itens de Farm</h3><span>{report.farmItems.length} material(is)</span></div>
          {report.farmItems.length ? report.farmItems.map(([name, qty]) => <div className="report-ranking-row" key={name}><span>{name}</span><strong>{qty.toLocaleString('pt-BR')}</strong></div>) : <p className="muted">Nenhum item de Farm no período selecionado.</p>}
        </section>
      </div>

      <section className="panel">
        <div className="panel-title"><h3>Resumo por usuário</h3><span>{report.people.length} usuário(s)</span></div>
        <div className="table-wrap">
          <table className="report-user-table">
            <thead><tr><th>Usuário</th><th>Vendas</th><th>Itens vendidos</th><th>Valor vendido</th><th>Depósito org.</th><th>Farms</th><th>Itens de Farm</th></tr></thead>
            <tbody>
              {report.people.map(person => <tr key={person.key}><td><strong>{person.label}</strong></td><td>{person.salesCount}</td><td>{person.soldItems.toLocaleString('pt-BR')}</td><td>{money(person.salesValue)}</td><td>{money(person.factionFee)}</td><td>{person.farmCount}</td><td>{person.farmItems.toLocaleString('pt-BR')}</td></tr>)}
              {!report.people.length && <tr><td colSpan="7" className="history-empty">Nenhum registro encontrado para os filtros selecionados.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
