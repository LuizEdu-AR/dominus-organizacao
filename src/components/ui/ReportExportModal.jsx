import { useMemo, useState } from 'react'
import { Download, X } from 'lucide-react'
import { money } from '../../utils/formatters'
import { sendDiscordEvent } from '../../services/discordService'

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

function toDate(value) {
  if (!value) return null
  if (typeof value?.toDate === 'function') return value.toDate()
  if (value?.seconds) return new Date(value.seconds * 1000)
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
function userKey(record, prefix) { return String(record?.[`${prefix}Uid`] || record?.[`${prefix}Id`] || record?.[`${prefix}Name`] || 'desconhecido') }
function totalItems(items = []) { return items.reduce((sum, item) => sum + Number(item?.qty || 0), 0) }
function isoDate(date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}` }
function brDate(date) { return date?.toLocaleDateString('pt-BR') || '-' }
function csvCell(value) {
  let text = String(value ?? '').replace(/\r?\n/g, ' ').trim()
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
function slug(value) { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }

export default function ReportExportModal({ open, onClose, sales, farms, users, partnerships }) {
  const now = new Date()
  const [dataType, setDataType] = useState('sales')
  const [periodType, setPeriodType] = useState('all')
  const [month, setMonth] = useState(now.getMonth())
  const [year, setYear] = useState(now.getFullYear())
  const [day, setDay] = useState(isoDate(now))
  const [rangeStart, setRangeStart] = useState(isoDate(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [rangeEnd, setRangeEnd] = useState(isoDate(now))
  const [selectedUser, setSelectedUser] = useState('all')
  const [partnershipType, setPartnershipType] = useState('all')
  const [selectedPartnership, setSelectedPartnership] = useState('all')
  const [exporting, setExporting] = useState(false)

  const years = useMemo(() => {
    const dates = [...sales, ...farms].map(item => toDate(item.createdAt)).filter(Boolean).map(date => date.getFullYear())
    return [...new Set([now.getFullYear(), ...dates])].sort((a,b) => b-a)
  }, [sales, farms])

  const period = useMemo(() => {
    if (periodType === 'all') {
      return { start: null, end: null, label: 'Todo o histórico', file: 'todo-historico' }
    }
    if (periodType === 'week') {
      const start = new Date(now); start.setHours(0,0,0,0); start.setDate(start.getDate() - start.getDay())
      return { start, end: now, label: `${brDate(start)} → ${brDate(now)}`, file: `semana-atual_${isoDate(now)}` }
    }
    if (periodType === 'month') {
      return { start: new Date(year, month, 1, 0,0,0,0), end: new Date(year, month+1, 0, 23,59,59,999), label: `${MONTHS[month]} de ${year}`, file: `${slug(MONTHS[month])}-${year}` }
    }
    if (periodType === 'day') {
      const start = new Date(`${day}T00:00:00`); const end = new Date(`${day}T23:59:59.999`)
      return { start, end, label: brDate(start), file: day.split('-').reverse().join('-') }
    }
    const start = new Date(`${rangeStart}T00:00:00`); const end = new Date(`${rangeEnd}T23:59:59.999`)
    return { start, end, label: `${brDate(start)} → ${brDate(end)}`, file: `${rangeStart.split('-').reverse().join('-')}_a_${rangeEnd.split('-').reverse().join('-')}` }
  }, [periodType, month, year, day, rangeStart, rangeEnd])

  const partnershipMap = useMemo(() => new Map(partnerships.map(p => [String(p.name || '').toLowerCase(), p.type === 'fraternity' ? 'fraternity' : 'organization'])), [partnerships])
  const partnershipOptions = useMemo(() => [...new Set(sales.map(s => s.partnershipName).filter(Boolean))].sort((a,b) => a.localeCompare(b,'pt-BR')).filter(name => partnershipType === 'all' || partnershipMap.get(name.toLowerCase()) === partnershipType), [sales, partnershipType, partnershipMap])

  const records = useMemo(() => {
    const source = dataType === 'sales' ? sales : farms
    const prefix = dataType === 'sales' ? 'seller' : 'member'
    return source.filter(record => {
      const date = toDate(record.createdAt)
      if (!date) return false
      if (period.start && date < period.start) return false
      if (period.end && date > period.end) return false
      if (selectedUser !== 'all' && userKey(record, prefix) !== selectedUser) return false
      if (dataType === 'sales') {
        if (selectedPartnership !== 'all' && record.partnershipName !== selectedPartnership) return false
        if (partnershipType !== 'all') {
          if (!record.partnershipName || partnershipMap.get(String(record.partnershipName).toLowerCase()) !== partnershipType) return false
        }
      }
      return true
    })
  }, [dataType, sales, farms, period, selectedUser, selectedPartnership, partnershipType, partnershipMap])

  const preview = useMemo(() => dataType === 'sales' ? {
    count: records.length,
    value: records.reduce((sum, r) => sum + Number(r.total ?? r.subtotal ?? 0), 0),
    fee: records.reduce((sum, r) => sum + Number(r.factionFee || 0), 0),
  } : { count: records.length, items: records.reduce((sum, r) => sum + totalItems(r.items), 0) }, [records, dataType])

  if (!open) return null
  const invalidRange = periodType === 'range' && rangeStart > rangeEnd

  async function exportCsv() {
    if (!records.length || invalidRange || exporting) return
    setExporting(true)
    try {
      const headers = dataType === 'sales'
        ? ['Data','Horário','Vendedor','ID','Tipo','Parceria','Produtos','Quantidade total','Valor vendido','Depósito Dominus']
        : ['Data','Horário','Membro','ID','Materiais','Quantidade total']
      const rows = records.map(record => {
        const date = toDate(record.createdAt)
        const items = (record.items || []).map(item => `${item.qty}x ${item.name}`).join(' | ')
        if (dataType === 'sales') return [brDate(date), date?.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) || '-', record.sellerName || '-', record.sellerId || '-', record.type || '-', record.partnershipName || '-', items, totalItems(record.items), Number(record.total ?? record.subtotal ?? 0).toFixed(2).replace('.',','), Number(record.factionFee || 0).toFixed(2).replace('.',',')]
        return [brDate(date), date?.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) || '-', record.memberName || '-', record.memberId || '-', items, totalItems(record.items)]
      })
      const csv = '\uFEFFsep=;\r\n' + [headers, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      const userLabel = selectedUser === 'all' ? '' : `_${slug(users.find(u => u.key === selectedUser)?.label || 'usuario')}`
      const partnershipLabel = dataType === 'sales' && selectedPartnership !== 'all' ? `_${slug(selectedPartnership)}` : ''
      link.href = url
      link.download = `dominus_${dataType === 'sales' ? 'vendas' : 'farm'}${userLabel}${partnershipLabel}_${period.file}.csv`
      document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url)
      sendDiscordEvent('admin-log', { action: 'Relatório CSV exportado', details: `${dataType === 'sales' ? 'Vendas' : 'Farm'} • ${period.label} • ${records.length} registro(s)` }).catch(() => {})
      onClose()
    } finally { setExporting(false) }
  }

  return <div className="modal-backdrop report-export-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="modal-card report-export-modal">
      <div className="report-export-head"><div><h3>Exportar relatório</h3><p className="muted">Configure os dados que deseja exportar em CSV.</p></div><button className="icon-button" onClick={onClose}><X size={18}/></button></div>
      <div className="report-export-section"><span className="report-export-label">Tipo de dados</span><div className="report-export-tabs"><button className={dataType==='sales'?'active':''} onClick={()=>setDataType('sales')}>Vendas</button><button className={dataType==='farms'?'active':''} onClick={()=>setDataType('farms')}>Farm</button></div></div>
      <div className="report-export-section"><span className="report-export-label">Período</span><div className="report-export-tabs five"><button className={periodType==='all'?'active':''} onClick={()=>setPeriodType('all')}>Tudo</button><button className={periodType==='week'?'active':''} onClick={()=>setPeriodType('week')}>Semana atual</button><button className={periodType==='month'?'active':''} onClick={()=>setPeriodType('month')}>Mês</button><button className={periodType==='day'?'active':''} onClick={()=>setPeriodType('day')}>Dia</button><button className={periodType==='range'?'active':''} onClick={()=>setPeriodType('range')}>Período</button></div>
        {periodType==='all' && <div className="report-period-preview">Todo o histórico • todos os registros disponíveis</div>}
        {periodType==='week' && <div className="report-period-preview">{period.label}</div>}
        {periodType==='month' && <div className="report-export-grid"><label>Mês<select value={month} onChange={e=>setMonth(Number(e.target.value))}>{MONTHS.map((m,i)=><option key={m} value={i}>{m}</option>)}</select></label><label>Ano<select value={year} onChange={e=>setYear(Number(e.target.value))}>{years.map(y=><option key={y}>{y}</option>)}</select></label></div>}
        {periodType==='day' && <label>Data<input type="date" value={day} onChange={e=>setDay(e.target.value)}/></label>}
        {periodType==='range' && <div className="report-export-grid"><label>Data inicial<input type="date" value={rangeStart} onChange={e=>setRangeStart(e.target.value)}/></label><label>Data final<input type="date" value={rangeEnd} onChange={e=>setRangeEnd(e.target.value)}/></label></div>}
        {invalidRange && <span className="report-export-error">A data inicial deve ser anterior à data final.</span>}
      </div>
      <div className="report-export-section"><label>Usuário<select value={selectedUser} onChange={e=>setSelectedUser(e.target.value)}><option value="all">Todos os usuários</option>{users.map(u=><option key={u.key} value={u.key}>{u.label}</option>)}</select></label></div>
      {dataType==='sales' && <div className="report-export-section"><span className="report-export-label">Parceria</span><div className="report-export-tabs"><button className={partnershipType==='all'?'active':''} onClick={()=>{setPartnershipType('all');setSelectedPartnership('all')}}>Todas</button><button className={partnershipType==='organization'?'active':''} onClick={()=>{setPartnershipType('organization');setSelectedPartnership('all')}}>Organizações</button><button className={partnershipType==='fraternity'?'active':''} onClick={()=>{setPartnershipType('fraternity');setSelectedPartnership('all')}}>Fraternidades</button></div><label>Parceria<select value={selectedPartnership} onChange={e=>setSelectedPartnership(e.target.value)}><option value="all">Todas as parcerias</option>{partnershipOptions.map(name=><option key={name}>{name}</option>)}</select></label></div>}
      <div className="report-export-preview"><div><span>Registros encontrados</span><strong>{preview.count.toLocaleString('pt-BR')}</strong></div>{dataType==='sales'?<><div><span>Valor vendido</span><strong>{money(preview.value)}</strong></div><div><span>Depósito Dominus</span><strong>{money(preview.fee)}</strong></div></>:<div><span>Itens farmados</span><strong>{preview.items.toLocaleString('pt-BR')}</strong></div>}</div>
      <div className="modal-actions"><button className="btn ghost" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={!records.length || invalidRange || exporting} onClick={exportCsv}><Download size={16}/> {exporting?'Exportando...':`Exportar ${records.length} registro(s)`}</button></div>
    </div>
  </div>
}
