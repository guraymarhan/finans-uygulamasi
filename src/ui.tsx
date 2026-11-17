import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useParty } from './store'

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])
  if (!open) return null
  // Body'ye taşınır: animasyonlu / bulanık kapsayıcılar içinde fixed konum bozulmasın
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="rise w-full max-w-lg max-h-[calc(100dvh-env(safe-area-inset-top)-12px)] overflow-y-auto overflow-x-hidden overscroll-contain rounded-t-[28px] border-t border-line bg-panel px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-white/15" />
        <div className="sticky -top-3 z-10 -mx-5 mb-4 flex items-center justify-between bg-panel px-5 py-2">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-full bg-white/5 px-3 py-1 text-sm text-mute">Kapat</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export type FieldSpec = {
  key: string
  label: string
  type?: 'text' | 'number' | 'date' | 'select' | 'day'
  options?: { value: string; label: string }[]
  hint?: string
  required?: boolean
  half?: boolean
}

export function Form({
  fields,
  initial,
  onSubmit,
  onDelete,
  submitLabel = 'Kaydet',
}: {
  fields: FieldSpec[]
  initial: object
  onSubmit: (v: Record<string, string>) => void
  onDelete?: () => void
  submitLabel?: string
}) {
  const [v, setV] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => {
      const x = (initial as Record<string, unknown>)[f.key]
      return [f.key, x === undefined || x === null ? '' : String(x)]
    })),
  )
  const missing = fields.some((f) => f.required && !v[f.key])
  return (
    <form
      className="grid grid-cols-2 gap-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (!missing) onSubmit(v)
      }}
    >
      {fields.map((f) => (
        <label key={f.key} className={`block min-w-0 ${f.half ? 'col-span-1' : 'col-span-2'}`}>
          <span className="mb-1 block truncate text-xs font-medium tracking-wide text-mute">{f.label}</span>
          {f.type === 'select' ? (
            <select className="inp" value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })}>
              {f.options!.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          ) : (
            <input
              className="inp"
              type={f.type === 'date' ? 'date' : 'text'}
              inputMode={f.type === 'number' || f.type === 'day' ? 'decimal' : undefined}
              value={v[f.key]}
              placeholder={f.type === 'day' ? '1-31' : ''}
              onChange={(e) => setV({ ...v, [f.key]: e.target.value })}
            />
          )}
          {f.hint && <span className="mt-1 block text-xs text-mute/80">{f.hint}</span>}
        </label>
      ))}
      <button disabled={missing} className="btn-primary col-span-2 mt-1 w-full disabled:opacity-40">{submitLabel}</button>
      {onDelete && (
        <button
          type="button"
          onClick={() => confirm('Silinsin mi?') && onDelete()}
          className="col-span-2 w-full rounded-2xl py-2 text-sm text-rose/80"
        >
          Sil
        </button>
      )}
    </form>
  )
}

/** "1.234,56" ya da "1234.56" → sayı */
export const toNum = (s: string | undefined) => {
  if (!s) return 0
  let t = s.replace(/\s/g, '')
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '')
  const n = parseFloat(t)
  return isFinite(n) ? n : 0
}
export const toDay = (s: string) => Math.min(31, Math.max(1, Math.round(toNum(s)) || 1))

export function Ring({ value, size = 168, children }: { value: number; size?: number; children?: ReactNode }) {
  const r = size / 2 - 12
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5eead4" />
            <stop offset="1" stopColor="#a78bfa" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#ffffff12" strokeWidth="12" fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring)"
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * v} ${c}`}
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  )
}

export function Bar({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-white/8 ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-mint to-lilac"
        style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, transition: 'width .8s ease' }}
      />
    </div>
  )
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="flex rounded-2xl border border-line bg-white/5 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded-xl px-1 py-2 text-[13px] font-medium whitespace-nowrap transition ${value === o.value ? 'bg-white/12 text-white shadow' : 'text-mute'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rise mt-6">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold tracking-wide text-mute uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function AddBtn({ onClick, label = 'Ekle' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="rounded-full bg-mint/15 px-3 py-1 text-sm font-medium text-mint">
      + {label}
    </button>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="glass p-5 text-center text-sm text-mute">{children}</div>
}

const COLORS = ['#5eead4', '#a78bfa', '#fcd34d', '#fda4af', '#93c5fd', '#86efac']
export function Confetti() {
  const party = useParty()
  if (!party) return null
  return (
    <div key={party.key} className="pointer-events-none fixed inset-0 z-[60] overflow-hidden">
      {Array.from({ length: 36 }).map((_, i) => (
        <span
          key={i}
          className="absolute top-0 block h-3 w-2 rounded-sm"
          style={{
            left: `${(i * 37) % 100}%`,
            background: COLORS[i % COLORS.length],
            animation: `fall ${1.6 + (i % 5) * 0.3}s ${(i % 7) * 0.08}s ease-in forwards`,
          }}
        />
      ))}
      <div className="absolute inset-x-6 top-[38%] flex justify-center">
        <div className="glass bg-panel/90 px-5 py-4 text-center text-base font-semibold" style={{ animation: 'pop 3.2s ease forwards' }}>
          {party.msg}
        </div>
      </div>
    </div>
  )
}
