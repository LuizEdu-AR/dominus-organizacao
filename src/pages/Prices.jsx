import { useEffect, useMemo, useRef, useState } from 'react'
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
  const dragPreviewRef = useRef(null)
  const dragPointerRef = useRef({ id: null, offsetY: 0, startX: 0 })
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

  function createFloatingRow(row, event, productId) {
    const rect = row.getBoundingClientRect()
    const clone = row.cloneNode(true)
    const sourceCells = row.querySelectorAll('td')
    const cloneCells = clone.querySelectorAll('td')

    clone.classList.remove('is-dragging', 'is-drag-over')
    clone.classList.add('price-floating-row')
    clone.removeAttribute('data-product-id')

    cloneCells.forEach((cell, index) => {
      const width = sourceCells[index]?.getBoundingClientRect().width
      if (width) {
        cell.style.width = `${width}px`
        cell.style.minWidth = `${width}px`
        cell.style.maxWidth = `${width}px`
      }
    })

    clone.querySelectorAll('input, button').forEach(element => {
      element.tabIndex = -1
      element.style.pointerEvents = 'none'
    })

    const table = document.createElement('table')
    table.className = 'price-floating-table'
    table.style.width = `${rect.width}px`
    table.style.left = `${rect.left}px`
    table.style.top = `${rect.top}px`

    const tbody = document.createElement('tbody')
    tbody.appendChild(clone)
    table.appendChild(tbody)
    document.body.appendChild(table)

    dragPreviewRef.current = table
    dragPointerRef.current = {
      id: productId,
      offsetY: event.clientY - rect.top,
      startX: rect.left,
    }
  }

  function startPointerDragging(event, productId) {
    if (event.button !== 0 || busyAction) return

    const row = event.currentTarget.closest('tr')
    if (!row) return

    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)

    setDraggedProductId(productId)
    setDragOverProductId(productId)
    createFloatingRow(row, event, productId)

    document.body.classList.add('price-is-sorting')
  }

  function updatePointerDragging(event) {
    if (!dragPointerRef.current.id || !dragPreviewRef.current) return

    const floating = dragPreviewRef.current
    const top = event.clientY - dragPointerRef.current.offsetY
    floating.style.transform = `translate3d(0, ${top - parseFloat(floating.style.top || 0)}px, 0)`

    const element = document.elementFromPoint(event.clientX, event.clientY)
    const targetRow = element?.closest?.('tr[data-product-id]')
    const targetId = targetRow?.dataset?.productId

    if (targetId && targetId !== dragPointerRef.current.id) {
      setDragOverProductId(targetId)
      moveProduct(targetId)
    }
  }

  function finishDragging() {
    dragPreviewRef.current?.remove()
    dragPreviewRef.current = null
    dragPointerRef.current = { id: null, offsetY: 0, startX: 0 }
    setDraggedProductId(null)
    setDragOverProductId(null)
    document.body.classList.remove('price-is-sorting')
  }

  useEffect(() => () => {
    dragPreviewRef.current?.remove()
    document.body.classList.remove('price-is-sorting')
  }, [])

  return (
    <>
      <style>{`
        .price-sort-row {
          position: relative;
          transition: transform 220ms cubic-bezier(.2,.75,.25,1), background 180ms ease, opacity 180ms ease;
        }
        .price-sort-row td {
          transition: background 180ms ease, border-color 180ms ease, opacity 180ms ease;
        }
        .price-sort-row.is-dragging {
          opacity: .22;
        }
        .price-sort-row.is-dragging td {
          background: rgba(124, 58, 237, .08);
          border-top: 1px dashed rgba(139, 92, 246, .4);
          border-bottom: 1px dashed rgba(139, 92, 246, .4);
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
        .price-floating-table {
          position: fixed;
          z-index: 99999;
          pointer-events: none;
          border-collapse: separate;
          border-spacing: 0;
          table-layout: fixed;
          background: #15121d;
          border: 1px solid rgba(139, 92, 246, .72);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 24px 55px rgba(0, 0, 0, .52), 0 0 0 1px rgba(124, 58, 237, .18);
          opacity: .985;
          will-change: transform;
          transform: translate3d(0, 0, 0) scale(1.01);
        }
        .price-floating-table td {
          padding: 12px 10px;
          background: #15121d !important;
        }
        .price-floating-table input {
          background: #0f0d15;
        }
        .price-is-sorting,
        .price-is-sorting * {
          cursor: grabbing !important;
          user-select: none !important;
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
            <p className="muted" style={{ margin: '6px 0 0' }}>Edite vários produtos ou reorganize a ordem.</p>
          </div>
          <LoadingButton
            className="btn primary"
            onClick={saveAll}
            loading={busyAction === 'save-all'}
            disabled={Boolean(busyAction)}
            loadingText="Salvando tudo..."
          >
            <Save size={17} /> Salvar
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
                    data-product-id={product.id}
                    className={`price-sort-row ${draggedProductId === product.id ? 'is-dragging' : ''} ${dragOverProductId === product.id ? 'is-drag-over' : ''}`}
                  >
                    <td>
                      {isLeader(profile?.role) ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            className="price-drag-handle"
                            onPointerDown={event => startPointerDragging(event, product.id)}
                            onPointerMove={updatePointerDragging}
                            onPointerUp={finishDragging}
                            onPointerCancel={finishDragging}
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
