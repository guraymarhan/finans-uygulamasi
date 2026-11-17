// Cihaza özel şifre kilidi (şifre bu cihazda, karıştırılmış olarak saklanır)
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

const LS = 'pin-v1'
const AWAY_MS = 2 * 60 * 1000 // 2 dk arka planda kalırsa tekrar kilitle

type Pin = { salt: string; hash: string }
const readPin = (): Pin | null => {
  try {
    return JSON.parse(localStorage.getItem(LS) || 'null')
  } catch {
    return null
  }
}

async function hash(pin: string, salt: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + ':' + pin))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

let locked = !!readPin()
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
export const useLocked = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => locked)
export const hasPin = () => !!readPin()

export async function setPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint32Array(4)).join('-')
  localStorage.setItem(LS, JSON.stringify({ salt, hash: await hash(pin, salt) }))
}
export function clearPin() {
  localStorage.removeItem(LS)
}
async function check(pin: string) {
  const p = readPin()
  return !p || (await hash(pin, p.salt)) === p.hash
}

let hiddenAt = 0
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') hiddenAt = Date.now()
  else if (hiddenAt && Date.now() - hiddenAt > AWAY_MS && readPin()) {
    locked = true
    emit()
  }
})

export function LockScreen() {
  const [pin, setP] = useState('')
  const [bad, setBad] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])
  const tryPin = async (v: string) => {
    setP(v)
    setBad(false)
    if (v.length >= 4 && (await check(v))) {
      locked = false
      emit()
    }
  }
  const submit = async () => {
    if (!(await check(pin))) {
      setBad(true)
      setP('')
    }
  }
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.target === ref.current) return
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('⌫')
      else if (e.key === 'Enter') press('✓')
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })
  const press = (k: string) => (k === '⌫' ? tryPin(pin.slice(0, -1)) : k === '✓' ? submit() : pin.length < 8 && tryPin(pin + k))
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink px-6">
      <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" className="mb-4 h-16 w-16" />
      <h1 className="grad-text text-2xl font-bold">Borç Pusulası</h1>
      <p className={`mt-2 text-sm ${bad ? 'text-rose' : 'text-mute'}`}>{bad ? 'Şifre yanlış, tekrar dene' : 'Şifreni gir'}</p>
      <input
        ref={ref}
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={pin}
        onChange={(e) => tryPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        className="sr-only"
        aria-label="Şifre"
      />
      <div className="my-6 flex h-4 gap-3" onClick={() => ref.current?.focus()}>
        {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full ${i < pin.length ? 'bg-mint' : 'bg-white/15'}`} />
        ))}
      </div>
      <div className="grid w-full max-w-[280px] grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'].map((k) => (
          <button key={k} onClick={() => press(k)} className="h-16 rounded-2xl bg-white/6 text-2xl font-semibold active:bg-white/12">
            {k}
          </button>
        ))}
      </div>
      <p className="mt-6 max-w-[280px] text-center text-xs text-mute">Şifreyi unutursan bu cihazdaki tarayıcı verilerini silip Drive'dan tekrar eşitleyebilirsin.</p>
    </div>
  )
}
