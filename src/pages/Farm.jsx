import { useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../context/AuthContext'
import { FARM_ITEMS } from '../data/farmItems'
import { addRecord } from '../services/dataService'
import { sendDiscordEvent } from '../services/discordService'
import { useToast } from '../components/toasts/ToastProvider'

export default function Farm() {
  const { profile } = useAuth()
  const { notify } = useToast()
  const [quantities, setQuantities] = useState({})

  const change = (name, delta) => setQuantities(q => ({ ...q, [name]: Math.max(0, Number(q[name] || 0) + delta) }))

  async function submit() {
    const items = Object.entries(quantities).filter(([, qty]) => qty > 0).map(([name, qty]) => ({ name, qty }))
    if (!items.length) return notify('Informe pelo menos um item.', 'error')

    const record = { memberUid: profile.uid, memberName: profile.name, memberId: profile.id, items }
    try {
      const ref = await addRecord('farms', record)
      await sendDiscordEvent('farm', { ...record, farmId: ref.id })
      setQuantities({})
      notify('Farm registrado e enviado ao Discord.')
    } catch (e) { notify(e.message, 'error') }
  }

  return (
    <>
      <PageHeader eyebrow="BAÚ" title="Farm" description="Informe os itens depositados. Os nomes abaixo são provisórios até a lista oficial ser confirmada." />
      <div className="farm-grid">
        {FARM_ITEMS.map(name => (
          <div className="farm-card" key={name}>
            <div className="farm-icon">{name.slice(-2)}</div>
            <strong>{name}</strong>
            <div className="qty-control">
              <button onClick={() => change(name, -1)}><Minus size={15} /></button>
              <span>{quantities[name] || 0}</span>
              <button onClick={() => change(name, 1)}><Plus size={15} /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="farm-actions"><button className="btn primary" onClick={submit}>Confirmar depósito</button></div>
    </>
  )
}
