import { useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { update, useData } from '../store'
import { addMonths, monthKey, monthLabel, monthYearLabel, payoff, tl, totals } from '../calc'
import { Section } from '../ui'
import type { Scope } from '../types'

const short = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}B` : String(Math.round(n)))
const tip = {
  contentStyle: { background: '#121935', border: '1px solid #ffffff22', borderRadius: 14, color: '#e8ebff', fontSize: 12 },
  labelStyle: { color: '#8b93b8' },
  formatter: (v: unknown) => tl(Number(v)),
}
const PIE = ['#5eead4', '#a78bfa', '#fcd34d', '#fda4af', '#93c5fd', '#86efac', '#f0abfc', '#fdba74', '#c4b5fd', '#67e8f9']

export function Analysis() {
  return (
    <div>
      <Simulator />
      <DebtFlow />
      <ExpenseBars />
      <Section title="Bu ay kategori dağılımı">
        <CategoryPie scope="all" />
      </Section>
    </div>
  )
}

function Simulator() {
  const d = useData()
  const t = totals(d)
  const [extra, setExtra] = useState(d.settings.extraMonthly)
  const base = t.monthly + d.settings.personMonthly
  const p0 = payoff(d, base)
  const p1 = payoff(d, base + extra)
  const saved = p0 && p1 ? p0.months - p1.months : 0
  return (
    <Section title="Borç bitiş tahmini">
      <div className="glass p-5">
        {t.total <= 0 ? (
          <div className="text-sm text-mute">Borç kaydı yok.</div>
        ) : !p1 ? (
          <div className="text-sm text-mute">Tahmin için kart veya kredilere aylık ödeme tutarı gir.</div>
        ) : (
          <>
            <div className="text-xs text-mute">Bu hızla borçsuz olacağın ay</div>
            <div className="mt-1 text-3xl font-bold grad-text">{monthYearLabel(p1.date)}</div>
            <div className="mt-1 text-sm text-mute">
              {p1.months} ay sonra · aylık {tl(base + extra)}
            </div>
            {saved > 0 && (
              <div className="mt-3 rounded-2xl bg-mint/10 px-3 py-2 text-sm text-mint">
                Ayda {tl(extra)} fazla ödersen <b>{saved} ay</b> erken bitiyor 🚀
              </div>
            )}
          </>
        )}
        <div className="mt-5">
          <div className="flex justify-between text-sm">
            <span>Aylık ekstra ödeme</span>
            <span className="tnum font-semibold">{tl(extra)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(20000, Math.ceil(base / 1000) * 1000)}
            step={500}
            value={extra}
            onChange={(e) => setExtra(+e.target.value)}
            className="mt-2 w-full accent-[#5eead4]"
          />
          {extra !== d.settings.extraMonthly && (
            <button onClick={() => update((x) => void (x.settings.extraMonthly = extra))} className="mt-1 text-xs text-lilac">
              Bunu hedefim olarak kaydet
            </button>
          )}
        </div>
        <div className="mt-4 text-[11px] leading-snug text-mute">
          Faiz ve kur değişimi hariç kaba tahmindir. Faiz ödemeli kredilerin anaparası vade tarihinde kapanmış sayılır. Kart ve kredi aylık ödemeleri{d.settings.personMonthly > 0 ? ' ile kişisel borçlara ayırdığın tutar' : ''} toplanır; kişisel borçlar için aylık tutarı Ayarlar'dan girebilirsin.
        </div>
      </div>
    </Section>
  )
}

function DebtFlow() {
  const d = useData()
  const data = d.snapshots.map((s) => ({ name: monthLabel(s.month), Toplam: Math.round(s.total) }))
  return (
    <Section title="Toplam borç akışı">
      <div className="glass p-3 pt-4">
        {data.length < 2 && <div className="px-2 pb-2 text-xs text-mute">Her ay toplam borcun otomatik kaydedilir; çizgi ay geçtikçe uzar.</div>}
        <div className="h-52">
          <ResponsiveContainer>
            <AreaChart data={data} margin={{ left: -10, right: 8, top: 5 }}>
              <defs>
                <linearGradient id="fl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#a78bfa" stopOpacity={0.5} />
                  <stop offset="1" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#ffffff0d" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#8b93b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={short} tick={{ fill: '#8b93b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip {...tip} />
              <Area type="monotone" dataKey="Toplam" stroke="#a78bfa" strokeWidth={2.5} fill="url(#fl)" dot={{ r: 3, fill: '#a78bfa' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Section>
  )
}

function ExpenseBars() {
  const d = useData()
  const data = Array.from({ length: 6 }, (_, i) => {
    const m = monthKey(addMonths(i - 5).toISOString().slice(0, 7))
    const of = (s: Scope) => d.expenses.filter((e) => e.scope === s && e.date.startsWith(m)).reduce((a, e) => a + e.amount, 0)
    return { name: monthLabel(m), 'İş yeri': of('business'), Kişisel: of('personal') }
  })
  return (
    <Section title="Aylık giderler">
      <div className="glass h-60 p-3 pt-4">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ left: -10, right: 8 }}>
            <CartesianGrid stroke="#ffffff0d" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: '#8b93b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={short} tick={{ fill: '#8b93b8', fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip {...tip} cursor={{ fill: '#ffffff08' }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="İş yeri" stackId="a" fill="#5eead4" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Kişisel" stackId="a" fill="#a78bfa" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  )
}

export function CategoryPie({ scope }: { scope: Scope | 'all' }) {
  const d = useData()
  const m = monthKey()
  const map = new Map<string, number>()
  d.expenses
    .filter((e) => e.date.startsWith(m) && (scope === 'all' || e.scope === scope))
    .forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amount))
  const data = [...map].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
  const total = data.reduce((a, x) => a + x.value, 0)
  if (!data.length) return <div className="glass p-4 text-sm text-mute">Bu ay henüz gider girilmedi.</div>
  return (
    <div className="glass flex items-center gap-2 p-4">
      <div className="h-36 w-36 shrink-0">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={42} outerRadius={64} paddingAngle={2} stroke="none">
              {data.map((_, i) => (
                <Cell key={i} fill={PIE[i % PIE.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {data.slice(0, 6).map((x, i) => (
          <div key={x.name} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PIE[i % PIE.length] }} />
            <span className="flex-1 truncate">{x.name}</span>
            <span className="tnum text-mute">%{Math.round((x.value / total) * 100)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

