// ─────────────────────────────────────────────────────────────────
//  atlassian-engine.ts  —  R&D Capitalisation DCF engine.
//  No React.
//
//  Valuation:
//    For each of FY26–FY35 compute Adj NI, discount at WACC.
//    Terminal value = exitMultiple × Adj NI(FY35), discounted.
//    Equity = Σ PV(Adj NI) + PV(TV) + netCash.
//
//  Adj NI vs GAAP NI:
//    Adj NI  uses R&D amortisation  (10-yr rolling window)
//    GAAP NI uses full R&D expense  (the scenario's rdPct)
//    hiddenEarnings = Adj NI − GAAP NI  (the gap the market misses)
//
//  Amortisation mechanics (10-yr straight-line rolling window):
//    cohortWindow holds the rdLife−1 most recent prior-year cohorts.
//    Each year: amort = (currentYearRd + cohortWindow[0..rdLife-1]) / rdLife
//    Oldest cohort drops off; new year's R&D added to front.
// ─────────────────────────────────────────────────────────────────

import type { AtlassianModelConfig, Scenario } from "./atlassian-models"

export interface AtlassianRow {
  year:       number
  fyLabel:    string    // "FY26" … "FY35"

  // Revenue
  rev:        number    // $B
  revGrowth:  number    // decimal

  // R&D capitalisation
  rdSpend:    number    // full GAAP R&D = rev × rdPct ($B)
  rdAmort:    number    // amortisation from 10-yr rolling window ($B)
  rdNetAsset: number    // net R&D intangible balance at year-end ($B)

  // OpEx
  sm:         number    // S&M ($B)
  ga:         number    // G&A ($B)

  // Adj P&L (R&D capitalised)
  adjEbit:    number    // GP − rdAmort − sm − ga ($B)
  adjEbitM:   number    // adjEbit / rev
  adjNi:      number    // adjEbit × (1 − tax) ($B)
  adjNiM:     number    // adjNi / rev
  pvAdjNi:    number    // adjNi / (1+wacc)^t

  // GAAP P&L (for comparison)
  gaapEbit:   number    // GP − rdSpend − sm − ga ($B)
  gaapNi:     number    // gaapEbit × (1 − tax) ($B)
  gaapNiM:    number    // gaapNi / rev

  // The "hidden earnings" the capitalisation reveals
  hiddenEarnings: number  // adjNi − gaapNi ($B)

  // Shares
  shares:     number    // diluted ($B) after cumulative net dilution
}

export interface AtlassianResult {
  rows:        AtlassianRow[]
  pvTv:        number    // PV of terminal value
  sumPvAdjNi:  number    // sum of PV Adj NI (explicit period)
  ev:          number    // sumPvAdjNi + pvTv  (≈ equity for debt-free co)
  equity:      number    // ev + netCash
  perShare:    number    // equity / year-10 shares
  updown:      number    // % vs currentPrice
  tvWeight:    number    // pvTv / ev
  exitMultiple: number   // the multiple applied
  impliedCAGR: number    // fair-value-accreted-at-WACC → currentPrice, annualised
}

export function runAtlassianDCF(
  model:        AtlassianModelConfig,
  sc:           Scenario,
  wacc:         number,
  exitMultiple: number,
): AtlassianResult {
  const {
    baseRevenue, grossMargin, taxRate,
    rdLife, historicalRdCohorts,
    sharesOut, dilutionSchedule,
    netCash, currentPrice, revGrowth,
  } = model
  const { rdPct, smPct, gaPct } = model.scenarios[sc]

  // ── Initialise rolling cohort window ─────────────────────────
  // historicalRdCohorts = [FY25, FY24, ..., FY17] (length = rdLife − 1 = 9)
  let cohortWindow = [...historicalRdCohorts]

  // Opening net R&D asset: cohort[i] has (rdLife − 1 − i) years remaining
  let rdNetAsset = historicalRdCohorts.reduce((acc, c, i) =>
    acc + c * (rdLife - 1 - i) / rdLife, 0)

  let rev    = baseRevenue
  let shares = sharesOut
  const rows: AtlassianRow[] = []

  for (let i = 0; i < 10; i++) {
    const fyLabel = `FY${(2026 + i).toString().slice(2)}`

    // Revenue
    rev = rev * (1 + revGrowth[i])
    const grossProfit = rev * grossMargin

    // R&D spend this year (full GAAP amount, cash + SBC)
    const rdSpend = rev * rdPct[i]

    // ── Amortisation (rolling window) ────────────────────────
    const fullWindow = [rdSpend, ...cohortWindow]   // length = rdLife
    const rdAmort    = fullWindow.slice(0, rdLife).reduce((s, c) => s + c, 0) / rdLife
    cohortWindow     = fullWindow.slice(0, rdLife - 1)  // drop oldest, keep rdLife−1

    rdNetAsset = rdNetAsset + rdSpend - rdAmort

    // OpEx
    const sm = rev * smPct[i]
    const ga = rev * gaPct[i]

    // ── Adjusted P&L ─────────────────────────────────────────
    const adjEbit = grossProfit - rdAmort - sm - ga
    const adjNi   = adjEbit * (1 - taxRate)

    // ── GAAP P&L (full R&D expensed) ─────────────────────────
    const gaapEbit = grossProfit - rdSpend - sm - ga
    const gaapNi   = gaapEbit * (1 - taxRate)

    // ── Shares ────────────────────────────────────────────────
    shares = shares * (1 + dilutionSchedule[i])

    rows.push({
      year:     2026 + i,
      fyLabel,
      rev,
      revGrowth: revGrowth[i],
      rdSpend,
      rdAmort,
      rdNetAsset,
      sm,
      ga,
      adjEbit,
      adjEbitM:   adjEbit / rev,
      adjNi,
      adjNiM:     adjNi / rev,
      pvAdjNi:    adjNi / Math.pow(1 + wacc, i + 1),
      gaapEbit,
      gaapNi,
      gaapNiM:    gaapNi / rev,
      hiddenEarnings: adjNi - gaapNi,
      shares,
    })
  }

  // ── Terminal value: exitMultiple × FY35 Adj NI ───────────────
  const lastAdjNi = rows[9].adjNi
  const tv        = exitMultiple * lastAdjNi
  const pvTv      = tv / Math.pow(1 + wacc, 10)
  const sumPvAdjNi = rows.reduce((s, r) => s + r.pvAdjNi, 0)
  const ev        = sumPvAdjNi + pvTv
  const equity    = ev + netCash
  const perShare  = equity / rows[9].shares

  const fvYear10    = perShare * Math.pow(1 + wacc, 10)
  const impliedCAGR = Math.pow(fvYear10 / currentPrice, 0.1) - 1

  return {
    rows, pvTv, sumPvAdjNi, ev, equity, perShare,
    updown:      (perShare / currentPrice - 1) * 100,
    tvWeight:    pvTv / ev,
    exitMultiple,
    impliedCAGR,
  }
}

// ── Sensitivity: Exit Multiple (rows) × WACC (cols) ──────────────
export interface AtlassianSensResult {
  multiples: number[]
  waccs:     number[]
  grid:      number[][]  // [multiple row][wacc col] → intrinsic value/share
}

export function buildAtlassianSensitivity(
  model: AtlassianModelConfig,
  sc:    Scenario,
  wacc:  number,
): AtlassianSensResult {
  const multiples = [12, 15, 18, 20, 23, 25, 30]
  const waccs     = [0.08, 0.09, 0.10, 0.11, 0.12]
  const grid      = multiples.map(m =>
    waccs.map(w => Math.round(runAtlassianDCF(model, sc, w, m).perShare))
  )
  return { multiples, waccs, grid }
}
