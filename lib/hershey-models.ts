// ─────────────────────────────────────────────────────────────────
//  hershey-models.ts  —  Deliberately-simple earnings DCF for
//  The Hershey Company (HSY).
//
//  The brief: a clean three-driver model —
//    • 4% revenue growth
//    • 45% gross margin
//    • 25% operating margin
//  with a dividend ($5.81/share today) that grows in line with EPS,
//  3% terminal growth and a 10% WACC.
//
//  Valuation mechanics (mirrors the Home Depot engine):
//    NOPAT = EBIT × (1 − tax)               [unlevered cash flow ≈ FCF]
//    EV    = Σ PV(NOPAT) + PV(terminal)
//    Equity = EV − net debt                 [bridge handles leverage]
//  while a parallel LEVERED line (EBIT − net interest, taxed) drives the
//  EPS shown in the table, so the EPS-linked dividend reads realistically.
//  Gross margin is a display line — value is driven off operating margin.
//
//  ── Baselines, from the FY2025 10-K (year ended Dec 31, 2025) ──────
//    Net sales ......................... $11,692.6M
//    Cost of sales ..................... $7,769.9M  (GM 33.5% — cocoa-
//                                        spike trough; 2024 GM was ~47%)
//    Operating profit .................. $1,441.5M  (OM 12.3% trough;
//                                        2024 OM ~26%)
//    Interest expense, net ............. $190.2M
//    Provision for income taxes ........ $330.9M / $1,214.2M = 27.3%
//                                        (elevated; HSY's structural rate
//                                        ran ~10–15% in 2023–24 on energy/
//                                        housing credits → 15% normalized)
//    Net income ........................ $883.3M  (diluted EPS $4.34)
//    Cash & equivalents ................ $925.9M
//    Total debt ........................ $5,403.1M  (218.5 ST + 503.3 cur.
//                                        LTD + 4,681.2 LTD)
//    → Net debt ........................ $4,477.2M
//    Shares out (Common 148.08M + Class B 54.61M) = 202.69M
//
//  The 45% GM / 25% OM assumptions are a NORMALIZED (post-cocoa-spike)
//  margin profile, roughly the 2024 shape, not the depressed 2025 actual.
//  The tax rate is likewise normalized to 15%.
// ─────────────────────────────────────────────────────────────────

export type HersheyScenario = "bear" | "base" | "bull"

export interface HersheyScenarioAssumptions {
  revGrowth:   number   // uniform annual revenue growth (decimal)
  grossMargin: number   // gross profit / revenue (display line)
  opMargin:    number   // operating income / revenue (value driver)
}

export interface HersheyModelConfig {
  slug:        string
  ticker:      string
  exchange:    string
  name:        string
  sector:      string
  description: string
  lastUpdated: string

  // ── base year (FY2025A actuals, $B) ───────────────────────────
  baseYear:    number
  baseRevenue: number    // $B net sales
  netDebt:     number    // $B, positive = net debt
  netInterest: number    // $B annual net interest expense (held flat)
  sharesOut:   number    // billions
  dps0:        number    // $/share — current annualized dividend

  // ── valuation ─────────────────────────────────────────────────
  taxRate:     number    // normalized effective tax rate
  termGrowth:  number
  waccDefault: number
  currentPrice: number   // $ fallback — replaced by live quote at runtime

  scenarios:   Record<HersheyScenario, HersheyScenarioAssumptions>
  accentColor?: string
}

const HERSHEY_MODEL: HersheyModelConfig = {
  slug:        "hershey",
  ticker:      "HSY",
  exchange:    "NYSE",
  name:        "The Hershey Company",
  sector:      "Consumer Staples",
  description: "Simple three-driver earnings DCF · 4% revenue · 45% gross / 25% operating margin · dividend grows with EPS · 3% terminal · 10% WACC",
  lastUpdated: "June 2026",

  baseYear:     2025,
  baseRevenue:  11.6926,
  netDebt:      4.477,
  netInterest:  0.1902,
  sharesOut:    0.20269,
  dps0:         5.81,

  taxRate:      0.15,
  termGrowth:   0.03,
  waccDefault:  0.10,
  currentPrice: 190.00,

  accentColor:  "#8b5a2b",   // Hershey chocolate brown

  scenarios: {
    // Softer recovery: margins reclaim only part of the pre-cocoa profile.
    bear: { revGrowth: 0.02, grossMargin: 0.42, opMargin: 0.21 },
    // User brief: clean normalized recovery.
    base: { revGrowth: 0.04, grossMargin: 0.45, opMargin: 0.25 },
    // Faster volume + full margin normalization beyond 2024 levels.
    bull: { revGrowth: 0.06, grossMargin: 0.47, opMargin: 0.28 },
  },
}

export const HERSHEY_MODELS: HersheyModelConfig[] = [HERSHEY_MODEL]

export function getHersheyModel(slug: string): HersheyModelConfig | undefined {
  return HERSHEY_MODELS.find(m => m.slug === slug)
}
