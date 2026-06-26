// ─────────────────────────────────────────────────────────────────
//  hershey-engine.ts  —  Pure calculation, no React.
//
//  Two parallel tracks per forecast year:
//
//    Valuation (unlevered)            Income / dividend (levered)
//    ────────────────────            ───────────────────────────
//    EBIT  = rev × opMargin          interest = net interest (flat)
//    NOPAT = EBIT × (1 − tax)        pretax   = EBIT − interest
//    PV    = NOPAT / (1+w)^t         NI       = pretax × (1 − tax)
//                                    EPS      = NI / shares
//                                    DPS      = prevDPS × (1 + EPS growth)
//
//    EV     = Σ PV(NOPAT) + PV(TV)        TV = NOPAT₁₀ × (1+g)/(w−g)
//    Equity = EV − net debt
//    perShare = Equity / shares
//
//  Shares are held flat (no buyback assumption — keeping it simple).
//  Gross profit is carried only as a display line.
// ─────────────────────────────────────────────────────────────────

import type { HersheyModelConfig, HersheyScenario } from "./hershey-models"

export interface HersheyRow {
  year:      number
  rev:       number   // $B
  revGrowth: number
  grossM:    number
  gross:     number   // $B gross profit
  opM:       number
  ebit:      number   // $B operating income
  nopat:     number   // $B unlevered after-tax (valuation flow)
  pvNopat:   number   // $B
  ni:        number   // $B net income (levered)
  eps:       number   // $/share
  dps:       number   // $/share
  divGrowth: number
  payout:    number   // dps / eps
}

export interface HersheyResult {
  rows:        HersheyRow[]
  sumPvNopat:  number   // $B
  pvTv:        number   // $B
  ev:          number   // $B
  netDebt:     number   // $B
  equity:      number   // $B intrinsic equity value
  perShare:    number   // $ intrinsic value / share  ← headline
  gordon:      number
  tvWeight:    number
  updown:      number   // % vs current price
  impliedCAGR: number   // 10-yr CAGR off current price
  divYieldFwd: number   // 2026E DPS / current price
  divYieldTtm: number   // current DPS / current price
  baseEps:     number   // normalized FY base EPS (the dividend-growth seed)
}

export function runHersheyDCF(
  model: HersheyModelConfig,
  sc:    HersheyScenario,
  wacc:  number,
  termG: number,
): HersheyResult {
  const { baseRevenue, netDebt, netInterest, sharesOut, dps0,
          taxRate, currentPrice } = model
  const { revGrowth, grossMargin, opMargin } = model.scenarios[sc]

  // Seed for the EPS-linked dividend: the normalized base-year (FY base)
  // EPS computed on the SAME margins/tax so year-1 growth is consistent.
  const baseEbit  = baseRevenue * opMargin
  const baseNi    = (baseEbit - netInterest) * (1 - taxRate)
  const baseEps   = baseNi / sharesOut

  const rows: HersheyRow[] = []
  let prevEps = baseEps
  let prevDps = dps0

  for (let i = 0; i < 10; i++) {
    const year  = 2026 + i
    const rev   = baseRevenue * Math.pow(1 + revGrowth, i + 1)
    const gross = rev * grossMargin
    const ebit  = rev * opMargin

    // Valuation track (unlevered)
    const nopat   = ebit * (1 - taxRate)
    const pvNopat = nopat / Math.pow(1 + wacc, i + 1)

    // Income track (levered)
    const ni  = (ebit - netInterest) * (1 - taxRate)
    const eps = ni / sharesOut

    const epsGrowth = prevEps > 0 ? (eps - prevEps) / prevEps : 0
    const dps       = prevDps * (1 + epsGrowth)      // grows in line with EPS
    const divGrowth = prevDps > 0 ? (dps - prevDps) / prevDps : 0
    const payout    = eps > 0 ? dps / eps : 0

    rows.push({
      year, rev, revGrowth, grossM: grossMargin, gross,
      opM: opMargin, ebit, nopat, pvNopat,
      ni, eps, dps, divGrowth, payout,
    })

    prevEps = eps
    prevDps = dps
  }

  const lastNopat = rows[9].nopat
  const gordon    = (1 + termG) / (wacc - termG)
  const tv        = lastNopat * gordon
  const pvTv      = tv / Math.pow(1 + wacc, 10)
  const sumPvNopat = rows.reduce((s, r) => s + r.pvNopat, 0)

  const ev       = sumPvNopat + pvTv
  const equity   = ev - netDebt
  const perShare = equity / sharesOut

  const fvYear10    = perShare * Math.pow(1 + wacc, 10)
  const impliedCAGR = perShare > 0 && currentPrice > 0
    ? Math.pow(fvYear10 / currentPrice, 0.1) - 1
    : 0

  return {
    rows, sumPvNopat, pvTv, ev, netDebt, equity, perShare, gordon,
    tvWeight:    ev > 0 ? pvTv / ev : 0,
    updown:      (perShare / currentPrice - 1) * 100,
    impliedCAGR,
    divYieldFwd: rows[0].dps / currentPrice,
    divYieldTtm: dps0 / currentPrice,
    baseEps,
  }
}

export interface HersheySensResult {
  waccs:  number[]
  tgrows: number[]
  grid:   number[][]   // [termG row][wacc col] → per-share value
}

export function buildHersheySensitivity(
  model: HersheyModelConfig,
  sc:    HersheyScenario,
): HersheySensResult {
  const waccs  = [0.08, 0.09, 0.10, 0.11, 0.12]
  const tgrows = [0.020, 0.025, 0.030, 0.035, 0.040]
  const grid   = tgrows.map(tg =>
    waccs.map(w => Math.round(runHersheyDCF(model, sc, w, tg).perShare)),
  )
  return { waccs, tgrows, grid }
}
