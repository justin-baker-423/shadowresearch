// ─────────────────────────────────────────────────────────────────
//  netflix-engine.ts  —  Content-Amortization DCF engine.
//
//  Core idea: content amortization (the bulk of COGS) is driven by the
//  capitalised content-asset balance, NOT by revenue. The balance grows
//  only by the "excess" cash invested above amortization each year, so
//  as excess investment stays modest, amortization compounds far slower
//  than revenue → gross- and operating-margin expansion.
//
//    amort(t)        = amortRate × ContentAsset(t−1)
//    ContentAsset(t) = ContentAsset(t−1) + excess(t)
//    additions(t)    = amort(t) + excess(t)                (cash spend)
//
//    COGS(t)         = amort(t) + nonContentCOGS(t)
//    nonContentCOGS  grows at scenario.nonContentCOGSGrowth
//    Marketing / Tech&Dev / G&A held flat as % of revenue (FY2025)
//
//    EBIT  = Revenue − COGS − Marketing − Tech&Dev − G&A
//    NOPAT = EBIT × (1 − tax)
//
//  Classical UFCF (content amort add-back + cash additions net to excess):
//    FCF = NOPAT + otherD&A − excessContent − capex
//
//  SBC is treated as a real (cash-equivalent) cost — already inside EBIT,
//  not added back. Working capital assumed neutral (streaming deferred
//  revenue ≈ offsets). WBD acquisition excluded.
//
//  Capital allocation (cash-floor buybacks): a cash balance is tracked
//  year-by-year, building by levered FCF (UFCF − after-tax net interest).
//  Netflix holds 2 months of revenue (rev ÷ 6) as cash; ALL cash above
//  that floor sweeps into repurchases at 25× that year's EPS. Terminal
//  equity value is divided by the reduced ending share count (long-term
//  holder accretion). Net income (EBIT − net interest, taxed) prices the
//  buyback; the DCF's EV itself stays on unlevered FCF.
// ─────────────────────────────────────────────────────────────────

import type { NetflixModelConfig, Scenario } from "./netflix-models"

export interface NetflixDCFRow {
  year:            number
  rev:             number
  revGrowth:       number
  contentAmort:    number   // amortRate × prior content-asset balance
  nonContentCOGS:  number
  cogs:            number
  grossProfit:     number
  grossMargin:     number
  marketing:       number
  techDev:         number
  ga:              number
  ebit:            number
  ebitMargin:      number
  nopat:           number
  netIncome:       number   // (EBIT − net interest) × (1 − tax) — for buyback P/E
  eps:             number   // netIncome / beginning shares
  excessContent:   number
  contentAsset:    number   // end-of-period balance
  capex:           number
  otherDA:         number
  fcf:             number
  fcfM:            number
  pvFcf:           number
  leveredFCF:      number   // UFCF − after-tax net interest (cash that lands on the balance sheet)
  cashTarget:      number   // 2 months of revenue held as cash
  cashEnd:         number   // cash & equivalents at END of period
  buyback:         number   // $ swept into repurchases (cash above the floor)
  sharesBought:    number   // shares retired this year ($B)
  shares:          number   // diluted shares at END of period ($B)
}

export interface NetflixDCFResult {
  rows:        NetflixDCFRow[]
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

export function runNetflixDCF(
  model: NetflixModelConfig,
  sc:    Scenario,
  wacc:  number,
  termG: number,
): NetflixDCFResult {
  const {
    baseRevenue, sharesOut, netCash, currentPrice, taxRate,
    contentAssetBase, amortRate, nonContentCOGSBase,
    marketingPct, techDevPct, gaPct, capexBase, otherDABase,
    cashBase, cashMonthsTarget, buybackPE, netInterestBase,
  } = model
  const { revGrowth, excessContent, nonContentCOGSGrowth } = model.scenarios[sc]

  let rev          = baseRevenue
  let contentAsset = contentAssetBase
  let nonContentCOGS = nonContentCOGSBase
  let capex        = capexBase
  let otherDA      = otherDABase
  let shares       = sharesOut
  let cash         = cashBase
  const rows: NetflixDCFRow[] = []

  for (let i = 0; i < 10; i++) {
    rev = rev * (1 + revGrowth[i])

    // Content amortization on the BEGINNING balance, then grow the balance
    const contentAmort = amortRate * contentAsset
    const excess       = excessContent[i]
    contentAsset       = contentAsset + excess

    // Non-content COGS compounds at its own (low) rate
    nonContentCOGS = nonContentCOGS * (1 + nonContentCOGSGrowth)
    const cogs        = contentAmort + nonContentCOGS
    const grossProfit = rev - cogs

    // Opex held flat as % of revenue
    const marketing = rev * marketingPct
    const techDev   = rev * techDevPct
    const ga        = rev * gaPct

    const ebit  = grossProfit - marketing - techDev - ga
    const nopat = ebit * (1 - taxRate)

    // Net income (levered) — only used to price buybacks at a P/E multiple.
    // Net interest held flat; the DCF's FCF itself stays unlevered.
    const netIncome = (ebit - netInterestBase) * (1 - taxRate)
    const eps       = netIncome / shares

    // Capex and other D&A scale with revenue
    capex   = capex   * (1 + revGrowth[i])
    otherDA = otherDA * (1 + revGrowth[i])

    // Classical UFCF — amort add-back & cash additions collapse to excess
    const fcf = nopat + otherDA - excess - capex

    // Cash-floor buybacks: cash builds by levered FCF (UFCF less after-tax
    // net interest), Netflix holds 2 months of revenue, and ALL cash above
    // that floor sweeps into repurchases at buybackPE × EPS.
    const leveredFCF   = fcf - netInterestBase * (1 - taxRate)
    const cashTarget   = rev * (cashMonthsTarget / 12)
    const cashAvail    = cash + leveredFCF
    const buyback      = Math.max(0, cashAvail - cashTarget)
    cash               = cashAvail - buyback   // = min(cashAvail, cashTarget)
    const buybackPrice = buybackPE * eps
    const sharesBought = buybackPrice > 0 ? buyback / buybackPrice : 0
    shares = shares - sharesBought

    rows.push({
      year:           2026 + i,
      rev,
      revGrowth:      revGrowth[i],
      contentAmort,
      nonContentCOGS,
      cogs,
      grossProfit,
      grossMargin:    grossProfit / rev,
      marketing,
      techDev,
      ga,
      ebit,
      ebitMargin:     ebit / rev,
      nopat,
      netIncome,
      eps,
      excessContent:  excess,
      contentAsset,
      capex,
      otherDA,
      fcf,
      fcfM:           fcf / rev,
      pvFcf:          fcf / Math.pow(1 + wacc, i + 1),
      leveredFCF,
      cashTarget,
      cashEnd:        cash,
      buyback,
      sharesBought,
      shares,
    })
  }

  const lastFCF  = rows[9].fcf
  const gordon   = (1 + termG) / (wacc - termG)
  const tv       = lastFCF * gordon
  const pvTv     = tv / Math.pow(1 + wacc, 10)
  const sumPvFcf = rows.reduce((s, r) => s + r.pvFcf, 0)
  const ev       = sumPvFcf + pvTv
  const equity   = ev + netCash
  const perShare = equity / rows[9].shares   // divided by reduced (post-buyback) share count

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
//  Sensitivity: WACC (columns) × terminal growth (rows) — classical
// ─────────────────────────────────────────────────────────────────
export interface NetflixSensResult {
  waccs:  number[]
  tgrows: number[]
  grid:   number[][]   // [termG row][wacc col] → intrinsic value/share
}

export function buildNetflixSensitivity(
  model: NetflixModelConfig,
  sc:    Scenario,
): NetflixSensResult {
  const waccs  = [0.08, 0.09, 0.10, 0.11, 0.12]
  const tgrows = [0.020, 0.025, 0.030, 0.035, 0.040]
  const grid   = tgrows.map(tg =>
    waccs.map(w => Math.round(runNetflixDCF(model, sc, w, tg).perShare))
  )
  return { waccs, tgrows, grid }
}
