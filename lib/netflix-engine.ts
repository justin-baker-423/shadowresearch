// ─────────────────────────────────────────────────────────────────
//  netflix-engine.ts  —  Vintage Content-Amortization DCF engine.
//
//  Core idea: content amortization (the bulk of COGS) is driven by how
//  the content library amortizes, NOT by revenue. Each year's cash spend
//  amortizes on a fixed ACCELERATED schedule, so when spend grows only a
//  little faster than amortization, amortization compounds far slower than
//  revenue → gross- and operating-margin expansion.
//
//    amort(t)        = legacy(t) + pipeline(t) + Σ_k sched[k−1]·spend(t−k)
//        legacy(t)   = disclosed run-off of the existing released balance
//        pipeline(t) = pipelineBalance · sched[t−2026]  (in-prod releasing)
//        sched       = accelerated cohort curve (1-yr release lag)
//    spend(t)        = contentSpendMultiple × amort(t)   (mgmt ~1.1×)
//    ContentAsset(t) = ContentAsset(t−1) + spend(t) − amort(t)
//
//    COGS(t)         = amort(t) + nonContentCOGS(t)
//    nonContentCOGS  grows at scenario.nonContentCOGSGrowth
//    Marketing / Tech&Dev / G&A held flat as % of revenue (FY2025)
//
//    EBIT  = Revenue − COGS − Marketing − Tech&Dev − G&A
//    NOPAT = EBIT × (1 − tax)
//
//  Classical UFCF (content amort add-back nets cash additions to the drain):
//    FCF = NOPAT + otherD&A − (spend − amort) − capex
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
  contentAmort:    number   // total content amortization this year
  amortLegacy:     number   // from pre-2026 released balance (disclosed run-off)
  amortPipeline:   number   // from the in-production pipeline releasing
  amortNew:        number   // from FY2026+ vintages on the cohort curve
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
  contentSpend:    number   // cash additions to content this year (= multiple × amort)
  spendToAmort:    number   // contentSpend / contentAmort
  contentAsset:    number   // end-of-period library balance
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
    contentAssetBase, amortSchedule, legacyAmort, pipelineBalance,
    nonContentCOGSBase,
    marketingPct, techDevPct, gaPct, capexBase, otherDABase,
    cashBase, cashMonthsTarget, buybackPE, netInterestBase,
  } = model
  const { revGrowth, contentSpendMultiple, nonContentCOGSGrowth } = model.scenarios[sc]

  let rev          = baseRevenue
  let contentAsset = contentAssetBase
  let nonContentCOGS = nonContentCOGSBase
  let capex        = capexBase
  let otherDA      = otherDABase
  let shares       = sharesOut
  let cash         = cashBase
  const spends: number[] = []   // cash content spend by forecast year (vintages)
  const rows: NetflixDCFRow[] = []

  for (let i = 0; i < 10; i++) {
    rev = rev * (1 + revGrowth[i])

    // ── Vintage content amortization ────────────────────────────
    // Pre-2026 content: disclosed run-off of the existing released balance
    // (legacy) + the in-production pipeline releasing onto the cohort curve.
    const legacy   = i < legacyAmort.length ? legacyAmort[i] : 0
    const pipeline = i < amortSchedule.length ? pipelineBalance * amortSchedule[i] : 0
    // New vintages: each prior forecast-year's spend amortized at its age,
    // beginning the year AFTER the spend (1-yr release lag).
    let newVintage = 0
    for (let j = 0; j < i; j++) {
      const age = i - j   // years after the spend year (≥ 1)
      if (age >= 1 && age <= amortSchedule.length) newVintage += amortSchedule[age - 1] * spends[j]
    }
    const contentAmort = legacy + pipeline + newVintage

    // Management's guided cash spend, then roll the library balance
    const contentSpend = contentSpendMultiple * contentAmort
    spends.push(contentSpend)
    contentAsset = contentAsset + contentSpend - contentAmort

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

    // Classical UFCF — content amort add-back nets cash additions to the drain
    const fcf = nopat + otherDA - (contentSpend - contentAmort) - capex

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
      amortLegacy:    legacy,
      amortPipeline:  pipeline,
      amortNew:       newVintage,
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
      contentSpend,
      spendToAmort:   contentSpend / contentAmort,
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
