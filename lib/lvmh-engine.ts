// ─────────────────────────────────────────────────────────────────
//  lvmh-engine.ts  —  Pure calculation, no React.
//
//  Standard earnings DCF (all internal math in EUR, output per-ADR USD):
//
//    earnings(t)   = rev(t) × niMargin(t)            [net income, group share]
//    PV(earnings)  = Σ earnings(t) / (1+wacc)^t
//    TV            = earnings(10) × (1+g)/(wacc−g)
//    earningsValue = PV(earnings) + PV(TV)           [EV-like, EUR]
//    equity        = earningsValue + netCash          [+ net cash / − debt]
//
//    perOrdinaryEur = equity / sharesOut
//    perAdrUsd      = perOrdinaryEur × fx / adrPerShare
//
//  perShare (the headline) is the per-ADR USD value, so it compares
//  directly to the live LVMUY price.
// ─────────────────────────────────────────────────────────────────

import type { LvmhModelConfig, LvmhScenario } from "./lvmh-models"

export interface LvmhRow {
  year:      number
  rev:       number   // €B
  revGrowth: number
  niM:       number
  earnings:  number   // €B net income, group share
  pvEarn:    number   // €B
}

export interface LvmhResult {
  rows:          LvmhRow[]
  sumPvEarn:     number   // €B
  pvTv:          number   // €B
  earningsValue: number   // €B  (PV earnings + PV TV)
  netCash:       number   // €B
  equity:        number   // €B  intrinsic equity value
  perOrdinaryEur: number  // € per ordinary share
  perShare:      number   // $ per ADR  ← headline, compares to LVMUY price
  gordon:        number
  tvWeight:      number
  updown:        number   // % vs current ADR price
  impliedCAGR:   number   // 10-yr CAGR off the ADR value
  divYieldAdr:   number   // trailing dividend yield on the ADR
}

export function runLvmhDCF(
  model: LvmhModelConfig,
  sc:    LvmhScenario,
  wacc:  number,
  termG: number,
  fx:    number,        // EUR→USD
): LvmhResult {
  const { baseRevenue, netCash, sharesOut, adrPerShare,
          currentPrice, dps } = model
  const { revGrowth, niMargin } = model.scenarios[sc]

  let rev = baseRevenue
  const rows: LvmhRow[] = []

  for (let i = 0; i < 10; i++) {
    rev = rev * (1 + revGrowth[i])
    const niM      = niMargin[i]
    const earnings = rev * niM
    rows.push({
      year:      2026 + i,
      rev,
      revGrowth: revGrowth[i],
      niM,
      earnings,
      pvEarn:    earnings / Math.pow(1 + wacc, i + 1),
    })
  }

  const lastEarn  = rows[9].earnings
  const gordon    = (1 + termG) / (wacc - termG)
  const tv        = lastEarn * gordon
  const pvTv      = tv / Math.pow(1 + wacc, 10)
  const sumPvEarn = rows.reduce((s, r) => s + r.pvEarn, 0)

  const earningsValue = sumPvEarn + pvTv
  const equity        = earningsValue + netCash

  const perOrdinaryEur = equity / sharesOut
  const perShare       = (perOrdinaryEur * fx) / adrPerShare   // USD per ADR

  const fvYear10    = perShare * Math.pow(1 + wacc, 10)
  const impliedCAGR = Math.pow(fvYear10 / currentPrice, 0.1) - 1
  const divYieldAdr = (dps * fx / adrPerShare) / currentPrice

  return {
    rows,
    sumPvEarn,
    pvTv,
    earningsValue,
    netCash,
    equity,
    perOrdinaryEur,
    perShare,
    gordon,
    tvWeight:    pvTv / earningsValue,
    updown:      (perShare / currentPrice - 1) * 100,
    impliedCAGR,
    divYieldAdr,
  }
}

export interface LvmhSensResult {
  waccs:  number[]
  tgrows: number[]
  grid:   number[][]   // per-ADR USD intrinsic value
}

export function buildLvmhSensitivity(
  model: LvmhModelConfig,
  sc:    LvmhScenario,
  fx:    number,
): LvmhSensResult {
  const waccs  = [0.08, 0.09, 0.10, 0.11, 0.12]
  const tgrows = [0.020, 0.025, 0.030, 0.035, 0.040]
  const grid   = tgrows.map(tg =>
    waccs.map(w => Math.round(runLvmhDCF(model, sc, w, tg, fx).perShare))
  )
  return { waccs, tgrows, grid }
}
