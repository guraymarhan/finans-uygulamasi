import { useState } from 'react'
import { useData } from '../store'
import { dateLabel, daysUntil, tl, upcoming, type Upcoming as U } from '../calc'
import { payExpense, payFixed, payLoan } from '../actions'
import { Empty } from '../ui'
import { CardPaySheet, InterestPaySheet } from './Debts'

const icon = { card: '💳', loan: '🏦', fixed: '🏢', interest: '🏦', expense: '🧾' }

export function UpcomingRow({ u, compact }: { u: U; compact?: boolean }) {
  const [paying, setPaying] = useState(false)
  const n = daysUntil(u.date)
  const when = n === 0 ? 'Bugün' : n === 1 ? 'Yarın' : n < 0 ? `${-n} gün geçti` : `${n} gün`
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="flex w-11 flex-col items-center rounded-xl bg-white/5 py-1">
        <span className="text-[10px] text-mute">{dateLabel(u.date).split(' ')[1]}</span>
        <span className="text-base font-bold leading-tight">{+u.date.slice(8)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">
          {icon[u.kind]} {u.title}
        </div>
        <div className="text-xs text-mute">
          {compact ? when : `${u.sub} · ${when}`}
        </div>
      </div>
      <div className="text-right">
        <div className="tnum text-sm font-semibold">{tl(u.amount)}</div>
        {u.paid ? (
          <span className="text-xs text-mint">Ödendi ✓</span>
        ) : (
          <button
            onClick={() => (u.kind === 'card' || u.kind === 'interest' ? setPaying(true) : u.kind === 'loan' ? payLoan(u.refId) : u.kind === 'expense' ? payExpense(u.refId) : payFixed(u.refId))}
            className="text-xs font-medium text-lilac"
          >
            Öde →
          </button>
        )}
      </div>
      {u.kind === 'card' && <CardPaySheet cardId={u.refId} open={paying} onClose={() => setPaying(false)} />}
      {u.kind === 'interest' && paying && <InterestPaySheet loanId={u.refId} open onClose={() => setPaying(false)} />}
    </div>
  )
}

export function Upcoming() {
  const d = useData()
  const list = upcoming(d, 30)
  const due = list.filter((u) => !u.paid).reduce((a, u) => a + u.amount, 0)
  return (
    <div>
      <div className="glass rise p-5">
        <div className="text-xs text-mute">Önümüzdeki 30 gün</div>
        <div className="tnum mt-1 text-3xl font-bold">{tl(due)}</div>
        <div className="mt-1 text-xs text-mute">
          {list.filter((u) => u.paid).length} ödeme tamamlandı, {list.filter((u) => !u.paid).length} bekliyor
        </div>
      </div>
      <div className="mt-4">
        {list.length ? (
          <div className="glass divide-y divide-line">{list.map((u) => <UpcomingRow key={u.kind + u.refId + u.date} u={u} />)}</div>
        ) : (
          <Empty>Kart, kredi veya sabit gider ekleyince ödeme takvimin burada oluşur.</Empty>
        )}
      </div>
    </div>
  )
}
