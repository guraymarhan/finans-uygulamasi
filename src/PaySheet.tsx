import { useData } from './store'
import { tl, today } from './calc'
import { Form, Sheet, toNum } from './ui'
import type { Source } from './actions'

export function useSourceOptions(allowCards: boolean) {
  const d = useData()
  return [
    { value: '', label: '💵 Nakit' },
    ...d.accounts.map((a) => ({ value: `acc:${a.id}`, label: `🏧 ${a.name} (${a.balance < 0 ? '-' : ''}${tl(Math.abs(a.balance))})` })),
    ...(allowCards ? d.cards.map((c) => ({ value: `card:${c.id}`, label: `💳 ${c.name}` })) : []),
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
          { key: 'source', label: 'Nereden ödedin?', type: 'select', options, hint: 'Kart seçersen tutar kartın borcuna eklenir, hesap seçersen hesabın bakiyesinden düşer.' },
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
