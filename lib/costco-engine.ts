// ─────────────────────────────────────────────────────────────────
//  costco-engine.ts  —  Pure calculation, no React.
//
//  EBIT  = rev × opMargin
//  NOPAT = EBIT × (1 − tax)                  [proxy for net income —
//                                              Costco's net cash position
//                                              makes financing effects
//                                              immaterial, so NI ≈ NOPAT]
//  D&A   = rev × dnaRate                     [held flat, added back —
//                                              standard UFCF treatment]
//  Capex = rev × capexRate                   [held flat — "capex to
//                                              support 8% growth"]
//  NWC tailwind = (rev − prevRev) × nwcTailwindRate
//                                             [Costco's negative-working-
//                                              capital float: growth itself
//                                              throws off cash]
//  FCF   = NOPAT + D&A − Capex + NWC tailwind
//  DPS   = FCF / shares                      [100% of residual FCF paid
//                                              out — no buybacks, shares
//                                              and net cash held flat]
//
//  EV     = Σ PV(FCF) + PV(TV)               TV = FCF₁₀ × (1+g)/(w−g)
//  Equity = EV − net debt                    [net debt is negative here,
//                                              i.e. net cash adds to equity]
//  perShare = Equity / shares
// ─────────────────────────────────────────────────────────────────

import type { CostcoModelConfig, CostcoScenario } from "./costco-models"

export interface CostcoRow {
  year:      number
  rev:       number   // $B
  revGrowth: number
  grossM:    number
  gross:     number   // $B gross profit (display)
  opM:       number
  ebit:      number   // $B operating income
  nopat:     number   // $B unlevered after-tax (≈ net income proxy)
  eps:       number   // $/share (NOPAT / shares)
  dna:       number   // $B D&A add-back
  capexRate: number
  capex:     number   // $B
  nwcTailwind: number // $B working-capital cash inflow from revenue growth
  fcf:       number   // $B residual free cash flow
  pvFcf:     number   // $B
  dps:       number   // $/share (= fcf / shares — 100% payout)
  divGrowth: number
  payout:    number   // dps / eps
}

export interface CostcoResult {
  rows:        CostcoRow[]
  sumPvFcf:    number   // $B
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
}

export function runCostcoDCF(
  model: CostcoModelConfig,
  sc:    CostcoScenario,
  wacc:  number,
  termG: number,
): CostcoResult {
  const { baseRevenue, netDebt, sharesOut, taxRate, capexRate, dnaRate, nwcTailwindRate, dps0, currentPrice } = model
  const { revGrowth, grossMargin, opMargin } = model.scenarios[sc]

  const rows: CostcoRow[] = []
  let prevDps = dps0
  let prevRev = baseRevenue

  for (let i = 0; i < 10; i++) {
    const year  = 2026 + i
    const rev   = baseRevenue * Math.pow(1 + revGrowth, i + 1)
    const gross = rev * grossMargin
    const ebit  = rev * opMargin

    const nopat = ebit * (1 - taxRate)
    const eps   = nopat / sharesOut

    const dna         = rev * dnaRate
    const capex       = rev * capexRate
    const nwcTailwind = (rev - prevRev) * nwcTailwindRate
    const fcf   = nopat + dna - capex + nwcTailwind
    const pvFcf = fcf / Math.pow(1 + wacc, i + 1)

    const dps       = fcf / sharesOut          // 100% of residual FCF paid out
    const divGrowth = prevDps > 0 ? (dps - prevDps) / prevDps : 0
    const payout    = eps > 0 ? dps / eps : 0

    rows.push({
      year, rev, revGrowth, grossM: grossMargin, gross,
      opM: opMargin, ebit, nopat, eps, dna,
      capexRate, capex, nwcTailwind, fcf, pvFcf,
      dps, divGrowth, payout,
    })

    prevDps = dps
    prevRev = rev
  }

  const lastFcf = rows[9].fcf
  const gordon  = (1 + termG) / (wacc - termG)
  const tv      = lastFcf * gordon
  const pvTv    = tv / Math.pow(1 + wacc, 10)
  const sumPvFcf = rows.reduce((s, r) => s + r.pvFcf, 0)

  const ev       = sumPvFcf + pvTv
  const equity   = ev - netDebt
  const perShare = equity / sharesOut

  const fvYear10    = perShare * Math.pow(1 + wacc, 10)
  const impliedCAGR = perShare > 0 && currentPrice > 0
    ? Math.pow(fvYear10 / currentPrice, 0.1) - 1
    : 0

  return {
    rows, sumPvFcf, pvTv, ev, netDebt, equity, perShare, gordon,
    tvWeight:    ev > 0 ? pvTv / ev : 0,
    updown:      (perShare / currentPrice - 1) * 100,
    impliedCAGR,
    divYieldFwd: rows[0].dps / currentPrice,
    divYieldTtm: dps0 / currentPrice,
  }
}

export interface CostcoSensResult {
  waccs:  number[]
  tgrows: number[]
  grid:   number[][]   // [termG row][wacc col] → per-share value
}

export function buildCostcoSensitivity(
  model: CostcoModelConfig,
  sc:    CostcoScenario,
): CostcoSensResult {
  const waccs  = [0.07, 0.08, 0.09, 0.10, 0.11]
  const tgrows = [0.020, 0.025, 0.030, 0.035, 0.040]
  const grid   = tgrows.map(tg =>
    waccs.map(w => Math.round(runCostcoDCF(model, sc, w, tg).perShare)),
  )
  return { waccs, tgrows, grid }
}
