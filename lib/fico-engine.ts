// ─────────────────────────────────────────────────────────────────
//  fico-engine.ts  —  Two-segment SOTP DCF engine for Fair Isaac
//
//  Per-year integrated FCF:
//    ScoresRev(t)      = scoresBaseRev × (1+scoresPriceGrowth)^t
//    ScoresFixedCosts(t) = scoresFixedCosts × (1+scoresFixedCostGrowth)^t
//    ScoresOpIncome(t) = ScoresRev(t) − ScoresFixedCosts(t)
//
//    SoftwareRev(t)    = softwareBaseRev × (1+softwareGrowth)^t
//    SoftwareMargin(t) = lerp(softwareMarginStart → softwareMarginTarget, t/10)
//    SoftwareOpIncome(t) = SoftwareRev(t) × SoftwareMargin(t)
//
//    CorpG&A(t)        = corpGandABase × (1+corpGrowthRate)^t
//    SBC(t)            = sbcAnnual × (1+sbcGrowthRate)^t
//
//    EBIT              = ScoresOpIncome + SoftwareOpIncome − CorpG&A
//    PreTaxIncome      = EBIT − interestExpense
//    NetIncome         = PreTaxIncome × (1−taxRate)
//    FCF               = NetIncome + dnaAnnual + SBC(t) − capexAnnual
//
//  Net buybacks (SBC add-back in FCF does not represent real cash):
//    BuybackCapacity   = FCF − SBC(t)
//    NetSharesRetired  = BuybackCapacity / buybackPrice
//
//  SOTP standalone segment EVs:
//    Scores EV   = Σ PV(ScoresOpIncome × (1−tax)) + PV(TV_scores)
//    Software EV = Σ PV(SoftwareOpIncome × (1−tax)) + PV(TV_software)
//    Corp Bridge = Total Integrated EV − Scores EV − Software EV  (perpetual drag)
// ─────────────────────────────────────────────────────────────────

import type { FicoModelConfig, FicoScenario } from "./fico-models"

export interface FicoRow {
  year: number

  // Scores segment
  scoresRev:             number
  scoresFixedCostsYear:  number
  scoresOpIncome:        number
  scoresOpMargin:        number
  scoresPostTax:         number   // ScoresOpIncome × (1−tax) — segment standalone FCF proxy
  scoresPvPostTax:       number

  // Software segment
  softwareRev:           number
  softwareMargin:        number
  softwareOpIncome:      number
  softwarePostTax:       number
  softwarePvPostTax:     number

  // Corporate
  corpGandA:             number
  sbcYear:               number

  // Integrated P&L
  ebit:                  number
  ebitMargin:            number
  preTaxIncome:          number
  netIncome:             number
  totalFcf:              number
  pvFcf:                 number

  // Buybacks (net of SBC)
  buybackCapacity:       number
  buybackPrice:          number
  netSharesRetired:      number
  shares:                number
  cumulRetired:          number

  // Total
  totalRev:              number
}

export interface FicoSotpResult {
  rows: FicoRow[]

  // ── Scores standalone ─────────────────────────────────────────
  scoresSumPvPostTax: number
  scoresPvTv:         number
  scoresEv:           number

  // ── Software standalone ───────────────────────────────────────
  softwareSumPvPostTax: number
  softwarePvTv:         number
  softwareEv:           number

  // ── Integrated totals ─────────────────────────────────────────
  sumPvFcf:           number
  pvTv:               number
  ev:                 number
  equity:             number
  perShare:           number
  updown:             number

  // ── Corp bridge ───────────────────────────────────────────────
  corpBridge:         number   // ev − scoresEv − softwareEv (negative drag)

  // ── Summary metrics ───────────────────────────────────────────
  tvWeight:           number
  gordon:             number
  impliedCAGR:        number
  impliedScoresGrowth: number
}

// ── Inner calculation (no reverse DCF) ───────────────────────────
function calcFicoSotp(
  model:                  FicoModelConfig,
  scoresPriceGrowth:      number,
  softwareGrowth:         number,
  softwareMarginTarget:   number,
  wacc:                   number,
  termG:                  number,
): {
  rows: FicoRow[]
  scoresSumPvPostTax: number; scoresPvTv: number; scoresEv: number
  softwareSumPvPostTax: number; softwarePvTv: number; softwareEv: number
  sumPvFcf: number; pvTv: number; ev: number; equity: number; perShare: number; gordon: number
} {
  const {
    scoresBaseRev, scoresFixedCosts, scoresFixedCostGrowth,
    softwareBaseRev, softwareMarginStart,
    corpGandABase, corpGrowthRate,
    interestExpense, dnaAnnual, capexAnnual,
    sbcAnnual, sbcGrowthRate,
    taxRate, netDebt, currentPrice, sharesOut,
  } = model

  const rows: FicoRow[] = []
  let shares       = sharesOut
  let cumulRetired = 0

  let scoresSumPvPostTax  = 0
  let softwareSumPvPostTax = 0
  let sumPvFcf             = 0

  for (let i = 0; i < 10; i++) {
    const t    = i + 1
    const year = 2025 + t
    const df   = Math.pow(1 + wacc, t)

    // ── Scores ──────────────────────────────────────────────────
    const scoresRev            = scoresBaseRev * Math.pow(1 + scoresPriceGrowth, t)
    const scoresFixedCostsYear = scoresFixedCosts * Math.pow(1 + scoresFixedCostGrowth, t)
    const scoresOpIncome       = scoresRev - scoresFixedCostsYear
    const scoresOpMargin       = scoresOpIncome / scoresRev
    const scoresPostTax        = scoresOpIncome * (1 - taxRate)
    const scoresPvPostTax      = scoresPostTax / df

    // ── Software ─────────────────────────────────────────────────
    const softwareRev       = softwareBaseRev * Math.pow(1 + softwareGrowth, t)
    const rampFraction      = Math.min(t / 10, 1.0)
    const softwareMargin    = softwareMarginStart + (softwareMarginTarget - softwareMarginStart) * rampFraction
    const softwareOpIncome  = softwareRev * softwareMargin
    const softwarePostTax   = softwareOpIncome * (1 - taxRate)
    const softwarePvPostTax = softwarePostTax / df

    // ── Corporate ────────────────────────────────────────────────
    const corpGandA = corpGandABase * Math.pow(1 + corpGrowthRate, t)
    const sbcYear   = sbcAnnual * Math.pow(1 + sbcGrowthRate, t)

    // ── Integrated P&L ───────────────────────────────────────────
    const ebit         = scoresOpIncome + softwareOpIncome - corpGandA
    const totalRev     = scoresRev + softwareRev
    const ebitMargin   = ebit / totalRev
    const preTaxIncome = ebit - interestExpense
    const netIncome    = preTaxIncome * (1 - taxRate)
    const totalFcf     = netIncome + dnaAnnual + sbcYear - capexAnnual
    const pvFcf        = totalFcf / df

    // ── Net buybacks (FCF net of SBC so new shares cancel add-back)
    const buybackCapacity  = totalFcf - sbcYear
    const buybackPrice     = currentPrice * Math.pow(1 + termG, t)
    const netSharesRetired = Math.max(buybackCapacity / buybackPrice, 0)
    cumulRetired          += netSharesRetired
    shares                 = Math.max(shares - netSharesRetired, 0.0001)

    scoresSumPvPostTax  += scoresPvPostTax
    softwareSumPvPostTax += softwarePvPostTax
    sumPvFcf             += pvFcf

    rows.push({
      year,
      scoresRev, scoresFixedCostsYear, scoresOpIncome, scoresOpMargin, scoresPostTax, scoresPvPostTax,
      softwareRev, softwareMargin, softwareOpIncome, softwarePostTax, softwarePvPostTax,
      corpGandA, sbcYear,
      ebit, ebitMargin, preTaxIncome, netIncome, totalFcf, pvFcf,
      buybackCapacity, buybackPrice, netSharesRetired, shares, cumulRetired,
      totalRev,
    })
  }

  // ── Terminal values ────────────────────────────────────────────
  const gordon   = (1 + termG) / (wacc - termG)
  const lastRow  = rows[9]
  const df10     = Math.pow(1 + wacc, 10)

  const scoresPvTv   = (lastRow.scoresPostTax  * (1 + termG) / (wacc - termG)) / df10
  const softwarePvTv = (lastRow.softwarePostTax * (1 + termG) / (wacc - termG)) / df10
  const pvTv         = (lastRow.totalFcf * (1 + termG) / (wacc - termG)) / df10

  const scoresEv   = scoresSumPvPostTax  + scoresPvTv
  const softwareEv = softwareSumPvPostTax + softwarePvTv

  const ev       = sumPvFcf + pvTv
  const equity   = ev - netDebt
  const perShare = equity / lastRow.shares

  return {
    rows,
    scoresSumPvPostTax, scoresPvTv, scoresEv,
    softwareSumPvPostTax, softwarePvTv, softwareEv,
    sumPvFcf, pvTv, ev, equity, perShare, gordon,
  }
}

// ── Reverse DCF: Scores price CAGR implied by current market price ─
function solveImpliedScoresGrowth(
  model:                FicoModelConfig,
  softwareGrowth:       number,
  softwareMarginTarget: number,
  wacc:                 number,
  termG:                number,
): number {
  let lo = -0.05, hi = 0.50
  for (let iter = 0; iter < 60; iter++) {
    const mid = (lo + hi) / 2
    const ps  = calcFicoSotp(model, mid, softwareGrowth, softwareMarginTarget, wacc, termG).perShare
    if (ps < model.currentPrice) lo = mid
    else                          hi = mid
    if (hi - lo < 0.00005) break
  }
  return (lo + hi) / 2
}

// ── Public API ────────────────────────────────────────────────────
export function runFicoSotp(
  model:                FicoModelConfig,
  scoresPriceGrowth:    number,
  softwareGrowth:       number,
  softwareMarginTarget: number,
  wacc:                 number,
  termG:                number,
): FicoSotpResult {
  const inner = calcFicoSotp(model, scoresPriceGrowth, softwareGrowth, softwareMarginTarget, wacc, termG)
  const {
    rows, scoresEv, softwareEv,
    scoresSumPvPostTax, scoresPvTv,
    softwareSumPvPostTax, softwarePvTv,
    sumPvFcf, pvTv, ev, equity, perShare, gordon,
  } = inner

  const fvYear10    = perShare * Math.pow(1 + wacc, 10)
  const impliedCAGR = model.currentPrice > 0
    ? Math.pow(fvYear10 / model.currentPrice, 0.1) - 1
    : 0

  const impliedScoresGrowth = solveImpliedScoresGrowth(
    model, softwareGrowth, softwareMarginTarget, wacc, termG,
  )

  return {
    rows,
    scoresSumPvPostTax, scoresPvTv, scoresEv,
    softwareSumPvPostTax, softwarePvTv, softwareEv,
    sumPvFcf, pvTv, ev, equity, perShare,
    updown:      (perShare / model.currentPrice - 1) * 100,
    corpBridge:  ev - scoresEv - softwareEv,
    tvWeight:    ev > 0 ? pvTv / ev : 0,
    gordon,
    impliedCAGR,
    impliedScoresGrowth,
  }
}

// ── Sensitivity: Scores Price Growth × Software Growth → per-share ─
export interface FicoSensGrid {
  rowLabels: number[]
  colLabels: number[]
  grid:      number[][]
}

export function buildFicoSensScoresSoftware(
  model:                FicoModelConfig,
  softwareMarginTarget: number,
  wacc:                 number,
  termG:                number,
): FicoSensGrid {
  const rowLabels = [0.06, 0.08, 0.10, 0.12, 0.15, 0.18, 0.20]  // Scores price growth
  const colLabels = [0.05, 0.07, 0.10, 0.12, 0.14, 0.16, 0.18]  // Software ARR growth
  const grid = rowLabels.map(sg =>
    colLabels.map(sw =>
      Math.round(calcFicoSotp(model, sg, sw, softwareMarginTarget, wacc, termG).perShare)
    )
  )
  return { rowLabels, colLabels, grid }
}

// ── Sensitivity: WACC × Terminal Growth → per-share ──────────────
export function buildFicoSensWaccTg(
  model:                FicoModelConfig,
  scoresPriceGrowth:    number,
  softwareGrowth:       number,
  softwareMarginTarget: number,
): FicoSensGrid {
  const rowLabels = [0.020, 0.025, 0.030, 0.035, 0.040]
  const colLabels = [0.070, 0.075, 0.080, 0.085, 0.090, 0.095, 0.100]
  const grid = rowLabels.map(tg =>
    colLabels.map(w =>
      Math.round(calcFicoSotp(model, scoresPriceGrowth, softwareGrowth, softwareMarginTarget, w, tg).perShare)
    )
  )
  return { rowLabels, colLabels, grid }
}
