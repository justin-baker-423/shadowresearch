// ─────────────────────────────────────────────────────────────────
//  meta-dcf-engine.ts  —  Three-Driver Capex-Adjusted NOPAT engine.
//
//  Revenue growth formula (FY2027 onward):
//    RevGrowth(t) = adMarketGrowth
//                 + shareGain(t)
//                 + ROIC × max(0, NetCapex(t−2)) / Rev(t−1)
//
//    Driver 1 — Market floor:  global ad TAM grows at adMarketGrowth (permanent)
//    Driver 2 — AI advantage:  shareGain(t) from scenario schedule, decays to 0
//    Driver 3 — Capex upside:  2-yr-lagged net capex monetised at ROIC
//
//  FY2026 is guidance-anchored (revenue & capex are absolute).
//  FY2027 growth is seeded by FY2025 actual net capex (model.netCapexSeed).
//  Capex in FY2027–2028 is elevated to absorb ~100% of FCF (near-zero free cash).
//
//  FCF = NOPAT + D&A − Capex
//  NOPAT = FoA Revenue × FoA Op Margin × (1 − tax)
//  D&A = PP&E_begin × daRate + Capex_new × daRate × 0.5  (half-year)
//
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
  adTAM:       number   // total global ad market this year ($B)
  mktShare:    number   // Meta's implied share of total global ad market (decimal)
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
  model:       MetaModelConfig,
  sc:          Scenario,
  wacc:        number,
  termG:       number,
  roic:        number,
  adMktGrowth?: number,   // optional — falls back to model.adMarketGrowth
): MetaDCFResult {
  const {
    foaBaseRevenue, foaYear1Revenue,
    sharesOut, netCash, currentPrice,
    taxRate, buybackSchedule, assetLife,
    basePPE, capexYear1, netCapexSeed, adTam2025,
  } = model
  const adMarketGrowth = adMktGrowth ?? model.adMarketGrowth
  const { foaOpMargin, capexPct, shareGainSchedule } = model.scenarios[sc]

  const daRate = 1 / assetLife   // 0.10 for 10-yr useful life

  let ppe    = basePPE           // gross PP&E at 1-Jan-2026
  let shares = sharesOut
  const rows: MetaDCFRow[] = []

  // ── Year 1 (FY2026): guidance anchor ─────────────────────────
  const rev1    = foaYear1Revenue
  const capex1  = capexYear1
  const da1     = basePPE * daRate + capex1 * daRate * 0.5
  const netCap1 = capex1 - da1
  const nopat1  = rev1 * foaOpMargin[0] * (1 - taxRate)
  const fcf1    = nopat1 + da1 - capex1
  const adTAM1  = adTam2025 * Math.pow(1 + adMarketGrowth, 1)  // 2026 TAM

  ppe    = ppe - da1 + capex1
  shares = shares * (1 - buybackSchedule[0])

  let prevRev = rev1

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
    adTAM:       adTAM1,
    mktShare:    rev1 / adTAM1,
  })

  // ── Years 2–10 (FY2027–2035): two-driver growth ──────────────
  for (let i = 1; i < 10; i++) {
    // 2-year lag: FY2027 (i=1) uses FY2025 seed; FY2028+ uses rows[i-2]
    const netCapexLagged = i === 1 ? netCapexSeed : rows[i - 2].netCapex
    const shareGain      = shareGainSchedule[i - 1] ?? 0

    // Three drivers: market floor + AI competitive advantage + lagged capex ROIC
    const revGrowth = adMarketGrowth + shareGain + roic * Math.max(0, netCapexLagged) / prevRev
    const rev       = prevRev * (1 + revGrowth)

    const capex   = rev * capexPct[i - 1]
    const prevPPE = ppe
    const da      = prevPPE * daRate + capex * daRate * 0.5
    const netCapex = capex - da

    ppe    = prevPPE - da + capex
    shares = shares * (1 - buybackSchedule[i])

    const nopat = rev * foaOpMargin[i] * (1 - taxRate)
    const fcf   = nopat + da - capex

    const yearNum = 2026 + i
    const adTAM   = adTam2025 * Math.pow(1 + adMarketGrowth, yearNum - 2025)

    rows.push({
      year:        yearNum,
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
      adTAM,
      mktShare: rev / adTAM,
    })

    prevRev = rev
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
//  Sensitivity: Ad Market Growth (rows) × ROIC (columns)
//  WACC and terminal growth held at slider values.
// ─────────────────────────────────────────────────────────────────
export interface MetaSensResult {
  adMktGrowths: number[]   // row labels
  roics:        number[]   // column labels
  grid:         number[][] // [adMktGrowth row][roic col] → intrinsic value/share
}

export function buildMetaSensitivity(
  model:  MetaModelConfig,
  sc:     Scenario,
  termG:  number,
  wacc:   number,
): MetaSensResult {
  const adMktGrowths = [0.04, 0.05, 0.06, 0.07, 0.08, 0.09]
  const roics        = [0.12, 0.15, 0.20, 0.25, 0.28]
  const grid = adMktGrowths.map(g =>
    roics.map(r => Math.round(runMetaDCF(model, sc, wacc, termG, r, g).perShare))
  )
  return { adMktGrowths, roics, grid }
}
