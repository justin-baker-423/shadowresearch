// ─────────────────────────────────────────────────────────────────
//  anthropic-engine.ts  —  Pure calculation, no React.
//
//  Revenue: firstRevenue in year 1 (2027), growing evenly to capRevenue
//  in year 10 (2036); then extGrowth for extYears (bull case only).
//
//  Each year (% of revenue):
//    serving  = rev × servingRate                (cost of revenue)
//    people   = rev × peopleRate                 (people, other R&D, SG&A)
//    NI       = rev × netMargin, or 0 in a breakeven year
//    EBIT     = NI / (1 − tax)
//    training = rev − serving − people − EBIT    (the plug)
//    FCF      ≈ NI
//
//  EV     = Σ PV(FCF)  +  PV(TV)      TV = FCF_last × (1+g)/(w−g)
//  Equity = EV − net debt              (net debt negative → adds cash)
//  perShare = Equity / fully diluted shares
//
//  impliedCAGR uses the site-wide convention:
//    (perShare × (1+WACC)^10 / price)^(1/10) − 1
// ─────────────────────────────────────────────────────────────────

import type { AnthropicModelConfig, AnthropicScenario } from "./anthropic-models"

export interface AnthropicRow {
  year:        number
  stage:       1 | 2         // 1 = 2027–36 build-out · 2 = growth-decade extension
  rev:         number        // $B
  revGrowth:   number
  serving:     number        // $B serving compute (cost of revenue)
  people:      number        // $B people, other R&D, SG&A
  training:    number        // $B training / R&D compute (plug)
  trainingPct: number        // training / revenue
  compute:     number        // $B total compute (serving + training)
  gw:          number        // total compute ÷ $/GW-year
  ebit:        number        // $B operating profit
  opM:         number
  ni:          number        // $B net income ≈ FCF
  netM:        number
  eps:         number        // $/share (fully diluted)
  pvFcf:       number        // $B
  breakeven:   boolean
}

export interface AnthropicResult {
  rows:          AnthropicRow[]
  stage1Growth:  number      // implied even growth 2027→2036
  sumPvFcf:      number      // $B
  sumPvStage1:   number      // $B PV of 2027–36 cash flows
  sumPvStage2:   number      // $B PV of extension-decade cash flows
  pvTv:          number      // $B
  ev:            number      // $B
  netDebt:       number      // $B
  equity:        number      // $B intrinsic equity value
  perShare:      number      // $ ← headline
  gordon:        number
  tvWeight:      number      // PV TV / equity
  cashWeight:    number      // net cash / equity
  updown:        number      // % vs current price
  impliedCAGR:   number
  hurdlePrice:   number      // buy price that earns the hurdle under the site CAGR convention
  exitPE:        number      // implied 2036 multiple: value at end-2036 ÷ 2036 NI
  moatCost:      number      // $/share given up to extra training vs. the underlying-margin path
  lastYear:      number
}

export function runAnthropicDCF(
  model:     AnthropicModelConfig,
  sc:        AnthropicScenario,
  wacc:      number,
  termG:     number,
  netMargin: number = model.netMarginDefault,
  extGrowthOverride?: number,
): AnthropicResult {
  const { baseYear, baseRevenue, firstRevenue, capRevenue, servingRate, peopleRate,
          taxRate, usdPerGwYear, netDebt, sharesOut, currentPrice, hurdle } = model
  const A         = model.scenarios[sc]
  const extGrowth = extGrowthOverride ?? A.extGrowth

  const g1 = Math.pow(capRevenue / firstRevenue, 1 / 9) - 1

  const rows: AnthropicRow[] = []
  const nYears = 10 + A.extYears
  let prevRev = baseRevenue
  let rev = firstRevenue

  for (let i = 0; i < nYears; i++) {
    const year  = baseYear + 1 + i
    const stage = (i < 10 ? 1 : 2) as 1 | 2
    if (i > 0) rev = stage === 1 ? rev * (1 + g1) : rev * (1 + extGrowth)

    const breakeven = A.breakevenUntil > 0 && year <= A.breakevenUntil
    const ni       = breakeven ? 0 : rev * netMargin
    const ebit     = ni / (1 - taxRate)
    const serving  = rev * servingRate
    const people   = rev * peopleRate
    const training = rev - serving - people - ebit
    const compute  = serving + training
    const pvFcf    = ni / Math.pow(1 + wacc, i + 1)

    rows.push({
      year, stage, rev, revGrowth: rev / prevRev - 1,
      serving, people, training, trainingPct: training / rev,
      compute, gw: compute / usdPerGwYear,
      ebit, opM: ebit / rev, ni, netM: ni / rev,
      eps: ni / sharesOut, pvFcf, breakeven,
    })
    prevRev = rev
  }

  const last    = rows[rows.length - 1]
  const gordon  = (1 + termG) / (wacc - termG)
  const tv      = last.ni * gordon
  const pvTv    = tv / Math.pow(1 + wacc, nYears)
  const sumPvStage1 = rows.filter(r => r.stage === 1).reduce((s, r) => s + r.pvFcf, 0)
  const sumPvStage2 = rows.filter(r => r.stage === 2).reduce((s, r) => s + r.pvFcf, 0)
  const sumPvFcf = sumPvStage1 + sumPvStage2

  const ev       = sumPvFcf + pvTv
  const equity   = ev - netDebt
  const perShare = equity / sharesOut

  const fvYear10    = perShare * Math.pow(1 + wacc, 10)
  const impliedCAGR = perShare > 0 && currentPrice > 0
    ? Math.pow(fvYear10 / currentPrice, 0.1) - 1
    : 0
  const hurdlePrice = fvYear10 / Math.pow(1 + hurdle, 10)

  // Exit P/E at end-2036: PV (at end-2036) of everything after 2036 ÷ 2036 NI
  const ni2036  = rows[9].ni
  const after   = rows.slice(10)
  const valEnd2036 =
    after.reduce((s, r, k) => s + r.ni / Math.pow(1 + wacc, k + 1), 0) +
    tv / Math.pow(1 + wacc, after.length)
  const exitPE = ni2036 > 0 ? valEnd2036 / ni2036 : 0

  // Price of the moat: per-share PV of profits forgone in breakeven years
  const moatCost = rows
    .filter(r => r.breakeven)
    .reduce((s, r) => s + (r.rev * netMargin) / Math.pow(1 + wacc, r.year - baseYear), 0) / sharesOut

  return {
    rows, stage1Growth: g1, sumPvFcf, sumPvStage1, sumPvStage2, pvTv, ev, netDebt, equity,
    perShare, gordon,
    tvWeight:   equity > 0 ? pvTv / equity : 0,
    cashWeight: equity > 0 ? -netDebt / equity : 0,
    updown:     (perShare / currentPrice - 1) * 100,
    impliedCAGR, hurdlePrice, exitPE, moatCost,
    lastYear: last.year,
  }
}

export interface AnthropicSensResult {
  waccs:   number[]
  margins: number[]
  grid:    number[][]   // [margin row][wacc col] → per-share value
}

export function buildAnthropicSensitivity(
  model: AnthropicModelConfig,
  sc:    AnthropicScenario,
  termG: number,
  extGrowth?: number,
): AnthropicSensResult {
  const waccs   = [0.09, 0.10, 0.11, 0.12, 0.15]
  const margins = [0.20, 0.237, 0.25, 0.30, 0.35]
  const grid    = margins.map(nm =>
    waccs.map(w => Math.round(runAnthropicDCF(model, sc, w, termG, nm, extGrowth).perShare)),
  )
  return { waccs, margins, grid }
}

/** Bull-case growth-decade sensitivity (ANT.md §10C). */
export function buildAnthropicGrowthSens(
  model: AnthropicModelConfig,
  wacc:  number,
  termG: number,
  netMargin: number,
): { growth: number; perShare: number; cagr: number }[] {
  return [0.05, 0.10, 0.15, 0.20].map(g => {
    const r = runAnthropicDCF(model, "bull", wacc, termG, netMargin, g)
    return { growth: g, perShare: r.perShare, cagr: r.impliedCAGR }
  })
}
