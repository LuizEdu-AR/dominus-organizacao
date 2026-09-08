import { useEffect, useMemo, useState } from 'react'
import { GripVertical, Percent, Plus, Save, Trash2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { addRecord, getCollection, getRecord, removeRecord, setRecord } from '../services/dataService'
import { INITIAL_PRODUCTS } from '../data/initialProducts'
import { isLeader } from '../utils/permissions'
import { money } from '../utils/formatters'
import { useToast } from '../components/toasts/ToastProvider'
import LoadingButton from '../components/ui/LoadingButton'

export default function Prices() {
  const { profile } = useAuth()
  const { notify } = useToast()
  const [products, setProducts] = useState([])
  const [factionFeePercentage, setFactionFeePercentage] = useState(0)
  const [busyAction, setBusyAction] = useState(null)
  const [draggedProductId, setDraggedProductId] = useState(null)
  const [dragOverProductId, setDragOverProductId] = useState(null)
  const [draft, setDraft] = useState({
    name: '',
    category: 'Equipamentos',
    price: '',
    partnershipEnabled: false,
    partnershipPrice: '',
  })

  const load = async () => {
    const [productList, settings] = await Promise.all([
      getCollection('products'),
      getRecord('settings', 'general'),
    ])
    setProducts(
      [...productList].sort((a, b) => {
        const orderA = Number.isFinite(Number(a.order)) ? Number(a.order) : Number.MAX_SAFE_INTEGER
        const orderB = Number.isFinite(Number(b.order)) ? Number(b.order) : Number.MAX_SAFE_INTEGER
        return orderA - orderB
      })
    )
    setFactionFeePercentage(Number(settings?.factionFeePercentage || 0))
  }

  useEffect(() => { load() }, [])

  const grouped = useMemo(() => products.reduce((acc, product) => {
    ;(acc[product.category || 'Outros'] ||= []).push(product)
    return acc
  }, {}), [products])

  async function seed() {
    if (busyAction) return
    setBusyAction('seed')
    try {
      for (let i = 0; i < INITIAL_PRODUCTS.length; i++) {
        await setRecord('products', `initial-${i + 1}`, { ...INITIAL_PRODUCTS[i], order: i })
      }
      await setRecord('settings', 'general', { factionFeePercentage: 0 })
      notify('Produtos iniciais carregados.')
      load()
    } catch (error) {
      notify(error.message, 'error')
    } finally { setBusyAction(null) }
  }

  async function saveFactionFee() {
    if (busyAction) return
    const percentage = Number(factionFeePercentage)
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      return notify('Informe uma taxa entre 0% e 100%.', 'error')
    }

    setBusyAction('fee')
    try {
      await setRecord('settings', 'general', { factionFeePercentage: percentage })
      notify('Taxa da facção atualizada.')
    } catch (error) {
      notify(error.message, 'error')
    } finally { setBusyAction(null) }
  }

  async function saveAll() {
    if (busyAction) return
    setBusyAction('save-all')
    try {
      await Promise.all(products.map((product, index) => setRecord('products', product.id, {
        name: product.name.trim(),
        category: product.category || 'Outros',
        price: Number(product.price),
        partnershipEnabled: Boolean(product.partnershipEnabled),
        partnershipPrice: Number(product.partnershipEnabled ? product.partnershipPrice : product.price),
        order: index,
      })))
      notify('Todas as alterações foram salvas.')
      await load()
    } catch (error) {
      notify(error.message, 'error')
    } finally { setBusyAction(null) }
  }

  async function add() {
    if (busyAction) return
    if (!draft.name || !draft.price) return notify('Informe nome e preço.', 'error')

    setBusyAction('add')
    try {
      await addRecord('products', {
        ...draft,
        price: Number(draft.price),
        partnershipPrice: Number(draft.partnershipEnabled ? draft.partnershipPrice || draft.price : draft.price),
        order: products.length,
      })
      setDraft({ name: '', category: 'Equipamentos', price: '', partnershipEnabled: false, partnershipPrice: '' })
      notify('Produto adicionado.')
      load()
    } catch (error) {
      notify(error.message, 'error')
    } finally { setBusyAction(null) }
  }

  function patchLocal(id, field, value) {
    setProducts(list => list.map(product => product.id === id ? { ...product, [field]: value } : product))
  }

  function moveProduct(targetId) {
    if (!draggedProductId || draggedProductId === targetId) return

    setProducts(current => {
      const dragged = current.find(product => product.id === draggedProductId)
      const target = current.find(product => product.id === targetId)
      if (!dragged || !target || (dragged.category || 'Outros') !== (target.category || 'Outros')) return current

      const next = [...current]
      const from = next.findIndex(product => product.id === draggedProductId)
      const to = next.findIndex(product => product.id === targetId)
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      return next.map((product, index) => ({ ...product, order: index }))
    })
  }

  function startDragging(event, productId) {
    const row = event.currentTarget.closest('tr')
    setDraggedProductId(productId)
    setDragOverProductId(productId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', productId)

    if (row) {
      const clone = row.cloneNode(true)
      const cells = row.querySelectorAll('td')
      const cloneCells = clone.querySelectorAll('td')

      clone.classList.add('price-drag-preview')
      clone.style.width = `${row.getBoundingClientRect().width}px`
      clone.style.position = 'fixed'
      clone.style.top = '-1000px'
      clone.style.left = '-1000px'
      clone.style.pointerEvents = 'none'

      cloneCells.forEach((cell, index) => {
        const width = cells[index]?.getBoundingClientRect().width
        if (width) cell.style.width = `${width}px`
      })

      const previewTable = document.createElement('table')
      previewTable.className = 'price-drag-preview-table'
      const tbody = document.createElement('tbody')
      tbody.appendChild(clone)
      previewTable.appendChild(tbody)
      document.body.appendChild(previewTable)

      event.dataTransfer.setDragImage(previewTable, 30, Math.max(18, row.getBoundingClientRect().height / 2))
      requestAnimationFrame(() => previewTable.remove())
    }
  }

  function finishDragging() {
    setDraggedProductId(null)
    setDragOverProductId(null)
  }

  return (
    <>
      <style>{`
        .price-sort-row {
          position: relative;
          transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease, opacity 180ms ease;
        }
        .price-sort-row td {
          transition: background 180ms ease, border-color 180ms ease;
        }
        .price-sort-row.is-dragging {
          z-index: 20;
          transform: translateY(-3px) scale(1.008);
          filter: drop-shadow(0 12px 18px rgba(0, 0, 0, .34));
        }
        .price-sort-row.is-dragging td {
          background: rgba(124, 58, 237, .14);
          border-top: 1px solid rgba(139, 92, 246, .55);
          border-bottom: 1px solid rgba(139, 92, 246, .55);
        }
        .price-sort-row.is-drag-over:not(.is-dragging) td {
          background: rgba(124, 58, 237, .075);
        }
        .price-sort-row.is-drag-over:not(.is-dragging) td:first-child {
          box-shadow: inset 0 2px 0 rgba(168, 85, 247, .75);
        }
        .price-drag-handle {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          width: 30px;
          height: 34px;
          border-radius: 8px;
          cursor: grab;
          color: #8f8a9b;
          transition: color 160ms ease, background 160ms ease, transform 160ms ease;
          user-select: none;
        }
        .price-drag-handle:hover {
          color: #c4b5fd;
          background: rgba(124, 58, 237, .13);
          transform: scale(1.05);
        }
        .price-drag-handle:active { cursor: grabbing; }
        .price-drag-preview-table {
          position: fixed;
          top: -1000px;
          left: -1000px;
          z-index: 99999;
          border-collapse: separate;
          border-spacing: 0;
          background: #15121d;
          border: 1px solid rgba(139, 92, 246, .65);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 22px 44px rgba(0, 0, 0, .5), 0 0 0 1px rgba(124, 58, 237, .18);
          opacity: .97;
        }
        .price-drag-preview-table td {
          padding: 12px 10px;
          background: #15121d;
        }
      `}</style>
      <PageHeader
        eyebrow="COMERCIAL"
        title="Tabela de preços"
        description="Valores, regras de parceria e configurações comerciais da Dominus."
      />

      {isLeader(profile?.role) && products.length === 0 && (
        <div className="notice-banner">
          <span>Nenhum produto cadastrado no Firebase.</span>
          <LoadingButton className="btn primary" onClick={seed} loading={busyAction === 'seed'} disabled={Boolean(busyAction)} loadingText="Carregando...">Carregar valores iniciais</LoadingButton>
        </div>
      )}

      <div className="panel faction-fee-panel">
        <div>
          <div className="settings-title"><Percent size={18} /><h3>Taxa da facção</h3></div>
          <p className="muted">Percentual aplicado automaticamente em todas as novas vendas.</p>
        </div>

        {isLeader(profile?.role) ? (
          <div className="faction-fee-editor">
            <div className="percentage-input">
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={factionFeePercentage}
                onChange={event => setFactionFeePercentage(event.target.value)}
              />
              <span>%</span>
            </div>
            <LoadingButton className="btn primary" onClick={saveFactionFee} loading={busyAction === 'fee'} disabled={Boolean(busyAction)} loadingText="Salvando..."><Save size={16} /> Salvar taxa</LoadingButton>
          </div>
        ) : (
          <strong className="fee-readonly">{factionFeePercentage}%</strong>
        )}
      </div>

      {isLeader(profile?.role) && (
        <div className="panel form-panel">
          <h3>Novo produto</h3>
          <div className="form-grid">
            <label>Nome<input value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
            <label>Categoria<input value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })} /></label>
            <label>Preço<input type="number" value={draft.price} onChange={event => setDraft({ ...draft, price: event.target.value })} /></label>
            <label className="check-label"><input type="checkbox" checked={draft.partnershipEnabled} onChange={event => setDraft({ ...draft, partnershipEnabled: event.target.checked })} /> Desconto de parceria</label>
            {draft.partnershipEnabled && <label>Preço parceria<input type="number" value={draft.partnershipPrice} onChange={event => setDraft({ ...draft, partnershipPrice: event.target.value })} /></label>}
            <LoadingButton className="btn primary" onClick={add} loading={busyAction === 'add'} disabled={Boolean(busyAction)} loadingText="Adicionando..."><Plus size={16} /> Adicionar</LoadingButton>
          </div>
        </div>
      )}

      {isLeader(profile?.role) && products.length > 0 && (
        <div className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h3 style={{ margin: 0 }}>Alterações da tabela</h3>
            <p className="muted" style={{ margin: '6px 0 0' }}>Edite vários produtos ou reorganize a ordem e salve tudo de uma só vez.</p>
          </div>
          <LoadingButton
            className="btn primary"
            onClick={saveAll}
            loading={busyAction === 'save-all'}
            disabled={Boolean(busyAction)}
            loadingText="Salvando tudo..."
          >
            <Save size={17} /> Salvar todas as alterações
          </LoadingButton>
        </div>
      )}

      {Object.entries(grouped).map(([category, items]) => (
        <div className="panel" key={category}>
          <div className="panel-title"><h3>{category}</h3><span>{items.length} produto(s)</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Produto</th><th>Preço pista</th><th>Parceria</th><th>Preço parceria</th>{isLeader(profile?.role) && <th>Ações</th>}</tr></thead>
              <tbody>
                {items.map(product => (
                  <tr
                    key={product.id}
                    className={`price-sort-row ${draggedProductId === product.id ? 'is-dragging' : ''} ${dragOverProductId === product.id ? 'is-drag-over' : ''}`}
                    onDragEnter={() => {
                      if (draggedProductId) setDragOverProductId(product.id)
                    }}
                    onDragOver={event => {
                      if (!isLeader(profile?.role) || !draggedProductId) return
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      setDragOverProductId(product.id)
                      moveProduct(product.id)
                    }}
                    onDrop={event => {
                      event.preventDefault()
                      finishDragging()
                    }}
                  >
                    <td>
                      {isLeader(profile?.role) ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            className="price-drag-handle"
                            draggable
                            onDragStart={event => startDragging(event, product.id)}
                            onDragEnd={finishDragging}
                            title="Segure e arraste a linha para mudar a ordem"
                            aria-label={`Arrastar ${product.name}`}
                          >
                            <GripVertical size={19} />
                          </span>
                          <input style={{ flex: 1 }} value={product.name} onChange={event => patchLocal(product.id, 'name', event.target.value)} />
                        </div>
                      ) : product.name}
                    </td>
                    <td>{isLeader(profile?.role) ? <input type="number" value={product.price} onChange={event => patchLocal(product.id, 'price', event.target.value)} /> : money(product.price)}</td>
                    <td>
                      {isLeader(profile?.role)
                        ? <input type="checkbox" checked={Boolean(product.partnershipEnabled)} onChange={event => patchLocal(product.id, 'partnershipEnabled', event.target.checked)} />
                        : product.partnershipEnabled ? 'Sim' : 'Não'}
                    </td>
                    <td>{isLeader(profile?.role) ? <input type="number" disabled={!product.partnershipEnabled} value={product.partnershipPrice ?? product.price} onChange={event => patchLocal(product.id, 'partnershipPrice', event.target.value)} /> : money(product.partnershipEnabled ? product.partnershipPrice : product.price)}</td>
                    {isLeader(profile?.role) && (
                      <td>
                        <div className="row-actions">
                          <button className="icon-button danger-text" disabled={Boolean(busyAction)} onClick={async () => { await removeRecord('products', product.id); load() }}><Trash2 size={17} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </>
  )
}
