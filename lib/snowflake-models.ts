// ─────────────────────────────────────────────────────────────────
//  snowflake-models.ts  —  Consumption-model FCF DCF config.
//
//  Valuation framework:
//    FCF  = NOPAT + D&A − CapEx + ΔDeferred Revenue
//    NOPAT = non-GAAP EBIT × (1 − tax)
//    TV   = exitMultiple × FCF(FY36)
//    Equity = Σ PV(FCF) + PV(TV) + netCash
//
//  Deferred revenue mechanics:
//    Snowflake bills customers upfront on capacity contracts.
//    ΔDeferred = deferredRatio × prior_rev × rev_growth_rate
//    (deferredRatio held constant at 72% — FY26A deferred / revenue)
//
//  SBC & dilution:
//    SBC grows at the same rate as non-GAAP total costs.
//    sbcRatio = FY26A SBC / FY26A non-GAAP total costs = 38.1%
//    Gross new shares = SBC / (revMultiple × rev/shares)
//    Shares repurchased = 100% FCF / (revMultiple × rev/shares)
//    Net share Δ = gross issued − repurchased
//
//  Fiscal year ends January 31.
// ─────────────────────────────────────────────────────────────────

export type Scenario = "bear" | "base" | "bull"

export interface SnowflakeScenario {
  // 10 values — FY27–FY36 (indexed 0–9)
  revGrowth: number[]   // revenue growth rate
  opMargin:  number[]   // non-GAAP EBIT margin (ex-SBC)
}

export interface SnowflakeModelConfig {
  slug:        string
  ticker:      string
  exchange:    string
  name:        string
  sector:      string
  description: string
  lastUpdated: string

  engine: "fcf-deferred-revenue"

  // ── Base year: FY26, ended January 31 2026 ───────────────────
  baseYear:    number    // 2026
  baseRevenue: number    // FY26A total revenue ($B)

  currency:     "USD"
  currentPrice: number   // $/share (replaced at runtime)
  sharesOut:    number   // diluted shares ($B) at FY26A — 342M

  netCash:      number   // net cash ($B): cash+investments − convert notes

  // ── Gross margin path ─────────────────────────────────────────
  // Linear creep from 76.2% → 78.0% (non-GAAP, ex-SBC), all scenarios
  grossMargins: number[] // 10 values FY27–FY36

  // ── P&L constants ─────────────────────────────────────────────
  taxRate:       number  // 0.21 (US federal corporate)
  daRatio:       number  // D&A as % of revenue — held at 4.5%
  capexRatio:    number  // CapEx as % of revenue — held at 2.0%

  // ── Deferred revenue ──────────────────────────────────────────
  // FY26A: $3.36B deferred / $4.68B revenue = 72%
  deferredRatio: number  // 0.72

  // ── SBC dilution ──────────────────────────────────────────────
  // FY26A SBC $1.60B / non-GAAP total costs $4.19B = 38.1%
  sbcRatio:      number  // 0.381
  // Share price proxy: revMultiple × (revenue / shares)
  revMultiple:   number  // 8 — conservative revenue-per-share multiple

  // ── Valuation defaults ────────────────────────────────────────
  exitMultipleDefault: number  // 35× FY36 FCF
  waccDefault:         number  // 10%

  scenarios: Record<Scenario, SnowflakeScenario>

  accentColor?: string
}

// ─────────────────────────────────────────────────────────────────
//  SNOWFLAKE_MODELS
// ─────────────────────────────────────────────────────────────────
export const SNOWFLAKE_MODELS: SnowflakeModelConfig[] = [
  {
    slug:        "snow",
    ticker:      "SNOW",
    exchange:    "NYSE",
    name:        "Snowflake Inc.",
    sector:      "Cloud Data & AI Platform",
    description: "Consumption-model FCF DCF · deferred revenue build · SBC dilution via 8× revenue/share · 100% FCF buyback",
    lastUpdated: "April 2026",
    engine:      "fcf-deferred-revenue",

    baseYear:    2026,
    baseRevenue: 4.684,   // FY26A total revenue ($B)
    currency:    "USD",
    currentPrice: 160,    // fallback; replaced at runtime
    sharesOut:   0.342,   // 342M diluted shares ($B)

    // Net cash at Jan 31 2026:
    // Cash $2.83B + ST inv $1.20B + LT inv $0.76B − convert notes $2.28B = $2.51B
    netCash:     2.50,

    // Gross margin: 76.2% → 78.0% linear creep over 10 years
    grossMargins: [0.762, 0.764, 0.766, 0.768, 0.770, 0.772, 0.774, 0.776, 0.778, 0.780],

    taxRate:      0.21,
    daRatio:      0.045,  // FY26A D&A $220M / $4.68B rev = 4.7%
    capexRatio:   0.020,  // FY26A CapEx $102M / $4.68B rev = 2.2%

    deferredRatio: 0.72,  // FY26A deferred $3.36B / $4.68B rev

    sbcRatio:     0.381,  // FY26A SBC $1.60B / non-GAAP costs $4.19B
    revMultiple:  8,

    exitMultipleDefault: 35,
    waccDefault:         0.10,

    accentColor: "#29B5E8",   // Snowflake blue

    scenarios: {
      bear: {
        // Growth disappoints — hyperscaler competition, macro pressure.
        // Margins expand slowly; limited S&M and R&D leverage.
        revGrowth: [0.26, 0.22, 0.19, 0.17, 0.16, 0.15, 0.15, 0.14, 0.13, 0.12],
        opMargin:  [0.11, 0.12, 0.13, 0.15, 0.17, 0.19, 0.22, 0.24, 0.26, 0.28],
      },
      base: {
        // Guidance-anchored FY27; ServiceNow-like plateau in the low-20s for 5 years.
        // Substantial back-half operating leverage as R&D and S&M scale.
        revGrowth: [0.27, 0.25, 0.23, 0.22, 0.22, 0.22, 0.22, 0.22, 0.20, 0.19],
        opMargin:  [0.12, 0.13, 0.15, 0.17, 0.20, 0.23, 0.27, 0.31, 0.35, 0.38],
      },
      bull: {
        // AI-acceleration drives above-consensus consumption growth.
        // Strong operating leverage; platform economics compound.
        revGrowth: [0.28, 0.26, 0.24, 0.23, 0.22, 0.22, 0.22, 0.21, 0.20, 0.19],
        opMargin:  [0.12, 0.14, 0.17, 0.20, 0.24, 0.29, 0.34, 0.39, 0.43, 0.45],
      },
    },
  },
]

export function getSnowflakeModel(slug: string): SnowflakeModelConfig | undefined {
  return SNOWFLAKE_MODELS.find(m => m.slug === slug)
}
