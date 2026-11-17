import { useEffect, useState } from 'react'
import { useLoaded } from './store'
import { Confetti } from './ui'
import { connect, useSync } from './sync'
import { LockScreen, useLocked } from './lock'
import { Home } from './screens/Home'
import { Debts } from './screens/Debts'
import { Expenses } from './screens/Expenses'
import { Upcoming } from './screens/Upcoming'
import { Analysis } from './screens/Analysis'
import { Settings } from './screens/Settings'

export type Tab = 'home' | 'debts' | 'expenses' | 'upcoming' | 'analysis' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Özet', icon: 'M3 12l9-8 9 8M5 10v10h14V10' },
  { id: 'debts', label: 'Borçlar', icon: 'M3 7h18v10H3zM3 11h18' },
  { id: 'upcoming', label: 'Takvim', icon: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4' },
  { id: 'expenses', label: 'Giderler', icon: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6' },
  { id: 'analysis', label: 'Analiz', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2' },
]

const TITLES: Record<Tab, string> = {
  home: 'Borç Pusulası',
  debts: 'Borçlar',
  expenses: 'Giderler',
  upcoming: 'Yaklaşan ödemeler',
  analysis: 'Analiz',
  settings: 'Ayarlar',
}

export default function App() {
  const loaded = useLoaded()
  const [tab, setTab] = useState<Tab>('home')
  const sync = useSync()
  const locked = useLocked()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [tab])
  if (locked) return <LockScreen />
  if (!loaded) return null
  return (
    <div className="mx-auto min-h-screen max-w-lg px-4 pt-[calc(env(safe-area-inset-top)+14px)] pb-[calc(env(safe-area-inset-bottom)+96px)]">
      <header className="mb-4 flex items-center justify-between">
        <h1 className={`text-2xl font-bold ${tab === 'home' ? 'grad-text' : ''}`}>{TITLES[tab]}</h1>
        <div className="flex items-center gap-2">
        {sync.status === 'auth' && (
          <button onClick={connect} className="rounded-full bg-sun/15 px-3 py-1.5 text-xs font-semibold text-sun">☁️ Eşitle</button>
        )}
        <button onClick={() => setTab(tab === 'settings' ? 'home' : 'settings')} className="rounded-full bg-white/6 p-2 text-mute" aria-label="Ayarlar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
          </svg>
        </button>
        </div>
      </header>

      <main key={tab}>
        {tab === 'home' && <Home go={setTab} />}
        {tab === 'debts' && <Debts />}
        {tab === 'expenses' && <Expenses />}
        {tab === 'upcoming' && <Upcoming />}
        {tab === 'analysis' && <Analysis />}
        {tab === 'settings' && <Settings />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] ${tab === t.id ? 'text-mint' : 'text-mute'}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={t.icon} />
              </svg>
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      <Confetti />
    </div>
  )
}
