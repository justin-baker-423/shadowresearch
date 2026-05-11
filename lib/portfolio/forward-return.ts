// ─────────────────────────────────────────────────────────────────
//  forward-return.ts
//
//  Computes the market-value-weighted average base-case implied
//  10-yr CAGR across all equity holdings with a DCF model.
//
//  Each model's currentPrice is overridden with the live price
//  already resolved by computePortfolio(), so the CAGR reflects
//  today's entry point.
// ─────────────────────────────────────────────────────────────────

import type { HoldingDetail } from './types'

// ── Standard engine ───────────────────────────────────────────────
import { runDCF }           from '@/lib/dcf-engine'
import { getModel }         from '@/lib/models'
import { getTsmModel }      from '@/lib/tsm-models'
import { getNikeModel }     from '@/lib/nike-models'
import { getCelsiusModel }  from '@/lib/celsius-models'

// ── Specialised engines ───────────────────────────────────────────
import { runMetaDCF }       from '@/lib/meta-dcf-engine'
import { getMetaModel }     from '@/lib/meta-models'

import { runDeereDCF }      from '@/lib/deere-engine'
import { getDeereModel }    from '@/lib/deere-models'

import { runLemonadeDCF }   from '@/lib/lemonade-engine'
import { getLemonadeModel } from '@/lib/lemonade-models'

import { runSnowflakeDCF }  from '@/lib/snowflake-engine'
import { getSnowflakeModel } from '@/lib/snowflake-models'

import { runAtlassianDCF }  from '@/lib/atlassian-engine'
import { getAtlassianModel } from '@/lib/atlassian-models'

import { runNikeDCF }       from '@/lib/nike-engine'

import { runTeslaDCF }      from '@/lib/tesla-engine'
import { TESLA_MODELS }     from '@/lib/tesla-models'

// ── Manual overrides (no DCF model; conviction-based estimate) ───
const MANUAL_CAGR: Record<string, number> = {
  COIN: 0.15,  // difficult to value; pencilled in at above-market 15% (May 2026)
}

/** Returns the base-case implied 10-yr CAGR for a single ticker at the given live price. */
function cagrForTicker(ticker: string, livePrice: number): number | null {
  // Check manual overrides first
  if (ticker.toUpperCase() in MANUAL_CAGR) return MANUAL_CAGR[ticker.toUpperCase()]

  try {
    // ── Tesla (multi-segment, lookup by ticker not slug) ───────
    const teslaModel = TESLA_MODELS.find(m => m.ticker === ticker.toUpperCase())
    if (teslaModel) {
      const m = { ...teslaModel, currentPrice: livePrice }
      return runTeslaDCF(m, m.waccDefault, m.termGrowth).impliedCAGR
    }

    // ── Meta (ROIC-driven) ─────────────────────────────────────
    const metaModel = getMetaModel(ticker.toLowerCase())
    if (metaModel) {
      const m = { ...metaModel, currentPrice: livePrice }
      return runMetaDCF(m, 'base', m.waccDefault, m.termGrowth, m.roicDefault).impliedCAGR
    }

    // ── Deere (ag-cycle + mix-shift) ──────────────────────────
    const deereModel = getDeereModel(ticker.toLowerCase())
    if (deereModel) {
      const m = { ...deereModel, currentPrice: livePrice }
      return runDeereDCF(m, 'base', m.subPctDefault, m.waccDefault, m.termGrowth).impliedCAGR
    }

    // ── Lemonade (IFP/loss-ratio) ──────────────────────────────
    const lemonadeModel = getLemonadeModel(ticker.toLowerCase())
    if (lemonadeModel) {
      const m = { ...lemonadeModel, currentPrice: livePrice }
      return runLemonadeDCF(m, m.lossRatioDefault, m.termGrowth).impliedCAGR
    }

    // ── Snowflake (consumption / exit multiple) ────────────────
    const snowflakeModel = getSnowflakeModel(ticker.toLowerCase())
    if (snowflakeModel) {
      const m = { ...snowflakeModel, currentPrice: livePrice }
      return runSnowflakeDCF(m, 'base', m.waccDefault, m.exitMultipleDefault).impliedCAGR
    }

    // ── Atlassian (R&D capitalisation + exit multiple) ─────────
    const atlassianModel = getAtlassianModel(ticker.toLowerCase())
    if (atlassianModel) {
      const m = { ...atlassianModel, currentPrice: livePrice }
      return runAtlassianDCF(m, 'base', m.waccDefault, m.exitMultipleDefault).impliedCAGR
    }

    // ── Nike (two-segment) ─────────────────────────────────────
    const nikeModel = getNikeModel(ticker.toLowerCase())
    if (nikeModel) {
      const m = { ...nikeModel, currentPrice: livePrice }
      return runNikeDCF(m, 'base', m.waccDefault, m.termGrowth).impliedCAGR
    }

    // ── TSM (standard engine, FCF-margin approach) ─────────────
    const tsmModel = getTsmModel(ticker.toLowerCase())
    if (tsmModel) {
      const m = { ...tsmModel, currentPrice: livePrice }
      return runDCF(m, 'base', m.waccDefault, m.termGrowth).impliedCAGR
    }

    // ── Celsius / standard earnings models (SAP, CMG, …) ──────
    const celsiusModel = getCelsiusModel(ticker.toLowerCase())
    if (celsiusModel) {
      const m = { ...celsiusModel, currentPrice: livePrice }
      return runDCF(m, 'base', m.waccDefault, m.termGrowth).impliedCAGR
    }

    const stdModel = getModel(ticker.toLowerCase())
    if (stdModel) {
      const m = { ...stdModel, currentPrice: livePrice }
      return runDCF(m, 'base', m.waccDefault, m.termGrowth).impliedCAGR
    }

    return null
  } catch {
    return null
  }
}

export interface ForwardReturnContribution {
  ticker:       string
  weightPct:    number   // raw portfolio weight (e.g. 31.0 = 31%)
  cagr:         number   // implied 10-yr CAGR decimal (e.g. 0.15)
  contribution: number   // weighted contribution to total (decimal, e.g. 0.046)
  isManual:     boolean  // true if using a manual override rather than a DCF model
}

export interface ForwardReturnResult {
  total:         number                        // MV-weighted avg CAGR decimal
  contributions: ForwardReturnContribution[]   // per-holding breakdown, sorted by |contribution| desc
}

/**
 * Returns the market-value-weighted average base-case implied 10-yr CAGR
 * across all equity holdings that have a DCF model, plus a per-holding breakdown.
 * Returns null if no holdings have a model.
 */
export function computeForwardReturn(holdingDetails: HoldingDetail[]): ForwardReturnResult | null {
  const rows: Array<{ ticker: string; weightPct: number; cagr: number; isManual: boolean }> = []
  let totalWeight = 0

  for (const h of holdingDetails) {
    const isManual = h.ticker.toUpperCase() in MANUAL_CAGR
    const cagr = cagrForTicker(h.ticker, h.currentPrice)
    if (cagr == null) continue
    rows.push({ ticker: h.ticker, weightPct: h.weightPct, cagr, isManual })
    totalWeight += h.weightPct
  }

  if (totalWeight === 0 || rows.length === 0) return null

  const contributions: ForwardReturnContribution[] = rows
    .map(r => ({
      ticker:       r.ticker,
      weightPct:    r.weightPct,
      cagr:         r.cagr,
      // normalised weight × cagr = this holding's share of the total
      contribution: (r.weightPct / totalWeight) * r.cagr,
      isManual:     r.isManual,
    }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))

  const total = contributions.reduce((s, c) => s + c.contribution, 0)

  return { total, contributions }
}
