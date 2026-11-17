import { useData } from './store'
import { accountRoom, tl, today } from './calc'
import { Form, Sheet, toNum } from './ui'
import type { Source } from './actions'

/** Kart limiti işareti: yeşil rahat, sarı yarıdan az, kırmızı %10'dan az */
const dot = (room: number, max: number) => (max <= 0 || room <= 0 ? '🔴' : room / max < 0.1 ? '🔴' : room / max < 0.5 ? '🟡' : '🟢')

export function useSourceOptions(allowCards: boolean) {
  const d = useData()
  return [
    { value: '', label: '💵 Nakit' },
    ...d.accounts.map((a) => {
      const x = accountRoom(a)
      const mark = x.own > 0 ? '🟢' : x.limitLeft > 0 ? '🟡' : '🔴'
      return { value: `acc:${a.id}`, label: `${mark} ${a.name}  ${tl(x.own)}${a.limit ? `  (+${tl(x.limitLeft)})` : ''}` }
    }),
    ...(allowCards
      ? d.cards.map((c) => {
          const room = Math.max(0, c.limit - c.balance)
          return { value: `card:${c.id}`, label: `${c.limit ? dot(room, c.limit) : '💳'} ${c.name}${c.limit ? `  (${tl(room)})` : ''}` }
        })
      : []),
  ]
}

/** "Nereden ödedin?" penceresi */
export function PaySheet({
  title,
  amount,
  allowCards = true,
  amountEditable = true,
  defaultSource = '',
  onPay,
  onClose,
}: {
  title: string
  amount: number
  allowCards?: boolean
  amountEditable?: boolean
  defaultSource?: Source
  onPay: (source: Source, amount: number, date: string) => void
  onClose: () => void
}) {
  const options = useSourceOptions(allowCards)
  return (
    <Sheet open onClose={onClose} title={title}>
      <Form
        fields={[
          { key: 'source', label: 'Nereden ödedin?', type: 'select', options },
          ...(amountEditable ? [{ key: 'amount', label: 'Tutar (₺)', type: 'number' as const, required: true, half: true }] : []),
          { key: 'date', label: 'Tarih', type: 'date', half: amountEditable },
        ]}
        initial={{ source: defaultSource, amount: Math.round(amount * 100) / 100 || '', date: today() }}
        submitLabel={amountEditable ? 'Ödendi olarak kaydet' : `${tl(amount)} ödendi olarak kaydet`}
        onSubmit={(v) => {
          onPay(v.source, amountEditable ? toNum(v.amount) : amount, v.date || today())
          onClose()
        }}
      />
    </Sheet>
  )
}
