// Google Drive otomatik eşitleme (gizli uygulama klasörü: appDataFolder)
import { useSyncExternalStore } from 'react'
import { getData, onUserChange, replaceAll } from './store'
import type { Data } from './types'

export const CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata'
const FILE = 'borc-pusulasi.json'
const LS = 'drive-sync-v1'

type Saved = { on: boolean; token?: string; exp?: number; fileId?: string; last?: number }
export type SyncState = { on: boolean; status: 'off' | 'idle' | 'syncing' | 'auth' | 'error'; last?: number; err?: string }

let saved: Saved = (() => {
  try {
    return JSON.parse(localStorage.getItem(LS) || '{}')
  } catch {
    return {}
  }
})()
const persist = () => {
  try {
    localStorage.setItem(LS, JSON.stringify(saved))
  } catch {
    /* yok */
  }
}

let state: SyncState = { on: !!saved.on, status: saved.on ? 'idle' : 'off', last: saved.last }
const subs = new Set<() => void>()
const set = (p: Partial<SyncState>) => {
  state = { ...state, ...p }
  subs.forEach((f) => f())
}
export const useSync = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => state)

const tokenOk = () => !!saved.token && (saved.exp ?? 0) > Date.now() + 60_000

// --- Google girişi ---
type TokenResp = { access_token?: string; expires_in?: number; error?: string }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const google: any
let gisLoad: Promise<void> | null = null
const loadGis = () =>
  (gisLoad ??= new Promise((res, rej) => {
    if (typeof google !== 'undefined' && google.accounts) return res()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.onload = () => res()
    s.onerror = () => {
      gisLoad = null
      rej(new Error('Google yüklenemedi'))
    }
    document.head.appendChild(s)
  }))

/** Bir dokunuşla çağrılmalı (açılır pencere). */
export async function connect() {
  if (!CLIENT_ID) return
  try {
    await loadGis()
  } catch {
    set({ status: 'error', err: 'Google’a ulaşılamadı. İnterneti kontrol et.' })
    return
  }
  const client = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: (r: TokenResp) => {
      if (!r.access_token) {
        set({ status: saved.on ? 'auth' : 'off', err: 'Giriş tamamlanmadı.' })
        return
      }
      saved = { ...saved, on: true, token: r.access_token, exp: Date.now() + (r.expires_in ?? 3600) * 1000 }
      persist()
      set({ on: true, status: 'idle', err: undefined })
      syncNow()
    },
    error_callback: () => set({ status: saved.on ? 'auth' : 'off', err: 'Giriş penceresi kapandı.' }),
  })
  client.requestAccessToken({ prompt: saved.on ? '' : 'consent' })
}

export function disconnect() {
  if (saved.token && typeof google !== 'undefined') google.accounts?.oauth2?.revoke?.(saved.token, () => {})
  saved = { on: false }
  persist()
  set({ on: false, status: 'off', last: undefined, err: undefined })
}

// --- Drive ---
async function api(url: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${saved.token}` } })
  if (r.status === 401) {
    saved.token = undefined
    persist()
    throw new Error('auth')
  }
  if (!r.ok) throw new Error(`Drive ${r.status}`)
  return r
}

async function findFile(): Promise<string | undefined> {
  const q = encodeURIComponent(`name='${FILE}'`)
  const r = await api(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id)&orderBy=modifiedTime desc`)
  const j = await r.json()
  return j.files?.[0]?.id
}

async function upload(d: Data) {
  const body = JSON.stringify(d)
  if (saved.fileId) {
    try {
      await api(`https://www.googleapis.com/upload/drive/v3/files/${saved.fileId}?uploadType=media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      return
    } catch (e) {
      if ((e as Error).message === 'auth') throw e
      saved.fileId = undefined // silinmiş olabilir, yeniden oluştur
    }
  }
  const b = 'pusula' + Math.random().toString(36).slice(2)
  const multipart =
    `--${b}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: FILE, parents: ['appDataFolder'] }) +
    `\r\n--${b}\r\nContent-Type: application/json\r\n\r\n${body}\r\n--${b}--`
  const r = await api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${b}` },
    body: multipart,
  })
  saved.fileId = (await r.json()).id
}

let running: Promise<void> | null = null
let again = false

/** Drive ile karşılaştır: hangisi yeniyse o kazanır. */
export function syncNow(): Promise<void> {
  if (!saved.on || !CLIENT_ID) return Promise.resolve()
  if (!tokenOk()) {
    set({ status: 'auth' })
    return Promise.resolve()
  }
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    set({ status: 'syncing', err: undefined })
    try {
      if (!saved.fileId) saved.fileId = await findFile()
      let remote: Data | null = null
      if (saved.fileId) {
        try {
          remote = await (await api(`https://www.googleapis.com/drive/v3/files/${saved.fileId}?alt=media`)).json()
        } catch (e) {
          if ((e as Error).message === 'auth') throw e
          saved.fileId = await findFile()
          if (saved.fileId) remote = await (await api(`https://www.googleapis.com/drive/v3/files/${saved.fileId}?alt=media`)).json()
        }
      }
      const local = getData()
      const lt = local.savedAt ?? 0
      const rt = remote?.savedAt ?? 0
      const first = !saved.last // bu cihazın ilk eşitlemesi: Drive'daki veri esas alınır
      if (remote && Array.isArray(remote.cards) && (first || rt > lt)) replaceAll(remote, true)
      else if (!remote || lt > rt) await upload(local)
      saved.last = Date.now()
      persist()
      set({ status: 'idle', last: saved.last })
    } catch (e) {
      const m = (e as Error).message
      persist()
      if (m === 'auth') set({ status: 'auth' })
      else set({ status: 'error', err: navigator.onLine ? 'Eşitlenemedi, sonra tekrar denenecek.' : 'İnternet yok, bağlanınca eşitlenecek.' })
    }
  })().finally(() => {
    running = null
    if (again) {
      again = false
      syncNow()
    }
  })
  return running
}

// Otomatik: açılışta, uygulamaya dönünce, her değişiklikten 2 sn sonra
let timer: ReturnType<typeof setTimeout> | undefined
export function startSync() {
  if (!CLIENT_ID) return
  onUserChange(() => {
    clearTimeout(timer)
    timer = setTimeout(syncNow, 2000)
  })
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && syncNow())
  window.addEventListener('online', () => syncNow())
  syncNow()
}
