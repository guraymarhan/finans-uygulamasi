import { useSyncExternalStore } from 'react'
import { get, set } from 'idb-keyval'
import type { Data } from './types'
import { monthKey, totals } from './calc'
import { fetchRates } from './rates'

const KEY = 'finans-v1'

export const emptyData = (): Data => ({
  version: 1,
  cards: [],
  loans: [],
  people: [],
  payments: [],
  fixed: [],
  expenses: [],
  snapshots: [],
  rates: { usd: 0, gold: 0, updatedAt: '', source: '' },
  settings: { extraMonthly: 0, personMonthly: 0 },
  peak: 0,
})

let data: Data = emptyData()
let loaded = false
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())

function recompute(d: Data) {
  const t = totals(d)
  d.peak = Math.max(d.peak, t.total)
  if (t.total === 0 && d.cards.length + d.loans.length + d.people.length === 0) return
  const m = monthKey()
  const snap = { month: m, total: t.total, cards: t.cards, loans: t.loans, people: t.people }
  const i = d.snapshots.findIndex((s) => s.month === m)
  if (i >= 0) d.snapshots[i] = snap
  else d.snapshots.push(snap)
  d.snapshots.sort((a, b) => a.month.localeCompare(b.month))
}

function commit(next: Data) {
  data = next
  set(KEY, next).catch(() => localStorage.setItem(KEY, JSON.stringify(next)))
  emit()
}

export function update(fn: (d: Data) => void) {
  const next = structuredClone(data)
  fn(next)
  recompute(next)
  commit(next)
}

export function replaceAll(d: Data) {
  const next = { ...emptyData(), ...d }
  recompute(next)
  commit(next)
}

export async function load() {
  try {
    const d = (await get(KEY)) ?? JSON.parse(localStorage.getItem(KEY) || 'null')
    if (d) data = { ...emptyData(), ...d, settings: { ...emptyData().settings, ...d.settings } }
  } catch {
    /* ilk açılış */
  }
  loaded = true
  navigator.storage?.persist?.().catch(() => {})
  update(() => {}) // bu ayın fotoğrafını güncelle
  refreshRates()
}

export async function refreshRates() {
  try {
    const r = await fetchRates()
    update((d) => {
      d.rates = { ...r, updatedAt: new Date().toISOString() }
    })
    return true
  } catch {
    return false
  }
}

export const useData = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => data)
export const useLoaded = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => loaded)

// Kutlamalar
type Party = { msg: string; key: number } | null
let party: Party = null
const partySubs = new Set<() => void>()
export function celebrate(msg: string) {
  party = { msg, key: Date.now() }
  partySubs.forEach((f) => f())
  setTimeout(() => {
    party = null
    partySubs.forEach((f) => f())
  }, 3200)
}
export const useParty = () => useSyncExternalStore((f) => (partySubs.add(f), () => partySubs.delete(f)), () => party)
export const getData = () => data
