import { db } from './firebase-admin.mjs'

const products = [
  ['Corda', 'Equipamentos', 5000],
  ['Algema', 'Equipamentos', 12000],
  ['Capuz', 'Equipamentos', 12000],
  ['Maleta de Attachs', 'Equipamentos', 24000],
  ['Attachs', 'Equipamentos', 12000],
  ['Masterpick', 'Equipamentos', 3600],
  ['Boosting', 'Equipamentos', 20000],
  ['VPN', 'Equipamentos', 20000],
  ['PenDrive', 'Equipamentos', 87590],
  ['Cartão Azul', 'Cartões', 250000],
  ['Cartão Amarelo', 'Cartões', 100000],
  ['Cartão Rosa', 'Cartões', 100000],
  ['Cartão Verde', 'Cartões', 18750],
  ['Cartão Vermelho', 'Cartões', 12500],
  ['Cartão Roxo', 'Cartões', 3500]
]

for (let i = 0; i < products.length; i++) {
  const [name, category, price] = products[i]
  await db.collection('products').doc(`initial-${i + 1}`).set({
    name, category, price, partnershipEnabled: false, partnershipPrice: price
  })
}

console.log('Produtos iniciais cadastrados.')
