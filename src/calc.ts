import type { Currency, Data, PersonDebt } from './types'

export const uid = () => crypto.randomUUID()
export const today = () => new Date().toISOString().slice(0, 10)
export const monthKey = (d: Date | string = new Date()) => (typeof d === 'string' ? d : d.toISOString()).slice(0, 7)
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

export const tl = (n: number, frac = 0) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: frac, minimumFractionDigits: frac }).format(n || 0)
export const num = (n: number, frac = 2) => new Intl.NumberFormat('tr-TR', { maximumFractionDigits: frac }).format(n || 0)
export const unitLabel = (c: Currency) => (c === 'USD' ? '$' : c === 'GAU' ? 'gr altın' : '₺')
export const fmtUnit = (n: number, c: Currency) => (c === 'USD' ? `$${num(n)}` : c === 'GAU' ? `${num(n)} gr` : tl(n))
const MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
export const monthLabel = (m: string) => `${MONTHS[+m.slice(5, 7) - 1]} ${m.slice(2, 4)}`
export const dateLabel = (d: string) => `${+d.slice(8, 10)} ${MONTHS[+d.slice(5, 7) - 1]}`

export const rateOf = (d: Data, c: Currency) => (c === 'USD' ? d.rates.usd : c === 'GAU' ? d.rates.gold : 1)
export const personPaid = (d: Data, p: PersonDebt) => sum(d.payments.filter((x) => x.kind === 'person' && x.refId === p.id).map((x) => x.amount))
export const personRemaining = (d: Data, p: PersonDebt) => Math.max(0, p.amount - personPaid(d, p))
export const loanRemaining = (l: Data['loans'][number]) => Math.max(0, l.totalInstallments - l.paidInstallments) * l.monthlyPayment

export function totals(d: Data) {
  const cards = sum(d.cards.map((c) => Math.max(0, c.balance)))
  const loans = sum(d.loans.map(loanRemaining))
  const people = sum(d.people.map((p) => personRemaining(d, p) * rateOf(d, p.currency)))
  const monthly =
    sum(d.cards.filter((c) => c.balance > 0).map((c) => Math.min(c.monthlyPayment, c.balance))) +
    sum(d.loans.filter((l) => loanRemaining(l) > 0).map((l) => l.monthlyPayment))
  return { cards, loans, people, total: cards + loans + people, monthly }
}

/** Ardışık ödeme yapılan ay sayısı */
export function streak(d: Data) {
  const months = new Set(d.payments.map((p) => p.date.slice(0, 7)))
  const dt = new Date()
  dt.setDate(1)
  if (!months.has(monthKey(dt))) dt.setMonth(dt.getMonth() - 1)
  let n = 0
  while (months.has(monthKey(dt))) {
    n++
    dt.setMonth(dt.getMonth() - 1)
  }
  return n
}

export function addMonths(m: number, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth() + m, 1)
  return d
}
export const monthYearLabel = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getFullYear()}`

export interface Upcoming { date: string; title: string; amount: number; kind: 'card' | 'loan' | 'fixed'; refId: string; paid: boolean; sub: string }

const iso = (y: number, m: number, day: number) => {
  const last = new Date(y, m + 1, 0).getDate()
  const d = new Date(y, m, Math.min(day, last))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function upcoming(d: Data, days = 30): Upcoming[] {
  const now = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - 7)
  const end = new Date(now)
  end.setDate(end.getDate() + days)
  const s = start.toISOString().slice(0, 10)
  const e = end.toISOString().slice(0, 10)
  const out: Upcoming[] = []
  const paidIn = (kind: string, id: string, m: string) =>
    kind === 'fixed'
      ? d.expenses.some((x) => x.fixedId === id && x.date.startsWith(m))
      : d.payments.some((p) => p.kind === kind && p.refId === id && p.date.startsWith(m))
  for (const off of [-1, 0, 1]) {
    const y = now.getFullYear()
    const mo = now.getMonth() + off
    const push = (kind: Upcoming['kind'], refId: string, day: number, title: string, amount: number, sub: string) => {
      const date = iso(y, mo, day)
      if (date < s || date > e) return
      const paid = paidIn(kind, refId, date.slice(0, 7))
      if (date < today() && paid) return
      out.push({ date, title, amount, kind, refId, paid, sub })
    }
    d.cards.filter((c) => c.balance > 0).forEach((c) => push('card', c.id, c.dueDay, c.name, Math.min(c.monthlyPayment, c.balance), 'Kart son ödeme'))
    d.loans.filter((l) => loanRemaining(l) > 0).forEach((l) => push('loan', l.id, l.dueDay, l.name, l.monthlyPayment, `Kredi taksiti ${l.paidInstallments + 1}/${l.totalInstallments}`))
    d.fixed.forEach((f) => push('fixed', f.id, f.day, f.title, f.amount, f.scope === 'business' ? 'İş yeri sabit gideri' : 'Sabit gider'))
  }
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export const daysUntil = (date: string) => Math.round((new Date(date + 'T00:00').getTime() - new Date(today() + 'T00:00').getTime()) / 864e5)

export function projection(total: number, perMonth: number) {
  if (perMonth <= 0 || total <= 0) return null
  const months = Math.ceil(total / perMonth)
  return { months, date: addMonths(months) }
}
