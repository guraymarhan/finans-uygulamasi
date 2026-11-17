import { useState } from 'react'
import { update, useData } from '../store'
import { addMonths, dateLabel, fmtUnit, loanRemaining, monthYearLabel, num, personPaid, personRemaining, rateOf, tl, today, uid } from '../calc'
import { deletePayment, payCard, payLoan, payPerson } from '../actions'
import { AddBtn, Bar, Empty, Form, Section, Segmented, Sheet, toDay, toNum } from '../ui'
import type { Card, Currency, Loan, PersonDebt } from '../types'

type Sub = 'cards' | 'loans' | 'people'

export function Debts() {
  const [sub, setSub] = useState<Sub>('cards')
  return (
    <div>
      <Segmented
        value={sub}
        onChange={setSub}
        options={[
          { value: 'cards', label: 'Kartlar' },
          { value: 'loans', label: 'Krediler' },
          { value: 'people', label: 'Kişiler' },
        ]}
      />
      {sub === 'cards' && <Cards />}
      {sub === 'loans' && <Loans />}
      {sub === 'people' && <People />}
    </div>
  )
}

/* ---------------- Kartlar ---------------- */

export function CardPaySheet({ cardId, open, onClose }: { cardId: string; open: boolean; onClose: () => void }) {
  const d = useData()
  const c = d.cards.find((x) => x.id === cardId)
  if (!c) return null
  return (
    <Sheet open={open} onClose={onClose} title={`${c.name} ödemesi`}>
      <Form
        key={String(open)}
        fields={[
          { key: 'amount', label: 'Ödenen tutar (₺)', type: 'number', required: true, hint: `Güncel borç ${tl(c.balance)}` },
          { key: 'date', label: 'Tarih', type: 'date' },
        ]}
        initial={{ amount: Math.min(c.monthlyPayment, c.balance) || '', date: today() }}
        submitLabel="Ödemeyi kaydet"
        onSubmit={(v) => {
          payCard(c.id, toNum(v.amount), v.date || today())
          onClose()
        }}
      />
    </Sheet>
  )
}

function Cards() {
  const d = useData()
  const [edit, setEdit] = useState<Partial<Card> | null>(null)
  const [pay, setPay] = useState<string | null>(null)
  const total = d.cards.reduce((a, c) => a + c.balance, 0)
  const limit = d.cards.reduce((a, c) => a + c.limit, 0)
  return (
    <Section title={`Kartlar · ${tl(total)}`} action={<AddBtn onClick={() => setEdit({})} />}>
      {limit > 0 && (
        <div className="mb-3 px-1 text-xs text-mute">
          Toplam limit {tl(limit)} · kullanım %{Math.round((total / limit) * 100)}
        </div>
      )}
      <div className="space-y-3">
        {d.cards.length === 0 && <Empty>Henüz kart yok. Kartlarını ekleyerek başla.</Empty>}
        {d.cards.map((c) => {
          const linked = d.expenses.filter((e) => e.cardId === c.id)
          return (
            <div key={c.id} className="glass rise overflow-hidden">
              <div className="bg-gradient-to-br from-lilac/20 via-transparent to-mint/10 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    <div className="mt-0.5 text-xs text-mute">
                      Kesim {c.statementDay} · Son ödeme {c.dueDay}
                    </div>
                  </div>
                  <button onClick={() => setEdit(c)} className="chip">Düzenle</button>
                </div>
                <div className="tnum mt-3 text-2xl font-bold">{c.balance > 0 ? tl(c.balance) : 'Borç yok 🎉'}</div>
                {c.limit > 0 && (
                  <>
                    <Bar value={1 - c.balance / c.limit} className="mt-2" />
                    <div className="mt-1 text-xs text-mute">Kullanılabilir {tl(Math.max(0, c.limit - c.balance))}</div>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-sm">
                <span className="text-mute">
                  Aylık {tl(c.monthlyPayment)}
                  {linked.length > 0 && ` · ${linked.length} gider bağlı`}
                </span>
                {c.balance > 0 && (
                  <button onClick={() => setPay(c.id)} className="font-medium text-mint">Ödeme yap</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      <History kind="card" />
      {pay && <CardPaySheet cardId={pay} open onClose={() => setPay(null)} />}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Kartı düzenle' : 'Yeni kart'}>
        {edit && (
          <Form
            fields={[
              { key: 'name', label: 'Kart adı', required: true },
              { key: 'balance', label: 'Toplam borç (₺)', type: 'number', hint: 'Ekstre + dönem içi harcamalar dahil güncel borç' },
              { key: 'monthlyPayment', label: 'Aylık ödeme (₺)', type: 'number', half: true },
              { key: 'limit', label: 'Limit (₺)', type: 'number', half: true },
              { key: 'statementDay', label: 'Hesap kesim günü', type: 'day', half: true },
              { key: 'dueDay', label: 'Son ödeme günü', type: 'day', half: true },
            ]}
            initial={edit}
            onSubmit={(v) => {
              const c: Card = {
                id: edit.id ?? uid(),
                name: v.name,
                balance: toNum(v.balance),
                monthlyPayment: toNum(v.monthlyPayment),
                limit: toNum(v.limit),
                statementDay: toDay(v.statementDay),
                dueDay: toDay(v.dueDay),
              }
              update((d) => {
                const i = d.cards.findIndex((x) => x.id === c.id)
                if (i >= 0) d.cards[i] = c
                else d.cards.push(c)
              })
              setEdit(null)
            }}
            onDelete={
              edit.id
                ? () => {
                    update((d) => {
                      d.cards = d.cards.filter((x) => x.id !== edit.id)
                      d.expenses.forEach((e) => e.cardId === edit.id && delete e.cardId)
                      d.fixed.forEach((e) => e.cardId === edit.id && delete e.cardId)
                    })
                    setEdit(null)
                  }
                : undefined
            }
          />
        )}
      </Sheet>
    </Section>
  )
}

/* ---------------- Krediler ---------------- */

function Loans() {
  const d = useData()
  const [edit, setEdit] = useState<Partial<Loan> | null>(null)
  const total = d.loans.reduce((a, l) => a + loanRemaining(l), 0)
  return (
    <Section title={`Krediler · ${tl(total)}`} action={<AddBtn onClick={() => setEdit({})} />}>
      <div className="space-y-3">
        {d.loans.length === 0 && <Empty>Kredilerini taksit sayısıyla ekle, bitiş tarihini birlikte izleyelim.</Empty>}
        {d.loans.map((l) => {
          const left = l.totalInstallments - l.paidInstallments
          const done = left <= 0
          return (
            <div key={l.id} className="glass rise p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{l.name}</div>
                  <div className="mt-0.5 text-xs text-mute">
                    Her ayın {l.dueDay}. günü · {tl(l.monthlyPayment)}
                  </div>
                </div>
                <button onClick={() => setEdit(l)} className="chip">Düzenle</button>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div className="tnum text-2xl font-bold">{done ? 'Kapandı 🎉' : tl(loanRemaining(l))}</div>
                <div className="text-right text-xs text-mute">
                  {l.paidInstallments}/{l.totalInstallments} taksit
                  {!done && <div>Bitiş {monthYearLabel(addMonths(left - 1))}</div>}
                </div>
              </div>
              <Bar value={l.paidInstallments / (l.totalInstallments || 1)} className="mt-2" />
              {!done && (
                <button onClick={() => payLoan(l.id)} className="mt-3 w-full rounded-xl bg-white/6 py-2.5 text-sm font-medium text-mint">
                  Bu ayın taksitini ödedim
                </button>
              )}
            </div>
          )
        })}
      </div>
      <History kind="loan" />
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Krediyi düzenle' : 'Yeni kredi'}>
        {edit && (
          <Form
            fields={[
              { key: 'name', label: 'Kredi adı (banka / tür)', required: true },
              { key: 'monthlyPayment', label: 'Aylık taksit (₺)', type: 'number', required: true },
              { key: 'totalInstallments', label: 'Toplam taksit', type: 'number', required: true, half: true },
              { key: 'paidInstallments', label: 'Ödenmiş taksit', type: 'number', half: true },
              { key: 'dueDay', label: 'Ödeme günü', type: 'day' },
            ]}
            initial={edit}
            onSubmit={(v) => {
              const l: Loan = {
                id: edit.id ?? uid(),
                name: v.name,
                monthlyPayment: toNum(v.monthlyPayment),
                totalInstallments: Math.round(toNum(v.totalInstallments)),
                paidInstallments: Math.round(toNum(v.paidInstallments)),
                dueDay: toDay(v.dueDay),
              }
              update((d) => {
                const i = d.loans.findIndex((x) => x.id === l.id)
                if (i >= 0) d.loans[i] = l
                else d.loans.push(l)
              })
              setEdit(null)
            }}
            onDelete={
              edit.id
                ? () => {
                    update((d) => {
                      d.loans = d.loans.filter((x) => x.id !== edit.id)
                    })
                    setEdit(null)
                  }
                : undefined
            }
          />
        )}
      </Sheet>
    </Section>
  )
}

/* ---------------- Kişiler ---------------- */

const CUR: { value: Currency; label: string }[] = [
  { value: 'USD', label: 'Dolar ($)' },
  { value: 'GAU', label: 'Gram altın' },
  { value: 'TRY', label: 'Türk lirası' },
]

function People() {
  const d = useData()
  const [edit, setEdit] = useState<Partial<PersonDebt> | null>(null)
  const [repay, setRepay] = useState<PersonDebt | null>(null)
  const persons = [...new Set(d.people.map((p) => p.person))]
  const byType = (['USD', 'GAU', 'TRY'] as Currency[])
    .map((c) => {
      const list = d.people.filter((p) => p.currency === c)
      const units = list.reduce((a, p) => a + personRemaining(d, p), 0)
      const then = list.reduce((a, p) => a + personRemaining(d, p) * (p.currency === 'TRY' ? 1 : p.rateAtDate), 0)
      return { c, units, now: units * rateOf(d, c), then }
    })
    .filter((x) => x.units > 0)

  return (
    <>
      {byType.length > 0 && (
        <Section title="Türe göre">
          <div className="grid grid-cols-2 gap-3">
            {byType.map((x) => (
              <div key={x.c} className="glass p-4">
                <div className="text-xs text-mute">{CUR.find((c) => c.value === x.c)!.label}</div>
                <div className="tnum mt-1 text-lg font-bold">{fmtUnit(x.units, x.c)}</div>
                <div className="tnum text-sm">{tl(x.now)}</div>
                {x.c !== 'TRY' && x.then > 0 && <Impact then={x.then} now={x.now} />}
              </div>
            ))}
          </div>
        </Section>
      )}
      <Section title="Kişiler" action={<AddBtn onClick={() => setEdit({ currency: 'USD', date: today() })} />}>
        {persons.length === 0 && <Empty>Dolar veya gram altın olarak aldığın borçları kişi bazında ekle; güncel TL karşılığını anlık görürsün.</Empty>}
        <div className="space-y-3">
          {persons.map((name) => {
            const list = d.people.filter((p) => p.person === name)
            const tot = list.reduce((a, p) => a + personRemaining(d, p) * rateOf(d, p.currency), 0)
            return (
              <div key={name} className="glass rise overflow-hidden">
                <div className="flex items-center justify-between px-4 pt-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-mint/40 to-lilac/40 font-semibold">
                      {name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="font-semibold">{name}</div>
                  </div>
                  <div className="tnum text-right font-bold">{tot > 0 ? tl(tot) : 'Kapandı 🎉'}</div>
                </div>
                <div className="mt-2 divide-y divide-line">
                  {list.map((p) => {
                    const rem = personRemaining(d, p)
                    const paid = personPaid(d, p)
                    return (
                      <div key={p.id} className="px-4 py-3">
                        <div className="flex items-center justify-between">
                          <button onClick={() => setEdit(p)} className="text-left">
                            <div className="tnum text-sm font-medium">
                              {fmtUnit(rem, p.currency)} <span className="text-mute">/ {fmtUnit(p.amount, p.currency)}</span>
                            </div>
                            <div className="text-xs text-mute">
                              {dateLabel(p.date)} {p.date.slice(0, 4)}
                              {p.note ? ` · ${p.note}` : ''}
                            </div>
                          </button>
                          {rem > 0 ? (
                            <button onClick={() => setRepay(p)} className="text-sm font-medium text-mint">Geri öde</button>
                          ) : (
                            <span className="text-xs text-mint">Tamam ✓</span>
                          )}
                        </div>
                        <Bar value={paid / (p.amount || 1)} className="mt-2" />
                        {p.currency !== 'TRY' && rem > 0 && (
                          <div className="mt-2 flex justify-between text-xs text-mute">
                            <span>Bugün {tl(rem * rateOf(d, p.currency))}</span>
                            {p.rateAtDate > 0 && <Impact then={rem * p.rateAtDate} now={rem * rateOf(d, p.currency)} inline />}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </Section>
      <History kind="person" />

      <Sheet open={!!repay} onClose={() => setRepay(null)} title={`${repay?.person ?? ''} · geri ödeme`}>
        {repay && (
          <Form
            fields={[
              { key: 'amount', label: `Miktar (${repay.currency === 'USD' ? '$' : repay.currency === 'GAU' ? 'gram' : '₺'})`, type: 'number', required: true, hint: `Kalan ${fmtUnit(personRemaining(d, repay), repay.currency)}` },
              { key: 'date', label: 'Tarih', type: 'date' },
            ]}
            initial={{ amount: '', date: today() }}
            submitLabel="Geri ödemeyi kaydet"
            onSubmit={(v) => {
              payPerson(repay.id, toNum(v.amount), v.date || today())
              setRepay(null)
            }}
          />
        )}
      </Sheet>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Borcu düzenle' : 'Yeni kişisel borç'}>
        {edit && <PersonForm edit={edit} persons={persons} close={() => setEdit(null)} />}
      </Sheet>
    </>
  )
}

function PersonForm({ edit, persons, close }: { edit: Partial<PersonDebt>; persons: string[]; close: () => void }) {
  const d = useData()
  const [cur, setCur] = useState<Currency>(edit.currency ?? 'USD')
  return (
    <>
      <div className="mb-3">
        <Segmented value={cur} onChange={setCur} options={CUR} />
      </div>
      <Form
        key={cur}
        fields={[
          { key: 'person', label: 'Kişi', required: true, hint: persons.length ? `Kayıtlı: ${persons.join(', ')}` : undefined },
          { key: 'amount', label: `Miktar (${cur === 'USD' ? '$' : cur === 'GAU' ? 'gram' : '₺'})`, type: 'number', required: true },
          { key: 'date', label: 'Alındığı tarih', type: 'date' },
          ...(cur !== 'TRY'
            ? [{ key: 'rateAtDate', label: `O günkü kur (1 ${cur === 'USD' ? '$' : 'gr'} = ₺)`, type: 'number' as const, hint: 'Kur etkisini hesaplamak için. Bilmiyorsan bugünkü kur kalabilir.' }]
            : []),
          { key: 'note', label: 'Not (isteğe bağlı)' },
        ]}
        initial={{ ...edit, rateAtDate: edit.currency === cur && edit.rateAtDate ? num(edit.rateAtDate) : num(rateOf(d, cur)) }}
        onSubmit={(v) => {
          const p: PersonDebt = {
            id: edit.id ?? uid(),
            person: v.person.trim(),
            currency: cur,
            amount: toNum(v.amount),
            date: v.date || today(),
            rateAtDate: cur === 'TRY' ? 1 : toNum(v.rateAtDate),
            note: v.note || undefined,
          }
          update((d) => {
            const i = d.people.findIndex((x) => x.id === p.id)
            if (i >= 0) d.people[i] = p
            else d.people.push(p)
          })
          close()
        }}
        onDelete={
          edit.id
            ? () => {
                update((d) => {
                  d.people = d.people.filter((x) => x.id !== edit.id)
                  d.payments = d.payments.filter((x) => x.refId !== edit.id)
                })
                close()
              }
            : undefined
        }
      />
    </>
  )
}

function Impact({ then, now, inline }: { then: number; now: number; inline?: boolean }) {
  const diff = now - then
  const pct = then ? (diff / then) * 100 : 0
  const txt = `${diff >= 0 ? '+' : '−'}${tl(Math.abs(diff))} (%${num(Math.abs(pct), 1)})`
  if (inline) return <span className={diff > 0 ? 'text-sun' : 'text-mint'}>Kur etkisi {txt}</span>
  return (
    <div className="mt-2 text-[11px] leading-tight text-mute">
      Alındığında {tl(then)}
      <div className={diff > 0 ? 'text-sun' : 'text-mint'}>Kur etkisi {txt}</div>
    </div>
  )
}

function History({ kind }: { kind: 'card' | 'loan' | 'person' }) {
  const d = useData()
  const [open, setOpen] = useState(false)
  const list = d.payments.filter((p) => p.kind === kind).sort((a, b) => b.date.localeCompare(a.date))
  if (!list.length) return null
  const nameOf = (id: string) =>
    kind === 'card' ? d.cards.find((c) => c.id === id)?.name : kind === 'loan' ? d.loans.find((l) => l.id === id)?.name : d.people.find((p) => p.id === id)?.person
  const fmt = (p: (typeof list)[number]) => {
    if (kind !== 'person') return tl(p.amount)
    const debt = d.people.find((x) => x.id === p.refId)
    return debt ? fmtUnit(p.amount, debt.currency) : num(p.amount)
  }
  return (
    <div className="mt-4">
      <button onClick={() => setOpen(!open)} className="px-1 text-sm text-mute">
        {open ? '▾' : '▸'} Ödeme geçmişi ({list.length})
      </button>
      {open && (
        <div className="glass mt-2 divide-y divide-line">
          {list.slice(0, 30).map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
              <span>
                {nameOf(p.id === '' ? '' : p.refId) ?? '—'} <span className="text-xs text-mute">· {dateLabel(p.date)}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="tnum">{fmt(p)}</span>
                <button onClick={() => confirm('Bu ödeme kaydı geri alınsın mı?') && deletePayment(p.id)} className="text-xs text-mute">Geri al</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
