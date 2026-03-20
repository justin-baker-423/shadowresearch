// ─────────────────────────────────────────────────────────────────
//  meta-dcf-engine.ts  —  Capex-Adjusted NOPAT valuation engine.
//
//  Framework (Damodaran reinvestment-rate driven):
//    FCF = NOPAT + D&A − Capex
//    NOPAT = FoA Revenue × FoA Op Margin × (1 − tax)
//    D&A = PP&E_begin × daRate + Capex_new × daRate × 0.5  (half-year)
//    RevGrowth(t) = ROIC × max(0, NetCapex(t−1)) / NOPAT(t−1)
//
//  Year 1 (FY2026): guidance-anchored (revenue & capex are absolute).
//  Years 2–10: ROIC-driven revenue growth; capex as % of revenue.
//  Reality Labs is excluded throughout.
// ─────────────────────────────────────────────────────────────────

import type { MetaModelConfig, Scenario } from "./meta-models"

export interface MetaDCFRow {
  year:        number
  rev:         number   // FoA revenue ($B)
  revGrowth:   number   // decimal; year 1 is guidance-implied
  foaOpMargin: number   // FoA operating margin (decimal)
  nopat:       number   // NOPAT = rev × margin × (1 − tax)
  da:          number   // D&A ($B)
  capex:       number   // capital expenditures ($B)
  netCapex:    number   // Capex − D&A ($B)
  fcf:         number   // FCF = NOPAT + D&A − Capex ($B) — can be negative
  fcfM:        number   // FCF / revenue
  pvFcf:       number   // PV of FCF
  shares:      number   // diluted shares after buybacks ($B)
  ppe:         number   // gross PP&E at end of period ($B)
}

export interface MetaDCFResult {
  rows:        MetaDCFRow[]
  pvTv:        number
  sumPvFcf:    number
  ev:          number
  equity:      number
  perShare:    number
  updown:      number   // % vs current price
  tvWeight:    number   // pvTv / ev
  gordon:      number   // terminal multiple
  impliedCAGR: number   // 10-yr CAGR accreting fair value at WACC from current price
}

export function runMetaDCF(
  model:  MetaModelConfig,
  sc:     Scenario,
  wacc:   number,
  termG:  number,
  roic:   number,
): MetaDCFResult {
  const {
    foaBaseRevenue, foaYear1Revenue,
    sharesOut, netCash, currentPrice,
    taxRate, buybackSchedule, assetLife,
    basePPE, capexYear1,
  } = model
  const { foaOpMargin, capexPct } = model.scenarios[sc]

  const daRate = 1 / assetLife   // 0.10 for 10-yr useful life

  let ppe    = basePPE           // gross PP&E at 1-Jan-2026
  let shares = sharesOut
  const rows: MetaDCFRow[] = []

  // ── Year 1 (FY2026): guidance anchor ─────────────────────────
  const rev1    = foaYear1Revenue
  const capex1  = capexYear1                               // $125B absolute
  const da1     = basePPE * daRate + capex1 * daRate * 0.5 // half-year convention
  const netCap1 = capex1 - da1
  const nopat1  = rev1 * foaOpMargin[0] * (1 - taxRate)
  const fcf1    = nopat1 + da1 - capex1

  ppe    = ppe - da1 + capex1
  shares = shares * (1 - buybackSchedule[0])

  let prevRev     = rev1
  let prevNopat   = nopat1
  let prevNetCapex = netCap1

  rows.push({
    year:        2026,
    rev:         rev1,
    revGrowth:   (foaYear1Revenue - foaBaseRevenue) / foaBaseRevenue,
    foaOpMargin: foaOpMargin[0],
    nopat:       nopat1,
    da:          da1,
    capex:       capex1,
    netCapex:    netCap1,
    fcf:         fcf1,
    fcfM:        fcf1 / rev1,
    pvFcf:       fcf1 / Math.pow(1 + wacc, 1),
    shares,
    ppe,
  })

  // ── Years 2–10 (FY2027–2035): ROIC-driven ───────────────────
  for (let i = 1; i < 10; i++) {
    // Damodaran: RevGrowth = ROIC × Reinvestment Rate = ROIC × NetCapex / NOPAT
    const revGrowth = roic * Math.max(0, prevNetCapex) / prevNopat
    const rev       = prevRev * (1 + revGrowth)

    // Capex = % of this year's revenue (capexPct has 9 values, index 0 = FY2027)
    const capex   = rev * capexPct[i - 1]
    const prevPPE = ppe
    const da      = prevPPE * daRate + capex * daRate * 0.5
    const netCapex = capex - da

    ppe    = prevPPE - da + capex
    shares = shares * (1 - buybackSchedule[i])

    const nopat = rev * foaOpMargin[i] * (1 - taxRate)
    const fcf   = nopat + da - capex

    rows.push({
      year:        2026 + i,
      rev,
      revGrowth,
      foaOpMargin: foaOpMargin[i],
      nopat,
      da,
      capex,
      netCapex,
      fcf,
      fcfM:    fcf / rev,
      pvFcf:   fcf / Math.pow(1 + wacc, i + 1),
      shares,
      ppe,
    })

    prevRev      = rev
    prevNopat    = nopat
    prevNetCapex = netCapex
  }

  // ── Terminal value (Gordon Growth) ───────────────────────────
  const lastFCF  = rows[9].fcf
  const gordon   = (1 + termG) / (wacc - termG)
  const tv       = lastFCF * gordon
  const pvTv     = tv / Math.pow(1 + wacc, 10)
  const sumPvFcf = rows.reduce((s, r) => s + r.pvFcf, 0)
  const ev       = sumPvFcf + pvTv
  const equity   = ev + netCash
  const perShare = equity / rows[9].shares

  // Fair value accreted at WACC for 10 years → implied CAGR vs current price
  const fvYear10    = perShare * Math.pow(1 + wacc, 10)
  const impliedCAGR = Math.pow(fvYear10 / currentPrice, 0.1) - 1

  return {
    rows, pvTv, sumPvFcf, ev, equity, perShare,
    updown:      (perShare / currentPrice - 1) * 100,
    tvWeight:    pvTv / ev,
    gordon,
    impliedCAGR,
  }
}

// ─────────────────────────────────────────────────────────────────
//  Sensitivity: ROIC (rows) × WACC (columns)
//  Terminal growth is held at the model's slider value (passed in).
// ─────────────────────────────────────────────────────────────────
export interface MetaSensResult {
  roics: number[]    // row labels
  waccs: number[]    // column labels
  grid:  number[][]  // [roic row][wacc col] → intrinsic value/share (rounded)
}

export function buildMetaSensitivity(
  model:  MetaModelConfig,
  sc:     Scenario,
  termG:  number,
): MetaSensResult {
  const roics = [0.12, 0.15, 0.20, 0.25, 0.28]
  const waccs = [0.08, 0.09, 0.10, 0.11, 0.12]
  const grid  = roics.map(r =>
    waccs.map(w => Math.round(runMetaDCF(model, sc, w, termG, r).perShare))
  )
  return { roics, waccs, grid }
}
