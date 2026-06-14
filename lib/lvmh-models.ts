// ─────────────────────────────────────────────────────────────────
//  lvmh-models.ts  —  Book-value-anchored DCF for LVMH, valued as the
//  US ADR (LVMUY).
//
//  Why this model is bespoke (not the generic SAP/EUR engine):
//
//    1. ADR conversion — LVMUY is an unsponsored ADR where
//       1 ADR = 1/5 of an ordinary MC.PA share (5 ADRs per share).
//       Fair value per ADR = (IV per ordinary share, EUR) × EUR/USD ÷ 5.
//
//    2. Earnings engine — 8% organic growth (1% volume + 7% accretive
//       price). The 7% price beats cost inflation and flows toward the
//       bottom line, so net margin EXPANDS from 13.5% (FY2025A) to 18.5%
//       by FY2035 (below the FY2021 peak of 18.7%) and net income
//       compounds FASTER than the 8% top line.
//
//  (A book-value add was prototyped and removed — adding full book value
//   to a full earnings DCF double-counts the operating assets, since
//   those assets produce the very earnings being discounted.)
//
//  All FY2025A actuals sourced from LVMH's 2025 consolidated financial
//  statements (released 2026-01-27), €M:
//    Revenue ........................... 80,807
//    Net profit, Group share ........... 10,878  (EPS €21.86)
//    Equity, Group share (book value) .. 67,472
//    Minority interests ................ 1,477
//    Net financial debt ................ ~6.83B  (9.9% of total equity)
//    Ordinary shares ................... 497.69M
//    DPS ............................... €13.00
// ─────────────────────────────────────────────────────────────────

export type LvmhScenario = "bear" | "base" | "bull"

export interface LvmhScenarioAssumptions {
  // 10 values — one per year 2026–2035
  revGrowth: number[]   // decimal, organic revenue growth
  niMargin:  number[]   // net-income (group share) margin
}

export interface LvmhModelConfig {
  slug:        string
  ticker:      string          // ADR ticker used for the live price fetch (USD)
  exchange:    string
  name:        string
  sector:      string
  description: string
  lastUpdated: string

  // ── base year (FY2025A actuals, EUR) ──────────────────────────
  baseYear:    number
  baseRevenue: number          // €B
  baseEarnings: number         // €B net income, Group share (sanity/display)
  netCash:     number          // €B, negative = net debt
  sharesOut:   number          // ordinary shares, billions
  dps:         number          // €/ordinary share trailing dividend

  // ── ADR mechanics ─────────────────────────────────────────────
  currency:    "EUR"           // underlying reporting currency
  adrPerShare: number          // ADRs per ordinary share (LVMUY = 5)
  currentPrice: number         // LVMUY price in USD (fallback; live-overridden)

  // ── valuation ─────────────────────────────────────────────────
  taxRate:     number          // 0 — niMargin is already net (after-tax)
  termGrowth:  number
  waccDefault: number

  scenarios: Record<LvmhScenario, LvmhScenarioAssumptions>
  accentColor?: string
}

// Base case: 8% organic growth WITH net-margin expansion from 13.5%
// today (FY2025A = 10,878/80,807) to 18.5% by FY2035 — i.e. +0.5pp/yr.
// This is the "price is accretive" thesis: the 7% price layer beats
// cost inflation, so each €1 of revenue drops more to the bottom line
// every year. Net income therefore compounds FASTER than the 8% top line.

const LVMH_MODEL: LvmhModelConfig = {
  slug:        "lvmh",
  ticker:      "LVMUY",
  exchange:    "OTC · ADR",
  name:        "LVMH Moët Hennessy Louis Vuitton",
  sector:      "Luxury Goods",
  description: "Luxury compounder · 8% organic (1% volume / 7% accretive price) · net margin 13.5%→18.5% · ADR valued off MC.PA × EUR/USD ÷ 5",
  lastUpdated: "June 2026",

  baseYear:     2025,
  baseRevenue:  80.807,
  baseEarnings: 10.878,
  netCash:      -6.83,
  sharesOut:    0.49769,
  dps:          13.00,

  currency:     "EUR",
  adrPerShare:  5,
  currentPrice: 118.54,        // LVMUY (USD) fallback — replaced at runtime

  taxRate:      0.00,          // niMargin is already after-tax net margin
  termGrowth:   0.03,
  waccDefault:  0.10,

  accentColor:  "#b8995a",     // LVMH champagne-gold

  scenarios: {
    // Demand softens; price merely offsets cost inflation → net margin
    // holds ~flat at 13.5%. Slower 5% top line.
    bear: {
      revGrowth: [0.05,0.05,0.05,0.05,0.05, 0.05,0.05,0.05,0.05,0.05],
      niMargin:  [0.135,0.135,0.135,0.135,0.135, 0.135,0.135,0.135,0.135,0.135],
    },
    // User thesis: 8% organic, net margin expands 13.5% → 18.5% by FY2035
    // (+0.5pp/yr) as accretive price flows to the bottom line.
    base: {
      revGrowth: [0.08,0.08,0.08,0.08,0.08, 0.08,0.08,0.08,0.08,0.08],
      niMargin:  [0.140,0.145,0.150,0.155,0.160, 0.165,0.170,0.175,0.180,0.185],
    },
    // Stronger price realisation + volume: faster top line and net margin
    // expands further, to ~20.5% by FY2035.
    bull: {
      revGrowth: [0.10,0.10,0.10,0.10,0.09, 0.09,0.09,0.08,0.08,0.08],
      niMargin:  [0.150,0.156,0.162,0.168,0.174, 0.180,0.186,0.192,0.198,0.205],
    },
  },
}

export const LVMH_MODELS: LvmhModelConfig[] = [LVMH_MODEL]

export function getLvmhModel(slug: string): LvmhModelConfig | undefined {
  return LVMH_MODELS.find(m => m.slug === slug)
}
