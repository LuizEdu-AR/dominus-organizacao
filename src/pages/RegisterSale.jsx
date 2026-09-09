import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, ShoppingCart } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { addRecord, getCollection, getRecord } from '../services/dataService'
import { sendDiscordEvent } from '../services/discordService'
import { money } from '../utils/formatters'
import { useToast } from '../components/toasts/ToastProvider'
import LoadingButton from '../components/ui/LoadingButton'

const isCard = (product) => (product.category || '').toLowerCase().includes('cart')

function ProductSection({
  title,
  products: sectionProducts,
  saleType,
  quantities,
  changeQty,
  setQuantity,
}) {
  if (!sectionProducts.length) return null

  return (
    <section className="sale-section panel">
      <div className="sale-section-header">
        <h3>{title}</h3>
        <span>{sectionProducts.length} produto(s)</span>
      </div>

      <div className="sale-product-list">
        {sectionProducts.map(product => {
          const partnershipActive = saleType === 'PARCERIA' && product.partnershipEnabled
          const displayedPrice = partnershipActive ? product.partnershipPrice : product.price

          return (
            <div className="sale-product-row" key={product.id}>
              <div className="sale-product-main">
                <strong>{product.name}</strong>
                <span className="product-price">{money(displayedPrice)}</span>
                {partnershipActive && Number(product.partnershipPrice) < Number(product.price) && (
                  <small>Parceria: desconto de {money(Number(product.price) - Number(product.partnershipPrice))} por unidade</small>
                )}
              </div>

              <div className="qty-control sale-qty-control">
                <button type="button" onClick={() => changeQty(product.id, -1)}><Minus size={15} /></button>
                <input
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={quantities[product.id] ?? 0}
                  onChange={event => setQuantity(product.id, event.target.value)}
                  onBlur={() => {
                    if (quantities[product.id] === '') setQuantity(product.id, 0)
                  }}
                  aria-label={`Quantidade de ${product.name}`}
                />
                <button type="button" onClick={() => changeQty(product.id, 1)}><Plus size={15} /></button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function RegisterSale() {
  const { profile } = useAuth()
  const { notify } = useToast()
  const [products, setProducts] = useState([])
  const [quantities, setQuantities] = useState({})
  const [saleType, setSaleType] = useState('PISTA')
  const [factionFeePercentage, setFactionFeePercentage] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [partnerships, setPartnerships] = useState([])
  const [partnershipId, setPartnershipId] = useState('')

  useEffect(() => {
    Promise.all([
      getCollection('products'),
      getRecord('settings', 'general'),
      getCollection('partnerships'),
    ]).then(([productList, settings, partnershipList]) => {
      setProducts(productList)
      setFactionFeePercentage(Number(settings?.factionFeePercentage || 0))
      setPartnerships([...partnershipList].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'pt-BR')))
    }).catch(() => {
      notify('Não foi possível carregar os dados da registradora.', 'error')
    })
  }, [])

  const items = useMemo(() => products
    .filter(p => Number(quantities[p.id] || 0) > 0)
    .map(p => {
      const normalPrice = Number(p.price)
      const partnershipPrice = Number(p.partnershipPrice ?? p.price)
      const unitPrice = saleType === 'PARCERIA' && p.partnershipEnabled
        ? partnershipPrice
        : normalPrice
      const qty = Number(quantities[p.id])

      return {
        productId: p.id,
        name: p.name,
        qty,
        basePrice: normalPrice,
        unitPrice,
        discount: Math.max(0, (normalPrice - unitPrice) * qty),
        subtotal: unitPrice * qty,
      }
    }), [products, quantities, saleType])

  const selectedPartnership = partnerships.find(partnership => partnership.id === partnershipId) || null

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
  const discount = items.reduce((sum, item) => sum + item.discount, 0)
  const factionFeeThreshold = 50000
  const factionFeeEligible = subtotal > factionFeeThreshold
  const appliedFactionFeePercentage = factionFeeEligible ? factionFeePercentage : 0
  const factionFee = subtotal * (appliedFactionFeePercentage / 100)
  const total = subtotal

  const technologyAndEquipment = products.filter(product => !isCard(product))
  const cards = products.filter(isCard)

  function changeQty(id, delta) {
    setQuantities(current => ({
      ...current,
      [id]: Math.max(0, Number(current[id] || 0) + delta),
    }))
  }

  function setQuantity(id, value) {
    if (value === '') {
      setQuantities(current => ({ ...current, [id]: '' }))
      return
    }

    const quantity = Math.max(0, Math.floor(Number(value) || 0))
    setQuantities(current => ({ ...current, [id]: quantity }))
  }

  async function finalize() {
    if (submitting) return
    if (!items.length) return notify('Adicione pelo menos um item.', 'error')
    if (saleType === 'PARCERIA' && !selectedPartnership) return notify('Selecione a organização parceira.', 'error')

    const sale = {
      sellerUid: profile.uid,
      sellerName: profile.name,
      sellerId: profile.id,
      type: saleType,
      partnershipId: saleType === 'PARCERIA' ? selectedPartnership.id : '',
      partnershipName: saleType === 'PARCERIA' ? selectedPartnership.name : '',
      items,
      subtotal,
      discount,
      factionFeePercentage: appliedFactionFeePercentage,
      factionFeeThreshold,
      factionFee,
      total,
    }

    setSubmitting(true)
    try {
      const ref = await addRecord('sales', sale)
      await sendDiscordEvent('sale', { ...sale, saleId: ref.id })
      setQuantities({})
      if (saleType === 'PARCERIA') setPartnershipId('')
      notify('Venda finalizada e enviada ao Discord.')
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="VENDAS"
        title="Registradora"
        description="Monte a venda, alterne entre Pista e Parceria e finalize o registro."
      />

      <div className="sale-type-row">
        <div className="segmented sale-type-segmented">
          {['PISTA', 'PARCERIA'].map(type => (
            <button
              key={type}
              className={saleType === type ? 'active' : ''}
              onClick={() => setSaleType(type)}
            >
              {type}
            </button>
          ))}
        </div>

        {saleType === 'PARCERIA' && (
          <label className="sale-partnership-select">
            <span>Organização parceira</span>
            <select value={partnershipId} onChange={event => setPartnershipId(event.target.value)}>
              <option value="">Selecione a parceria</option>
              {partnerships.map(partnership => (
                <option key={partnership.id} value={partnership.id}>{partnership.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {saleType === 'PARCERIA' && partnerships.length === 0 && (
        <span className="muted" style={{ display: 'block', marginTop: 10 }}>
          Nenhuma parceria cadastrada. Peça a um Líder para adicionar uma parceria na seção Parcerias.
        </span>
      )}

      <div className="sales-layout sale-list-layout">
        <div className="sale-sections">
          <ProductSection
            title="Tecnologia e Equipamentos"
            products={technologyAndEquipment}
            saleType={saleType}
            quantities={quantities}
            changeQty={changeQty}
            setQuantity={setQuantity}
          />
          <ProductSection
            title="Cartões"
            products={cards}
            saleType={saleType}
            quantities={quantities}
            changeQty={changeQty}
            setQuantity={setQuantity}
          />
        </div>

        <aside className="summary-card">
          <div className="summary-title"><ShoppingCart size={20} /><h3>Resumo da venda</h3></div>

          <div className="summary-items">
            {items.length === 0 && <span className="muted">Nenhum item selecionado.</span>}
            {items.map(item => (
              <div className="summary-item" key={item.productId}>
                <div>
                  <strong>{item.qty}x {item.name}</strong>
                  {item.discount > 0 && <small>Desconto: {money(item.discount)}</small>}
                </div>
                <span>{money(item.subtotal)}</span>
              </div>
            ))}
          </div>

          <div className="summary-row"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
          <div className="summary-row"><span>Descontos</span><strong>- {money(discount)}</strong></div>
          <div className="summary-row">
            <span>
              Depósito para facção ({factionFeePercentage}%)
              {!factionFeeEligible && <small className="muted"> — devido somente acima de {money(factionFeeThreshold)}</small>}
            </span>
            <strong>{money(factionFee)}</strong>
          </div>
          <div className="summary-row total"><span>Valor a ser cobrado</span><strong>{money(total)}</strong></div>
          <LoadingButton className="btn primary full" onClick={finalize} loading={submitting} loadingText="Finalizando...">Finalizar venda</LoadingButton>
        </aside>
      </div>
    </>
  )
}
