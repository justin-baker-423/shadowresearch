import Link from "next/link"
import { MODELS } from "@/lib/models"
import { runDCF } from "@/lib/dcf-engine"

export default function Home() {
  return (
    <div className="landing">
      <div className="landing-hero">
        <h1>DCF Research</h1>
        <p>
          Discounted cash flow models built from first principles.
          Each model is interactive — adjust WACC, terminal growth, and
          scenario assumptions using the sliders inside.
        </p>
      </div>

      <div className="section-label" style={{ marginBottom: 14 }}>
        {MODELS.length} {MODELS.length === 1 ? "Model" : "Models"}
      </div>

      <div className="model-grid">
        {MODELS.map(m => {
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
            </Link>
          )
        })}
      </div>
    </div>
  )
}
