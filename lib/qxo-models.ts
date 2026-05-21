// ─────────────────────────────────────────────────────────────────
//  qxo-models.ts  —  Model configuration for QXO, Inc. (NYSE: QXO)
//
//  Engine: NOPAT-based UFCF bridge
//    FCF = NOPAT + D&A − CapEx − ΔWC
//    D&A = CapEx = 1.5% revenue → net capex ≈ 0; simplifies to NOPAT − ΔWC
//    EBITDA margin expands linearly from startMargin over yrsExpansion years
//
//  Revenue base: $18.1B pro forma (Beacon + Kodiak + TopBuild close Q3 2026E)
//  Scenarios differ only in annual revenue growth and total margin expansion.
// ─────────────────────────────────────────────────────────────────

export type QxoScenario = "bear" | "base" | "bull"

export interface QxoScenarioConfig {
  description:  string
  revGrowth:    number   // annual revenue growth (decimal)
  totalExpBps:  number   // total Adj EBITDA margin expansion over yrsExpansion years
}

export interface QxoModelConfig {
  slug:         string
  ticker:       string
  name:         string
  exchange:     string
  sector:       string
  description:  string
  lastUpdated:  string

  currentPrice: number   // fallback; overridden by live Yahoo fetch
  baseRevenue:  number   // $B — 2026E pro forma (Beacon + Kodiak + TopBuild)

  startMargin:  number   // starting blended Adj EBITDA margin (shared across scenarios)
  yrsExpansion: number   // years of linear margin expansion (Years 1–N, stable after)
  daRate:       number   // D&A as % of revenue
  capexRate:    number   // CapEx as % of revenue (≈ daRate → net capex ≈ 0)
  nwcRate:      number   // NWC as % of revenue (ΔWC = nwcRate × ΔRev)
  taxRate:      number   // effective tax rate

  netDebt:      number   // $B — positive = net debt
  sharesOut:    number   // billions — fully diluted default (slider-overrideable)

  waccDefault:  number
  termGrowth:   number
  accentColor:  string

  scenarios: Record<QxoScenario, QxoScenarioConfig>
}

const QXO: QxoModelConfig = {
  slug:        "qxo",
  ticker:      "QXO",
  name:        "QXO, Inc.",
  exchange:    "NYSE",
  sector:      "Building Products Distribution",
  description: "Brad Jacobs roll-up · Beacon + Kodiak + TopBuild · ZBB margin expansion · $18B pro forma revenue",
  lastUpdated: "May 2026",

  currentPrice:  22.00,   // fallback; overridden by live Yahoo fetch
  baseRevenue:   18.1,    // 2026E pro forma: Beacon ~$9.0B + Kodiak ~$2.4B + TopBuild ~$6.2B + adj

  startMargin:   0.130,   // 13.0% blended starting Adj EBITDA margin
  yrsExpansion:  5,       // expansion in Years 1–5; margin stable in Years 6–10
  daRate:        0.015,   // 1.5% D&A as % of revenue (asset-light distribution)
  capexRate:     0.015,   // 1.5% CapEx ≈ D&A; maintenance only (no organic growth capex)
  nwcRate:       0.100,   // 10% NWC as % of revenue (standard for distribution)
  taxRate:       0.260,   // 26% per QXO Q3 2025 adjusted effective tax rate

  netDebt:       7.0,     // $7.0B net debt at TopBuild close (gross $9.1B − ~$2.1B cash)
  sharesOut:     1.724,   // 1,724M fully diluted (all preferred converted; see research context)

  waccDefault:   0.10,
  termGrowth:    0.030,
  accentColor:   "#1a5276",

  scenarios: {
    bear: {
      description: "Housing downturn · weak organic demand · limited margin improvement",
      revGrowth:   0.04,
      totalExpBps: 100,
    },
    base: {
      description: "Mid-single-digit organic growth · ZBB + vendor rebate scale unlocked",
      revGrowth:   0.06,
      totalExpBps: 200,
    },
    bull: {
      description: "Housing recovery + Jacobs playbook firing · aggressive margin expansion",
      revGrowth:   0.08,
      totalExpBps: 300,
    },
  },
}

export const QXO_MODELS: QxoModelConfig[] = [QXO]

export function getQxoModel(slug: string): QxoModelConfig | undefined {
  return QXO_MODELS.find(m => m.slug === slug)
}
