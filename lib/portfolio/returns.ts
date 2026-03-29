// Pure calculation functions — no I/O, no server-only dependency.
// Modified Dietz TWR, XIRR (Newton's method), CAGR, holding period formatting.
import { Transaction, Lot, ReturnMetric } from './types'

const MS_PER_DAY  = 86_400_000
const DAYS_PER_YR = 365.25

// ── Utility ───────────────────────────────────────────────────────────────────

export function daysToYears(ms: number): number {
  return ms / (MS_PER_DAY * DAYS_PER_YR)
}

// Weighted-average acquisition date across all open lots
export function weightedAvgDate(lots: Lot[]): Date {
  const totalShares = lots.reduce((s, l) => s + l.shares, 0)
  if (totalShares === 0) return new Date()

  const EPOCH = 0 // Unix epoch ms
  const weightedMs = lots.reduce(
    (s, l) => s + l.shares * (l.date.getTime() - EPOCH),
    0,
  )
  return new Date(weightedMs / totalShares)
}

// ── Holding period formatter ──────────────────────────────────────────────────
// Mirrors the string format used in the original portfolio.ts snapshot:
// "1 yr 7 mo" / "4 mo 20 d" / "28 days"

export function formatHoldingPeriod(from: Date, to: Date): string {
  const totalDays = Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY)

  if (totalDays < 30) return `${totalDays} days`

  const years   = Math.floor(totalDays / 365)
  const remain  = totalDays - years * 365
  const months  = Math.floor(remain / 30)
  const days    = remain - months * 30

  if (years > 0 && months > 0) return `${years} yr ${months} mo`
  if (years > 0)               return `${years} yr`
  if (months > 0 && days > 3)  return `${months} mo ${days} d`
  return `${months} mo`
}

// ── CAGR ──────────────────────────────────────────────────────────────────────

export function computeCAGR(
  cost:  number,
  value: number,
  years: number,
): number | null {
  if (years <= 0 || cost <= 0 || value <= 0) return null
  return (value / cost) ** (1 / years) - 1
}

// ── Modified Dietz TWR ────────────────────────────────────────────────────────
// Industry-standard approximation when daily prices aren't available.
// R = (EMV - BMV - ΣCF) / (BMV + Σ(CF_i × W_i))
// W_i = (T - days_since_start_i) / T

export function modifiedDietz(
  transactions: Transaction[],
  endMV:        number,
  label:        string,
): Omit<ReturnMetric, 'irr'> | null {
  const deposits = transactions.filter(t => t.txType === 'DEPOSIT')
  if (deposits.length === 0) return null

  const sorted    = [...transactions].sort((a, b) => a.txDate.getTime() - b.txDate.getTime())
  const startDate = sorted[0].txDate
  const endDate   = new Date()
  const T         = (endDate.getTime() - startDate.getTime()) / MS_PER_DAY
  if (T === 0) return null

  const bmv      = 0  // account started with $0
  const totalCF  = deposits.reduce((s, t) => s + t.amount, 0)
  const weighted = deposits.reduce((s, t) => {
    const daysIn = (t.txDate.getTime() - startDate.getTime()) / MS_PER_DAY
    return s + t.amount * ((T - daysIn) / T)
  }, 0)

  const denom = bmv + weighted
  if (Math.abs(denom) < 1e-6) return null

  const mdReturn    = (endMV - bmv - totalCF) / denom
  const years       = T / DAYS_PER_YR
  const annualised  = years > 0 ? (1 + mdReturn) ** (1 / years) - 1 : null

  const fmt = (d: Date) =>
    d.toLocaleString('en-US', { month: 'short', year: 'numeric' })

  return {
    label,
    period:         `${fmt(startDate)} – ${fmt(endDate)}`,
    years:          Math.round(years * 10) / 10,
    totalDeposits:  Math.round(totalCF),
    endingMV:       Math.round(endMV),
    cumulativeTWR:  Math.round(mdReturn * 1000) / 10,
    annualisedTWR:  annualised != null ? Math.round(annualised * 1000) / 10 : 0,
  }
}

// ── XIRR (Newton's method) ────────────────────────────────────────────────────
// Solves NPV = Σ CF_i / (1+r)^t_i = 0 for r.
// Deposits are outflows from the investor's perspective (negative).
// Terminal market value is the final inflow (positive).

export function xirr(
  transactions: Transaction[],
  endMV:        number,
): number | null {
  const deposits = transactions.filter(t => t.txType === 'DEPOSIT')
  if (deposits.length === 0) return null

  const cfs = [
    ...deposits.map(t => ({ date: t.txDate, amount: -t.amount })),
    { date: new Date(), amount: endMV },
  ].sort((a, b) => a.date.getTime() - b.date.getTime())

  const t0      = cfs[0].date
  const years   = cfs.map(cf => daysToYears(cf.date.getTime() - t0.getTime()))
  const amounts = cfs.map(cf => cf.amount)

  const npv  = (r: number) =>
    amounts.reduce((s, a, i) => s + a / (1 + r) ** years[i], 0)
  const dnpv = (r: number) =>
    amounts.reduce((s, a, i) => s - years[i] * a / (1 + r) ** (years[i] + 1), 0)

  for (const r0 of [0.1, 0.0, 0.5, -0.05, 0.3]) {
    let r = r0
    for (let iter = 0; iter < 200; iter++) {
      try {
        const f  = npv(r)
        const df = dnpv(r)
        if (Math.abs(df) < 1e-12) break
        const r2 = r - f / df
        if (Math.abs(r2 - r) < 1e-8) { r = r2; break }
        r = r2
        if (r <= -1) r = -0.999
      } catch { break }
    }
    if (Math.abs(npv(r)) < 0.01) return r
  }
  return null
}
