// ─────────────────────────────────────────────────────────────────
//  tesla-engine.ts  —  Pure calculation functions for the
//  Tesla multi-segment DCF.  No React.
//
//  FCF per year is stored in the model config (pre-computed from
//  Excel).  The engine re-discounts those FCFs at the chosen WACC
//  and computes the terminal value at the chosen termG.
//  EBIT is derived from segment revenues × segment EBIT margins and
//  is used for display only.
// ─────────────────────────────────────────────────────────────────

import type { TeslaModelConfig } from "./tesla-models"

export interface TeslaRow {
  year:           number
  // Segment revenues ($B)
  coreAutoRev:    number
  energyRev:      number
  cybercabRev:    number
  fsdOemRev:      number
  fsdTeslaRev:    number
  pvnRev:         number
  totalRev:       number
  revGrowth:      number
  // Consolidated P&L (display)
  ebit:           number    // sum of segment EBITs ($B)
  ebitMargin:     number    // EBIT / totalRev
  // Cash flow
  fcf:            number    // pre-computed from Excel ($B)
  pvFcf:          number    // discounted at chosen WACC ($B)
}

export interface TeslaResult {
  rows:        TeslaRow[]
  pvTv:        number       // PV of terminal value ($B)
  sumPvFcf:    number       // sum of PV FCFs yr 1–10 ($B)
  ev:          number       // enterprise value ($B)
  equity:      number       // EV + terminalNetCash ($B)
  perShare:    number       // equity / sharesOut
  updown:      number       // % vs currentPrice
  tvWeight:    number       // pvTv / ev
  gordon:      number       // terminal multiple
  impliedCAGR: number       // fair value accreted at WACC ÷ current price
}

export function runTeslaDCF(
  model: TeslaModelConfig,
  wacc:  number,
  termG: number,
): TeslaResult {
  const { segmentRevenue: seg, totalRevenue, fcfSchedule,
          ebitMargins: em, sharesOut, terminalNetCash, currentPrice } = model

  // Derive base total revenue (implied FY2025) for first-year growth calc
  // FY2025 total ≈ Core Auto $97B + Energy $10B = $107B per Excel assumptions sheet
  const baseTotal = 107.0

  const rows: TeslaRow[] = []

  for (let i = 0; i < 10; i++) {
    const coreAutoRev    = seg.coreAuto[i]
    const energyRev      = seg.energy[i]
    const cybercabRev    = seg.cybercab[i]
    const fsdOemRev      = seg.fsdOem[i]
    const fsdTeslaRev    = seg.fsdTeslaOwners[i]
    const pvnRev         = seg.pvn[i]
    const totalRev       = totalRevenue[i]

    const prevTotal      = i === 0 ? baseTotal : totalRevenue[i - 1]
    const revGrowth      = (totalRev - prevTotal) / prevTotal

    // Consolidated EBIT from segment revenues × constant EBIT margins
    const ebit =
      coreAutoRev    * em.coreAuto       +
      energyRev      * em.energy         +
      cybercabRev    * em.cybercab       +
      fsdOemRev      * em.fsdOem         +
      fsdTeslaRev    * em.fsdTeslaOwners +
      pvnRev         * em.pvn

    const fcf   = fcfSchedule[i]
    const pvFcf = fcf / Math.pow(1 + wacc, i + 1)

    rows.push({
      year: 2026 + i,
      coreAutoRev, energyRev, cybercabRev, fsdOemRev, fsdTeslaRev, pvnRev,
      totalRev, revGrowth, ebit,
      ebitMargin: totalRev > 0 ? ebit / totalRev : 0,
      fcf, pvFcf,
    })
  }

  const lastFCF  = rows[9].fcf
  const gordon   = (1 + termG) / (wacc - termG)
  const tv       = lastFCF * gordon
  const pvTv     = tv / Math.pow(1 + wacc, 10)
  const sumPvFcf = rows.reduce((s, r) => s + r.pvFcf, 0)
  const ev       = sumPvFcf + pvTv

  // Tesla equity bridge: EV + accumulated terminal net cash (not today's net cash)
  const equity   = ev + terminalNetCash
  const perShare = equity / sharesOut

  const fvYear10    = perShare * Math.pow(1 + wacc, 10)
  const impliedCAGR = Math.pow(fvYear10 / currentPrice, 0.1) - 1

  return {
    rows, pvTv, sumPvFcf, ev, equity, perShare,
    updown:   (perShare / currentPrice - 1) * 100,
    tvWeight: pvTv / ev,
    gordon,
    impliedCAGR,
  }
}

export interface TeslaSensResult {
  waccs:  number[]
  tgrows: number[]
  grid:   number[][]   // [termG row][wacc col] → intrinsic value per share
}

export function buildTeslaSensitivity(model: TeslaModelConfig): TeslaSensResult {
  const waccs  = [0.08, 0.09, 0.10, 0.11, 0.12]
  const tgrows = [0.020, 0.025, 0.030, 0.035, 0.040]
  const grid   = tgrows.map(tg =>
    waccs.map(w => Math.round(runTeslaDCF(model, w, tg).perShare))
  )
  return { waccs, tgrows, grid }
}
