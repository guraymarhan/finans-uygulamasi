import { useRef, useState } from 'react'
import { refreshRates, replaceAll, update, useData } from '../store'
import { num, tl, today } from '../calc'
import { Form, Section, Sheet, toNum } from '../ui'
import type { Data } from '../types'
import { CLIENT_ID, connect, disconnect, syncNow, useSync } from '../sync'

export function Settings() {
  const d = useData()
  const [rateEdit, setRateEdit] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const file = useRef<HTMLInputElement>(null)

  const exportData = async () => {
    const name = `borc-pusulasi-yedek-${today()}.json`
    const blob = new Blob([JSON.stringify(d, null, 1)], { type: 'application/json' })
    const f = new File([blob], name, { type: 'application/json' })
    if (navigator.canShare?.({ files: [f] })) {
      try {
        await navigator.share({ files: [f], title: name })
        return
      } catch {
        /* iptal */
      }
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    a.click()
  }

  const importData = async (fl: File) => {
    try {
      const j = JSON.parse(await fl.text()) as Data
      if (!Array.isArray(j.cards) || !Array.isArray(j.snapshots)) throw new Error()
      if (confirm('Mevcut veriler bu yedekle değiştirilsin mi?')) {
        replaceAll(j)
        setMsg('Yedek geri yüklendi ✓')
      }
    } catch {
      setMsg('Dosya okunamadı. Uygulamadan alınmış bir yedek seç.')
    }
  }

  return (
    <div>
      <Section title="Kurlar">
        <div className="glass divide-y divide-line">
          <Row label="1 Dolar" value={d.rates.usd ? tl(d.rates.usd, 2) : '—'} />
          <Row label="1 Gram altın" value={d.rates.gold ? tl(d.rates.gold, 2) : '—'} />
          <div className="px-4 py-3 text-xs text-mute">
            {d.rates.updatedAt ? `${new Date(d.rates.updatedAt).toLocaleString('tr-TR')} · ${d.rates.source}` : 'Henüz kur alınmadı.'}
          </div>
          <div className="flex gap-2 p-3">
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                const ok = await refreshRates()
                setBusy(false)
                setMsg(ok ? 'Kurlar güncellendi ✓' : 'Kur alınamadı, son bilinen değer kullanılıyor. Elle girebilirsin.')
              }}
              className="flex-1 rounded-xl bg-white/6 py-2.5 text-sm text-mint"
            >
              {busy ? 'Alınıyor…' : 'Şimdi güncelle'}
            </button>
            <button onClick={() => setRateEdit(true)} className="flex-1 rounded-xl bg-white/6 py-2.5 text-sm">Elle gir</button>
          </div>
        </div>
      </Section>

      <Section title="Tahmin ayarları">
        <div className="glass p-4">
          <Form
            key={d.settings.personMonthly + '-' + d.settings.extraMonthly}
            fields={[
              { key: 'personMonthly', label: 'Kişisel borçlara aylık ayırdığım (₺)', type: 'number' },
              { key: 'extraMonthly', label: 'Hedef ekstra aylık ödeme (₺)', type: 'number' },
            ]}
            initial={d.settings}
            onSubmit={(v) => {
              update((x) => {
                x.settings.personMonthly = toNum(v.personMonthly)
                x.settings.extraMonthly = toNum(v.extraMonthly)
              })
              setMsg('Kaydedildi ✓')
            }}
          />
        </div>
      </Section>

      <DriveSync />

      <Section title="Yedek">
        <div className="glass p-4 text-sm text-mute">
          Drive eşitlemesi açık olsa da ayda bir yedek dosyası alman iyi olur. Yedek al'a basınca açılan menüden Drive'a kaydedebilirsin.
          <div className="mt-3 flex gap-2">
            <button onClick={exportData} className="btn-primary flex-1 text-sm">Yedek al</button>
            <button onClick={() => file.current?.click()} className="flex-1 rounded-2xl bg-white/6 py-3 text-sm text-white">Yedeği yükle</button>
          </div>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
        </div>
      </Section>

      <Section title="Telefona kurulum">
        <div className="glass p-4 text-sm leading-relaxed text-mute">
          Safari'de bu sayfayı açıp alttaki <b className="text-white">Paylaş</b> düğmesine, sonra <b className="text-white">Ana Ekrana Ekle</b>'ye dokun. Uygulama simgesiyle tam ekran açılır, internet olmadan da çalışır.
        </div>
      </Section>

      {msg && (
        <div className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+90px)] z-40 mx-auto max-w-md" onClick={() => setMsg('')}>
          <div className="glass bg-panel/95 px-4 py-3 text-center text-sm">{msg}</div>
        </div>
      )}

      <Sheet open={rateEdit} onClose={() => setRateEdit(false)} title="Kurları elle gir">
        <Form
          fields={[
            { key: 'usd', label: '1 Dolar (₺)', type: 'number', required: true },
            { key: 'gold', label: '1 Gram altın (₺)', type: 'number', required: true },
          ]}
          initial={{ usd: num(d.rates.usd, 4), gold: num(d.rates.gold, 2) }}
          onSubmit={(v) => {
            update((x) => {
              x.rates = { usd: toNum(v.usd), gold: toNum(v.gold), updatedAt: new Date().toISOString(), source: 'Elle girildi' }
            })
            setRateEdit(false)
          }}
        />
      </Sheet>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-4 py-3 text-sm">
      <span className="text-mute">{label}</span>
      <span className="tnum font-semibold">{value}</span>
    </div>
  )
}

function DriveSync() {
  const s = useSync()
  const btn = 'flex-1 rounded-2xl bg-white/6 py-3 text-sm text-white'
  let line = ''
  if (s.status === 'syncing') line = 'Eşitleniyor…'
  else if (s.status === 'auth') line = 'Google oturumunun süresi doldu. Devam etmek için bir kez dokun.'
  else if (s.status === 'error') line = s.err || 'Eşitlenemedi.'
  else if (s.last) line = `Son eşitleme: ${new Date(s.last).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
  return (
    <Section title="Google Drive eşitleme">
      <div className="glass p-4 text-sm text-mute">
        {!CLIENT_ID ? (
          'Google bağlantısı henüz ayarlanmadı.'
        ) : !s.on ? (
          <>
            Telefon ve bilgisayar aynı verileri görsün. Veriler Google Drive'ında, yalnızca bu uygulamanın görebildiği gizli bir klasörde durur.
            <div className="mt-2 text-xs">Önce telefonda bağlan. Diğer cihazda bağlandığında Drive'daki veriler o cihaza gelir.</div>
            <button onClick={connect} className="btn-primary mt-3 w-full text-sm">Google ile bağlan</button>
            {s.err && <div className="mt-2 text-xs text-rose">{s.err}</div>}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${s.status === 'idle' ? 'bg-mint' : s.status === 'syncing' ? 'bg-sun' : 'bg-rose'}`} />
              <span className="text-white">Bağlı</span>
            </div>
            <div className="mt-1 text-xs">{line}</div>
            <div className="mt-3 flex gap-2">
              {s.status === 'auth' ? (
                <button onClick={connect} className="btn-primary flex-1 text-sm">Yeniden bağlan</button>
              ) : (
                <button onClick={() => syncNow()} className={btn}>Şimdi eşitle</button>
              )}
              <button onClick={() => confirm('Drive bağlantısı kesilsin mi? Bu cihazdaki veriler silinmez.') && disconnect()} className={btn}>Bağlantıyı kes</button>
            </div>
          </>
        )}
      </div>
    </Section>
  )
}
