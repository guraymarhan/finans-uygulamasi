import { useState } from 'react'
import { useData } from '../store'
import { dateLabel, monthKey, monthDues, num, paidSoFar, tl, totals, upcoming } from '../calc'
import { Bar, Ring, Section, Segmented } from '../ui'
import type { Scope } from '../types'
import type { Tab } from '../App'
import { UpcomingRow } from './Upcoming'
import { CategoryPie } from './Analysis'

export function Home({ go }: { go: (t: Tab) => void }) {
  const d = useData()
  const [scope, setScope] = useState<Scope>(() => (localStorage.getItem('scope') as Scope) || 'personal')
  const pick = (s: Scope) => {
    setScope(s)
    localStorage.setItem('scope', s)
  }
  return (
    <div>
      <Segmented value={scope} onChange={pick} options={[{ value: 'personal', label: 'Kişisel' }, { value: 'business', label: 'İş Yeri' }]} />
      {scope === 'personal' ? <Personal go={go} /> : <Business go={go} />}
      {d.cards.length + d.loans.length + d.people.length + d.accounts.length === 0 && scope === 'personal' && (
        <div className="glass rise mt-6 p-5 text-sm leading-relaxed text-mute">
          <div className="mb-1 text-base font-semibold text-white">Hoş geldin 👋</div>
          Önce <b className="text-white">Borçlar</b> sekmesinden kartlarını, kredilerini ve kişisel borçlarını ekle. Her ay toplam borcun otomatik kaydedilir, ilerlemen burada büyür.
        </div>
      )}
    </div>
  )
}

function Personal({ go }: { go: (t: Tab) => void }) {
  const d = useData()
  const t = totals(d)
  const paidTotal = paidSoFar(d)
  const progress = paidTotal + t.total > 0 ? paidTotal / (paidTotal + t.total) : 0
  const dues = monthDues(d)
  const dueAll = dues.reduce((a, x) => a + x.amount, 0)
  const duePaid = dues.filter((x) => x.paid).reduce((a, x) => a + x.amount, 0)
  const biz = dues.filter((x) => x.scope === 'business')
  const bizAll = biz.reduce((a, x) => a + x.amount, 0)
  const bizPaid = biz.filter((x) => x.paid).reduce((a, x) => a + x.amount, 0)
  const next = upcoming(d, 30).filter((u) => !u.paid).slice(0, 8)

  return (
    <>
      <div className="glass rise mt-4 p-4">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => go('debts')} className="flex flex-col items-center">
            <Ring value={progress} size={140}>
              <div className="text-[11px] text-mute">Toplam borç</div>
              <div className="tnum text-base font-bold">{tl(t.total)}</div>
            </Ring>
            <div className="mt-1 text-sm font-semibold grad-text">%{num(progress * 100, progress < 0.1 ? 1 : 0)} ödendi</div>
          </button>
          <button onClick={() => go('expenses')} className="flex flex-col items-center">
            <Ring value={bizAll ? bizPaid / bizAll : 0} size={140}>
              <div className="text-[11px] text-mute">İş yeri bu ay</div>
              <div className="tnum text-base font-bold">{tl(bizAll)}</div>
              <div className="text-[11px] text-mute">{bizAll ? `${tl(bizPaid)} ödendi` : 'sabit gider yok'}</div>
            </Ring>
            <div className="mt-1 text-sm font-semibold grad-text">%{bizAll ? Math.round((bizPaid / bizAll) * 100) : 0} ödendi</div>
          </button>
        </div>
        <button onClick={() => go('upcoming')} className="mt-4 block w-full rounded-2xl bg-white/5 px-4 py-3 text-left">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-mute">Bu ayın ödemeleri · kişisel + iş yeri</div>
              <div className="tnum text-xl font-bold">{tl(dueAll - duePaid)} <span className="text-xs font-normal text-mute">bekliyor</span></div>
            </div>
            <div className="tnum text-right text-xs text-mute">
              {tl(duePaid)} / {tl(dueAll)}
              <div>{dues.filter((x) => x.paid).length}/{dues.length} ödendi</div>
            </div>
          </div>
          <Bar value={dueAll ? duePaid / dueAll : 0} className="mt-2" />
        </button>
      </div>

      <Section title="Sıradaki ödemeler" action={<button onClick={() => go('upcoming')} className="text-sm text-mint">Tümü</button>}>
        {next.length ? (
          <div className="glass divide-y divide-line">{next.map((u) => <UpcomingRow key={u.kind + u.refId + u.date} u={u} compact />)}</div>
        ) : (
          <div className="glass p-4 text-sm text-mute">Önümüzdeki 30 günde bekleyen ödeme yok ✨</div>
        )}
      </Section>

      <Section title="Dağılım">
        <div className="glass divide-y divide-line">
          {[
            ['Kredi kartları', t.cards, '💳'],
            ['Krediler', t.loans, '🏦'],
            ['Kişisel borçlar', t.people, '🤝'],
            ...(d.accounts.length ? [['Ek hesap / avans', t.accounts, '🏧']] : []),
            ...(t.bills > 0 ? [['Bu ayın ödenmemiş giderleri', t.bills, '🧾']] : []),
          ].map(([label, v, e]) => (
            <button key={label as string} onClick={() => go('debts')} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
              <span className="text-xl">{e}</span>
              <div className="flex-1">
                <div className="text-sm">{label}</div>
                <Bar value={t.total ? (v as number) / t.total : 0} className="mt-1.5" />
              </div>
              <div className="tnum text-sm font-semibold">{tl(v as number)}</div>
            </button>
          ))}
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-mute">Aylık ödeme yükü</span>
            <span className="tnum font-semibold">{tl(t.monthly)}</span>
          </div>
        </div>
      </Section>
      {d.rates.usd > 0 && (
        <div className="mt-4 text-center text-xs text-mute">
          $1 = {tl(d.rates.usd, 2)} · 1 gr altın = {tl(d.rates.gold, 0)} · {dateLabel(d.rates.updatedAt.slice(0, 10))}
        </div>
      )}
    </>
  )
}

function Business({ go }: { go: (t: Tab) => void }) {
  const d = useData()
  const m = monthKey()
  const exp = d.expenses.filter((e) => e.scope === 'business' && e.date.startsWith(m))
  const total = exp.reduce((a, e) => a + e.amount, 0)
  const byCard = exp.filter((e) => e.cardId).reduce((a, e) => a + e.amount, 0)
  const fixed = d.fixed.filter((f) => f.scope === 'business')
  const fixedTotal = fixed.reduce((a, f) => a + f.amount, 0)
  const paidFixed = fixed.filter((f) => d.expenses.some((e) => e.fixedId === f.id && e.date.startsWith(m)))
  const pending = upcoming(d, 30).filter((u) => u.kind === 'fixed' && !u.paid && fixed.some((f) => f.id === u.refId))
  return (
    <>
      <div className="glass rise mt-4 p-5">
        <div className="text-xs text-mute">Bu ay iş yeri giderleri</div>
        <div className="tnum mt-1 text-3xl font-bold">{tl(total)}</div>
        <div className="mt-1 text-xs text-mute">{byCard > 0 ? `${tl(byCard)} kartla ödendi` : 'Kartla ödenen yok'}</div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span>Sabit giderler</span>
          <span className="tnum text-mute">
            {paidFixed.length}/{fixed.length} ödendi · {tl(fixedTotal)}/ay
          </span>
        </div>
        <Bar value={fixed.length ? paidFixed.length / fixed.length : 0} className="mt-2" />
      </div>
      <Section title="Bekleyen sabit giderler" action={<button onClick={() => go('expenses')} className="text-sm text-mint">Giderler</button>}>
        {pending.length ? (
          <div className="glass divide-y divide-line">{pending.slice(0, 5).map((u) => <UpcomingRow key={u.refId + u.date} u={u} compact />)}</div>
        ) : (
          <div className="glass p-4 text-sm text-mute">{fixed.length ? 'Bu dönemin sabit giderleri tamam ✓' : 'Giderler sekmesinden sabit giderlerini ekle.'}</div>
        )}
      </Section>
      <Section title="Bu ayın dağılımı">
        <CategoryPie scope="business" />
      </Section>
    </>
  )
}
