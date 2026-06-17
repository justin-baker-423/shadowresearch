// ─────────────────────────────────────────────────────────────────
//  netflix-models.ts  —  Content-Amortization DCF engine config.
//
//  Separate from models.ts because Netflix's economics are driven by
//  the content-asset balance: amortization (the bulk of COGS) is a
//  function of the capitalised content library, not of revenue. As
//  content-asset growth slows, amortization compounds far slower than
//  revenue → gross- and operating-margin expansion.
//
//  State variable: ContentAsset (net, $B).
//    amort(t)       = amortRate × ContentAsset(t−1)
//    excess(t)      = scheduled cash invested in content ABOVE amort ($B)
//    additions(t)   = amort(t) + excess(t)          (cash content spend)
//    ContentAsset(t)= ContentAsset(t−1) + excess(t)
//
//  Classical UFCF then collapses to:
//    FCF = NOPAT + otherD&A − excessContent − capex
//  (the content-amort add-back and cash additions net to just excess.)
//
//  FY2025 anchors are from the FY2025 10-K / Q4'25 release. WBD pending
//  acquisition is EXCLUDED — this is standalone Netflix.
//
//  Capital allocation: Netflix holds ~2 months of revenue as cash; all
//  cash generated above that floor sweeps into share repurchases at 25×
//  EPS. The model tracks the cash balance year-by-year (built by levered
//  FCF) to size each year's buyback.
// ─────────────────────────────────────────────────────────────────

import type { Scenario } from "./models"
export type { Scenario }

export interface NetflixScenarioAssumptions {
  // 10 values — FY2026–2035 revenue growth (decimal)
  revGrowth: number[]
  // 10 values — FY2026–2035 cash content investment IN EXCESS of amortization ($B)
  // This is the net add to the content-asset balance each year.
  excessContent: number[]
  // Annual growth of the non-content portion of cost of revenues (decimal)
  nonContentCOGSGrowth: number
}

export interface NetflixModelConfig {
  slug:        string
  ticker:      string
  exchange:    string
  name:        string
  sector:      string
  description: string
  lastUpdated: string

  // ── engine tag — routes to NetflixModelShell ─────────────────
  engine: "content-amortization"

  // ── base / anchor year (FY2025A) ─────────────────────────────
  baseYear:     number
  baseRevenue:  number   // FY2025A total revenue ($B)

  currency:     "USD"
  currentPrice: number   // $/share (post 10-for-1 split) — replaced live
  sharesOut:    number   // diluted shares ($B) — opening count, reduced by buybacks
  netCash:      number   // net cash (+) / net debt (−) ($B)

  // ── DCF assumptions ───────────────────────────────────────────
  taxRate:      number   // effective tax rate (decimal)
  termGrowth:   number
  waccDefault:  number

  // ── Capital allocation — cash-floor buybacks ─────────────────
  // Netflix holds ~2 months of revenue as cash; ALL cash above that
  // floor sweeps into repurchases at buybackPE × that year's EPS.
  // Cash builds by levered FCF (UFCF − after-tax net interest).
  cashBase:         number  // FY2025A cash & equivalents ($B) — opening balance
  cashMonthsTarget: number  // months of revenue held as cash on hand
  buybackPE:        number  // P/E multiple paid on repurchases
  netInterestBase:  number  // FY2025 net interest expense ($B); bridges EBIT→net income & UFCF→levered FCF

  // ── Content-amortization engine inputs (FY2025A) ─────────────
  contentAssetBase: number  // content assets, net at 1-Jan-2026 ($B)
  amortRate:        number  // content amort ÷ beginning content-asset balance
  nonContentCOGSBase: number // FY2025 cost of revenues − content amort ($B)

  // ── Opex held flat as % of revenue (FY2025 ratios) ───────────
  marketingPct: number   // sales & marketing / revenue
  techDevPct:   number   // technology & development / revenue
  gaPct:        number   // general & administrative / revenue

  // ── Other cash items (FY2025A, grow with revenue) ────────────
  capexBase:    number   // purchases of property & equipment ($B)
  otherDABase:  number   // D&A of PP&E + intangibles ($B)

  // ── FY2025A reference margins (for expansion display) ────────
  baseGrossMargin: number
  baseEbitMargin:  number

  scenarios: Record<Scenario, NetflixScenarioAssumptions>

  accentColor?: string
}

// linear ramp helper: n values from `from` to `to` inclusive
function ramp(from: number, to: number, n = 10): number[] {
  return Array.from({ length: n }, (_, i) => from + (to - from) * (i / (n - 1)))
}

// ─────────────────────────────────────────────────────────────────
//  NETFLIX_MODELS
// ─────────────────────────────────────────────────────────────────
export const NETFLIX_MODELS: NetflixModelConfig[] = [
  {
    slug:        "netflix",
    ticker:      "NFLX",
    exchange:    "NASDAQ",
    name:        "Netflix, Inc.",
    sector:      "Streaming / Media",
    description: "Content-amortization engine · slowing content investment drives gross- & operating-margin expansion · WBD excluded",
    lastUpdated: "June 2026",
    engine:      "content-amortization",

    baseYear:    2025,
    baseRevenue: 45.183,   // FY2025A total revenue ($B)

    currency:     "USD",
    currentPrice: 110,     // post 10-for-1 split — replaced live by Yahoo
    sharesOut:    4.30,    // diluted shares (B) — opening count, reduced by buybacks
    netCash:      -5.46,   // net debt $5.46B (gross debt $14.5B − cash $9.034B)

    taxRate:     0.137,    // FY2025 effective (1.74 / 12.72)
    termGrowth:  0.03,
    waccDefault: 0.10,

    cashBase:         9.034,  // FY2025A cash & equivalents ($9,033,681K per 10-K)
    cashMonthsTarget: 2,      // hold 2 months of revenue; sweep the rest to buybacks
    buybackPE:        25,     // repurchase at ~25× current-year EPS
    netInterestBase:  0.60,   // FY2025 net interest ($0.78B exp − $0.17B inc)

    contentAssetBase:   32.778,   // content assets, net at 1-Jan-2026 ($B)
    amortRate:          0.506,    // FY2025 amort $16.42B ÷ begin $32.45B
    nonContentCOGSBase: 6.853,    // FY2025 COGS $23.28B − content amort $16.42B

    marketingPct: 0.0731,   // $3.30B / $45.18B
    techDevPct:   0.0751,   // $3.39B / $45.18B
    gaPct:        0.0418,   // $1.89B / $45.18B

    capexBase:   0.688,     // FY2025 purchases of PP&E ($B)
    otherDABase: 0.333,     // FY2025 D&A of PP&E + intangibles ($B)

    baseGrossMargin: 0.485, // (45.183 − 23.275) / 45.183
    baseEbitMargin:  0.295, // 13.327 / 45.183

    accentColor: "#E50914", // Netflix red

    scenarios: {
      // ── Bear: slower growth, content arms-race (heavier excess), cost creep
      bear: {
        revGrowth:     [0.13, 0.11, 0.10, 0.09, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08],
        excessContent: ramp(3.0, 6.0),   // must keep spending to defend engagement
        nonContentCOGSGrowth: 0.10,
      },
      // ── Base: user's literal assumptions
      base: {
        revGrowth:     [0.16, 0.14, 0.13, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12],
        excessContent: ramp(2.0, 4.0),   // $2B → $4B excess content investment
        nonContentCOGSGrowth: 0.08,
      },
      // ── Bull: stronger growth, content efficiency (lighter excess)
      bull: {
        revGrowth:     [0.18, 0.16, 0.15, 0.14, 0.13, 0.13, 0.12, 0.12, 0.12, 0.12],
        excessContent: ramp(1.5, 3.0),
        nonContentCOGSGrowth: 0.07,
      },
    },
  },
]

export function getNetflixModel(slug: string): NetflixModelConfig | undefined {
  return NETFLIX_MODELS.find(m => m.slug === slug)
}
