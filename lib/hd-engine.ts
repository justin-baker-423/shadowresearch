// ─────────────────────────────────────────────────────────────────
//  hd-engine.ts  —  UFCF-based DCF engine for Home Depot (HD)
//
//  Inputs:
//    • revGrowth  — uniform annual revenue growth (slider: 2–8%)
//    • opMargin   — uniform adj operating margin (slider: 11–16%)
//    • wacc       — discount rate
//    • termG      — terminal growth rate
//
//  UFCF = NOPAT + D&A − Capex  (pre-interest, for EV via WACC)
//  Equity = EV − initial net debt ($49.9B)
//
//  Capital waterfall (for display):
//    Net Income → Dividends → Debt paydown (until ND/EBITDA < trigger)
//    → Buybacks (residual FCF at assumed P/E × EPS)
//
//  Dividend growth tied to EPS growth YoY (floored — HD won't cut)
// ─────────────────────────────────────────────────────────────────

import type { HDModelConfig } from "./hd-models"

export interface HDRow {
  year:           number
  revenue:        number   // $B
  ebit:           number   // $B (revenue × opMargin)
  ebitda:         number   // $B (ebit + D&A)
  nopat:          number   // $B (EBIT × (1−tax))
  dna:            number   // $B (revenue × dnaRate)
  capex:          number   // $B (revenue × capexRate)
  ufcf:           number   // $B (NOPAT + D&A − Capex)
  pvFcf:          number   // $B (discounted UFCF)

  // Capital waterfall (levered view, for display)
  interest:       number   // $B (start-of-year netDebt × avgIntRate)
  netIncome:      number   // $B ((EBIT − interest) × (1−tax))
  eps:            number   // $/share
  dps:            number   // $/share (grows with EPS, floored)
  divGrowth:      number   // YoY DPS growth fraction
  totalDiv:       number   // $B
  fcfAfterDiv:    number   // $B (levered FCF − dividends)
  debtRepaid:     number   // $B (when ND/EBITDA > trigger)
  buybacks:       number   // $B (when ND/EBITDA ≤ trigger)
  sharesRetired:  number   // billions
  shares:         number   // billions (start-of-year)
  netDebt:        number   // $B (start-of-year)
  netDebtEbitda:  number   // leverage ratio at start of year
}

export interface HDResult {
  rows:        HDRow[]
  pvTv:        number   // PV of terminal value
  sumPvFcf:    number   // Σ PV(UFCF)
  ev:          number   // Enterprise value ($B)
  equity:      number   // Equity value ($B) = EV − initial net debt
  perShare:    number   // Equity / initial shares
  updown:      number   // % vs current price
  tvWeight:    number   // PV(TV) / EV
  gordon:      number   // TV Gordon multiple
  impliedCAGR: number   // WACC-accreted fair value → CAGR from current price
}

export function runHDDCF(
  model:     HDModelConfig,
  revGrowth: number,
  opMargin:  number,
  wacc:      number,
  termG:     number,
): HDResult {
  const rows: HDRow[] = []

  let shares  = model.sharesOut
  let netDebt = model.netDebt
  let prevEps = model.basePrevEps   // FY2025A adj EPS seeds year-1 DPS growth
  let prevDps = model.dps0

  for (let i = 0; i < 10; i++) {
    const year    = 2026 + i
    const revenue = model.baseRevenue * Math.pow(1 + revGrowth, i + 1)
    const ebit    = revenue * opMargin
    const dna     = revenue * model.dnaRate
    const ebitda  = ebit + dna
    const capex   = revenue * model.capexRate
    const nopat   = ebit * (1 - model.taxRate)
    const ufcf    = nopat + dna - capex

    const leverageRatio = ebitda > 0 ? netDebt / ebitda : 99
    const interest      = Math.max(0, netDebt) * model.avgIntRate
    const netIncome     = Math.max(0, (ebit - interest) * (1 - model.taxRate))
    const eps           = netIncome / shares

    // DPS grows with EPS YoY; never cut (floor at 0% growth)
    const epsGrowth = prevEps > 0 ? (eps - prevEps) / prevEps : 0
    const dps       = prevDps * (1 + Math.max(0, epsGrowth))
    const divGrowth = (dps - prevDps) / prevDps

    const totalDiv    = dps * shares
    const levFcf      = netIncome + dna - capex   // levered FCF (post-interest)
    const fcfAfterDiv = levFcf - totalDiv

    // Capital allocation: debt first, buybacks once leverage is comfortable
    let debtRepaid    = 0
    let buybacks      = 0
    let sharesRetired = 0

    if (leverageRatio > model.buybackTrigger) {
      debtRepaid = Math.max(0, fcfAfterDiv)
    } else {
      buybacks      = Math.max(0, fcfAfterDiv)
      const buyPrice = Math.max(1, eps * model.buybackPE)
      sharesRetired  = buybacks / buyPrice
    }

    const pvFcf = ufcf / Math.pow(1 + wacc, i + 1)

    rows.push({
      year, revenue, ebit, ebitda, nopat, dna, capex, ufcf, pvFcf,
      interest, netIncome, eps, dps, divGrowth, totalDiv,
      fcfAfterDiv, debtRepaid, buybacks, sharesRetired,
      shares, netDebt, netDebtEbitda: leverageRatio,
    })

    prevEps = eps
    prevDps = dps
    shares  = Math.max(0.001, shares - sharesRetired)
    netDebt = Math.max(0, netDebt - debtRepaid)
  }

  // Terminal value on year-10 UFCF
  const lastUFCF = rows[9].ufcf
  const gordon   = (1 + termG) / (wacc - termG)
  const tv       = lastUFCF * gordon
  const pvTv     = tv / Math.pow(1 + wacc, 10)

  const sumPvFcf = rows.reduce((s, r) => s + r.pvFcf, 0)
  const ev       = sumPvFcf + pvTv

  // Equity: EV minus INITIAL net debt (EV already prices in future cash generation)
  const equity   = ev - model.netDebt
  const perShare = equity / model.sharesOut

  const impliedCAGR =
    perShare > 0 && model.currentPrice > 0
      ? Math.pow((perShare * Math.pow(1 + wacc, 10)) / model.currentPrice, 1 / 10) - 1
      : 0

  return {
    rows, pvTv, sumPvFcf, ev, equity, perShare,
    updown:   (perShare / model.currentPrice - 1) * 100,
    tvWeight: ev > 0 ? pvTv / ev : 0,
    gordon,
    impliedCAGR,
  }
}

// ── Sensitivity: Revenue Growth × Op Margin → intrinsic value ──────
export interface HDSensRevMargin {
  revGrowths: number[]
  opMargins:  number[]
  grid:       number[][]   // [opMargin row][revGrowth col] → per share value
}

export function buildHDSensRevMargin(
  model: HDModelConfig,
  wacc:  number,
  termG: number,
): HDSensRevMargin {
  const revGrowths = [0.02, 0.03, 0.04, 0.05, 0.06, 0.07, 0.08]
  const opMargins  = [0.110, 0.120, 0.130, 0.135, 0.140, 0.150, 0.160]
  const grid = opMargins.map(om =>
    revGrowths.map(rg => Math.round(runHDDCF(model, rg, om, wacc, termG).perShare)),
  )
  return { revGrowths, opMargins, grid }
}

// ── Sensitivity: WACC × Terminal Growth → intrinsic value ──────────
export interface HDSensWaccTg {
  waccs:  number[]
  tgrows: number[]
  grid:   number[][]   // [tg row][wacc col] → per share value
}

export function buildHDSensWaccTg(
  model:     HDModelConfig,
  revGrowth: number,
  opMargin:  number,
): HDSensWaccTg {
  const waccs  = [0.070, 0.075, 0.080, 0.085, 0.090, 0.095, 0.100]
  const tgrows = [0.015, 0.020, 0.025, 0.030, 0.035]
  const grid   = tgrows.map(tg =>
    waccs.map(w => Math.round(runHDDCF(model, revGrowth, opMargin, w, tg).perShare)),
  )
  return { waccs, tgrows, grid }
}
