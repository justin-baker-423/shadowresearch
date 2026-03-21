// ─────────────────────────────────────────────────────────────────
//  dcf-engine.ts  —  Pure calculation functions, no React.
//  Works with any ModelConfig from models.ts.
// ─────────────────────────────────────────────────────────────────

import type { ModelConfig, Scenario } from "./models"

export interface DCFRow {
  year:        number
  rev:         number
  revGrowth:   number
  niM:         number   // non-IFRS margin
  oeM:         number   // owner-earnings margin (post SBC haircut)
  fcfM:        number   // FCF margin (post tax)
  fcf:         number
  pvFcf:       number
  shares:      number
  sharesBought?: number // shares repurchased via FCF (billions), only when buybackPE is set
}

export interface DCFResult {
  rows:         DCFRow[]
  pvTv:         number
  sumPvFcf:     number
  ev:           number
  equity:       number
  perShare:     number
  updown:       number   // % vs current price
  tvWeight:     number   // TV / EV
  gordon:       number   // TV multiple
  impliedCAGR:  number   // 10-yr CAGR: fair value accreted at WACC from current price
}

export function runDCF(
  model:  ModelConfig,
  sc:     Scenario,
  wacc:   number,
  termG:  number,
): DCFResult {
  const { baseRevenue, sharesOut, netCash, currentPrice,
          taxRate, sbcHaircut, buybackRate, buybackPE } = model
  const { revGrowth, niMargin } = model.scenarios[sc]

  let rev    = baseRevenue
  let shares = sharesOut
  const rows: DCFRow[] = []

  for (let i = 0; i < 10; i++) {
    rev = rev * (1 + revGrowth[i])
    const niM  = niMargin[i]
    const oeM  = niM - sbcHaircut
    const fcfM = oeM * (1 - taxRate)
    const fcf  = rev * fcfM

    let sharesBought: number | undefined
    if (buybackPE) {
      // 100% of FCF repurchased at (buybackPE × owner-earnings per share)
      // buyback price = buybackPE × (fcf / shares)
      // shares bought = fcf / buyback price = shares / buybackPE
      sharesBought = shares / buybackPE
      shares = shares - sharesBought
    } else {
      shares = shares * (1 - buybackRate)
    }

    rows.push({
      year:      2026 + i,
      rev,
      revGrowth: revGrowth[i],
      niM, oeM, fcfM, fcf,
      pvFcf: fcf / Math.pow(1 + wacc, i + 1),
      shares,
      sharesBought,
    })
  }

  const lastFCF  = rows[9].fcf
  const gordon   = (1 + termG) / (wacc - termG)
  const tv       = lastFCF * gordon
  const pvTv     = tv / Math.pow(1 + wacc, 10)
  const sumPvFcf = rows.reduce((s, r) => s + r.pvFcf, 0)
  const ev       = sumPvFcf + pvTv
  const equity   = ev + netCash
  const perShare = equity / rows[9].shares

  // Fair value accreted at WACC for 10 years, divided by current price → CAGR
  const fvYear10     = perShare * Math.pow(1 + wacc, 10)
  const impliedCAGR  = Math.pow(fvYear10 / currentPrice, 0.1) - 1

  return {
    rows, pvTv, sumPvFcf, ev, equity, perShare,
    updown:      (perShare / currentPrice - 1) * 100,
    tvWeight:    pvTv / ev,
    gordon,
    impliedCAGR,
  }
}

export interface SensResult {
  waccs:  number[]
  tgrows: number[]
  grid:   number[][]   // [termG row][wacc col] → intrinsic value
}

export function buildSensitivity(model: ModelConfig, sc: Scenario): SensResult {
  const waccs  = [0.08, 0.09, 0.10, 0.11, 0.12]
  const tgrows = [0.020, 0.025, 0.030, 0.035, 0.040]
  const grid   = tgrows.map(tg =>
    waccs.map(w => Math.round(runDCF(model, sc, w, tg).perShare))
  )
  return { waccs, tgrows, grid }
}
