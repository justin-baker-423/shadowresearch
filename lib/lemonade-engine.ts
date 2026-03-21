// ─────────────────────────────────────────────────────────────────
//  lemonade-engine.ts  —  Pure calculation functions for the
//  Lemonade IFP-driven DCF.  No React.
//
//  Primary interactive assumption: lossRatioStart (gross loss ratio
//  in the first forecast year).  The engine steps it down by
//  model.lossRatioStepDown per year.  WACC is fixed at model.waccDefault.
//  Terminal growth remains user-adjustable.
// ─────────────────────────────────────────────────────────────────

import type { LemonadeModelConfig } from "./lemonade-models"

export interface LemonadeRow {
  year:             number

  // ── P&L waterfall ────────────────────────────────────────────
  ifp:              number   // In-Force Premium ($B)
  nep:              number   // Net Earned Premium ($B)
  lossAndLae:       number   // Net Loss & LAE ($B)
  lossRatio:        number   // lossAndLae / nep (decimal)
  gcCommission:     number   // GC synthetic commission ($B)
  opex:             number   // Operating expenses ($B)
  expenseRatio:     number   // (gcCommission + opex) / nep (decimal)
  combinedRatio:    number   // lossRatio + expenseRatio (decimal)
  investmentIncome: number   // Investment income on float ($B)
  ebit:             number   // EBIT ($B)
  ebitMargin:       number   // ebit / nep (decimal)

  // ── Cash flow ────────────────────────────────────────────────
  nopat:            number   // NOPAT ($B)
  fcf:              number   // FCF ($B)
  pvFcf:            number   // PV of FCF discounted to base year ($B)
  shares:           number   // Diluted shares ($B)

  // ── Cash build ───────────────────────────────────────────────
  cashBalance:      number   // Starting net cash + cumulative FCFs received ($B)

  // ── Book equity (balance sheet stockholders' equity) ─────────
  // bookEquity[i] = baseBookEquity + sum(nopat[0..i])
  // Increases each year by net income (NOPAT); no dividends paid.
  // Excludes SBC add-back and share-issuance proceeds.
  bookEquity:       number   // Stockholders' equity at year-end ($B)
  bookEquityPerShare: number // bookEquity / diluted shares ($/share)
}

export interface LemonadeResult {
  rows:         LemonadeRow[]
  pvTv:         number      // PV of terminal value ($B)
  sumPvFcf:     number      // Sum of PV FCFs yr 1–10 ($B)
  ev:           number      // Enterprise value ($B)
  gcObligation: number      // GC quasi-debt deducted from equity ($B)
  equity:       number      // EV + netCash − gcObligation ($B)
  perShare:     number      // equity / terminal-year shares
  updown:       number      // % vs currentPrice
  tvWeight:     number      // pvTv / ev
  gordon:       number      // terminal multiple
  impliedCAGR:  number
}

export function runLemonadeDCF(
  model:           LemonadeModelConfig,
  lossRatioStart:  number,   // user-chosen starting gross loss ratio (e.g. 0.68)
  termG:           number,
): LemonadeResult {
  const wacc = model.waccDefault   // WACC fixed; only loss ratio is user-adjustable

  const {
    nepSchedule,
    gcCommissionSchedule, opexSchedule, investmentIncomeSchedule,
    sharesSchedule,
    netCash, currentPrice, gcObligationB,
    taxRate, lossRatioStepDown, daAddback,
  } = model

  const rows: LemonadeRow[] = []
  let cumFcf    = 0
  let bookEquity = model.baseBookEquity

  for (let i = 0; i < 10; i++) {
    const ifp    = model.ifpSchedule[i]
    const nep    = nepSchedule[i]
    const gcComm = gcCommissionSchedule[i]
    const opex   = opexSchedule[i]
    const invInc = investmentIncomeSchedule[i]
    const shares = sharesSchedule[i]

    // ── Dynamic loss ratio ────────────────────────────────────
    const lossRatio = Math.max(0, lossRatioStart - i * lossRatioStepDown)
    const lae       = nep * lossRatio

    // ── P&L waterfall ─────────────────────────────────────────
    const expenseRatio  = (gcComm + opex) / nep
    const combinedRatio = lossRatio + expenseRatio
    const ebit          = nep - lae - gcComm - opex + invInc
    const ebitMargin    = ebit / nep

    // NOPAT: full loss recognised when negative (no DTA benefit);
    // positive years: EBIT × (1 − tax)
    const nopat = ebit < 0 ? ebit : ebit * (1 - taxRate)

    // FCF: NOPAT + D&A add-back
    const fcf   = nopat + daAddback

    const pvFcf = fcf / Math.pow(1 + wacc, i + 1)

    // ── Cash build ────────────────────────────────────────────
    cumFcf += fcf
    const cashBalance = netCash + cumFcf

    // ── Book equity ───────────────────────────────────────────
    bookEquity += nopat
    const bookEquityPerShare = bookEquity / shares

    rows.push({
      year: 2026 + i,
      ifp, nep,
      lossAndLae: lae, lossRatio,
      gcCommission: gcComm, opex,
      expenseRatio, combinedRatio,
      investmentIncome: invInc,
      ebit, ebitMargin,
      nopat, fcf, pvFcf, shares,
      cashBalance,
      bookEquity,
      bookEquityPerShare,
    })
  }

  const lastFCF  = rows[9].fcf
  const gordon   = (1 + termG) / (wacc - termG)
  const tv       = lastFCF * gordon
  const pvTv     = tv / Math.pow(1 + wacc, 10)
  const sumPvFcf = rows.reduce((s, r) => s + r.pvFcf, 0)
  const ev       = sumPvFcf + pvTv
  const equity   = ev + netCash - gcObligationB
  const perShare = equity / rows[9].shares

  const fvYear10    = perShare * Math.pow(1 + wacc, 10)
  const impliedCAGR = Math.pow(fvYear10 / currentPrice, 0.1) - 1

  return {
    rows, pvTv, sumPvFcf, ev,
    gcObligation: gcObligationB,
    equity, perShare,
    updown:   (perShare / currentPrice - 1) * 100,
    tvWeight: pvTv / ev,
    gordon,
    impliedCAGR,
  }
}

export interface LemonadeSensResult {
  lossRatios: number[]
  tgrows:     number[]
  grid:       number[][]  // [lossRatio row][termG col] → intrinsic value
}

export function buildLemonadeSensitivity(model: LemonadeModelConfig): LemonadeSensResult {
  // Rows: 5 starting loss ratios centred on lossRatioDefault
  const lossRatios = [0.58, 0.63, 0.68, 0.73, 0.78]
  const tgrows     = [0.020, 0.025, 0.030, 0.035, 0.040]
  const grid = lossRatios.map(lr =>
    tgrows.map(tg => Math.round(runLemonadeDCF(model, lr, tg).perShare))
  )
  return { lossRatios, tgrows, grid }
}
