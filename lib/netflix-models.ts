// ─────────────────────────────────────────────────────────────────
//  netflix-models.ts  —  Content-Amortization DCF engine config.
//
//  Separate from models.ts because Netflix's economics are driven by
//  how the capitalised content library amortizes, NOT by revenue. As
//  content investment decelerates relative to amortization, amortization
//  (the bulk of COGS) compounds far slower than revenue → gross- and
//  operating-margin expansion.
//
//  SPEND-ANCHORED AMORTIZATION (reduced-form, calibrated to guidance):
//    • Cash content spend is the exogenous driver. FY2026 is ANCHORED to
//      management's $20B guidance; thereafter it grows at (revGrowth +
//      contentSpendGrowthSpread) — e.g. 2pp below revenue.
//    • Amortization tracks the guided steady-state ratio:
//        amort(t) = spend(t) / contentSpendRatio   (ratio ≈ 1.1×)
//      So FY2026 amort = $20B / 1.1 = $18.2B (+10.7% vs FY2025 — content
//      amortization has never declined in Netflix history; the earlier
//      vintage-convolution build wrongly showed it falling to $15.4B).
//    • The library balance rolls: ContentAsset(t) = ContentAsset(t−1)
//      + spend(t) − amort(t).
//    • Margin expansion is then transparent: it comes entirely from content
//      spend (hence amort) growing slower than revenue.
//
//  Why reduced-form: management guides directly to the spend/amort ratio,
//  and a title-level cohort convolution proved fragile/under-identified
//  (it under-counted near-term amortization). amortSchedule below is kept
//  only as 10-K REFERENCE for the Content tab, not used by the engine.
//
//  Classical UFCF (content amort add-back nets cash additions to the drain):
//    FCF = NOPAT + otherD&A − (spend − amort) − capex
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
  // Cash content spend grows at (revGrowth + spread) off the FY2026 anchor
  // each year (e.g. −0.02 ⇒ 2pp below revenue). The single content lever.
  contentSpendGrowthSpread: number
  // Non-content COGS growth — either a fixed annual rate (base/bull) OR a
  // spread vs revenue growth (bear: −0.02 ⇒ grows 2pp below revenue). One set.
  nonContentCOGSGrowth?:       number
  nonContentCOGSGrowthSpread?: number
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

  // ── Content amortization (spend-anchored) inputs (FY2025A) ───
  contentAssetBase: number  // total content assets, net at 1-Jan-2026 ($B)
  content2026Spend: number  // FY2026 cash content spend ($B) — management guidance anchor
  contentSpendRatio: number // cash spend ÷ amortization (guided); amort = spend / ratio
  // Disclosed accelerated cohort curve (fraction amortized in each year after
  // first availability) — kept only as 10-K REFERENCE for the Content tab.
  amortSchedule:    number[]
  contentAmortBase: number  // FY2025A content amortization ($B) — reference
  contentSpendBase: number  // FY2025A cash additions to content ($B) — reference
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
    currentPrice: 70.90,   // live ~$71 anchor — replaced live by Yahoo on the perf tab
    sharesOut:    4.30,    // diluted shares (B) — opening count, reduced by buybacks
    netCash:      -5.46,   // net debt $5.46B (gross debt $14.5B − cash $9.034B)

    taxRate:     0.137,    // FY2025 effective (1.74 / 12.72)
    termGrowth:  0.03,
    waccDefault: 0.10,

    cashBase:         9.034,  // FY2025A cash & equivalents ($9,033,681K per 10-K)
    cashMonthsTarget: 2,      // hold 2 months of revenue; sweep the rest to buybacks
    buybackPE:        25,     // repurchase at ~25× current-year EPS
    netInterestBase:  0.60,   // FY2025 net interest ($0.78B exp − $0.17B inc)

    contentAssetBase:   32.778,   // total content assets, net at 1-Jan-2026 ($B)
    content2026Spend:   20.0,     // FY2026 cash content spend — management guidance
    contentSpendRatio:  1.10,     // guided spend ÷ amort ⇒ FY2026 amort = 20.0/1.1 = $18.2B
    // 10-K disclosed accelerated run-off (~47/22/15/10/6; 94% within 4 yrs) —
    // REFERENCE only (Content tab); the engine uses the guided ratio above.
    amortSchedule:      [0.47, 0.22, 0.15, 0.10, 0.06],
    contentAmortBase:   16.422,   // FY2025A content amortization ($B)
    contentSpendBase:   17.097,   // FY2025A additions to content assets ($B, cash-flow stmt)
    nonContentCOGSBase: 6.853,    // FY2025 COGS $23.28B − content amort $16.42B

    marketingPct: 0.0731,   // $3.30B / $45.18B
    techDevPct:   0.0751,   // $3.39B / $45.18B
    gaPct:        0.0418,   // $1.89B / $45.18B

    capexBase:   0.688,     // FY2025 purchases of PP&E ($B)
    otherDABase: 0.333,     // FY2025 D&A of PP&E + intangibles ($B)

    baseGrossMargin: 0.485, // (45.183 − 23.275) / 45.183
    baseEbitMargin:  0.295, // 13.327 / 45.183

    accentColor: "#E50914", // Netflix red

    // All scenarios anchor FY2026 spend to $20B (guidance); they diverge from
    // 2027 via revenue growth and how far content spend trails revenue.
    scenarios: {
      // ── Bear: slower growth, disciplined costs — content spend & non-content
      //    COGS both grow ~2pp below revenue. Margins expand, gently.
      bear: {
        revGrowth:                  [0.13, 0.11, 0.10, 0.09, 0.08, 0.08, 0.08, 0.08, 0.08, 0.08],
        contentSpendGrowthSpread:   -0.02,
        nonContentCOGSGrowthSpread: -0.02,
      },
      // ── Base: content spend grows 2pp below revenue (200bps), non-content COGS +8%
      base: {
        revGrowth:                [0.16, 0.14, 0.13, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12],
        contentSpendGrowthSpread: -0.02,   // 200bps below revenue
        nonContentCOGSGrowth:     0.08,
      },
      // ── Bull: stronger growth + content efficiency (spend grows 3pp below revenue)
      bull: {
        revGrowth:                [0.18, 0.16, 0.15, 0.14, 0.13, 0.13, 0.12, 0.12, 0.12, 0.12],
        contentSpendGrowthSpread: -0.03,
        nonContentCOGSGrowth:     0.07,
      },
    },
  },
]

export function getNetflixModel(slug: string): NetflixModelConfig | undefined {
  return NETFLIX_MODELS.find(m => m.slug === slug)
}
