// ─────────────────────────────────────────────────────────────────
//  nike-engine.ts  —  Two-segment DCF engine for Nike Inc.
//
//  Architecture differs from standard dcf-engine.ts:
//    • Revenue split: Ex-China + China (separate growth trajectories)
//    • Explicit FCF bridge: NOPAT + D&A − CapEx ± Working Capital
//    • Capital return waterfall: FCF → Dividends → Buyback capacity
//    • Phase labels: Turnaround (FY26-27) · Recovery (FY28-29) · Compounding (FY30+)
//    • Share count tracks actual buyback retirements at pre-set price path
// ─────────────────────────────────────────────────────────────────

import type { NikeModelConfig, NikeScenarioConfig } from "./nike-models"

export type NikeScenario = "bear" | "base" | "bull"

export type NikePhase = "Turnaround" | "Recovery" | "Compounding"

export interface NikeRow {
  year:             number
  phase:            NikePhase

  // Revenue
  exChinaRev:       number   // $B
  chinaRev:         number   // $B
  totalRev:         number   // $B

  // Margins
  grossMargin:      number   // fraction
  grossProfit:      number   // $B
  sga:              number   // $B
  ebit:             number   // $B
  ebitMargin:       number   // fraction

  // FCF bridge
  nopat:            number   // $B  (ebit × (1−taxRate))
  dna:              number   // $B
  capex:            number   // $B
  wcDelta:          number   // $B  (positive = cash source)
  fcf:              number   // $B
  pvFcf:            number   // $B  (discounted at WACC)

  // Capital return
  dps:              number   // $/share
  totalDiv:         number   // $B  (dps × shares at start of year)
  fcfAfterDiv:      number   // $B  (may be negative — covered by balance sheet)
  buybackCapacity:  number   // $B  (max(0, fcfAfterDiv))
  sharesRetired:    number   // billions
  shares:           number   // billions (end of year)
}

export interface NikeResult {
  rows:         NikeRow[]
  pvTv:         number   // PV of terminal value
  sumPvFcf:     number   // Σ PV(FCF)
  ev:           number   // Enterprise value
  equity:       number   // Equity value (EV + netCash)
  perShare:     number   // Equity / year-10 shares
  updown:       number   // % vs current price
  tvWeight:     number   // PV(TV) / EV
  gordon:       number   // TV multiple
  impliedCAGR:  number   // 10-yr CAGR: fair value accreted at WACC / current price
  avgDivYield:  number   // avg annual div yield using buyback price path as proxy (display only)
}

export function runNikeDCF(
  model: NikeModelConfig,
  sc:    NikeScenario,
  wacc:  number,
  termG: number,
): NikeResult {
  const cfg: NikeScenarioConfig = model.scenarios[sc]
  const rows: NikeRow[] = []

  let shares = model.sharesOut   // billions — tracks retirements each year

  for (let i = 0; i < 10; i++) {
    const year = 2026 + i

    // ── Revenue ──────────────────────────────────────────────────
    const exChinaRev = cfg.exChinaRev[i]
    const chinaRev   = cfg.chinaRev[i]
    const totalRev   = exChinaRev + chinaRev

    // ── P&L ──────────────────────────────────────────────────────
    const grossMargin = cfg.grossMargin[i]
    const grossProfit = totalRev * grossMargin
    const sga         = cfg.sga[i]
    const ebit        = grossProfit - sga
    const ebitMargin  = ebit / totalRev
    const nopat       = ebit * (1 - model.taxRate)

    // ── FCF bridge ───────────────────────────────────────────────
    const dna         = cfg.dna[i]
    const capex       = cfg.capex[i]
    const wcDelta     = cfg.wcDelta[i]
    const fcf         = nopat + dna - capex + wcDelta

    // ── Capital return ────────────────────────────────────────────
    const dps         = cfg.dps[i]
    const totalDiv    = dps * shares            // shares at start of year
    const fcfAfterDiv = fcf - totalDiv
    const buybackCapacity = Math.max(0, fcfAfterDiv)

    // Retire shares — buyback dollars ÷ pre-set price assumption
    const buybackPrice  = cfg.buybackPrice[i]
    const sharesRetired = buybackCapacity / buybackPrice
    shares = Math.max(shares - sharesRetired, 0.001)

    // ── Discounting ───────────────────────────────────────────────
    const pvFcf = fcf / Math.pow(1 + wacc, i + 1)

    // ── Phase ─────────────────────────────────────────────────────
    const phase: NikePhase =
      year <= 2027 ? "Turnaround" :
      year <= 2029 ? "Recovery"   : "Compounding"

    rows.push({
      year, phase,
      exChinaRev, chinaRev, totalRev,
      grossMargin, grossProfit, sga, ebit, ebitMargin,
      nopat, dna, capex, wcDelta, fcf, pvFcf,
      dps, totalDiv, fcfAfterDiv, buybackCapacity, sharesRetired, shares,
    })
  }

  // ── Terminal value & DCF ─────────────────────────────────────────
  const lastFCF  = rows[9].fcf
  const gordon   = (1 + termG) / (wacc - termG)
  const tv       = lastFCF * gordon
  const pvTv     = tv / Math.pow(1 + wacc, 10)
  const sumPvFcf = rows.reduce((s, r) => s + r.pvFcf, 0)
  const ev       = sumPvFcf + pvTv
  const equity   = ev + model.netCash         // netCash < 0 = net debt

  // Use year-10 shares (reduced by buybacks) for per-share value
  const perShare = equity / rows[9].shares

  // Implied CAGR: fair value accreted at WACC over 10 years → return from today's price
  const fvYear10    = perShare * Math.pow(1 + wacc, 10)
  const impliedCAGR = Math.pow(fvYear10 / model.currentPrice, 0.1) - 1

  // Avg div yield: avg DPS / buyback price path (illustrative price proxy, display only)
  const avgDivYield = rows.reduce((sum, r) => {
    return sum + r.dps / cfg.buybackPrice[rows.indexOf(r)]
  }, 0) / rows.length

  return {
    rows, pvTv, sumPvFcf, ev, equity, perShare,
    updown:   (perShare / model.currentPrice - 1) * 100,
    tvWeight: pvTv / ev,
    gordon,
    impliedCAGR,
    avgDivYield,
  }
}

// ── Sensitivity: WACC × Terminal Growth → intrinsic value ──────────
export interface NikeSensResult {
  waccs:  number[]
  tgrows: number[]
  grid:   number[][]  // [termG row][wacc col] → intrinsic value per share
}

export function buildNikeSensitivity(
  model: NikeModelConfig,
  sc:    NikeScenario,
): NikeSensResult {
  const waccs  = [0.07, 0.08, 0.09, 0.10, 0.11]
  const tgrows = [0.015, 0.020, 0.025, 0.030, 0.035]
  const grid   = tgrows.map(tg =>
    waccs.map(w => Math.round(runNikeDCF(model, sc, w, tg).perShare))
  )
  return { waccs, tgrows, grid }
}
