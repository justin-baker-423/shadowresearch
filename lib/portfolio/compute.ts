import 'server-only'

import { loadTransactions }                                        from './parse'
import { buildEquityPositions, buildOptionPositions, firstBuyDates } from './fifo'
import {
  computeCAGR, formatHoldingPeriod, weightedAvgDate,
  modifiedDietz, xirr, daysToYears,
}                                                                  from './returns'
import { fetchPrices, getLogoUrl }                                 from './prices'
import { computeLifetimeReturns }                                   from './history'
import {
  Holding, HoldingDetail, OpenOption, ReturnMetric,
  PortfolioData, AccountShort,
}                                                                  from './types'

const SHORT_HOLD_DAYS = 180   // < 6 months → CAGR flagged as unreliable
const MS_PER_DAY     = 86_400_000

function toShort(account: string): AccountShort {
  return account === 'Schwab IRA' ? 'IRA' : 'RH'
}

function round2(n: number) { return Math.round(n * 100) / 100 }
function round1(n: number) { return Math.round(n * 10)  / 10  }

// ── Main pipeline ─────────────────────────────────────────────────────────────

export async function computePortfolio(): Promise<PortfolioData> {
  const transactions  = loadTransactions()
  const equityPos     = buildEquityPositions(transactions)
  const optionPos     = buildOptionPositions(transactions)
  const firstBuyMap   = firstBuyDates(equityPos)

  // ── Gather tickers for open equity positions ──────────────────────────────
  const tickersNeeded: string[] = []
  for (const pos of equityPos.values()) {
    const totalShares = pos.lots.reduce((s, l) => s + l.shares, 0)
    if (totalShares >= 0.001 && !tickersNeeded.includes(pos.ticker)) {
      tickersNeeded.push(pos.ticker)
    }
  }

  // ── Live price + company name fetch + lifetime returns (parallel) ────────
  // Both hit Yahoo Finance independently — run concurrently to save wall-clock
  // time. computeLifetimeReturns falls back to the last weekly OHLC close for
  // the final value when live prices aren't yet available (negligible delta).
  const [{ prices, companyNames, allFetched }, lifetimeReturns] = await Promise.all([
    fetchPrices(tickersNeeded),
    computeLifetimeReturns(transactions),
  ])

  // ── Build per-account holdings ────────────────────────────────────────────
  const now = new Date()
  const unsorted: Omit<Holding, 'rank' | 'weightPct'>[] = []

  for (const pos of equityPos.values()) {
    if (pos.lots.length === 0) continue

    const totalShares = pos.lots.reduce((s, l) => s + l.shares, 0)
    if (totalShares < 0.001) continue

    const totalCost    = pos.lots.reduce((s, l) => s + l.shares * l.costPerShare, 0)
    const unitCost     = totalCost / totalShares
    const avgDate      = weightedAvgDate(pos.lots)
    const currentPrice = prices.get(pos.ticker) ?? 0
    const marketValue  = totalShares * currentPrice
    const gainLoss     = marketValue - totalCost
    const returnPct    = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0
    const years        = daysToYears(now.getTime() - avgDate.getTime())
    const cagrVal      = computeCAGR(totalCost, marketValue, years)
    const holdPeriodMs = now.getTime() - avgDate.getTime()

    unsorted.push({
      ticker:          pos.ticker,
      account:         toShort(pos.account),
      shares:          Math.round(totalShares * 10_000) / 10_000,
      avgCostDate:     avgDate.toISOString().slice(0, 10),
      holdingPeriod:   formatHoldingPeriod(avgDate, now),
      avgCostPerShare: round2(unitCost),
      currentPrice:    round2(currentPrice),
      marketValue:     Math.round(marketValue),
      costBasis:       Math.round(totalCost),
      gainLoss:        Math.round(gainLoss),
      returnPct:       round1(returnPct),
      cagrPct:         cagrVal != null ? round1(cagrVal * 100) : 0,
      shortHold:       holdPeriodMs < SHORT_HOLD_DAYS * MS_PER_DAY,
    })
  }

  unsorted.sort((a, b) => b.marketValue - a.marketValue)
  const totalMV = unsorted.reduce((s, h) => s + h.marketValue, 0)

  const holdings: Holding[] = unsorted.map((h, i) => ({
    ...h,
    rank:     i + 1,
    weightPct: totalMV > 0 ? round1((h.marketValue / totalMV) * 100) : 0,
  }))

  // ── Compute 3-month share changes per (account, ticker) ───────────────────
  const threeMonthsAgo = new Date(now.getTime() - 90 * MS_PER_DAY)
  const netChange3mo   = new Map<string, number>()   // key = `${account}::${ticker}`
  const hadActivity3mo = new Set<string>()

  for (const tx of transactions) {
    if (tx.txDate < threeMonthsAgo) continue
    if (tx.assetClass !== 'EQUITY' && tx.assetClass !== 'ETF') continue

    const key = `${tx.account}::${tx.ticker}`
    hadActivity3mo.add(key)
    const cur = netChange3mo.get(key) ?? 0

    if (['BUY', 'REINVEST', 'TRANSFER_IN'].includes(tx.txType)) {
      netChange3mo.set(key, cur + tx.quantity)
    } else if (tx.txType === 'SELL') {
      netChange3mo.set(key, cur - tx.quantity)
    }
  }

  // ── Build merged per-ticker HoldingDetail ────────────────────────────────
  // Group holdings by ticker
  const byTicker = new Map<string, Holding[]>()
  for (const h of holdings) {
    if (!byTicker.has(h.ticker)) byTicker.set(h.ticker, [])
    byTicker.get(h.ticker)!.push(h)
  }

  const holdingDetails: HoldingDetail[] = []

  for (const [ticker, rows] of byTicker) {
    const mergedShares  = rows.reduce((s, h) => s + h.shares,      0)
    const mergedMV      = rows.reduce((s, h) => s + h.marketValue, 0)
    const mergedCB      = rows.reduce((s, h) => s + h.costBasis,   0)
    const mergedReturn  = mergedCB > 0 ? ((mergedMV - mergedCB) / mergedCB) * 100 : 0

    // Weighted-avg cost per share across all lots for this ticker
    const avgCostPerShare = mergedShares > 0 ? mergedCB / mergedShares : 0

    // Weighted-avg holding date across all accounts' lots for this ticker
    const allLots = [...equityPos.values()]
      .filter(p => p.ticker === ticker)
      .flatMap(p => p.lots)
    const avgDate = weightedAvgDate(allLots)
    const years   = daysToYears(now.getTime() - avgDate.getTime())
    const cagrVal = computeCAGR(mergedCB, mergedMV, years)

    // Total holding period: first ever buy of this ticker
    const firstBuy = firstBuyMap.get(ticker) ?? avgDate

    // 3-month share changes aggregated across accounts
    let totalNetChange3mo: number | null = null
    let anyActivity = false

    for (const row of rows) {
      const key = `${row.account === 'IRA' ? 'Schwab IRA' : 'Robinhood'}::${ticker}`
      if (hadActivity3mo.has(key)) {
        anyActivity = true
        const change = netChange3mo.get(key) ?? 0
        totalNetChange3mo = (totalNetChange3mo ?? 0) + change
      }
    }

    let change3moPct: number | null = null
    const isNewPosition3mo =
      anyActivity && (firstBuy >= threeMonthsAgo)

    if (anyActivity && totalNetChange3mo !== null) {
      const sharesBefore = mergedShares - totalNetChange3mo
      if (sharesBefore > 0.001) {
        change3moPct = round1((totalNetChange3mo / sharesBefore) * 100)
      }
      // if sharesBefore <= 0, it's a new position — change3moPct stays null
    }

    const currentPrice = prices.get(ticker) ?? rows[0]?.currentPrice ?? 0

    holdingDetails.push({
      ticker,
      companyName:        companyNames.get(ticker) ?? ticker,
      accounts:           [...new Set(rows.map(h => h.account))],
      shares:             round2(mergedShares),
      marketValue:        Math.round(mergedMV),
      costBasis:          Math.round(mergedCB),
      currentPrice:       round2(currentPrice),
      avgCostPerShare:    round2(avgCostPerShare),
      weightPct:          totalMV > 0 ? round1((mergedMV / totalMV) * 100) : 0,
      returnPct:          round1(mergedReturn),
      cagrPct:            cagrVal != null ? round1(cagrVal * 100) : 0,
      holdingPeriod:      formatHoldingPeriod(avgDate, now),
      totalHoldingStart:  firstBuy.toISOString().slice(0, 10),
      totalHoldingPeriod: formatHoldingPeriod(firstBuy, now),
      change3moShares:    totalNetChange3mo !== null ? round2(totalNetChange3mo) : null,
      change3moPct,
      isNewPosition3mo,
    })
  }

  // Sort by market value desc
  holdingDetails.sort((a, b) => b.marketValue - a.marketValue)

  // ── Open options ──────────────────────────────────────────────────────────
  const openOptions: OpenOption[] = []
  for (const op of optionPos.values()) {
    openOptions.push({
      ticker:        op.ticker,
      description:   op.description,
      account:       toShort(op.account),
      contracts:     op.contracts,
      costBasis:     round2(op.totalCost),
      openDate:      op.openDate.toISOString().slice(0, 10),
      holdingPeriod: formatHoldingPeriod(op.openDate, now),
    })
  }

  // ── Return metrics ────────────────────────────────────────────────────────
  const schwabTx   = transactions.filter(t => t.account === 'Schwab IRA')
  const rhoodTx    = transactions.filter(t => t.account === 'Robinhood')
  const schwabMV   = holdings.filter(h => h.account === 'IRA').reduce((s, h) => s + h.marketValue, 0)
  const rhoodMV    = holdings.filter(h => h.account === 'RH').reduce((s, h) => s + h.marketValue, 0)
  const combinedMV = schwabMV + rhoodMV

  const subsets: [string, typeof transactions, number][] = [
    ['Combined',   transactions, combinedMV],
    ['Schwab IRA', schwabTx,     schwabMV],
    ['Robinhood',  rhoodTx,      rhoodMV],
  ]

  const returnMetrics: ReturnMetric[] = []
  for (const [label, txSet, endMV] of subsets) {
    const twr    = modifiedDietz(txSet, endMV, label)
    const irrVal = xirr(txSet, endMV)
    if (twr) {
      returnMetrics.push({ ...twr, irr: irrVal != null ? round1(irrVal * 100) : 0 })
    }
  }

  // ── Portfolio totals ──────────────────────────────────────────────────────
  const totalCostBasis = holdings.reduce((s, h) => s + h.costBasis, 0)
  const totalGainLoss  = holdings.reduce((s, h) => s + h.gainLoss,  0)

  // Top 5 weight %
  const top5Pct = holdingDetails
    .slice(0, 5)
    .reduce((s, h) => s + h.weightPct, 0)

  // MV-weighted average holding period (in days), then format
  const weightedHoldDays = holdingDetails.reduce((s, h) => {
    const avgDate = new Date(h.totalHoldingStart + 'T12:00:00Z')  // using first buy date for consistency
    const days    = (now.getTime() - avgDate.getTime()) / MS_PER_DAY
    return s + h.marketValue * days
  }, 0)
  const avgDays   = totalMV > 0 ? weightedHoldDays / totalMV : 0
  const avgFrom   = new Date(now.getTime() - avgDays * MS_PER_DAY)
  const avgHoldingPeriod = formatHoldingPeriod(avgFrom, now)

  return {
    holdings,
    holdingDetails,
    openOptions,
    returnMetrics,
    totals: {
      marketValue:      Math.round(totalMV),
      costBasis:        Math.round(totalCostBasis),
      gainLoss:         Math.round(totalGainLoss),
      positionCount:    holdings.length,
      top5Pct:          round1(top5Pct),
      avgHoldingPeriod,
      asOf:             now.toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      }),
      lifetimeMwr:      lifetimeReturns.lifetimeMwr,
      lifetimeTwrCagr:  lifetimeReturns.lifetimeTwrCagr,
    },
    lastUpdated:   now.toISOString(),
    pricesFetched: allFetched,
  }
}
