// ─────────────────────────────────────────────────────────────────
//  atlassian-models.ts  —  R&D Capitalisation engine config.
//
//  Valuation framework:
//    Adj NI  = (GP − R&D Amortisation − S&M − G&A) × (1 − tax)
//    PV      = Σ Adj NI(t) / (1+WACC)^t   [FY26–FY35]
//    TV      = exitMultiple × Adj NI(FY35) / (1+WACC)^10
//    Equity  = PV + TV + netCash
//
//  The exit multiple (default 20×) replaces Gordon Growth entirely.
//  Thesis: if Atlassian stopped R&D investment, the installed-base
//  cash flows would converge toward Adj NI as amortisation runs off.
//  A 20× P/E reflects the quality and durability of that earnings
//  stream, not just a terminal growth rate.
//
//  Amortisation:
//    10-yr straight-line rolling window.
//    historicalRdCohorts = [FY25→FY17] — estimated GAAP R&D spend.
//    Each cohort contributes 1/10 per year; oldest drops off annually.
//
//  Dilution:
//    +1%/yr net (SBC grants − buybacks) for FY26–FY30; 0% thereafter.
// ─────────────────────────────────────────────────────────────────

export type Scenario = "bear" | "base" | "bull"

export interface AtlassianScenario {
  // 10 values — FY26–FY35 (indexed 0–9)
  rdPct: number[]   // total R&D as % of revenue (cash + SBC)
  smPct: number[]   // S&M as % of revenue
  gaPct: number[]   // G&A as % of revenue
}

export interface AtlassianModelConfig {
  slug:        string
  ticker:      string
  exchange:    string
  name:        string
  sector:      string
  description: string
  lastUpdated: string

  engine: "rd-capitalisation"

  // ── Base year: FY25, ended June 30 2025 ──────────────────────
  baseYear:    number    // 2025
  baseRevenue: number    // FY25A revenue ($B)

  currency:     "USD"
  currentPrice: number   // $/share (replaced at runtime)
  sharesOut:    number   // diluted shares ($B) at FY25A

  netCash:      number   // net cash ($B) at FY25A

  // ── P&L constants ─────────────────────────────────────────────
  grossMargin:  number   // held constant
  taxRate:      number   // effective

  // ── R&D capitalisation ────────────────────────────────────────
  rdLife:              number    // amortisation life (10 years)
  // Historical GAAP R&D spend ($B), most-recent-first [FY25…FY17].
  // 9 cohorts — FY16 and earlier fully amortised by FY26 start.
  historicalRdCohorts: number[]

  // ── Share dilution ────────────────────────────────────────────
  // Net annual dilution per year (FY26–FY35); 10 values.
  // Positive = net issuer. User spec: +1%/yr FY26-30, 0% FY31-35.
  dilutionSchedule: number[]

  // ── Revenue growth (fixed across all scenarios) ───────────────
  // FY26: 22%; −1pp/yr to 15%; flat from FY33.
  revGrowth: number[]   // 10 values

  // ── Valuation defaults ────────────────────────────────────────
  exitMultipleDefault: number   // default P/E exit multiple (20×)
  waccDefault:         number   // 10%

  scenarios: Record<Scenario, AtlassianScenario>

  accentColor?: string
}

// ─────────────────────────────────────────────────────────────────
//  ATLASSIAN_MODELS
// ─────────────────────────────────────────────────────────────────
export const ATLASSIAN_MODELS: AtlassianModelConfig[] = [
  {
    slug:        "team",
    ticker:      "TEAM",
    exchange:    "NASDAQ",
    name:        "Atlassian Corporation",
    sector:      "Enterprise Software / Cloud",
    description: "R&D capitalisation · 10-yr amortisation · 20× Adj Earnings exit · installed-base earnings power",
    lastUpdated: "March 2026",
    engine:      "rd-capitalisation",

    baseYear:    2025,
    baseRevenue: 4.86,    // FY25A ($B)
    currency:    "USD",
    currentPrice: 220,    // fallback; replaced at runtime
    sharesOut:   0.257,   // 257M diluted shares ($B)

    netCash:     1.70,    // net cash at FY25A ($B)

    grossMargin: 0.82,    // 82%, held constant
    taxRate:     0.22,    // 22% effective

    rdLife:      10,

    // Historical GAAP R&D spend ($B), most-recent-first [FY25…FY17].
    // FY25 actuals: 51.2% × $4.86B = $2.49B.
    // Prior years estimated at declining % as business was earlier-stage.
    // FY16 and earlier are fully amortised by FY26 start.
    historicalRdCohorts: [
      2.490,  // FY25 — 51.2% of $4.86B (actuals) — 9 years remaining
      2.088,  // FY24 — ~48% of $4.35B            — 8 years remaining
      1.706,  // FY23 — ~45% of $3.79B            — 7 years remaining
      1.419,  // FY22 — ~43% of $3.30B            — 6 years remaining
      0.840,  // FY21 — ~40% of $2.10B            — 5 years remaining
      0.631,  // FY20 — ~38% of $1.66B            — 4 years remaining
      0.436,  // FY19 — ~36% of $1.21B            — 3 years remaining
      0.309,  // FY18 — ~34% of $0.91B            — 2 years remaining
      0.230,  // FY17 — ~32% of $0.72B            — 1 year  remaining
    ],

    // +1%/yr FY26–FY30; 0% FY31–FY35
    dilutionSchedule: [0.01, 0.01, 0.01, 0.01, 0.01, 0.00, 0.00, 0.00, 0.00, 0.00],

    // Revenue growth: 22% → −1pp/yr → 15% flat from FY33
    revGrowth: [0.22, 0.21, 0.20, 0.19, 0.18, 0.17, 0.16, 0.15, 0.15, 0.15],

    exitMultipleDefault: 20,
    waccDefault:         0.10,

    accentColor: "#0052cc",   // Atlassian blue

    // Scenarios: rdPct anchored at 51.2% (FY25 actuals), smPct at 34%
    // (FY25 actuals, includes high SBC in sales). Both decline as
    // scale and AI-driven efficiency improve over the model period.
    scenarios: {
      bear: {
        // R&D and S&M intensity persists; limited operating leverage
        rdPct: [0.51, 0.51, 0.50, 0.50, 0.49, 0.48, 0.47, 0.46, 0.45, 0.44],
        smPct: [0.34, 0.33, 0.32, 0.31, 0.30, 0.30, 0.29, 0.29, 0.28, 0.28],
        gaPct: [0.08, 0.08, 0.07, 0.07, 0.07, 0.07, 0.06, 0.06, 0.06, 0.06],
      },
      base: {
        // Moderate leverage as cloud migration tailwinds moderate
        rdPct: [0.51, 0.50, 0.48, 0.46, 0.44, 0.42, 0.41, 0.40, 0.39, 0.38],
        smPct: [0.34, 0.32, 0.31, 0.29, 0.28, 0.27, 0.26, 0.25, 0.24, 0.24],
        gaPct: [0.08, 0.07, 0.07, 0.06, 0.06, 0.06, 0.05, 0.05, 0.05, 0.05],
      },
      bull: {
        // Strong efficiency gains; AI accelerates R&D output and PLG compounds
        rdPct: [0.50, 0.48, 0.45, 0.42, 0.39, 0.37, 0.35, 0.33, 0.31, 0.30],
        smPct: [0.33, 0.31, 0.29, 0.27, 0.25, 0.23, 0.22, 0.21, 0.20, 0.20],
        gaPct: [0.08, 0.07, 0.07, 0.06, 0.06, 0.05, 0.05, 0.05, 0.05, 0.05],
      },
    },
  },
]

export function getAtlassianModel(slug: string): AtlassianModelConfig | undefined {
  return ATLASSIAN_MODELS.find(m => m.slug === slug)
}
