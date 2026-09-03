import { useEffect, useMemo, useState } from 'react'
import { Percent, Plus, Save, Trash2 } from 'lucide-react'
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
    setProducts(productList)
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
        await setRecord('products', `initial-${i + 1}`, INITIAL_PRODUCTS[i])
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

  async function save(product) {
    if (busyAction) return
    setBusyAction(`save:${product.id}`)
    try {
      await setRecord('products', product.id, {
        name: product.name.trim(),
        category: product.category || 'Outros',
        price: Number(product.price),
        partnershipEnabled: Boolean(product.partnershipEnabled),
        partnershipPrice: Number(product.partnershipEnabled ? product.partnershipPrice : product.price),
      })
      notify('Produto atualizado.')
      load()
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

  return (
    <>
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

      {Object.entries(grouped).map(([category, items]) => (
        <div className="panel" key={category}>
          <div className="panel-title"><h3>{category}</h3><span>{items.length} produto(s)</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Produto</th><th>Preço pista</th><th>Parceria</th><th>Preço parceria</th>{isLeader(profile?.role) && <th>Ações</th>}</tr></thead>
              <tbody>
                {items.map(product => (
                  <tr key={product.id}>
                    <td>{isLeader(profile?.role) ? <input value={product.name} onChange={event => patchLocal(product.id, 'name', event.target.value)} /> : product.name}</td>
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
                          <LoadingButton className="icon-button" onClick={() => save(product)} loading={busyAction === `save:${product.id}`} disabled={Boolean(busyAction)} loadingText=""><Save size={17} /></LoadingButton>
                          <button className="icon-button danger-text" onClick={async () => { await removeRecord('products', product.id); load() }}><Trash2 size={17} /></button>
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
