import Link from "next/link"
import { MODELS } from "@/lib/models"
import { runDCF } from "@/lib/dcf-engine"
import { META_MODELS } from "@/lib/meta-models"
import { runMetaDCF } from "@/lib/meta-dcf-engine"

export const revalidate = 300 // refresh every 5 minutes

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
  // Fetch EUR/USD rate once for all EUR-denominated models
  const eurUsd = await yahooPrice("EURUSD=X")
  const fx = eurUsd ?? 1.08

  // Build adjusted models with live FX conversion
  const adjustedModels = await Promise.all(
    MODELS.map(async m => {
      const livePrice = await yahooPrice(m.ticker)
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
    })
  )

  // Fetch META live price (USD, no FX conversion needed)
  const metaLivePrice = await yahooPrice("META")
  const adjustedMetaModels = META_MODELS.map(m =>
    metaLivePrice ? { ...m, currentPrice: metaLivePrice } : m
  )

  const totalModels = adjustedModels.length + adjustedMetaModels.length

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
        {totalModels} {totalModels === 1 ? "Model" : "Models"}
      </div>

      <div className="model-grid">
        {adjustedModels.map(m => {
          const result = runDCF(m, "base", m.waccDefault, m.termGrowth)
          const upSign = result.updown > 0 ? "+" : ""
          const upCol  = result.updown > 0 ? "var(--green)" : "var(--red)"
          const curr   = m.currency === "EUR" ? "€" : m.currency === "GBP" ? "£" : "$"

          return (
            <Link key={m.slug} href={`/models/${m.slug}`} className="model-card">
              <div className="model-card-top">
                <span
                  className="model-card-ticker"
                  style={{ color: m.accentColor ?? "var(--accent)" }}
                >
                  {m.ticker}
                </span>
                <span className="model-card-exchange">{m.exchange}</span>
              </div>
              <div className="model-card-name">{m.name}</div>
              <div className="model-card-desc">{m.description}</div>
              <div className="model-card-footer">
                <span>
                  Base IV:{" "}
                  <strong style={{ color: "var(--text-1)" }}>
                    {curr}{Math.round(result.perShare)}
                  </strong>
                  {" "}
                  <span style={{ color: upCol }}>
                    ({upSign}{result.updown.toFixed(1)}%)
                  </span>
                </span>
                <span>Updated {m.lastUpdated}</span>
              </div>
              <div className="model-card-cagr" style={{ color: upCol }}>
                10-yr CAGR: {result.impliedCAGR > 0 ? "+" : ""}{(result.impliedCAGR * 100).toFixed(1)}%
              </div>
            </Link>
          )
        })}

        {adjustedMetaModels.map(m => {
          const result = runMetaDCF(m, "base", m.waccDefault, m.termGrowth, m.roicDefault)
          const upSign = result.updown > 0 ? "+" : ""
          const upCol  = result.updown > 0 ? "var(--green)" : "var(--red)"

          return (
            <Link key={m.slug} href={`/models/${m.slug}`} className="model-card">
              <div className="model-card-top">
                <span
                  className="model-card-ticker"
                  style={{ color: m.accentColor ?? "var(--accent)" }}
                >
                  {m.ticker}
                </span>
                <span className="model-card-exchange">{m.exchange}</span>
              </div>
              <div className="model-card-name">{m.name}</div>
              <div className="model-card-desc">{m.description}</div>
              <div className="model-card-footer">
                <span>
                  Base IV:{" "}
                  <strong style={{ color: "var(--text-1)" }}>
                    ${Math.round(result.perShare)}
                  </strong>
                  {" "}
                  <span style={{ color: upCol }}>
                    ({upSign}{result.updown.toFixed(1)}%)
                  </span>
                </span>
                <span>Updated {m.lastUpdated}</span>
              </div>
              <div className="model-card-cagr" style={{ color: upCol }}>
                10-yr CAGR: {result.impliedCAGR > 0 ? "+" : ""}{(result.impliedCAGR * 100).toFixed(1)}%
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
