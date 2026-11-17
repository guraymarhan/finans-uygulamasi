import { useState } from 'react'
import { useData } from '../store'
import { dateLabel, monthKey, monthYearLabel, payoff, streak, tl, totals, upcoming } from '../calc'
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
  const progress = d.peak > 0 ? (d.peak - t.total) / d.peak : 0
  const s = streak(d)
  const perMonth = t.monthly + d.settings.personMonthly + d.settings.extraMonthly
  const proj = payoff(d, perMonth)
  const prev = d.snapshots.filter((x) => x.month < monthKey()).at(-1)
  const diff = prev ? prev.total - t.total : 0
  const next = upcoming(d, 30).filter((u) => !u.paid && u.kind !== 'fixed').slice(0, 3)

  return (
    <>
      <div className="glass rise mt-4 flex flex-col items-center p-5">
        <Ring value={progress} size={190}>
          <div className="text-xs text-mute">Toplam borç</div>
          <div className="tnum text-2xl font-bold">{tl(t.total)}</div>
          {d.peak > 0 && <div className="mt-1 text-xs font-semibold grad-text">%{Math.round(progress * 100)} azaldı</div>}
        </Ring>
        <div className="mt-3 text-center text-sm text-mute">
          {progress > 0 ? (
            <>Zirveden bu yana <b className="text-mint">{tl(d.peak - t.total)}</b> erittin.</>
          ) : t.total > 0 ? (
            'Başlangıç noktan burası. Her ödeme bu halkayı dolduracak.'
          ) : (
            'Borç yok, harika!'
          )}
        </div>
        <div className="mt-4 grid w-full grid-cols-3 gap-2 text-center">
          <Mini label="Seri" value={`${s} ay`} emoji="🔥" />
          <Mini label="Bu ay" value={diff > 0 ? `-${tl(diff)}` : diff < 0 ? `+${tl(-diff)}` : '—'} emoji={diff > 0 ? '📉' : '🧭'} />
          <Mini label="Borçsuz" value={proj ? monthYearLabel(proj.date) : '—'} emoji="🏁" />
        </div>
      </div>

      <Section title="Dağılım">
        <div className="glass divide-y divide-line">
          {[
            ['Kredi kartları', t.cards, '💳'],
            ['Krediler', t.loans, '🏦'],
            ['Kişisel borçlar', t.people, '🤝'],
            ...(d.accounts.length ? [['Ek hesap / avans', t.accounts, '🏧']] : []),
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

      <Section title="Sıradaki ödemeler" action={<button onClick={() => go('upcoming')} className="text-sm text-mint">Tümü</button>}>
        {next.length ? (
          <div className="glass divide-y divide-line">{next.map((u) => <UpcomingRow key={u.kind + u.refId + u.date} u={u} compact />)}</div>
        ) : (
          <div className="glass p-4 text-sm text-mute">Önümüzdeki 30 günde bekleyen ödeme yok ✨</div>
        )}
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

function Mini({ label, value, emoji }: { label: string; value: string; emoji: string }) {
  return (
    <div className="rounded-2xl bg-white/5 px-2 py-2.5">
      <div className="text-base">{emoji}</div>
      <div className="tnum mt-0.5 truncate text-sm font-semibold">{value}</div>
      <div className="text-[11px] text-mute">{label}</div>
    </div>
  )
}

