import type { Card, Currency, Data, Loan, PersonDebt } from './types'

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
/** Kartın bu dönem ödenecek tutarı: girilmişse aylık ödeme, yoksa dönem içi tutar, o da yoksa toplam borç */
export const cardDue = (c: Card) => Math.min(c.balance, c.monthlyPayment > 0 ? c.monthlyPayment : (c.periodSpend ?? 0) > 0 ? c.periodSpend! : c.balance)
/** Hesaptaki kendi para + kalan ek hesap / avans limiti */
export const accountRoom = (a: { balance: number; limit: number }) => {
  const own = Math.max(0, a.balance)
  const used = Math.max(0, -a.balance)
  const limitLeft = Math.max(0, a.limit - used)
  return { own, used, limitLeft, room: own + limitLeft }
}
export const isInterestLoan = (l: Loan) => l.kind === 'interest'
export const loanRemaining = (l: Loan) =>
  isInterestLoan(l) ? Math.max(0, l.principal ?? 0) : Math.max(0, l.totalInstallments - l.paidInstallments) * l.monthlyPayment

const addM = (iso: string, m: number) => {
  const [y, mo, da] = iso.split('-').map(Number)
  const last = new Date(y, mo - 1 + m + 1, 0).getDate()
  const d = new Date(y, mo - 1 + m, Math.min(da, last))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const daysBetween = (a: string, b: string) => Math.round((new Date(b + 'T00:00').getTime() - new Date(a + 'T00:00').getTime()) / 864e5)

export interface InterestDue { date: string; amount: number; days: number; last: boolean }
/** Faiz ödemeli kredinin ödeme takvimi. Faiz = anapara × yıllık oran × gün / 365 (BSMV/KKDF bankaya göre değişir). */
export function interestSchedule(l: Loan): InterestDue[] {
  if (!isInterestLoan(l) || !l.firstInterestDate || !l.maturityDate || !l.startDate) return []
  const out: InterestDue[] = []
  const step = Math.max(1, l.periodMonths || 3)
  let prev = l.startDate
  let date = l.firstInterestDate
  for (let i = 0; i < 120 && prev < l.maturityDate; i++) {
    if (date > l.maturityDate) date = l.maturityDate
    const days = daysBetween(prev, date)
    out.push({ date, days, last: date === l.maturityDate, amount: ((l.principal ?? 0) * (l.annualRate ?? 0) * days) / 36500 })
    prev = date
    date = addM(l.firstInterestDate, step * (i + 1))
  }
  return out
}
export const interestPaidCount = (d: Data, l: Loan) => d.payments.filter((p) => p.kind === 'interest' && p.refId === l.id).length
export function nextInterest(d: Data, l: Loan) {
  const s = interestSchedule(l)
  const i = interestPaidCount(d, l)
  const n = s[i]
  if (!n) return null
  return { ...n, index: i, total: s.length, amount: l.nextInterest || n.amount }
}

/** Kartta taksitli harcamaların bu ay yansıyan kısmı */
export function cardInstallments(d: Data, cardId: string) {
  const now = monthKey()
  const items = d.expenses
    .filter((e) => e.cardId === cardId && (e.installments ?? 1) > 1)
    .map((e) => {
      const n = e.installments!
      const [y, m] = e.date.split('-').map(Number)
      const [ny, nm] = now.split('-').map(Number)
      const done = (ny - y) * 12 + (nm - m) // geçen ay sayısı
      return { e, n, per: e.amount / n, left: Math.max(0, n - done) }
    })
    .filter((x) => x.left > 0)
  return { items, monthly: sum(items.map((x) => x.per)), remaining: sum(items.map((x) => x.per * x.left)) }
}

export function totals(d: Data) {
  const cards = sum(d.cards.map((c) => Math.max(0, c.balance)))
  const loans = sum(d.loans.map(loanRemaining))
  const people = sum(d.people.map((p) => personRemaining(d, p) * rateOf(d, p.currency)))
  const accounts = sum((d.accounts ?? []).map((a) => Math.max(0, -a.balance)))
  // Bu aya (ve geçmiş aylara) ait ödenmemiş sabit giderler ve ödenecek giderler; gelecek aylar eklenmez
  const m = monthKey()
  const bills =
    sum(d.fixed.filter((f) => !d.expenses.some((x) => x.fixedId === f.id && x.date.startsWith(m))).map((f) => f.amount)) +
    sum(d.expenses.filter((x) => x.pending && x.date.slice(0, 7) <= m).map((x) => x.amount))
  const monthly =
    sum(d.cards.filter((c) => c.balance > 0).map((c) => Math.min(c.balance, c.monthlyPayment > 0 ? c.monthlyPayment : c.periodSpend ?? 0))) +
    sum(d.loans.filter((l) => !isInterestLoan(l) && loanRemaining(l) > 0).map((l) => l.monthlyPayment))
  return { cards, loans, people, accounts, bills, total: cards + loans + people + accounts + bills, monthly }
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

export interface Upcoming { date: string; title: string; amount: number; kind: 'card' | 'loan' | 'fixed' | 'interest' | 'expense'; refId: string; paid: boolean; sub: string }

const iso = (y: number, m: number, day: number) => {
  const last = new Date(y, m + 1, 0).getDate()
  const d = new Date(y, m, Math.min(day, last))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function upcoming(d: Data, days = 30): Upcoming[] {
  const now = new Date()
  // bu ayın başından itibaren: ödenmemiş geçmiş günlü ödemeler de listede kalsın
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 12)
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
    d.cards.filter((c) => c.balance > 0).forEach((c) => push('card', c.id, c.dueDay, c.name, cardDue(c), 'Kart son ödeme'))
    d.loans.filter((l) => !isInterestLoan(l) && loanRemaining(l) > 0).forEach((l) => push('loan', l.id, l.dueDay, l.name, l.monthlyPayment, `Kredi taksiti ${l.paidInstallments + 1}/${l.totalInstallments}`))
    d.fixed.forEach((f) => push('fixed', f.id, f.day, f.title, f.amount, f.scope === 'business' ? 'İş yeri sabit gideri' : 'Sabit gider'))
  }
  d.expenses
    .filter((x) => x.pending && x.date <= e)
    .forEach((x) => out.push({ date: x.date, title: x.title, amount: x.amount, kind: 'expense', refId: x.id, paid: false, sub: x.scope === 'business' ? 'İş yeri gideri' : 'Gider' }))
  d.loans.filter(isInterestLoan).forEach((l) => {
    const n = nextInterest(d, l)
    if (n && n.date <= e) out.push({ date: n.date, title: l.name, amount: n.amount + (n.last ? l.principal ?? 0 : 0), kind: 'interest', refId: l.id, paid: false, sub: n.last ? 'Vade: anapara + faiz' : `Faiz ödemesi ${n.index + 1}/${n.total}` })
  })
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

export interface MonthDue { date: string; title: string; amount: number; kind: Upcoming['kind']; refId: string; paid: boolean; scope: 'personal' | 'business' }
/** Bu takvim ayına düşen tüm ödemeler (kart, kredi, faiz, sabit gider) ve ödenip ödenmedikleri */
export function monthDues(d: Data, m = monthKey()): MonthDue[] {
  const [y, mo] = m.split('-').map(Number)
  const out: MonthDue[] = []
  const paidCard = (id: string, kind: string) => d.payments.filter((p) => p.kind === kind && p.refId === id && p.date.startsWith(m))
  d.cards.forEach((c) => {
    const ps = paidCard(c.id, 'card')
    const paid = ps.length > 0
    if (c.balance <= 0 && !paid) return
    out.push({ date: iso(y, mo - 1, c.dueDay), title: c.name, kind: 'card', refId: c.id, paid, scope: 'personal', amount: paid ? sum(ps.map((p) => p.amount)) : cardDue(c) })
  })
  d.loans.filter((l) => !isInterestLoan(l)).forEach((l) => {
    const paid = paidCard(l.id, 'loan').length > 0
    if (!paid && loanRemaining(l) <= 0) return
    out.push({ date: iso(y, mo - 1, l.dueDay), title: l.name, kind: 'loan', refId: l.id, paid, scope: 'personal', amount: l.monthlyPayment })
  })
  d.loans.filter(isInterestLoan).forEach((l) => {
    const pc = interestPaidCount(d, l)
    interestSchedule(l).forEach((x, i) => {
      if (!x.date.startsWith(m)) return
      const amt = (i === pc && l.nextInterest ? l.nextInterest : x.amount) + (x.last ? l.principal ?? 0 : 0)
      out.push({ date: x.date, title: l.name, kind: 'interest', refId: l.id, paid: i < pc, scope: 'business', amount: amt })
    })
  })
  // fixed'e bağlı olmayan tek seferlik giderler (ödendi ya da ödenecek)
  d.expenses
    .filter((x) => !x.fixedId && x.date.startsWith(m))
    .forEach((x) => out.push({ date: x.date, title: x.title, kind: 'expense', refId: x.id, paid: !x.pending, scope: x.scope, amount: x.amount }))
  d.fixed.forEach((f) => {
    const e = d.expenses.find((x) => x.fixedId === f.id && x.date.startsWith(m))
    out.push({ date: iso(y, mo - 1, f.day), title: f.title, kind: 'fixed', refId: f.id, paid: !!e, scope: f.scope, amount: e ? e.amount : f.amount })
  })
  return out.sort((a, b) => a.date.localeCompare(b.date))
}

/** Uygulamaya kaydedilen toplam ödeme (TL) */
export function paidSoFar(d: Data) {
  // Öde ile kapatılan sabit / ödenecek giderler (kartla ödenenler borcu karta taşıdığı için sayılmaz)
  const bills = sum(d.expenses.filter((e) => (e.fixedId || e.settled) && !e.cardId).map((e) => e.amount))
  return bills + sum(
    d.payments
      .filter((p) => p.kind !== 'interest')
      .map((p) => {
        if (p.kind !== 'person') return p.amount
        const debt = d.people.find((x) => x.id === p.refId)
        return debt ? p.amount * rateOf(d, debt.currency) : 0
      }),
  )
}

export const daysUntil = (date: string) => Math.round((new Date(date + 'T00:00').getTime() - new Date(today() + 'T00:00').getTime()) / 864e5)

/** Faiz ödemeli kredilerin anaparası vadede tek seferde kapanır; diğer borçlar aylık ödemeyle erir. */
export function payoff(d: Data, perMonth: number) {
  const lump = d.loans.filter((l) => isInterestLoan(l) && (l.principal ?? 0) > 0)
  const rest = totals(d).total - sum(lump.map((l) => l.principal ?? 0))
  const p = rest > 0 ? projection(rest, perMonth) : { months: 0, date: new Date() }
  if (!p) return null
  let date = p.date
  for (const l of lump) {
    const m = new Date(l.maturityDate + 'T00:00')
    if (m > date) date = m
  }
  const months = Math.max(0, (date.getFullYear() - new Date().getFullYear()) * 12 + date.getMonth() - new Date().getMonth())
  return { months, date, lumpDate: lump.length ? date : null }
}

export function projection(total: number, perMonth: number) {
  if (perMonth <= 0 || total <= 0) return null
  const months = Math.ceil(total / perMonth)
  return { months, date: addMonths(months) }
}
