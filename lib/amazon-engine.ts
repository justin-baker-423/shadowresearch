// ─────────────────────────────────────────────────────────────────
//  amazon-engine.ts  —  Pure calculation, no React.
//  Port of amazon-sotp-reference.ts (spec v1.1); reproduces its golden
//  values exactly at default inputs.
//
//  equity = AWS EV + Ads EV + Commerce EV + Anthropic stake + Other bets
//           − (debt − cash);   perShare = equity ÷ diluted shares
//
//  Every segment: years 2027–36 discounted at (1+WACC)^i; terminal value
//  TV = NOPAT_2037 × (1 − g/RONIC) ÷ (WACC − g) with RONIC = WACC
//  (terminal new capital earns its cost) → NOPAT_2037 ÷ WACC.
//
//  AWS (capital-driven rate base)
//    revPerNetCapex: start through 2028, linear to end by 2032, flat after
//    Revenue_y = Revenue_y−1 + revPerNetCapex × max(0, capex − D&A)_y−1
//    Core grows at coreGrowth; AI = Revenue − Core; training 40% of AI
//      through 2028, linear to trainingShareEnd by 2036
//    NOPAT = blended ROIC × beginning capital;  IC += capex − D&A
//    D&A = legacy (217 × 5 yr, 145 × 28 yr) + vintages from the year after
//      spend (60% at 5.5 yr, 40% at 30 yr; half year in the final partial year)
//    Capex: +25%, +10%, flat to 2030, then lerp to D&A + g × IC by 2036
//    FCF = NOPAT − (capex − D&A);  terminal NOPAT = ROIC_2036 × IC_2036
//  Advertising
//    Growth 17% → 5%; EBIT = rev × ad margin; FCF = NOPAT × (1 − 10%)
//  Commerce (ex-ads, ex-other bets)
//    m0 = (NA+Intl OI − ad margin × ad revenue + other-bets add-back) ÷ rev
//    margin = m0 + automation + leverage
//      automation = (warehouse 10.2% × whShare + driver 2.98% × drvShare)
//                   × 59% net capture × share kept
//    Reinvestment = Δrevenue ÷ sales-to-capital
//  Other bets: −Σ PV(cost × (1 − tax)), $7B to 2030 fading to 0 by 2035
//    (perpetual toggle: −cost × (1 − tax) ÷ WACC)
//  Anthropic: 15% × dcf-site ANT equity in the matching ANT scenario,
//    at ANT's own WACC; no tax haircut
//
//  impliedCAGR = (perShare × (1+WACC)^10 / price)^(1/10) − 1
// ─────────────────────────────────────────────────────────────────

import type { AmazonModelConfig, AmazonScenario, StakeBasis, OtherBetsMode } from "./amazon-models"
import { runAnthropicDCF } from "./anthropic-engine"
import { ANTHROPIC_MODELS } from "./anthropic-models"

export interface AwsRow {
  year:        number
  rev:         number
  revGrowth:   number
  core:        number
  inference:   number
  training:    number
  aiShare:     number
  trainingShareOfAi: number
  revPerNetCapex: number
  capex:       number
  da:          number
  netCapex:    number
  icBegin:     number
  icEnd:       number
  blendedRoic: number   // on beginning capital (the driver)
  roicAvg:     number   // on average capital (display)
  nopat:       number
  ebit:        number
  opMargin:    number
  fcf:         number
  pvFcf:       number
}

export interface AwsResult {
  rows:     AwsRow[]
  sumPvFcf: number
  cumFcf:   number
  tv:       number
  pvTv:     number
  ev:       number
  tvWeight: number
  evToIC:   number
}

export interface AdsRow {
  year: number; rev: number; growth: number; ebit: number; nopat: number
  reinvest: number; fcf: number; pvFcf: number
}

export interface AdsResult {
  rows: AdsRow[]; margin: number; sumPvFcf: number; tv: number; pvTv: number; ev: number
}

export interface CommerceRow {
  year: number; rev: number; growth: number
  margin: number; baseMargin: number; automation: number; leverage: number
  warehouseShare: number; driverShare: number
  ebit: number; nopat: number; reinvest: number; fcf: number; pvFcf: number
}

export interface CommerceResult {
  rows: CommerceRow[]
  baseRev: number; baseOI: number; baseMargin: number
  sumPvFcf: number; tv: number; pvTv: number; ev: number
}

export interface StakeResult {
  basis:       StakeBasis
  antScenario: "bear" | "base" | "bull"
  value:       number   // $B, the line used in the SOTP
  antEquity:   number   // ANT equity in the matching scenario ($B)
  antPerShare: number   // ANT value per share in that scenario ($)
  options:     Record<StakeBasis, number>
}

export interface AmazonOverrides {
  adsMargin?:        number
  commerceKept?:     number
  commerceS2C?:      number
  warehouseAutoEnd?: number
  stakeBasis?:       StakeBasis
  otherBetsMode?:    OtherBetsMode
}

export interface AmazonResult {
  aws:          AwsResult
  ads:          AdsResult
  commerce:     CommerceResult
  otherBets:    number    // $B, negative
  stake:        StakeResult
  netDebt:      number
  ev:           number    // operating EV (AWS + ads + commerce + other bets)
  equity:       number
  perShare:     number
  updown:       number
  impliedCAGR:  number
  hurdlePrice:  number
  marketCap:    number
  impliedAwsEV: number    // market cap + net debt − other pieces at model value
  perSharePieces: { aws: number; ads: number; commerce: number; stake: number; otherBets: number; netDebt: number }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t))
/** Share of cost depreciated in service year k (1-based) for a given life; partial final year. */
const depFrac = (k: number, life: number) => { const r = life - (k - 1); return r <= 0 ? 0 : Math.min(1, r) / life }
const pv = (x: number, w: number, i: number) => x / Math.pow(1 + w, i)
/** Terminal value at end-2036; with RONIC = WACC growth adds no value. */
const termValue = (nopatNext: number, w: number, g: number, ronic = w) => nopatNext * (1 - g / ronic) / (w - g)

// ── AWS ──────────────────────────────────────────────────────────
export function runAws(model: AmazonModelConfig, sc: AmazonScenario, w: number, g: number): AwsResult {
  const B = model.aws, s = model.scenarios[sc].aws, y0 = model.baseYear, yN = model.lastYear
  const vint: Record<number, number> = {}
  const daFor = (y: number) => {
    const k = y - y0
    let d = B.legacyShortLived * depFrac(k, B.legacyShortLife) + B.legacyLongLived * depFrac(k, B.legacyLongLife)
    for (const v of Object.keys(vint).map(Number)) if (v < y) {
      const c = vint[v], kk = y - v
      d += c * B.shortLivedShare * depFrac(kk, B.shortLife) + c * (1 - B.shortLivedShare) * depFrac(kk, B.longLife)
    }
    return d
  }

  const rows: AwsRow[] = []
  let rev = B.baseRevenue, core = B.baseRevenue * (1 - B.baseAiShare)
  let prevCapex = B.baseCapex, prevDA = B.baseDA, ic = B.baseIC, capex = B.baseCapex, sumPv = 0
  for (let y = y0 + 1; y <= yN; y++) {
    const i = y - y0
    const r = y <= B.buildoutEnd ? s.revPerNetCapexStart
      : lerp(s.revPerNetCapexStart, s.revPerNetCapexEnd, (y - B.buildoutEnd) / (B.rampEndYear - B.buildoutEnd))
    const prevRev = rev
    rev = prevRev + r * Math.max(0, prevCapex - prevDA)
    core *= 1 + s.coreGrowth
    const ai = Math.max(0, rev - core)
    const tShare = y <= B.buildoutEnd ? B.trainingShareBuildout
      : lerp(B.trainingShareBuildout, s.trainingShareEnd, (y - B.buildoutEnd) / (yN - B.buildoutEnd))
    const training = ai * tShare, inference = ai - training
    const blended = (core * s.coreRoic + inference * s.inferenceRoic + training * s.trainingRoic) / rev
    const icBegin = ic, nopat = blended * icBegin
    const da = daFor(y)
    if (i <= B.capexGrowth.length) capex *= 1 + B.capexGrowth[i - 1]
    else if (y > B.capexFlatUntil) {
      const c2030 = rows.find(rw => rw.year === B.capexFlatUntil)!.capex
      capex = lerp(c2030, da + g * icBegin, (y - B.capexFlatUntil) / (yN - B.capexFlatUntil))
    }
    vint[y] = capex
    const netCapex = capex - da
    ic = icBegin + netCapex
    const fcf = nopat - netCapex
    const pvFcf = pv(fcf, w, i)
    sumPv += pvFcf
    const ebit = nopat / (1 - model.taxRate)
    rows.push({
      year: y, rev, revGrowth: rev / prevRev - 1,
      core: Math.min(core, rev), inference, training, aiShare: ai / rev, trainingShareOfAi: tShare,
      revPerNetCapex: r, capex, da, netCapex, icBegin, icEnd: ic,
      blendedRoic: blended, roicAvg: nopat / ((icBegin + ic) / 2),
      nopat, ebit, opMargin: ebit / rev, fcf, pvFcf,
    })
    prevCapex = capex; prevDA = da
  }
  const last = rows[rows.length - 1]
  const tv   = termValue(last.blendedRoic * last.icEnd, w, g)
  const pvTv = pv(tv, w, yN - y0)
  const ev   = sumPv + pvTv
  return {
    rows, sumPvFcf: sumPv, cumFcf: rows.reduce((t, r) => t + r.fcf, 0),
    tv, pvTv, ev, tvWeight: pvTv / ev, evToIC: ev / B.baseIC,
  }
}

// ── Advertising ──────────────────────────────────────────────────
export function runAds(model: AmazonModelConfig, margin: number, w: number, g: number): AdsResult {
  const A = model.ads
  let rev = A.baseRevenue, sumPv = 0
  const rows: AdsRow[] = []
  for (let i = 1; i <= 10; i++) {
    const growth = A.growthStart + (A.growthEnd - A.growthStart) * (i - 1) / 9
    rev *= 1 + growth
    const ebit = rev * margin, nopat = ebit * (1 - model.taxRate)
    const reinvest = nopat * A.reinvestRate, fcf = nopat - reinvest
    const pvFcf = pv(fcf, w, i)
    sumPv += pvFcf
    rows.push({ year: model.baseYear + i, rev, growth, ebit, nopat, reinvest, fcf, pvFcf })
  }
  const tv   = termValue(rows[9].nopat * (1 + g), w, g)
  const pvTv = pv(tv, w, 10)
  return { rows, margin, sumPvFcf: sumPv, tv, pvTv, ev: sumPv + pvTv }
}

// ── Commerce (ex-ads, ex-other bets) ─────────────────────────────
export function runCommerce(
  model: AmazonModelConfig, adsMargin: number, kept: number, s2c: number, warehouseAutoEnd: number,
  w: number, g: number,
): CommerceResult {
  const C = model.commerce
  const baseRev = C.naIntlRevenue - model.ads.baseRevenue
  const baseOI  = C.naIntlOpIncome - adsMargin * model.ads.baseRevenue + C.otherBetsAddBack
  const m0      = baseOI / baseRev
  let rev = baseRev, sumPv = 0
  const rows: CommerceRow[] = []
  for (let i = 1; i <= 10; i++) {
    const y = model.baseYear + i
    const growth = C.growthStart + (C.growthEnd - C.growthStart) * (i - 1) / 9
    const prev = rev
    rev *= 1 + growth
    const wh = warehouseAutoEnd * i / 10
    const dv = C.driverAutoEnd * Math.max(0, y - C.driverAutoStart) / (model.lastYear - C.driverAutoStart)
    const automation = (C.warehouseLaborPct * wh + C.driverLaborPct * dv) * C.netCapture * kept
    const leverage   = C.leverageEnd * i / 10
    const margin     = m0 + automation + leverage
    const ebit = rev * margin, nopat = ebit * (1 - model.taxRate)
    const reinvest = (rev - prev) / s2c
    const fcf = nopat - reinvest
    const pvFcf = pv(fcf, w, i)
    sumPv += pvFcf
    rows.push({ year: y, rev, growth, margin, baseMargin: m0, automation, leverage,
                warehouseShare: wh, driverShare: dv, ebit, nopat, reinvest, fcf, pvFcf })
  }
  const tv   = termValue(rows[9].nopat * (1 + g), w, g)
  const pvTv = pv(tv, w, 10)
  return { rows, baseRev, baseOI, baseMargin: m0, sumPvFcf: sumPv, tv, pvTv, ev: sumPv + pvTv }
}

// ── Other bets (Leo, Zoox): costs only ───────────────────────────
export function runOtherBets(model: AmazonModelConfig, w: number, mode: OtherBetsMode = "fade"): number {
  const O = model.otherBets
  if (mode === "perpetual") return -O.annualCost * (1 - model.taxRate) / w
  let v = 0
  for (let i = 1; i <= 10; i++) {
    const y = model.baseYear + i
    const c = y <= O.flatThrough ? O.annualCost : O.annualCost * Math.max(0, O.zeroBy - y) / (O.zeroBy - O.flatThrough)
    v -= pv(c * (1 - model.taxRate), w, i)
  }
  return v
}

// ── Anthropic stake (scenario-matched, ANT's own WACC, no tax haircut) ──
export function amazonStake(model: AmazonModelConfig, sc: AmazonScenario, basis: StakeBasis = "pct15"): StakeResult {
  const antSc = model.scenarios[sc].ant
  const m = ANTHROPIC_MODELS[0]
  const ant = runAnthropicDCF(m, antSc, m.waccDefault, m.termGrowth, m.netMarginDefault, m.scenarios[antSc].extGrowth)
  const S = model.anthropic
  const options: Record<StakeBasis, number> = {
    pct15:       S.stakePct * ant.equity,
    classN:      S.classNShares * ant.perShare,
    classNNotes: (S.classNShares + S.noteShares) * ant.perShare,
    market:      S.classNShares * S.antPrice,
  }
  return { basis, antScenario: antSc, value: options[basis], antEquity: ant.equity, antPerShare: ant.perShare, options }
}

// ── SOTP ─────────────────────────────────────────────────────────
export function runAmazonSotp(
  model: AmazonModelConfig,
  sc:    AmazonScenario,
  wacc:  number,
  termG: number,
  ov:    AmazonOverrides = {},
): AmazonResult {
  const S = model.scenarios[sc]
  const adsMargin = ov.adsMargin ?? S.adsMargin

  const aws       = runAws(model, sc, wacc, termG)
  const ads       = runAds(model, adsMargin, wacc, termG)
  const commerce  = runCommerce(model, adsMargin, ov.commerceKept ?? S.commerceKept, ov.commerceS2C ?? S.commerceS2C,
                                ov.warehouseAutoEnd ?? model.commerce.warehouseAutoEnd, wacc, termG)
  const otherBets = runOtherBets(model, wacc, ov.otherBetsMode ?? "fade")
  const stake     = amazonStake(model, sc, ov.stakeBasis ?? "pct15")
  const netDebt   = model.debt - model.cash

  const ev       = aws.ev + ads.ev + commerce.ev + otherBets
  const equity   = ev + stake.value - netDebt
  const perShare = equity / model.sharesOut

  const impliedCAGR = perShare > 0 && model.currentPrice > 0
    ? Math.pow(perShare * Math.pow(1 + wacc, 10) / model.currentPrice, 0.1) - 1 : 0
  const hurdlePrice = perShare * Math.pow((1 + wacc) / (1 + model.hurdle), 10)

  const marketCap = model.currentPrice * model.sharesOut
  const sh = model.sharesOut
  return {
    aws, ads, commerce, otherBets, stake, netDebt, ev, equity, perShare,
    updown: (perShare / model.currentPrice - 1) * 100,
    impliedCAGR, hurdlePrice, marketCap,
    impliedAwsEV: marketCap + netDebt - ads.ev - commerce.ev - otherBets - stake.value,
    perSharePieces: {
      aws: aws.ev / sh, ads: ads.ev / sh, commerce: commerce.ev / sh,
      stake: stake.value / sh, otherBets: otherBets / sh, netDebt: -netDebt / sh,
    },
  }
}

// ── Sensitivity: WACC × share of Commerce automation savings kept ─
export function buildAmazonSensitivity(
  model: AmazonModelConfig, sc: AmazonScenario, termG: number, ov: AmazonOverrides = {},
): { waccs: number[]; kept: number[]; grid: number[][] } {
  const waccs = [0.08, 0.09, 0.10, 0.11, 0.12]
  const kept  = [0, 0.25, 0.50, 0.75, 1.00]
  const grid = kept.map(k =>
    waccs.map(w => runAmazonSotp(model, sc, w, termG, { ...ov, commerceKept: k }).perShare))
  return { waccs, kept, grid }
}
