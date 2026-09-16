import { useMemo, useState } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

const PRODUCTS = [
  { name: 'Corda', image: '/images/products/corda.png', output: 3, materials: { 'Pano': 15, 'Cinta': 15 } },
  { name: 'Algema', image: '/images/products/algema.png', output: 5, materials: { 'Alumínio Chapado': 20, 'Cobre Escovado': 20, 'Plástico Processado': 20 } },
  { name: 'VPN', image: '/images/products/vpn.png', output: 2, materials: { 'Chip': 15, 'Fibra de Carbono': 15, 'Cabo': 15 } },
  { name: 'Capuz', image: '/images/products/capuz.png', output: 1, materials: { 'Pano': 15, 'Cinta': 15 } },
  { name: 'Maleta de Attachs', image: '/images/products/maleta_de_attachs.png', output: 1, materials: { 'Materiais Reciclados': 20, 'Cobre Escovado': 20, 'Alumínio Chapado': 20 } },
  { name: 'Masterpick', image: '/images/products/masterpick.png', output: 3, materials: { 'Aço': 10, 'Plástico Processado': 10, 'Borracha Processada': 10, 'Transponder': 2 } },
  { name: 'Pager', image: '/images/products/pager.png', output: 1, materials: { 'Módulo ECU': 15, 'Plástico Processado': 15, 'Borracha Processada': 15 } },
  { name: 'Mira de arma', image: '/images/products/mira_de_arma.png', output: 3, materials: { 'Cabo': 15, 'Cobre Escovado': 15 } },
  { name: 'Apoio de arma', image: '/images/products/apoio_de_arma.png', output: 3, materials: { 'Chip': 20, 'Ferro de Solda': 20, 'Alumínio Chapado': 20 } },
  { name: 'Lanterna de arma', image: '/images/products/lanterna_de_arma.png', output: 3, materials: { 'Cabo': 20, 'Módulo ECU': 20 } },
  { name: 'Boca de arma', image: '/images/products/boca_de_arma.png', output: 3, materials: { 'Cabo': 20, 'Módulo ECU': 20, 'Plástico Processado': 20 } },
  { name: 'Cano de arma', image: '/images/products/cano_de_arma.png', output: 3, materials: { 'Chip': 15, 'Ferro de Solda': 15 } },
  { name: 'Carregador de arma', image: '/images/products/pente_de_arma.png', output: 3, materials: { 'Cabo': 20, 'Alumínio Chapado': 20, 'Cobre Escovado': 20 } },
  { name: 'Pendrive', image: '/images/products/pendrive.png', output: 1, materials: { 'Cobre Escovado': 20, 'Alumínio Chapado': 20, 'Módulo ECU': 20 } },
  { name: 'Cartão Azul', image: '/images/products/cartao_azul.png', output: 1, materials: { 'Chip': 60, 'Fibra de Carbono': 60, 'Ferro de Solda': 60, 'Cabo': 60 } },
  { name: 'Cartão Amarelo', image: '/images/products/cartao_amarelo.png', output: 1, materials: { 'Módulo ECU': 50, 'Chip': 50, 'Ferro de Solda': 50, 'Cabo': 50 } },
  { name: 'Cartão Rosa', image: '/images/products/cartao_rosa.png', output: 1, materials: { 'Aço': 30, 'Chip': 30, 'Ferro de Solda': 30, 'Cabo': 30 } },
  { name: 'Cartão Verde', image: '/images/products/cartao_verde.png', output: 1, materials: { 'Plástico Processado': 20, 'Ferro de Solda': 20, 'Chip': 20, 'Cabo': 20 } },
  { name: 'Cartão Vermelho', image: '/images/products/cartao_vermelho.png', output: 1, materials: { 'Módulo ECU': 30, 'Chip': 30, 'Ferro de Solda': 30, 'Cabo': 30 } },
  { name: 'Cartão Roxo', image: '/images/products/cartao_roxo.png', output: 1, materials: { 'Fibra de Carbono': 30, 'Cabo': 30, 'Ferro de Solda': 30, 'Chip': 30 } },
]

export default function Production() {
  const [quantities, setQuantities] = useState({})

  function setQuantity(name, value) {
    if (value === '') {
      setQuantities(current => ({ ...current, [name]: '' }))
      return
    }
    setQuantities(current => ({ ...current, [name]: Math.max(0, Math.floor(Number(value) || 0)) }))
  }

  function changeQuantity(name, delta) {
    setQuantities(current => ({
      ...current,
      [name]: Math.max(0, Number(current[name] || 0) + delta),
    }))
  }

  const calculation = useMemo(() => {
    const materials = {}
    const selected = []

    PRODUCTS.forEach(product => {
      const requested = Number(quantities[product.name] || 0)
      if (requested <= 0) return

      const stacks = Math.ceil(requested / product.output)
      const produced = stacks * product.output
      selected.push({ ...product, requested, stacks, produced })

      Object.entries(product.materials).forEach(([material, amount]) => {
        materials[material] = (materials[material] || 0) + amount * stacks
      })
    })

    return { materials, selected }
  }, [quantities])

  const hasSelection = calculation.selected.length > 0

  return (
    <>
      <PageHeader
        eyebrow="FABRICAÇÃO"
        title="Produção"
        description="Informe o que deseja fabricar. O cálculo considera stacks completas e mostra os itens de Farm necessários."
      />

      <div className="production-layout">
        <section className="production-products panel">
          <div className="production-section-header">
            <div>
              <h3>Produtos</h3>
              <span>Informe a quantidade que deseja produzir.</span>
            </div>
            <button type="button" className="btn secondary production-clear" onClick={() => setQuantities({})} disabled={!hasSelection}>
              <RotateCcw size={16} /> Limpar quantidades
            </button>
          </div>

          <div className="production-list">
            {PRODUCTS.map(product => {
              const requested = Number(quantities[product.name] || 0)
              const stacks = requested > 0 ? Math.ceil(requested / product.output) : 0
              const produced = stacks * product.output

              return (
                <div className="production-row" key={product.name}>
                  <div className="production-product">
                    <div className="production-image">
                      <img src={product.image} alt={product.name} />
                    </div>
                    <div>
                      <strong>{product.name}</strong>
                      <span>1 stack produz {product.output} {product.output === 1 ? 'unidade' : 'unidades'}</span>
                      {requested > 0 && (
                        <small>{stacks} {stacks === 1 ? 'stack' : 'stacks'} → {produced} unidades produzidas</small>
                      )}
                    </div>
                  </div>

                  <div className="qty-control production-qty">
                    <button type="button" onClick={() => changeQuantity(product.name, -1)}><Minus size={15} /></button>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={quantities[product.name] ?? 0}
                      onChange={event => setQuantity(product.name, event.target.value)}
                      onBlur={() => {
                        if (quantities[product.name] === '') setQuantity(product.name, 0)
                      }}
                      aria-label={`Quantidade de ${product.name}`}
                    />
                    <button type="button" onClick={() => changeQuantity(product.name, 1)}><Plus size={15} /></button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <aside className="production-summary panel">
          <div className="production-summary-head">
            <h3>Itens necessários</h3>
            <span>Totais calculados por stack</span>
          </div>

          {!hasSelection ? (
            <div className="production-empty">
              Informe a quantidade de um ou mais produtos para ver os materiais necessários.
            </div>
          ) : (
            <>
              <div className="production-materials">
                {Object.entries(calculation.materials).map(([name, amount]) => (
                  <div className="production-material" key={name}>
                    <span>{name}</span>
                    <strong>{amount}x</strong>
                  </div>
                ))}
              </div>

              <div className="production-summary-divider" />

              <div className="production-selected">
                <strong>Produção calculada</strong>
                {calculation.selected.map(product => (
                  <div key={product.name}>
                    <span>{product.name}</span>
                    <small>{product.requested} solicitadas · {product.stacks} {product.stacks === 1 ? 'stack' : 'stacks'} · {product.produced} produzidas</small>
                  </div>
                ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  )
}
