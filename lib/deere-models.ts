// ─────────────────────────────────────────────────────────────────
//  deere-models.ts  —  Ag Cycle + Services Mix-Shift engine config.
//
//  Thesis: Model Deere's equipment business through the 2016–2023
//  historical ag cycle (trough→peak→trough) while tracking the
//  secular mix-shift from equipment-only to subscription/precision-ag
//  services. Financial services smoothed at a fixed annual growth
//  rate; interest expense scales with FS revenue.
// ─────────────────────────────────────────────────────────────────

import type { Scenario } from "./models"
export type { Scenario }

export interface DeereScenarioAssumptions {
  // 9 values — FY2027–FY2035 equipment sales growth rates
  // (Year 1 / FY2026 is a fixed guidance anchor across all scenarios)
  equipGrowth:   number[]
  // Financial services annual revenue growth rate
  fsGrowthRate:  number
  // Fraction of diluted shares retired each year (buyback)
  buybackRate:   number
  // Annual dividend per share growth rate
  divGrowthRate: number
}

export interface DeereModelConfig {
  slug:         string
  ticker:       string
  exchange:     string
  name:         string
  sector:       string
  description:  string
  lastUpdated:  string

  // ── engine tag ────────────────────────────────────────────────
  engine: "deere-ag-cycle"

  // ── identifiers ───────────────────────────────────────────────
  baseYear:     number    // most recent completed FY (FY2025, ended Nov 2025)
  currency:     "USD"
  currentPrice: number   // $/share; replaced at runtime by Yahoo Finance
  sharesOut:    number   // diluted shares ($B) at start of FY2026E

  // ── consolidated equity bridge ────────────────────────────────
  // Net debt = Total debt − Cash/Securities − Financing Receivables
  // Includes Financial Services; FS debt offset by FS financing receivables
  netDebt:      number   // $B, positive = net debt

  // ── Year 1 (FY2026E) revenue anchors — guidance-consistent ───
  y1EquipRev:     number  // equipment sales ($B)
  y1SubRev:       number  // subscription/precision-ag services ($B)
  y1FsRev:        number  // financial services revenue ($B)
  y1OtherRev:     number  // other income ($B)

  // ── cost model ────────────────────────────────────────────────
  y1InterestExp:  number  // FY2025A consolidated interest expense ($B)
  otherOpEx:      number  // other operating expenses ($B, held fixed)
  taxRate:        number  // normalized effective tax rate
  // SG&A as % of equipment sales — 10 values (FY2026–FY2035)
  sgaPct:         number[]

  // ── capital allocation ────────────────────────────────────────
  divPerShare:    number  // FY2026E annual dividend ($/share)

  // ── subscription mix-shift slider ────────────────────────────
  subPctDefault:  number  // default Year 10 subscription % slider value

  // ── valuation defaults ────────────────────────────────────────
  termGrowth:     number
  waccDefault:    number

  scenarios: Record<Scenario, DeereScenarioAssumptions>

  accentColor?: string
}

// ─────────────────────────────────────────────────────────────────
//  Gross margin model — calibrated to user's Excel (two data points):
//    subPct = 5%  → blended GM = 36.7%  (FY2026E anchor)
//    subPct = 14% → blended GM = 40.8%  (FY2034E base)
//  Linear: GM = 0.344 + 0.456 × subPct
//  Interpretation: each 1pt of subscription mix → +0.46pt GM
//  (driven by ~80% gross margin on precision-ag subscriptions vs
//   ~28% on equipment manufacturing)
// ─────────────────────────────────────────────────────────────────
export function gmFromSubPct(subPct: number): number {
  return 0.344 + 0.456 * subPct
}

// ─────────────────────────────────────────────────────────────────
//  DEERE_MODELS  ← add new Ag Cycle entries here
// ─────────────────────────────────────────────────────────────────
export const DEERE_MODELS: DeereModelConfig[] = [
  {
    slug:        "de",
    ticker:      "DE",
    exchange:    "NYSE",
    name:        "Deere & Company",
    sector:      "Industrial / Precision Agriculture",
    description: "Ag cycle recovery · Precision-ag services mix-shift · FS pass-through · Capital return waterfall",
    lastUpdated: "March 2026",
    engine:      "deere-ag-cycle",

    baseYear:     2025,
    currency:     "USD",
    currentPrice: 450,     // replaced at runtime by Yahoo Finance
    sharesOut:    0.2671,  // 267.1M diluted shares ($B) — start of FY2026E

    // Consolidated net debt: Total debt ($63.9B) − Cash+Securities ($9.7B)
    // − Financing Receivables ($44.6B) − Securitized Receivables ($6.8B)
    // Source: Deere 10-K, FY2025A supplemental balance sheets (Nov 2, 2025)
    netDebt:      2.8,

    // FY2026E guidance-consistent anchors (Q1'26 management guidance)
    y1EquipRev:    32.877,
    y1SubRev:       1.730,
    y1FsRev:        6.150,
    y1OtherRev:     1.070,

    // Source: Deere 10-K, FY2025A consolidated income statement
    y1InterestExp:  2.453,  // consolidated interest expense
    otherOpEx:      1.292,  // other operating expenses (held fixed)
    taxRate:        0.22,   // normalized; FY2025A was ~19.8% due to special items

    // SG&A % of equipment sales — matches user's Excel path (10% → 8%)
    sgaPct: [0.10, 0.10, 0.10, 0.10, 0.09, 0.09, 0.08, 0.08, 0.08, 0.08],

    // $1.62/quarter × 4 = $6.48/yr; confirmed in Q1'26 earnings letter (Feb 19, 2026)
    divPerShare:   6.48,
    subPctDefault: 0.14,   // 14% — base case Year 10 subscription % (matches Excel 2034E)

    termGrowth:  0.030,
    waccDefault: 0.090,

    accentColor: "#367C2B",  // John Deere green

    scenarios: {
      bear: {
        // Weaker cycle recovery: positive rates ×~0.65, negative ×~1.10
        // Represents sustained large-ag headwinds, slower precision-ag adoption
        equipGrowth:   [0.075, 0.166, 0.033, -0.105, 0.155, 0.126, 0.107, -0.172, 0.033],
        fsGrowthRate:  0.05,
        buybackRate:   0.008,
        divGrowthRate: 0.03,
      },
      base: {
        // Historical 2016–2023 ag trough-to-peak cycle replayed 1:1
        // Growth rates: -12% trough, +26% peak, -16% correction, +5% recovery
        equipGrowth:   [0.116, 0.256, 0.051, -0.095, 0.239, 0.194, 0.165, -0.156, 0.050],
        fsGrowthRate:  0.07,
        buybackRate:   0.017,
        divGrowthRate: 0.05,
      },
      bull: {
        // Stronger cycle: positive rates ×~1.20, negative ×~0.80
        // Represents strong commodity cycle + faster precision-ag monetization
        equipGrowth:   [0.139, 0.307, 0.061, -0.076, 0.287, 0.233, 0.198, -0.125, 0.060],
        fsGrowthRate:  0.08,
        buybackRate:   0.025,
        divGrowthRate: 0.07,
      },
    },
  },
]

export function getDeereModel(slug: string): DeereModelConfig | undefined {
  return DEERE_MODELS.find(m => m.slug === slug)
}
