const GRAM_PER_OZ = 31.1034768

const parse = (v: unknown): number => {
  if (typeof v === 'number') return v
  if (typeof v !== 'string') return NaN
  let s = v.replace(/[^\d.,]/g, '')
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.')
  return parseFloat(s)
}

async function getJson(url: string) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store' })
    if (!r.ok) throw new Error(String(r.status))
    return await r.json()
  } finally {
    clearTimeout(t)
  }
}

function pick(o: Record<string, unknown> | undefined): number {
  if (!o) return NaN
  for (const k of ['Selling', 'Satış', 'satis', 'selling']) {
    const n = parse(o[k])
    if (n > 0) return n
  }
  return NaN
}

/** Önce Türkiye piyasası (Truncgil), olmazsa uluslararası kaynaklardan hesaplar. */
export async function fetchRates(): Promise<{ usd: number; gold: number; source: string }> {
  for (const url of ['https://finans.truncgil.com/v4/today.json', 'https://finans.truncgil.com/today.json']) {
    try {
      const j = await getJson(url)
      const usd = pick(j.USD)
      const gold = pick(j.GRA ?? j['gram-altin'])
      if (usd > 0 && gold > 0) return { usd, gold, source: 'Truncgil' }
    } catch {
      /* sonraki kaynak */
    }
  }
  const fx = await getJson('https://open.er-api.com/v6/latest/USD')
  const usd = Number(fx?.rates?.TRY)
  const xau = await getJson('https://api.gold-api.com/price/XAU')
  const gold = (Number(xau?.price) / GRAM_PER_OZ) * usd
  if (!(usd > 0 && gold > 0)) throw new Error('kur alınamadı')
  return { usd, gold, source: 'Uluslararası (ons → gram)' }
}
