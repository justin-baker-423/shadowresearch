// ─────────────────────────────────────────────────────────────────
//  costco-models.ts  —  Deliberately-simple three-driver FCF DCF for
//  Costco Wholesale Corporation (COST).
//
//  The brief:
//    • Gross margin held flat at 13% (display line)
//    • Operating margin held flat at 3.8% (value driver)
//    • Capex scales with revenue at a constant ratio, calibrated to
//      the FY2025A capex intensity — i.e. capex "supports" the 8%
//      revenue growth rather than being modeled as a separate driver
//    • 100% of residual FCF (NOPAT − Capex) paid out as dividends
//      each year — no buybacks, no cash buildup, shares held flat
//
//  ── Baselines, from the FY2025 10-K (year ended Aug 31, 2025) ──────
//    Total revenue (net sales + membership fees) ... $275,235M
//    Merchandise costs ................................ $239,886M
//    Gross profit ...................................... $35,349M  (GM 12.84% ≈ 13%)
//    Operating income .................................. $10,383M  (OM 3.77% ≈ 3.8%)
//    Effective tax rate ................................ 25.13%
//    Net income ......................................... $8,099M  (diluted EPS $18.21)
//    Capital expenditures ............................... $5,498M  (2.0% of revenue;
//                                                          FY2026 guidance $6.0–6.5B)
//    Depreciation & amortization ........................ $2,426M  (0.88% of revenue)
//    Cash & equivalents + short-term investments ....... $15,284M
//    Total debt .......................................... $8,173M
//    → Net cash .......................................... $7,111M
//    Diluted shares (as of Sept 30, 2025) ............... 443.2M
//    Current annualized regular dividend ................. $5.88/share
//                                                          ($1.47/qtr, raised Apr 2026)
//
//  ── Working-capital tailwind ────────────────────────────────────
//  Costco runs structurally negative working capital (upfront
//  membership fees + payables terms that outrun inventory turns), so
//  revenue growth itself throws off cash beyond NOPAT. From the
//  FY2025 cash-flow statement, the net change in operating assets/
//  liabilities (merchandise inventories + accounts payable + other,
//  net) was +$1,764M against ~$20.5B of revenue growth (~8.6%);
//  FY2024's equivalent was +$611M against a smaller revenue increase
//  (~3.4%). Given the one-year noise, this model uses a rounded,
//  conservative 5% of incremental revenue as the working-capital
//  cash tailwind each forecast year.
//
//  FCF = NOPAT + D&A − Capex + (ΔRevenue × nwcTailwindRate)
//
//  Because NOPAT and capex scale linearly off revenue while the NWC
//  tailwind scales off the revenue *increase*, FCF still compounds
//  close to (but not exactly) the revenue growth rate. This model
//  does not attempt to reproduce Costco's actual lumpy special-
//  dividend pattern; it smooths 100% of residual FCF into a steady
//  annual payout instead.
// ─────────────────────────────────────────────────────────────────

export type CostcoScenario = "bear" | "base" | "bull"

export interface CostcoScenarioAssumptions {
  revGrowth:   number   // uniform annual revenue growth (decimal)
  grossMargin: number   // gross profit / revenue (display line)
  opMargin:    number   // operating income / revenue (value driver)
}

export interface CostcoModelConfig {
  slug:        string
  ticker:      string
  exchange:    string
  name:        string
  sector:      string
  description: string
  lastUpdated: string

  // ── base year (FY2025A actuals, $B) ───────────────────────────
  baseYear:    number
  baseRevenue: number    // $B total revenue (net sales + membership fees)
  netDebt:     number    // $B, positive = net debt, negative = net cash
  sharesOut:   number    // billions
  dps0:        number    // $/share — current annualized regular dividend

  // ── capex (second driver — scales with revenue) ────────────────
  capexRate:   number    // capex / revenue, held constant

  // ── FCF build-out (D&A add-back + working-capital tailwind) ────
  dnaRate:         number   // D&A / revenue, held constant
  nwcTailwindRate: number   // cash inflow from ΔNWC / Δrevenue, held constant

  // ── valuation ─────────────────────────────────────────────────
  taxRate:     number    // normalized effective tax rate
  termGrowth:  number
  waccDefault: number
  currentPrice: number   // $ fallback — replaced by live quote at runtime

  scenarios:   Record<CostcoScenario, CostcoScenarioAssumptions>
  accentColor?: string
}

const COSTCO_MODEL: CostcoModelConfig = {
  slug:        "costco",
  ticker:      "COST",
  exchange:    "NASDAQ",
  name:        "Costco Wholesale Corporation",
  sector:      "Warehouse Club / Retail",
  description: "Simple three-driver FCF DCF · 13% gross / 3.8% operating margin held flat · capex scaled to fund 8% revenue growth · 100% of residual FCF paid out as dividends",
  lastUpdated: "July 2026",

  baseYear:     2025,
  baseRevenue:  275.235,
  netDebt:      -7.111,     // net cash
  sharesOut:    0.4432,
  dps0:         5.88,

  capexRate:    0.020,      // $5,498M / $275,235M FY2025A, held flat

  dnaRate:         0.0088,  // $2,426M / $275,235M FY2025A, held flat
  nwcTailwindRate: 0.05,    // rounded, conservative vs. FY2025A actual ~8.6%

  taxRate:      0.25,
  termGrowth:   0.03,
  waccDefault:  0.09,
  currentPrice: 972.35,

  accentColor:  "#e31837",   // Costco red

  scenarios: {
    // Membership growth slows, tariff/competitive pressure on margin
    bear: { revGrowth: 0.05, grossMargin: 0.125, opMargin: 0.034 },
    // User brief: hold current margins flat, 8% top-line growth
    base: { revGrowth: 0.08, grossMargin: 0.130, opMargin: 0.038 },
    // Faster international unit growth + membership fee/Kirkland mix
    bull: { revGrowth: 0.10, grossMargin: 0.135, opMargin: 0.041 },
  },
}

export const COSTCO_MODELS: CostcoModelConfig[] = [COSTCO_MODEL]

export function getCostcoModel(slug: string): CostcoModelConfig | undefined {
  return COSTCO_MODELS.find(m => m.slug === slug)
}
