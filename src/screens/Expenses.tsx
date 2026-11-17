import { useState } from 'react'
import { update, useData } from '../store'
import { dateLabel, monthKey, monthLabel, tl, today, uid } from '../calc'
import { deleteExpense, payFixed, saveExpense } from '../actions'
import { AddBtn, Empty, Form, Section, Segmented, Sheet, toDay, toNum } from '../ui'
import type { Expense, FixedExpense, Scope } from '../types'

export const CATEGORIES: Record<Scope, string[]> = {
  business: ['Kira', 'Maaş', 'Elektrik', 'Su', 'Doğalgaz', 'İnternet/Telefon', 'Muhasebe', 'Vergi/SGK', 'Malzeme', 'Diğer'],
  personal: ['Market', 'Fatura', 'Kira', 'Ulaşım', 'Yemek', 'Sağlık', 'Eğlence', 'Giyim', 'Diğer'],
}

export function Expenses() {
  const d = useData()
  const [scope, setScope] = useState<Scope>('business')
  const [month, setMonth] = useState(monthKey())
  const [editE, setEditE] = useState<Partial<Expense> | null>(null)
  const [editF, setEditF] = useState<Partial<FixedExpense> | null>(null)
  const months = [...new Set([monthKey(), ...d.expenses.map((e) => e.date.slice(0, 7))])].sort().reverse()
  const fixed = d.fixed.filter((f) => f.scope === scope)
  const list = d.expenses.filter((e) => e.scope === scope && e.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date))
  const total = list.reduce((a, e) => a + e.amount, 0)
  const cardOpts = [{ value: '', label: 'Nakit / banka' }, ...d.cards.map((c) => ({ value: c.id, label: `💳 ${c.name}` }))]
  const catOpts = CATEGORIES[scope].map((c) => ({ value: c, label: c }))
  const cardName = (id?: string) => d.cards.find((c) => c.id === id)?.name

  return (
    <div>
      <Segmented value={scope} onChange={setScope} options={[{ value: 'business', label: 'İş Yeri' }, { value: 'personal', label: 'Kişisel' }]} />

      <Section title="Sabit giderler" action={<AddBtn onClick={() => setEditF({ scope, category: CATEGORIES[scope][0], day: 1 })} />}>
        {fixed.length === 0 ? (
          <Empty>Kira, maaş, fatura gibi her ay tekrar eden giderleri ekle. Ödeme günü takvime düşer.</Empty>
        ) : (
          <div className="glass divide-y divide-line">
            {fixed.map((f) => {
              const paid = d.expenses.some((e) => e.fixedId === f.id && e.date.startsWith(monthKey()))
              return (
                <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => setEditF(f)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-sm font-medium">{f.title}</div>
                    <div className="text-xs text-mute">
                      Her ayın {f.day}. günü · {f.cardId ? `💳 ${cardName(f.cardId)}` : 'Nakit / banka'}
                    </div>
                  </button>
                  <div className="text-right">
                    <div className="tnum text-sm font-semibold">{tl(f.amount)}</div>
                    {paid ? (
                      <span className="text-xs text-mint">Bu ay ödendi ✓</span>
                    ) : (
                      <button onClick={() => payFixed(f.id)} className="text-xs font-medium text-lilac">Ödendi işaretle</button>
                    )}
                  </div>
                </div>
              )
            })}
            <div className="flex justify-between px-4 py-2.5 text-sm text-mute">
              <span>Aylık toplam</span>
              <span className="tnum">{tl(fixed.reduce((a, f) => a + f.amount, 0))}</span>
            </div>
          </div>
        )}
      </Section>

      <Section title="Giderler" action={<AddBtn onClick={() => setEditE({ scope, date: today(), category: CATEGORIES[scope][0] })} label="Gider" />}>
        <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1">
          {months.map((m) => (
            <button key={m} onClick={() => setMonth(m)} className={`shrink-0 rounded-full px-3 py-1 text-sm ${m === month ? 'bg-white/12 text-white' : 'bg-white/5 text-mute'}`}>
              {monthLabel(m)}
            </button>
          ))}
        </div>
        <div className="glass">
          <div className="flex justify-between border-b border-line px-4 py-3">
            <span className="text-sm text-mute">{monthLabel(month)} toplamı</span>
            <span className="tnum font-bold">{tl(total)}</span>
          </div>
          {list.length === 0 && <div className="p-4 text-center text-sm text-mute">Bu ay gider yok.</div>}
          <div className="divide-y divide-line">
            {list.map((e) => (
              <button key={e.id} onClick={() => setEditE(e)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{e.title}</div>
                  <div className="text-xs text-mute">
                    {dateLabel(e.date)} · {e.category}
                    {e.cardId && ` · 💳 ${cardName(e.cardId) ?? ''}`}
                  </div>
                </div>
                <div className="tnum text-sm font-semibold">{tl(e.amount)}</div>
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Sheet open={!!editE} onClose={() => setEditE(null)} title={editE?.id ? 'Gideri düzenle' : 'Yeni gider'}>
        {editE && (
          <Form
            fields={[
              { key: 'title', label: 'Açıklama', required: true },
              { key: 'amount', label: 'Tutar (₺)', type: 'number', required: true },
              { key: 'category', label: 'Kategori', type: 'select', options: catOpts },
              { key: 'cardId', label: 'Nasıl ödendi?', type: 'select', options: cardOpts, hint: 'Kart seçersen tutar o kartın borcuna da eklenir.' },
              { key: 'date', label: 'Tarih', type: 'date' },
            ]}
            initial={editE}
            onSubmit={(v) => {
              saveExpense({
                id: editE.id,
                title: v.title,
                amount: toNum(v.amount),
                category: v.category,
                cardId: v.cardId || undefined,
                date: v.date || today(),
                scope: editE.scope ?? scope,
                fixedId: editE.fixedId,
              })
              setEditE(null)
            }}
            onDelete={
              editE.id
                ? () => {
                    deleteExpense(editE.id!)
                    setEditE(null)
                  }
                : undefined
            }
          />
        )}
      </Sheet>

      <Sheet open={!!editF} onClose={() => setEditF(null)} title={editF?.id ? 'Sabit gideri düzenle' : 'Yeni sabit gider'}>
        {editF && (
          <Form
            fields={[
              { key: 'title', label: 'Ad (örn. Dükkan kirası)', required: true },
              { key: 'amount', label: 'Aylık tutar (₺)', type: 'number', required: true },
              { key: 'category', label: 'Kategori', type: 'select', options: catOpts },
              { key: 'day', label: 'Ödeme günü', type: 'day' },
              { key: 'cardId', label: 'Genelde nasıl ödüyorsun?', type: 'select', options: cardOpts, hint: 'Kart seçersen "ödendi" dediğinde kart borcuna eklenir.' },
            ]}
            initial={editF}
            onSubmit={(v) => {
              const f: FixedExpense = {
                id: editF.id ?? uid(),
                title: v.title,
                amount: toNum(v.amount),
                category: v.category,
                day: toDay(v.day),
                cardId: v.cardId || undefined,
                scope: editF.scope ?? scope,
              }
              update((d) => {
                const i = d.fixed.findIndex((x) => x.id === f.id)
                if (i >= 0) d.fixed[i] = f
                else d.fixed.push(f)
              })
              setEditF(null)
            }}
            onDelete={
              editF.id
                ? () => {
                    update((d) => {
                      d.fixed = d.fixed.filter((x) => x.id !== editF.id)
                    })
                    setEditF(null)
                  }
                : undefined
            }
          />
        )}
      </Sheet>
    </div>
  )
}
