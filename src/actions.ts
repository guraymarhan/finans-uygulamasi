import type { Expense } from './types'
import { celebrate, getData, update } from './store'
import { personRemaining, today, uid, loanRemaining } from './calc'

export function payCard(cardId: string, amount: number, date = today()) {
  update((d) => {
    const c = d.cards.find((x) => x.id === cardId)
    if (!c) return
    const before = c.balance
    c.balance = Math.max(0, c.balance - amount)
    d.payments.push({ id: uid(), kind: 'card', refId: cardId, amount, date })
    if (before > 0 && c.balance === 0) setTimeout(() => celebrate(`${c.name} borcu sıfırlandı! 🎉`))
  })
  celebrate('Ödeme kaydedildi, bir adım daha 💪')
}

export function payLoan(loanId: string, date = today()) {
  update((d) => {
    const l = d.loans.find((x) => x.id === loanId)
    if (!l || loanRemaining(l) <= 0) return
    l.paidInstallments += 1
    d.payments.push({ id: uid(), kind: 'loan', refId: loanId, amount: l.monthlyPayment, date })
    setTimeout(() => celebrate(loanRemaining(l) <= 0 ? `${l.name} kapandı! Tebrikler 🎉` : `Taksit ödendi, ${l.totalInstallments - l.paidInstallments} taksit kaldı 💪`))
  })
}

export function payPerson(debtId: string, amount: number, date = today()) {
  update((d) => {
    const p = d.people.find((x) => x.id === debtId)
    if (!p) return
    d.payments.push({ id: uid(), kind: 'person', refId: debtId, amount, date })
    setTimeout(() => celebrate(personRemaining(d, p) <= 0 ? `${p.person} borcu kapandı! 🎉` : 'Geri ödeme kaydedildi 💪'))
  })
}

export function deletePayment(id: string) {
  update((d) => {
    const p = d.payments.find((x) => x.id === id)
    if (!p) return
    if (p.kind === 'card') {
      const c = d.cards.find((x) => x.id === p.refId)
      if (c) c.balance += p.amount
    }
    if (p.kind === 'loan') {
      const l = d.loans.find((x) => x.id === p.refId)
      if (l) l.paidInstallments = Math.max(0, l.paidInstallments - 1)
    }
    d.payments = d.payments.filter((x) => x.id !== id)
  })
}

/** Gider kartla ödendiyse kartın borcuna eklenir. */
export function saveExpense(e: Omit<Expense, 'id'> & { id?: string }) {
  update((d) => {
    const old = e.id ? d.expenses.find((x) => x.id === e.id) : undefined
    if (old?.cardId) {
      const c = d.cards.find((x) => x.id === old.cardId)
      if (c) c.balance -= old.amount
    }
    if (e.cardId) {
      const c = d.cards.find((x) => x.id === e.cardId)
      if (c) c.balance += e.amount
    }
    const next = { ...e, id: e.id ?? uid() } as Expense
    if (old) Object.assign(old, next)
    else d.expenses.push(next)
  })
}

export function deleteExpense(id: string) {
  update((d) => {
    const e = d.expenses.find((x) => x.id === id)
    if (e?.cardId) {
      const c = d.cards.find((x) => x.id === e.cardId)
      if (c) c.balance = Math.max(0, c.balance - e.amount)
    }
    d.expenses = d.expenses.filter((x) => x.id !== id)
  })
}

export function payFixed(fixedId: string, date = today()) {
  const f = getData().fixed.find((x) => x.id === fixedId)
  if (!f) return
  saveExpense({ title: f.title, amount: f.amount, category: f.category, date, cardId: f.cardId, scope: f.scope, fixedId })
  celebrate('Ödendi olarak işaretlendi ✓')
}
