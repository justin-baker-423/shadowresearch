// ─────────────────────────────────────────────────────────────────
//  snowflake-engine.ts  —  Consumption-model FCF DCF engine.
//  No React.
//
//  FCF Build:
//    EBIT        = rev × opMargin[i]              (non-GAAP, ex-SBC)
//    NOPAT       = EBIT × (1 − taxRate)
//    D&A         = rev × daRatio
//    CapEx       = rev × capexRatio
//    ΔDeferred   = deferredRatio × prior_rev × revGrowth[i]
//    FCF         = NOPAT + D&A − CapEx + ΔDeferred
//
//  SBC & Dilution (computed each year, AFTER FCF):
//    non_gaap_costs = rev − EBIT              (= rev × (1 − opMargin))
//    SBC            = sbcRatio × non_gaap_costs
//    price          = revMultiple × rev / shares
//    gross_issued   = SBC / price
//    repurchased    = FCF / price              (100% of FCF → buybacks)
//    net_Δshares    = gross_issued − repurchased
//    shares_end     = shares_start + net_Δshares
//
//  Terminal value:
//    TV = exitMultiple × FCF(FY36)
//    PV(TV) = TV / (1+WACC)^10
//
//  Equity bridge:
//    Equity = Σ PV(FCF) + PV(TV) + netCash
//    Value/share = Equity / shares(FY36)
// ─────────────────────────────────────────────────────────────────

import type { SnowflakeModelConfig, Scenario } from "./snowflake-models"

export interface SnowflakeRow {
  year:     number
  fyLabel:  string   // "FY27" … "FY36"

  // Revenue
  rev:      number   // $B
  revGrowth: number  // decimal

  // P&L
  grossProfit:  number
  grossMargin:  number
  ebit:         number   // non-GAAP EBIT ($B)
  ebitMargin:   number   // = opMargin[i]
  nopat:        number   // EBIT × (1 − tax)

  // Cash flow components
  da:            number  // D&A
  capex:         number  // CapEx
  deltaDeferred: number  // Δ deferred revenue (billings > revenue)
  fcf:           number  // NOPAT + D&A − CapEx + ΔDeferred
  fcfMargin:     number  // fcf / rev
  pvFcf:         number  // FCF / (1+WACC)^t

  // SBC & dilution
  sbc:              number  // SBC spend ($B)
  pricePerShare:    number  // 8× rev/share ($)
  grossSharesIssued: number // SBC / price ($B shares)
  sharesRepurchased: number // FCF / price ($B shares)
  netShareChange:   number  // gross − repurchased ($B)
  sharesEnd:        number  // shares at year-end ($B)
}

export interface SnowflakeResult {
  rows:       SnowflakeRow[]
  pvTv:       number   // PV of terminal value
  sumPvFcf:   number   // Σ PV(FCF) over explicit period
  ev:         number   // sumPvFcf + pvTv
  equity:     number   // ev + netCash
  perShare:   number   // equity / FY36 shares
  updown:     number   // % vs currentPrice
  tvWeight:   number   // pvTv / ev
  exitMultiple: number
  impliedCAGR:  number // 10-yr CAGR: fair value accreted at WACC from today's price
}

export function runSnowflakeDCF(
  model:        SnowflakeModelConfig,
  sc:           Scenario,
  wacc:         number,
  exitMultiple: number,
): SnowflakeResult {
  const {
    baseRevenue, grossMargins, taxRate,
    daRatio, capexRatio, deferredRatio,
    sbcRatio, revMultiple,
    sharesOut, netCash, currentPrice,
  } = model
  const { revGrowth, opMargin } = model.scenarios[sc]

  let rev    = baseRevenue
  let shares = sharesOut
  const rows: SnowflakeRow[] = []

  for (let i = 0; i < 10; i++) {
    const fyLabel  = `FY${(27 + i).toString().padStart(2, "0")}`
    const priorRev = rev

    // Revenue
    rev = rev * (1 + revGrowth[i])

    // P&L
    const grossProfit = rev * grossMargins[i]
    const ebit        = rev * opMargin[i]
    const nopat       = ebit * (1 - taxRate)

    // Cash flow components
    const da            = rev * daRatio
    const capex         = rev * capexRatio
    const deltaDeferred = deferredRatio * priorRev * revGrowth[i]
    const fcf           = nopat + da - capex + deltaDeferred
    const pvFcf         = fcf / Math.pow(1 + wacc, i + 1)

    // SBC & dilution
    const nonGaapCosts    = rev - ebit                          // rev × (1 − opMargin)
    const sbc             = sbcRatio * nonGaapCosts
    const pricePerShare   = revMultiple * rev / shares          // 8× rev/share
    const grossShares     = sbc / pricePerShare                 // new shares from SBC
    const repurchased     = fcf / pricePerShare                 // buybacks with FCF
    const netShareChange  = grossShares - repurchased
    shares                = shares + netShareChange

    rows.push({
      year:       2027 + i,
      fyLabel,
      rev,
      revGrowth:  revGrowth[i],
      grossProfit,
      grossMargin: grossMargins[i],
      ebit,
      ebitMargin:  opMargin[i],
      nopat,
      da,
      capex,
      deltaDeferred,
      fcf,
      fcfMargin:   fcf / rev,
      pvFcf,
      sbc,
      pricePerShare,
      grossSharesIssued: grossShares,
      sharesRepurchased: repurchased,
      netShareChange,
      sharesEnd:   shares,
    })
  }

  // ── Terminal value ────────────────────────────────────────────
  const lastFcf    = rows[9].fcf
  const tv         = exitMultiple * lastFcf
  const pvTv       = tv / Math.pow(1 + wacc, 10)
  const sumPvFcf   = rows.reduce((s, r) => s + r.pvFcf, 0)
  const ev         = sumPvFcf + pvTv
  const equity     = ev + netCash
  const perShare   = equity / rows[9].sharesEnd

  // ── Implied CAGR (fair value accreted at WACC from today's price) ──
  const fvYear10   = perShare * Math.pow(1 + wacc, 10)
  const impliedCAGR = Math.pow(fvYear10 / currentPrice, 0.1) - 1

  return {
    rows, pvTv, sumPvFcf, ev, equity, perShare,
    updown:      (perShare / currentPrice - 1) * 100,
    tvWeight:    pvTv / ev,
    exitMultiple,
    impliedCAGR,
  }
}

// ── Sensitivity: Exit Multiple (rows) × WACC (cols) ──────────────
export interface SnowflakeSensResult {
  multiples: number[]
  waccs:     number[]
  grid:      number[][]  // [multiple row][wacc col] → intrinsic value/share
}

export function buildSnowflakeSensitivity(
  model: SnowflakeModelConfig,
  sc:    Scenario,
  wacc:  number,
): SnowflakeSensResult {
  const multiples = [20, 25, 30, 35, 40, 45, 50]
  const waccs     = [0.08, 0.09, 0.10, 0.11, 0.12]
  const grid      = multiples.map(m =>
    waccs.map(w => Math.round(runSnowflakeDCF(model, sc, w, m).perShare))
  )
  return { multiples, waccs, grid }
}
