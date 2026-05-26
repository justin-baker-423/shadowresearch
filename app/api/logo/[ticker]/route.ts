// Logo proxy — fetches company logos server-side so:
// 1. Same-origin responses work in canvas (no CORS tainting)
// 2. Responses are cached at the CDN / Next.js edge layer
// 3. We can swap logo sources without touching client code

import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import path from 'path'

// Ticker → primary domain (keep in sync with lib/portfolio/logos.ts)
const TICKER_DOMAINS: Record<string, string> = {
  TSM:  'tsmc.com',
  META: 'meta.com',
  TSLA: 'tesla.com',
  SNOW: 'snowflake.com',
  DE:   'deere.com',
  CELH: 'celsius.com',
  CVX:  'chevron.com',
  CMG:  'chipotle.com',
  LMND: 'lemonade.com',
  COIN: 'coinbase.com',
  TEAM: 'atlassian.com',
  PLTR: 'palantir.com',
  RIVN: 'rivian.com',
  QQQ:  'invesco.com',
  GOOGL: 'google.com',
  AAPL: 'apple.com',
  MSFT: 'microsoft.com',
  AMZN: 'amazon.com',
  NVDA: 'nvidia.com',
  FIG:  'figma.com',
  SAP:  'sap.com',
  NKE:  'nike.com',
  QXO:  'qxo.com',
  FICO: 'fico.com',
  HD:   'homedepot.com',
}

const CACHE_SECONDS = 60 * 60 * 24   // 24 h

async function tryFetch(url: string): Promise<{ buf: ArrayBuffer; ct: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      // Next.js 14 fetch caching — revalidate after 24 h
      next: { revalidate: CACHE_SECONDS },
    })
    const ct = res.headers.get('content-type') ?? ''
    if (res.ok && ct.startsWith('image/') && ct !== 'image/gif') {
      const buf = await res.arrayBuffer()
      // Reject suspiciously small images (Clearbit 1×1 fallback is ~68 bytes)
      if (buf.byteLength > 200) return { buf, ct }
    }
  } catch { /* try next source */ }
  return null
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  const { ticker: rawTicker } = await params
  const ticker = rawTicker.toUpperCase()

  // Static override: drop a file at public/logos/<TICKER>.{png,svg,jpg} to bypass all external sources
  for (const ext of ['png', 'svg', 'jpg', 'webp']) {
    try {
      const filePath = path.join(process.cwd(), 'public', 'logos', `${ticker}.${ext}`)
      const buf = await readFile(filePath)
      const ct = ext === 'svg' ? 'image/svg+xml' : ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
      return new NextResponse(buf, {
        headers: {
          'Content-Type':                ct,
          'Cache-Control':               `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600`,
          'Access-Control-Allow-Origin': '*',
        },
      })
    } catch { /* file not found, try next */ }
  }

  const domain = TICKER_DOMAINS[ticker]
  if (!domain) return new NextResponse(null, { status: 404 })

  const sources = [
    `https://logo.clearbit.com/${domain}?size=128`,
    `https://img.logo.dev/${domain}?token=pk_X-1ZO13GSgeOoUrIuJ6BeQ`,  // logo.dev free tier
    `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=https://${domain}&size=128`,
    `https://financialmodelingprep.com/image-stock/${ticker}.png`,      // FMP — covers all NYSE/NASDAQ tickers
    `https://logo.twelvedata.com/${ticker.toLowerCase()}.png`,          // Twelve Data stock logos
    `https://${domain}/apple-touch-icon.png`,
    `https://${domain}/favicon-32x32.png`,
    `https://${domain}/favicon.ico`,
  ]

  for (const url of sources) {
    const result = await tryFetch(url)
    if (result) {
      return new NextResponse(result.buf, {
        headers: {
          'Content-Type':                result.ct,
          'Cache-Control':               `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=3600`,
          'Access-Control-Allow-Origin': '*',
        },
      })
    }
  }

  return new NextResponse(null, { status: 404 })
}
