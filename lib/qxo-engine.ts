// ─────────────────────────────────────────────────────────────────
//  qxo-engine.ts  —  NOPAT-based UFCF engine for QXO, Inc.
//
//  FCF bridge per year:
//    Revenue(t)    = Revenue(t-1) × (1 + revGrowth)
//    EBITDA Margin = min(startMargin + t × bpsPerYear, finalMargin)
//    EBITDA        = Revenue × ebitdaM
//    D&A           = Revenue × daRate   [1.5%]
//    EBIT          = EBITDA − D&A
//    NOPAT         = EBIT × (1 − taxRate)
//    CapEx         = Revenue × capexRate [1.5% = D&A → net capex = 0]
//    ΔWC           = (Revenue − Revenue_prev) × nwcRate
//    UFCF          = NOPAT + D&A − CapEx − ΔWC  =  NOPAT − ΔWC
// ─────────────────────────────────────────────────────────────────

import type { QxoModelConfig, QxoScenario } from "./qxo-models"

export interface QxoRow {
  year:    number
  rev:     number   // $B
  ebitdaM: number   // EBITDA margin (decimal)
  ebitda:  number   // $B
  da:      number   // $B
  ebit:    number   // $B
  nopat:   number   // $B
  capex:   number   // $B
  dwc:     number   // $B (positive = cash outflow)
  ufcf:    number   // $B
  pvFcf:   number   // $B
}

export interface QxoResult {
  rows:        QxoRow[]
  pvTv:        number
  sumPvFcf:    number
  ev:          number
  equity:      number   // EV − netDebt
  perShare:    number   // equity / sharesOut (sharesOut in billions → $/share)
  updown:      number   // % vs currentPrice
  tvWeight:    number   // pvTv / ev
  gordon:      number   // TV / UFCF₁₀ multiple
  impliedCAGR: number   // 10-yr WACC-accreted CAGR: (perShare×(1+WACC)^10/currentPrice)^0.1 − 1
}

export function runQxoDCF(
  model:     QxoModelConfig,
  sc:        QxoScenario,
  wacc:      number,
  termG:     number,
  sharesOut: number,   // billions — slider override
): QxoResult {
  const cfg = model.scenarios[sc]
  const { startMargin, yrsExpansion, daRate, capexRate, nwcRate, taxRate } = model
  const bpsPerYear  = (cfg.totalExpBps / yrsExpansion) / 10000
  const finalMargin = startMargin + cfg.totalExpBps / 10000

  const rows: QxoRow[] = []
  let prevRev = model.baseRevenue

  for (let t = 1; t <= 10; t++) {
    const rev     = prevRev * (1 + cfg.revGrowth)
    const ebitdaM = Math.min(startMargin + t * bpsPerYear, finalMargin)
    const ebitda  = rev * ebitdaM
    const da      = rev * daRate
    const ebit    = ebitda - da
    const nopat   = ebit * (1 - taxRate)
    const capex   = rev * capexRate
    const dwc     = (rev - prevRev) * nwcRate
    const ufcf    = nopat + da - capex - dwc
    const pvFcf   = ufcf / Math.pow(1 + wacc, t)

    rows.push({ year: 2026 + t, rev, ebitdaM, ebitda, da, ebit, nopat, capex, dwc, ufcf, pvFcf })
    prevRev = rev
  }

  const sumPvFcf = rows.reduce((s, r) => s + r.pvFcf, 0)
  const ufcf10   = rows[9].ufcf
  const tv       = ufcf10 * (1 + termG) / (wacc - termG)
  const pvTv     = tv / Math.pow(1 + wacc, 10)
  const ev       = sumPvFcf + pvTv
  const equity   = ev - model.netDebt
  const perShare = equity / sharesOut

  const fvYear10    = perShare * Math.pow(1 + wacc, 10)
  const impliedCAGR = Math.pow(fvYear10 / model.currentPrice, 0.1) - 1

  return {
    rows,
    pvTv,
    sumPvFcf,
    ev,
    equity,
    perShare,
    updown:   (perShare / model.currentPrice - 1) * 100,
    tvWeight: pvTv / ev,
    gordon:   tv / ufcf10,
    impliedCAGR,
  }
}

export function buildQxoSensitivity(
  model:     QxoModelConfig,
  sc:        QxoScenario,
  sharesOut: number,
): { waccs: number[]; tgrs: number[]; grid: number[][] } {
  const waccs = [0.08, 0.09, 0.10, 0.11, 0.12]
  const tgrs  = [0.020, 0.025, 0.030, 0.035, 0.040]
  const grid  = tgrs.map(tg =>
    waccs.map(w => runQxoDCF(model, sc, w, tg, sharesOut).perShare)
  )
  return { waccs, tgrs, grid }
}
