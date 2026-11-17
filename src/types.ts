export type Currency = 'USD' | 'GAU' | 'TRY'
export type Scope = 'personal' | 'business'

export interface Card { id: string; name: string; limit: number; balance: number; monthlyPayment: number; statementDay: number; dueDay: number }
export interface Loan { id: string; name: string; monthlyPayment: number; totalInstallments: number; paidInstallments: number; dueDay: number }
export interface PersonDebt { id: string; person: string; currency: Currency; amount: number; date: string; rateAtDate: number; note?: string }
/** amount: TL for card/loan, birim (USD / gram) for person */
export interface Payment { id: string; kind: 'card' | 'loan' | 'person'; refId: string; amount: number; date: string }
export interface FixedExpense { id: string; title: string; amount: number; category: string; day: number; cardId?: string; scope: Scope }
export interface Expense { id: string; title: string; amount: number; category: string; date: string; cardId?: string; scope: Scope; fixedId?: string }
export interface Snapshot { month: string; total: number; cards: number; loans: number; people: number }
export interface Rates { usd: number; gold: number; updatedAt: string; source: string }
export interface Settings { extraMonthly: number; personMonthly: number }

export interface Data {
  version: 1
  cards: Card[]
  loans: Loan[]
  people: PersonDebt[]
  payments: Payment[]
  fixed: FixedExpense[]
  expenses: Expense[]
  snapshots: Snapshot[]
  rates: Rates
  settings: Settings
  peak: number
}
