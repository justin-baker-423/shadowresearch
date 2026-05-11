import type { Metadata } from "next"
import "./globals.css"
import Sidebar from "@/components/Sidebar"
import { MODELS } from "@/lib/models"
import { META_MODELS } from "@/lib/meta-models"
import { TESLA_MODELS } from "@/lib/tesla-models"
import { LEMONADE_MODELS } from "@/lib/lemonade-models"
import { DEERE_MODELS } from "@/lib/deere-models"
import { CELSIUS_MODELS } from "@/lib/celsius-models"
import { SNOWFLAKE_MODELS } from "@/lib/snowflake-models"
import { ATLASSIAN_MODELS } from "@/lib/atlassian-models"
import { NIKE_MODELS } from "@/lib/nike-models"
import { TSM_MODELS } from "@/lib/tsm-models"
import { runDCF } from "@/lib/dcf-engine"
import { runMetaDCF } from "@/lib/meta-dcf-engine"
import { runTeslaDCF } from "@/lib/tesla-engine"
import { runLemonadeDCF } from "@/lib/lemonade-engine"
import { runDeereDCF } from "@/lib/deere-engine"
import { runSnowflakeDCF } from "@/lib/snowflake-engine"
import { runAtlassianDCF } from "@/lib/atlassian-engine"
import { runNikeDCF } from "@/lib/nike-engine"

export const metadata: Metadata = {
  title: "Shadow Research",
  description: "Private equity research — discounted cash flow models",
}

async function yahooPrice(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        next: { revalidate: 300 },
      }
    )
    if (!res.ok) return null
    const json = await res.json()
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice
    return typeof price === "number" ? price : null
  } catch {
    return null
  }
}

type SidebarItem = {
  slug: string; ticker: string; name: string; sector: string
  accentColor?: string; cagr: number; extraInfo?: string
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Fetch all unique tickers in parallel. Next.js deduplicates fetch() calls
  // with the same URL within a render pass, so model pages won't double-fetch.
  const allTickers = [
    ...MODELS.map(m => m.ticker),
    ...META_MODELS.map(m => m.ticker),
    ...TESLA_MODELS.map(m => m.ticker),
    ...LEMONADE_MODELS.map(m => m.ticker),
    ...DEERE_MODELS.map(m => m.ticker),
    ...CELSIUS_MODELS.map(m => m.ticker),
    ...SNOWFLAKE_MODELS.map(m => m.ticker),
    ...ATLASSIAN_MODELS.map(m => m.ticker),
    ...NIKE_MODELS.map(m => m.ticker),
    ...TSM_MODELS.map(m => m.ticker),
    'EURUSD=X',
  ]
  const uniqueTickers = [...new Set(allTickers)]

  const priceResults = await Promise.all(uniqueTickers.map(t => yahooPrice(t)))
  const prices = new Map(uniqueTickers.map((t, i) => [t, priceResults[i]]))
  const fx = prices.get('EURUSD=X') ?? 1.08

  const items: SidebarItem[] = []

  for (const m of MODELS) {
    const livePrice = prices.get(m.ticker)
    const adj = m.currency === 'EUR'
      ? { ...m, currency: 'USD' as const, currentPrice: livePrice ?? parseFloat((m.currentPrice * fx).toFixed(2)), baseRevenue: parseFloat((m.baseRevenue * fx).toFixed(1)), netCash: parseFloat((m.netCash * fx).toFixed(2)) }
      : livePrice ? { ...m, currentPrice: livePrice } : m
    const r = runDCF(adj, "base", adj.waccDefault, adj.termGrowth)
    items.push({ slug: m.slug, ticker: m.ticker, name: m.name, sector: m.sector, accentColor: m.accentColor, cagr: r.impliedCAGR })
  }

  for (const m of META_MODELS) {
    const adj = prices.get(m.ticker) ? { ...m, currentPrice: prices.get(m.ticker)! } : m
    const r = runMetaDCF(adj, "base", adj.waccDefault, adj.termGrowth, adj.roicDefault)
    items.push({ slug: m.slug, ticker: m.ticker, name: m.name, sector: m.sector, accentColor: m.accentColor, cagr: r.impliedCAGR })
  }

  for (const m of TESLA_MODELS) {
    const adj = prices.get(m.ticker) ? { ...m, currentPrice: prices.get(m.ticker)! } : m
    const r = runTeslaDCF(adj, adj.waccDefault, adj.termGrowth)
    items.push({ slug: m.slug, ticker: m.ticker, name: m.name, sector: m.sector, accentColor: m.accentColor, cagr: r.impliedCAGR })
  }

  for (const m of LEMONADE_MODELS) {
    const adj = prices.get(m.ticker) ? { ...m, currentPrice: prices.get(m.ticker)! } : m
    const r = runLemonadeDCF(adj, adj.lossRatioDefault, adj.termGrowth)
    items.push({ slug: m.slug, ticker: m.ticker, name: m.name, sector: m.sector, accentColor: m.accentColor, cagr: r.impliedCAGR })
  }

  for (const m of DEERE_MODELS) {
    const adj = prices.get(m.ticker) ? { ...m, currentPrice: prices.get(m.ticker)! } : m
    const r = runDeereDCF(adj, "base", adj.subPctDefault, adj.waccDefault, adj.termGrowth)
    items.push({
      slug: m.slug, ticker: m.ticker, name: m.name, sector: m.sector, accentColor: m.accentColor,
      cagr: r.impliedCAGR,
      extraInfo: `+ ${(r.avgDivYield15xPE * 100).toFixed(1)}% Div`,
    })
  }

  for (const m of CELSIUS_MODELS) {
    const adj = prices.get(m.ticker) ? { ...m, currentPrice: prices.get(m.ticker)! } : m
    const r = runDCF(adj, "base", adj.waccDefault, adj.termGrowth)
    items.push({ slug: m.slug, ticker: m.ticker, name: m.name, sector: m.sector, accentColor: m.accentColor, cagr: r.impliedCAGR })
  }

  for (const m of ATLASSIAN_MODELS) {
    const adj = prices.get(m.ticker) ? { ...m, currentPrice: prices.get(m.ticker)! } : m
    const r = runAtlassianDCF(adj, "base", adj.waccDefault, adj.exitMultipleDefault)
    items.push({ slug: m.slug, ticker: m.ticker, name: m.name, sector: m.sector, accentColor: m.accentColor, cagr: r.impliedCAGR })
  }

  for (const m of SNOWFLAKE_MODELS) {
    const adj = prices.get(m.ticker) ? { ...m, currentPrice: prices.get(m.ticker)! } : m
    const r = runSnowflakeDCF(adj, "base", adj.waccDefault, adj.exitMultipleDefault)
    items.push({ slug: m.slug, ticker: m.ticker, name: m.name, sector: m.sector, accentColor: m.accentColor, cagr: r.impliedCAGR })
  }

  for (const m of NIKE_MODELS) {
    const adj = prices.get(m.ticker) ? { ...m, currentPrice: prices.get(m.ticker)! } : m
    const r = runNikeDCF(adj, "base", adj.waccDefault, adj.termGrowth)
    items.push({
      slug: m.slug, ticker: m.ticker, name: m.name, sector: m.sector, accentColor: m.accentColor,
      cagr: r.impliedCAGR,
      extraInfo: `+ ${(r.avgDivYield * 100).toFixed(1)}% Div`,
    })
  }

  for (const m of TSM_MODELS) {
    const adj = prices.get(m.ticker) ? { ...m, currentPrice: prices.get(m.ticker)! } : m
    const r = runDCF(adj, "base", adj.waccDefault, adj.termGrowth)
    items.push({ slug: m.slug, ticker: m.ticker, name: m.name, sector: m.sector, accentColor: m.accentColor, cagr: r.impliedCAGR })
  }

  items.sort((a, b) => b.cagr - a.cagr)

  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <Sidebar models={items} />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
