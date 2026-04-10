import Link from "next/link"
import ModelLogo from "@/components/ModelLogo"
import { MODELS } from "@/lib/models"
import { runDCF } from "@/lib/dcf-engine"
import { META_MODELS } from "@/lib/meta-models"
import { runMetaDCF } from "@/lib/meta-dcf-engine"
import { TESLA_MODELS } from "@/lib/tesla-models"
import { runTeslaDCF } from "@/lib/tesla-engine"
import { LEMONADE_MODELS } from "@/lib/lemonade-models"
import { runLemonadeDCF } from "@/lib/lemonade-engine"
import { DEERE_MODELS } from "@/lib/deere-models"
import { runDeereDCF } from "@/lib/deere-engine"
import { CELSIUS_MODELS } from "@/lib/celsius-models"
import { SNOWFLAKE_MODELS } from "@/lib/snowflake-models"
import { runSnowflakeDCF } from "@/lib/snowflake-engine"

export const revalidate = 300 // refresh every 5 minutes

type CardEntry = {
  slug: string
  ticker: string
  name: string
  description: string
  lastUpdated: string
  accentColor?: string
  exchange: string
  currency: string
  cagr: number
  updown: number
  intrinsicPerShare: number
  labelIV: string
  extraLine?: string
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

export default async function Home() {
  const eurUsd = await yahooPrice("EURUSD=X")
  const fx = eurUsd ?? 1.08

  const cards: CardEntry[] = []

  // ── Standard models (SAP, CMG) ──────────────────────────────
  await Promise.all(
    MODELS.map(async m => {
      const livePrice = await yahooPrice(m.ticker)
      const adj = (() => {
        if (m.currency === "EUR") {
          return {
            ...m,
            currency:     "USD" as const,
            currentPrice: livePrice ?? parseFloat((m.currentPrice * fx).toFixed(2)),
            baseRevenue:  parseFloat((m.baseRevenue * fx).toFixed(1)),
            netCash:      parseFloat((m.netCash * fx).toFixed(2)),
          }
        }
        return livePrice ? { ...m, currentPrice: livePrice } : m
      })()
      const result = runDCF(adj, "base", adj.waccDefault, adj.termGrowth)
      const curr = adj.currency === "EUR" ? "€" : adj.currency === "GBP" ? "£" : "$"
      cards.push({
        slug: m.slug, ticker: m.ticker, name: m.name, description: m.description,
        lastUpdated: m.lastUpdated, accentColor: m.accentColor,
        exchange: m.exchange ?? "", currency: curr,
        cagr: result.impliedCAGR, updown: result.updown,
        intrinsicPerShare: result.perShare, labelIV: "Base IV",
      })
    })
  )

  // ── Capex-Adjusted NOPAT models (Meta) ───────────────────────
  await Promise.all(
    META_MODELS.map(async m => {
      const livePrice = await yahooPrice(m.ticker)
      const adj = livePrice ? { ...m, currentPrice: livePrice } : m
      const result = runMetaDCF(adj, "base", adj.waccDefault, adj.termGrowth, adj.roicDefault)
      cards.push({
        slug: m.slug, ticker: m.ticker, name: m.name, description: m.description,
        lastUpdated: m.lastUpdated, accentColor: m.accentColor,
        exchange: m.exchange ?? "", currency: "$",
        cagr: result.impliedCAGR, updown: result.updown,
        intrinsicPerShare: result.perShare, labelIV: "Base IV",
      })
    })
  )

  // ── Tesla multi-segment models ────────────────────────────────
  await Promise.all(
    TESLA_MODELS.map(async m => {
      const livePrice = await yahooPrice(m.ticker)
      const adj = livePrice ? { ...m, currentPrice: livePrice } : m
      const result = runTeslaDCF(adj, adj.waccDefault, adj.termGrowth)
      cards.push({
        slug: m.slug, ticker: m.ticker, name: m.name, description: m.description,
        lastUpdated: m.lastUpdated, accentColor: m.accentColor,
        exchange: m.exchange ?? "", currency: "$",
        cagr: result.impliedCAGR, updown: result.updown,
        intrinsicPerShare: result.perShare, labelIV: "Bull IV",
      })
    })
  )

  // ── Lemonade IFP-driven models ────────────────────────────────
  await Promise.all(
    LEMONADE_MODELS.map(async m => {
      const livePrice = await yahooPrice(m.ticker)
      const adj = livePrice ? { ...m, currentPrice: livePrice } : m
      const result = runLemonadeDCF(adj, adj.waccDefault, adj.termGrowth)
      cards.push({
        slug: m.slug, ticker: m.ticker, name: m.name, description: m.description,
        lastUpdated: m.lastUpdated, accentColor: m.accentColor,
        exchange: m.exchange ?? "", currency: "$",
        cagr: result.impliedCAGR, updown: result.updown,
        intrinsicPerShare: result.perShare, labelIV: "Base IV",
      })
    })
  )

  // ── Deere Ag Cycle + Mix-Shift models ────────────────────────
  await Promise.all(
    DEERE_MODELS.map(async m => {
      const livePrice = await yahooPrice(m.ticker)
      const adj = livePrice ? { ...m, currentPrice: livePrice } : m
      const result = runDeereDCF(adj, "base", adj.subPctDefault, adj.waccDefault, adj.termGrowth)
      cards.push({
        slug: m.slug, ticker: m.ticker, name: m.name, description: m.description,
        lastUpdated: m.lastUpdated, accentColor: m.accentColor,
        exchange: m.exchange ?? "", currency: "$",
        cagr: result.impliedCAGR, updown: result.updown,
        intrinsicPerShare: result.intrinsicPerShare, labelIV: "Base IV",
        extraLine: `Avg div yield: ${(result.avgDivYield15xPE * 100).toFixed(1)}% (15× P/E)`,
      })
    })
  )

  // ── Celsius Holdings ──────────────────────────────────────────
  await Promise.all(
    CELSIUS_MODELS.map(async m => {
      const livePrice = await yahooPrice(m.ticker)
      const adj = livePrice ? { ...m, currentPrice: livePrice } : m
      const result = runDCF(adj, "base", adj.waccDefault, adj.termGrowth)
      cards.push({
        slug: m.slug, ticker: m.ticker, name: m.name, description: m.description,
        lastUpdated: m.lastUpdated, accentColor: m.accentColor,
        exchange: m.exchange ?? "", currency: "$",
        cagr: result.impliedCAGR, updown: result.updown,
        intrinsicPerShare: result.perShare, labelIV: "Base IV",
      })
    })
  )

  // ── Snowflake consumption-model FCF DCF ──────────────────────
  await Promise.all(
    SNOWFLAKE_MODELS.map(async m => {
      const livePrice = await yahooPrice(m.ticker)
      const adj = livePrice ? { ...m, currentPrice: livePrice } : m
      const result = runSnowflakeDCF(adj, "base", adj.waccDefault, adj.exitMultipleDefault)
      cards.push({
        slug: m.slug, ticker: m.ticker, name: m.name, description: m.description,
        lastUpdated: m.lastUpdated, accentColor: m.accentColor,
        exchange: m.exchange ?? "", currency: "$",
        cagr: result.impliedCAGR, updown: result.updown,
        intrinsicPerShare: result.perShare, labelIV: "Base IV",
      })
    })
  )

  // Sort all cards by implied CAGR descending
  cards.sort((a, b) => b.cagr - a.cagr)

  return (
    <div className="landing">
      <div className="landing-hero">
        <h1>Shadow Research</h1>
        <p>
          Discounted cash flow models built from first principles.
          Each model is interactive — adjust WACC, terminal growth, and
          scenario assumptions using the sliders inside.
        </p>
      </div>

      <div className="section-label" style={{ marginBottom: 14 }}>
        {cards.length} {cards.length === 1 ? "Model" : "Models"}
      </div>

      <div className="model-grid">
        {cards.map(c => {
          const upSign = c.updown > 0 ? "+" : ""
          const upCol  = c.updown > 0 ? "var(--green)" : "var(--red)"
          return (
            <Link key={c.slug} href={`/models/${c.slug}`} className="model-card">
              <div className="model-card-top">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <ModelLogo ticker={c.ticker} accentColor={c.accentColor} size={24} />
                  <span className="model-card-ticker" style={{ color: c.accentColor ?? "var(--accent)" }}>
                    {c.ticker}
                  </span>
                </div>
                <span className="model-card-exchange">{c.exchange}</span>
              </div>
              <div className="model-card-name">{c.name}</div>
              <div className="model-card-desc">{c.description}</div>
              <div className="model-card-footer">
                <span>
                  {c.labelIV}:{" "}
                  <strong style={{ color: "var(--text-1)" }}>
                    {c.currency}{Math.round(c.intrinsicPerShare).toLocaleString()}
                  </strong>
                  {" "}
                  <span style={{ color: upCol }}>
                    ({upSign}{c.updown.toFixed(1)}%)
                  </span>
                </span>
                <span>Updated {c.lastUpdated}</span>
              </div>
              <div className="model-card-cagr" style={{ color: upCol }}>
                10-yr CAGR: {c.cagr > 0 ? "+" : ""}{(c.cagr * 100).toFixed(1)}%
              </div>
              {c.extraLine && (
                <div className="model-card-cagr" style={{ color: c.accentColor ?? "var(--accent)", marginTop: 2 }}>
                  {c.extraLine}
                </div>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
