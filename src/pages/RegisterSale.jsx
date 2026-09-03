import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus, ShoppingCart } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { addRecord, getCollection, getRecord } from '../services/dataService'
import { sendDiscordEvent } from '../services/discordService'
import { money } from '../utils/formatters'
import { useToast } from '../components/toasts/ToastProvider'

const isCard = (product) => (product.category || '').toLowerCase().includes('cart')

export default function RegisterSale() {
  const { profile } = useAuth()
  const { notify } = useToast()
  const [products, setProducts] = useState([])
  const [quantities, setQuantities] = useState({})
  const [customPrices, setCustomPrices] = useState({})
  const [saleType, setSaleType] = useState('PISTA')
  const [factionFeePercentage, setFactionFeePercentage] = useState(0)

  useEffect(() => {
    Promise.all([
      getCollection('products'),
      getRecord('settings', 'general'),
    ]).then(([productList, settings]) => {
      setProducts(productList)
      setFactionFeePercentage(Number(settings?.factionFeePercentage || 0))
    }).catch(() => {
      notify('Não foi possível carregar os dados da registradora.', 'error')
    })
  }, [])

  const items = useMemo(() => products
    .filter(p => Number(quantities[p.id] || 0) > 0)
    .map(p => {
      const manualPrice = customPrices[p.id]
      const normalPrice = Number(manualPrice === '' || manualPrice == null ? p.price : manualPrice)
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
    }), [products, quantities, customPrices, saleType])

  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
  const discount = items.reduce((sum, item) => sum + item.discount, 0)
  const factionFee = subtotal * (factionFeePercentage / 100)
  const total = subtotal + factionFee

  const technologyAndEquipment = products.filter(product => !isCard(product))
  const cards = products.filter(isCard)

  function changeQty(id, delta) {
    setQuantities(current => ({
      ...current,
      [id]: Math.max(0, Number(current[id] || 0) + delta),
    }))
  }

  async function finalize() {
    if (!items.length) return notify('Adicione pelo menos um item.', 'error')

    const sale = {
      sellerUid: profile.uid,
      sellerName: profile.name,
      sellerId: profile.id,
      type: saleType,
      items,
      subtotal,
      discount,
      factionFeePercentage,
      factionFee,
      total,
    }

    try {
      const ref = await addRecord('sales', sale)
      await sendDiscordEvent('sale', { ...sale, saleId: ref.id })
      setQuantities({})
      setCustomPrices({})
      notify('Venda finalizada e enviada ao Discord.')
    } catch (error) {
      notify(error.message, 'error')
    }
  }

  function ProductSection({ title, products: sectionProducts }) {
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

                <label className="sale-manual-price">
                  <span>Preço manual</span>
                  <input
                    type="number"
                    min="0"
                    value={customPrices[product.id] ?? ''}
                    placeholder={String(product.price)}
                    onChange={event => setCustomPrices(current => ({
                      ...current,
                      [product.id]: event.target.value,
                    }))}
                    disabled={partnershipActive}
                    title={partnershipActive ? 'Na parceria é usado o preço de parceria definido pelo Líder.' : 'Alterar preço desta venda.'}
                  />
                </label>

                <div className="qty-control sale-qty-control">
                  <button onClick={() => changeQty(product.id, -1)}><Minus size={15} /></button>
                  <span>{quantities[product.id] || 0}</span>
                  <button onClick={() => changeQty(product.id, 1)}><Plus size={15} /></button>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <>
      <PageHeader
        eyebrow="VENDAS"
        title="Registradora"
        description="Monte a venda, alterne entre Pista e Parceria e finalize o registro."
      />

      <div className="segmented">
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

      <div className="sales-layout sale-list-layout">
        <div className="sale-sections">
          <ProductSection title="Tecnologia e Equipamentos" products={technologyAndEquipment} />
          <ProductSection title="Cartões" products={cards} />
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
          <div className="summary-row"><span>Taxa da facção ({factionFeePercentage}%)</span><strong>{money(factionFee)}</strong></div>
          <div className="summary-row total"><span>Total</span><strong>{money(total)}</strong></div>
          <button className="btn primary full" onClick={finalize}>Finalizar venda</button>
        </aside>
      </div>
    </>
  )
}
