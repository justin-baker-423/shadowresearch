// ─────────────────────────────────────────────────────────────────
//  deere-engine.ts  —  Ag Cycle + Services Mix-Shift DCF engine
//
//  FCF proxy = Net Income (EO D&A $1,280M ≈ EO capex $1,358M;
//  FS lease originations are FS-funded and embedded in FS revenue
//  and consolidated net debt — NOT deducted separately).
//
//  Capital return waterfall (order of priority):
//    1. Interest expense  — already deducted from NI in P&L
//    2. Debt principal    — $2.8B consolidated net debt assumed
//                          refinanced at maturity (EO is ~net-cash;
//                          FS debt is self-funded by fin. receivables)
//    3. Dividends         — grow at scenario divGrowthRate
//    4. FCF surplus       — available for buybacks
//
//  Total return CAGR = 15× P/E exit on FY2035E EPS
//    + reinvested dividends compounded at EPS growth rate,
//    vs today's entry price.  Each year's div reinvested at
//    15×EPSᵢ; FV at exit = divᵢ × (EPS₁₀/EPSᵢ).
// ─────────────────────────────────────────────────────────────────

import type { DeereModelConfig, Scenario } from "./deere-models"
import { gmFromSubPct } from "./deere-models"

const RD_PCT        = 0.05  // R&D as % of equipment sales (FY2025A ≈4.5%, held at 5%)
export const PE_EXIT_MULTIPLE = 15  // terminal P/E for total return CAGR

export interface DeereDCFRow {
  year:             number
  equipRev:         number  // $B
  subRev:           number  // $B
  fsRev:            number  // $B
  otherRev:         number  // $B
  totalRev:         number  // $B
  subPct:           number  // subscription fraction of (equip+sub)
  gmPct:            number  // blended gross margin %
  grossProfit:      number  // $B
  rd:               number  // $B
  sga:              number  // $B
  interestExp:      number  // $B
  otherOpEx:        number  // $B
  preTaxIncome:     number  // $B
  netIncome:        number  // $B
  shares:           number  // diluted shares ($B)
  sharesBoughtBack: number  // shares retired this year ($B); 0 in Year 1
  eps:              number  // $/share
  divPerShare:      number  // $/share
  totalDiv:         number  // $B
  fcfSurplus:       number  // $B (NI − dividends ≥ 0; available for buybacks)
  impliedBuybackCost: number  // $B (sharesBoughtBack × 15 × eps)
  pv:               number  // PV of NI at WACC
}

export interface DeereDCFResult {
  rows:               DeereDCFRow[]
  terminalValue:      number  // $B (Gordon growth on Year 10 NI)
  pvTerminal:         number  // $B
  pvSum:              number  // $B (Σ PV(NI) years 1–10)
  enterpriseValue:    number  // $B
  equityValue:        number  // $B (EV − consolidated net debt)
  intrinsicPerShare:  number  // $/share (DCF fair value)
  impliedCAGR:        number  // WACC-accreted CAGR: intrinsic × (1+WACC)^10 vs entry price
  peExitPrice:        number  // 15× FY2035E EPS (display only — not used in valuation)
  avgDivYield15xPE:   number  // avg annual div yield using 15× P/E as share price (display only)
  updown:             number  // % upside/(downside) vs DCF intrinsic
  gordon:             number  // terminal multiple
  tvWeight:           number  // terminal value / enterprise value
}

export function runDeereDCF(
  model:      DeereModelConfig,
  scenario:   Scenario,
  subPct10:   number,   // Year 10 subscription target (slider value)
  wacc:       number,
  termGrowth: number,
): DeereDCFResult {
  const s = model.scenarios[scenario]
  const rows: DeereDCFRow[] = []

  let equipRev    = model.y1EquipRev
  let fsRev       = model.y1FsRev
  let shares      = model.sharesOut
  let divPerShare = model.divPerShare

  for (let i = 0; i < 10; i++) {
    const year = model.baseYear + 1 + i  // FY2026 .. FY2035

    // Equipment revenue: Year 1 = guidance anchor; Years 2–10 grow at cycle rates
    if (i > 0) {
      equipRev = equipRev * (1 + s.equipGrowth[i - 1])
    }

    // Subscription % ramp: 5% at Year 1 → slider target at Year 9 → holds Year 10
    const subPct = 0.05 + Math.min(1, i / 8) * (subPct10 - 0.05)

    // Subscription revenue: subPct = sub / (equip + sub) → sub = equip × subPct/(1−subPct)
    const subRev = equipRev * subPct / (1 - subPct)

    // FS revenue grows smoothly at scenario-specific rate
    if (i > 0) {
      fsRev = fsRev * (1 + s.fsGrowthRate)
    }

    const otherRev    = model.y1OtherRev
    const totalRev    = equipRev + subRev + fsRev + otherRev

    // Gross margin: applied to total revenue; calibrated: 5%→36.7%, 14%→40.8%
    const gmPct       = gmFromSubPct(subPct)
    const grossProfit = totalRev * gmPct

    // Operating expenses (interest already captured here — priority 1 of waterfall)
    const rd          = equipRev * RD_PCT
    const sga         = equipRev * model.sgaPct[i]
    const interestExp = model.y1InterestExp * (fsRev / model.y1FsRev)
    const otherOpEx   = model.otherOpEx

    // Net income (after interest and tax — priorities 1 & 2 of waterfall already satisfied)
    const preTaxIncome = grossProfit - rd - sga - interestExp - otherOpEx
    const netIncome    = Math.max(0, preTaxIncome * (1 - model.taxRate))

    // Share count: capture shares before buyback to compute retirement
    // No buyback in Year 1 (Deere suspended buybacks at cycle trough, Q4 FY2025: $0)
    const sharesStart = shares
    if (i > 0) {
      shares = shares * (1 - s.buybackRate)
    }
    const sharesBoughtBack = sharesStart - shares  // $B; 0 in Year 1

    const eps = netIncome / shares

    // Dividends: grow at scenario rate from Year 2 (priority 3 of waterfall)
    if (i > 0) {
      divPerShare = divPerShare * (1 + s.divGrowthRate)
    }
    const totalDiv   = divPerShare * shares
    // FCF surplus available for buybacks (priority 4) — shown for reference;
    // actual buyback is driven by the fixed scenario buybackRate, not this figure
    const fcfSurplus = Math.max(0, netIncome - totalDiv)

    // Implied buyback cost at 15× P/E (context: is FCF surplus sufficient?)
    const impliedBuybackCost = sharesBoughtBack * PE_EXIT_MULTIPLE * eps

    // PV of net income
    const pv = netIncome / Math.pow(1 + wacc, i + 1)

    rows.push({
      year, equipRev, subRev, fsRev, otherRev, totalRev,
      subPct, gmPct, grossProfit, rd, sga, interestExp, otherOpEx,
      preTaxIncome, netIncome, shares, sharesBoughtBack, eps,
      divPerShare, totalDiv, fcfSurplus, impliedBuybackCost, pv,
    })
  }

  // Terminal value: Gordon Growth Model on Year 10 NI
  const lastNI        = rows[9].netIncome
  const gordon        = (1 + termGrowth) / (wacc - termGrowth)
  const terminalValue = lastNI * (1 + termGrowth) / (wacc - termGrowth)
  const pvTerminal    = terminalValue / Math.pow(1 + wacc, 10)
  const pvSum         = rows.reduce((acc, r) => acc + r.pv, 0)

  const enterpriseValue   = pvSum + pvTerminal
  const equityValue       = enterpriseValue - model.netDebt
  const intrinsicPerShare = equityValue / model.sharesOut

  // ── WACC-accreted CAGR (DCF basis) ───────────────────────────────
  // Intrinsic value accretes at WACC going forward; investor earns that
  // compound return if buying at today's price.
  const fvYear10    = intrinsicPerShare * Math.pow(1 + wacc, 10)
  const impliedCAGR = Math.pow(Math.max(0.01, fvYear10) / model.currentPrice, 0.1) - 1

  // ── 15× P/E dividend yield (display only — does not affect valuation) ─
  // Average annual dividend yield over the 10-year period, using 15× EPS
  // as the share price proxy. Illustrates income return on a "normalized"
  // P/E entry, independent of the DCF intrinsic value.
  const peExitPrice      = PE_EXIT_MULTIPLE * rows[9].eps
  const avgDivYield15xPE = rows.reduce((sum, r) => {
    return sum + r.divPerShare / (PE_EXIT_MULTIPLE * r.eps)
  }, 0) / rows.length

  const updown   = (intrinsicPerShare / model.currentPrice - 1) * 100
  const tvWeight = pvTerminal / enterpriseValue

  return {
    rows, terminalValue, pvTerminal, pvSum, enterpriseValue, equityValue,
    intrinsicPerShare, impliedCAGR, peExitPrice, avgDivYield15xPE, updown, gordon, tvWeight,
  }
}

// ── Sensitivity grid: Sub% Year 10 (rows) × WACC (cols) ─────────
export const SENS_SUB_PCTS = [0.05, 0.08, 0.11, 0.14, 0.17, 0.20, 0.25]
export const SENS_WACCS    = [0.07, 0.08, 0.09, 0.10, 0.11, 0.12]

export function buildDeereSensitivity(
  model:      DeereModelConfig,
  scenario:   Scenario,
  termGrowth: number,
): { subPcts: number[]; waccs: number[]; grid: number[][] } {
  const grid = SENS_SUB_PCTS.map(sp =>
    SENS_WACCS.map(w => {
      const r = runDeereDCF(model, scenario, sp, w, termGrowth)
      return Math.round(r.intrinsicPerShare)
    })
  )
  return { subPcts: SENS_SUB_PCTS, waccs: SENS_WACCS, grid }
}
