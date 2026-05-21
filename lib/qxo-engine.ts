// ─────────────────────────────────────────────────────────────────
//  qxo-engine.ts  —  NOPAT-based UFCF engine for QXO, Inc.
//
//  FCF bridge per year:
//    Revenue(t)    = organicRev(t) + maRev(t)
//    organicRev(t) = organicRev(t-1) × (1 + revGrowth)
//    maRev(t)      = prior M&A pool grown at revGrowth + new acquisitions
//    EBITDA Margin = min(startMargin + t × bpsPerYear, finalMargin)
//    EBITDA        = Revenue × ebitdaM
//    D&A           = Revenue × daRate   [1.5%]
//    EBIT          = EBITDA − D&A
//    NOPAT         = EBIT × (1 − taxRate)
//    CapEx         = Revenue × capexRate [1.5% = D&A → net capex = 0]
//    ΔWC           = (totalRev − prevTotalRev) × nwcRate
//    UFCF_preMa    = NOPAT + D&A − CapEx − ΔWC  =  NOPAT − ΔWC
//
//  M&A flywheel (when maRate > 0):
//    maSpend(t)    = maRate × max(0, UFCF_preMa(t))
//    maNewRev(t)   = maSpend(t) / (maMultiple × ebitdaM(t))
//    maRevPool(t+1)= maRevPool(t) × (1 + revGrowth) + maNewRev(t)
//    UFCF(t)       = UFCF_preMa(t) − maSpend(t)   ← distributable FCF
//
//  When maRate = 0 the engine is identical to the original.
// ─────────────────────────────────────────────────────────────────

import type { QxoModelConfig, QxoScenario } from "./qxo-models"

export interface QxoRow {
  year:       number
  organicRev: number   // $B — organic only
  maRev:      number   // $B — M&A-pool revenue this year
  rev:        number   // $B — total (organic + MA)
  ebitdaM:    number   // EBITDA margin (decimal)
  ebitda:     number   // $B
  da:         number   // $B
  ebit:       number   // $B
  nopat:      number   // $B
  capex:      number   // $B
  dwc:        number   // $B (positive = cash use)
  ufcfPreMa:  number   // $B — before M&A reinvestment spend
  maSpend:    number   // $B — reinvested in acquisitions
  ufcf:       number   // $B — distributable (after M&A spend)
  pvFcf:      number   // $B
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
  maRate:    number = 0,  // fraction of pre-MA UFCF reinvested in acquisitions (0–1)
): QxoResult {
  const cfg = model.scenarios[sc]
  const { startMargin, yrsExpansion, daRate, capexRate, nwcRate, taxRate, maMultiple } = model
  const bpsPerYear  = (cfg.totalExpBps / yrsExpansion) / 10000
  const finalMargin = startMargin + cfg.totalExpBps / 10000

  const rows: QxoRow[] = []

  let prevOrganicRev = model.baseRevenue   // organic revenue base for growth calculation
  let prevTotalRev   = model.baseRevenue   // total revenue base for ΔWC calculation
  let maRevPool      = 0                   // M&A revenue pool contributing this year

  for (let t = 1; t <= 10; t++) {
    // ── Revenue ────────────────────────────────────────────────
    const organicRev = prevOrganicRev * (1 + cfg.revGrowth)
    const maRev      = maRevPool
    const rev        = organicRev + maRev

    // ── P&L ────────────────────────────────────────────────────
    const ebitdaM = Math.min(startMargin + t * bpsPerYear, finalMargin)
    const ebitda  = rev * ebitdaM
    const da      = rev * daRate
    const ebit    = ebitda - da
    const nopat   = ebit * (1 - taxRate)
    const capex   = rev * capexRate

    // ΔWC on total revenue change (conservative: acquired NWC baked into deal price,
    // but ongoing growth of MA businesses does require incremental NWC)
    const dwc = (rev - prevTotalRev) * nwcRate

    // ── FCF bridge ─────────────────────────────────────────────
    const ufcfPreMa = nopat + da - capex - dwc  // = nopat - dwc (da=capex cancel)

    // ── M&A reinvestment ───────────────────────────────────────
    const maSpend  = maRate > 0 ? Math.max(0, ufcfPreMa) * maRate : 0
    const maNewRev = maSpend > 0 ? maSpend / (maMultiple * ebitdaM) : 0
    const ufcf     = ufcfPreMa - maSpend
    const pvFcf    = ufcf / Math.pow(1 + wacc, t)

    rows.push({ year: 2026 + t, organicRev, maRev, rev, ebitdaM, ebitda, da, ebit, nopat, capex, dwc, ufcfPreMa, maSpend, ufcf, pvFcf })

    // ── Advance state ──────────────────────────────────────────
    prevOrganicRev = organicRev
    prevTotalRev   = rev
    // Prior MA pool grows at revGrowth; new acquisition added at end of year (full contribution next year)
    maRevPool = maRev * (1 + cfg.revGrowth) + maNewRev
  }

  const sumPvFcf = rows.reduce((s, r) => s + r.pvFcf, 0)
  // TV uses ufcfPreMa: in terminal year the assembled business's full earnings
  // power is capitalized; ongoing M&A at termG is embedded in the perpetuity.
  const tv       = rows[9].ufcfPreMa * (1 + termG) / (wacc - termG)
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
    gordon:   tv / rows[9].ufcfPreMa,
    impliedCAGR,
  }
}

export function buildQxoSensitivity(
  model:     QxoModelConfig,
  sc:        QxoScenario,
  sharesOut: number,
  maRate:    number = 0,
): { waccs: number[]; tgrs: number[]; grid: number[][] } {
  const waccs = [0.08, 0.09, 0.10, 0.11, 0.12]
  const tgrs  = [0.020, 0.025, 0.030, 0.035, 0.040]
  const grid  = tgrs.map(tg =>
    waccs.map(w => runQxoDCF(model, sc, w, tg, sharesOut, maRate).perShare)
  )
  return { waccs, tgrs, grid }
}
