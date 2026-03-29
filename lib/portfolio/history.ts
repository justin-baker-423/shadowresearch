import 'server-only'
import { Transaction, PerformancePoint, PerformanceData } from './types'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

// ── Period → date range ───────────────────────────────────────────────────────

const MS_PER_DAY = 86_400_000

interface PeriodParams {
  from:     Date
  to:       Date
  interval: '1d' | '1wk'
}

function getPeriodParams(
  period:      string,
  customStart?: Date,
  customEnd?:   Date,
): PeriodParams {
  const now = new Date()
  const to  = customEnd ?? now

  if (period === 'Custom' && customStart) {
    const days = (to.getTime() - customStart.getTime()) / MS_PER_DAY
    return { from: customStart, to, interval: days > 365 ? '1wk' : '1d' }
  }

  if (period === 'YTD') {
    return { from: new Date(now.getFullYear(), 0, 1), to, interval: '1d' }
  }

  const configs: Record<string, { days: number; interval: '1d' | '1wk' }> = {
    D:   { days: 1,    interval: '1d'  },
    W:   { days: 7,    interval: '1d'  },
    M:   { days: 30,   interval: '1d'  },
    Q:   { days: 90,   interval: '1d'  },
    '1Y':{ days: 365,  interval: '1d'  },
    '5Y':{ days: 1825, interval: '1wk' },
  }
  const cfg = configs[period] ?? configs['1Y']
  return { from: new Date(to.getTime() - cfg.days * MS_PER_DAY), to, interval: cfg.interval }
}

// ── Historical price fetcher ──────────────────────────────────────────────────

interface OHLC {
  timestamps: number[]   // Unix milliseconds
  closes:     number[]
}

async function fetchOHLC(
  ticker:   string,
  from:     Date,
  to:       Date,
  interval: '1d' | '1wk',
): Promise<OHLC> {
  try {
    const rows = await yf.historical(ticker, {
      period1:  from.toISOString().slice(0, 10),
      period2:  to.toISOString().slice(0, 10),
      interval,
    }) as Array<{ date: Date; adjClose?: number; close: number }>

    return {
      timestamps: rows.map(r => r.date.getTime()),
      closes:     rows.map(r => r.adjClose ?? r.close),
    }
  } catch {
    return { timestamps: [], closes: [] }
  }
}

// ── Share timeline builder ────────────────────────────────────────────────────
// Pre-computes a sorted list of (ts_ms, cumulativeShares) per (account, ticker)
// so we can binary-search shares held at any date in O(log n).

interface ShareEvent { ts: number; shares: number }

const BUY_TYPES  = new Set(['BUY', 'REINVEST', 'TRANSFER_IN'])
const SELL_TYPES = new Set(['SELL'])

function buildShareTimelines(transactions: Transaction[]): Map<string, ShareEvent[]> {
  const running   = new Map<string, number>()
  const timelines = new Map<string, ShareEvent[]>()

  for (const tx of transactions) {
    if (tx.assetClass !== 'EQUITY' && tx.assetClass !== 'ETF') continue
    if (!tx.ticker) continue

    const key = `${tx.account}::${tx.ticker}`
    const cur = running.get(key) ?? 0
    let next  = cur

    if (BUY_TYPES.has(tx.txType))       next += tx.quantity
    else if (SELL_TYPES.has(tx.txType)) next -= tx.quantity
    else continue

    next = Math.max(0, next)
    running.set(key, next)

    if (!timelines.has(key)) timelines.set(key, [])
    timelines.get(key)!.push({ ts: tx.txDate.getTime(), shares: next })
  }

  return timelines
}

function sharesAtTs(timeline: ShareEvent[], ts: number): number {
  let lo = 0, hi = timeline.length - 1
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (timeline[mid].ts <= ts) lo = mid
    else                        hi = mid - 1
  }
  return timeline[lo]?.ts <= ts ? timeline[lo].shares : 0
}

// ── External cash flow map ───────────────────────────────────────────────────
// Maps ISO date string (YYYY-MM-DD) → net external capital flow into the
// equity portfolio on that day.
//
// Only flows that bring *new money* from outside the portfolio count:
//   BUY          → +cost  (tx.amount is negative, so -tx.amount is positive)
//   SELL         → -proceeds  (-tx.amount, since tx.amount is positive)
//   TRANSFER_IN  → +value  (amount=0 in source, use qty × price as cost basis)
//   REINVEST     → 0  (dividends reinvested stay inside the portfolio)
//
// This follows the GIPS / Modified-Dietz Daily Valuation approach: each
// daily sub-period return = MV_end / (MV_start + CF) − 1, then chain all
// sub-period returns to get a True Time-Weighted Return.

function buildCashFlowMap(transactions: Transaction[]): Map<string, number> {
  const cfMap = new Map<string, number>()

  for (const tx of transactions) {
    if (tx.assetClass !== 'EQUITY' && tx.assetClass !== 'ETF') continue
    if (!tx.ticker) continue

    let cf = 0

    if (tx.txType === 'BUY') {
      // amount is negative (cash outflow = new money in) → CF = +cost
      cf = -tx.amount
    } else if (tx.txType === 'SELL') {
      // amount is positive (cash inflow = money out of portfolio) → CF = -proceeds
      cf = -tx.amount
    } else if (tx.txType === 'TRANSFER_IN') {
      // amount = 0 in source; use qty × cost-per-share as the value transferred in
      cf = tx.quantity * tx.price
    }
    // REINVEST: intentionally 0 (internal flow)

    if (cf !== 0) {
      const key = tx.txDate.toISOString().slice(0, 10)
      cfMap.set(key, (cfMap.get(key) ?? 0) + cf)
    }
  }

  return cfMap
}

// Flatten cfMap into a sorted array of { ts (ms), amount } for efficient scanning.
function flattenCfMap(
  cfMap: Map<string, number>,
): Array<{ ts: number; amount: number }> {
  return [...cfMap.entries()]
    .map(([dateKey, amount]) => ({
      ts:     new Date(dateKey + 'T12:00:00Z').getTime(),   // noon UTC avoids tz edge cases
      amount,
    }))
    .sort((a, b) => a.ts - b.ts)
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function computePerformanceSeries(
  transactions:     Transaction[],
  currentHoldings:  Array<{ ticker: string; accountFull: string; shares: number }>,
  period:           string,
  customStart?:     Date,
  customEnd?:       Date,
): Promise<PerformanceData> {
  const { from, to, interval } = getPeriodParams(period, customStart, customEnd)

  // Collect all equity tickers ever held
  const relevantTickers = new Set<string>()
  for (const tx of transactions) {
    if ((tx.assetClass === 'EQUITY' || tx.assetClass === 'ETF') && tx.ticker) {
      relevantTickers.add(tx.ticker)
    }
  }

  // Fetch historical OHLC for all tickers + S&P 500 in parallel
  const fetchTargets = [...relevantTickers, '^GSPC']
  const rawData = new Map<string, OHLC>()
  await Promise.allSettled(
    fetchTargets.map(async ticker => {
      rawData.set(ticker, await fetchOHLC(ticker, from, to, interval))
    }),
  )

  // S&P 500 timestamps drive the x-axis
  const sp500 = rawData.get('^GSPC')
  if (!sp500 || sp500.timestamps.length === 0) {
    return { points: [], portfolioReturn: 0, sp500Return: 0, period }
  }

  // Build share timelines and cash flow map from all transactions
  const shareTimelines = buildShareTimelines(transactions)
  const sortedCFs      = flattenCfMap(buildCashFlowMap(transactions))

  // ── Compute portfolio market value at each OHLC date ──────────────────────

  const portfolioValues: number[] = sp500.timestamps.map(ts => {
    let mv = 0

    if (period === 'D') {
      for (const h of currentHoldings) {
        const ohlc = rawData.get(h.ticker)
        if (!ohlc || ohlc.timestamps.length === 0) continue
        const idx   = findLastIndex(ohlc.timestamps, t => t <= ts)
        const price = idx >= 0 ? ohlc.closes[idx] : 0
        if (price > 0) mv += h.shares * price
      }
    } else {
      for (const [key, timeline] of shareTimelines) {
        const shares = sharesAtTs(timeline, ts)
        if (shares <= 0) continue
        const ticker = key.split('::').slice(1).join('::')
        const ohlc   = rawData.get(ticker)
        if (!ohlc || ohlc.timestamps.length === 0) continue
        const idx   = findLastIndex(ohlc.timestamps, t => t <= ts)
        const price = idx >= 0 ? ohlc.closes[idx] : 0
        if (price > 0) mv += shares * price
      }
    }

    return mv
  })

  // Filter to dates where both portfolio and S&P 500 have valid (non-zero) data
  const validIndices = sp500.timestamps
    .map((_, i) => i)
    .filter(i => portfolioValues[i] > 0 && sp500.closes[i] > 0)

  if (validIndices.length < 2) {
    return { points: [], portfolioReturn: 0, sp500Return: 0, period }
  }

  // ── Modified Dietz Money-Weighted Return (MWR) ────────────────────────────
  // At each date t, relative to the period start t₀:
  //
  //   MWR(t) = (MV_t − MV₀ − ΣCF) / (MV₀ + Σ(CF × W))
  //
  // where for each external cash flow CF_i occurring at time t_i:
  //   W_i = (T − elapsed_i) / T
  //   T       = total ms from t₀ to t (current date)
  //   elapsed_i = ms from t₀ to t_i
  //
  // W_i = 1 if the CF arrives at the very start (full weight),
  // W_i = 0 if it arrives at the very end (no weight — no time to compound).
  //
  // This is the GIPS-compliant money-weighted return: larger/earlier capital
  // contributions carry more weight, so the result reflects your personal
  // experience as an investor, not an abstract per-dollar-per-day return.

  const startTs   = sp500.timestamps[validIndices[0]]
  const startMV   = portfolioValues[validIndices[0]]
  const sp500Base = sp500.closes[validIndices[0]]
  const points:   PerformancePoint[] = []

  // Only CFs that arrive strictly after the period start matter.
  // Earlier CFs are already baked into MV₀.
  const periodCFs = sortedCFs.filter(cf => cf.ts > startTs)

  for (let i = 0; i < validIndices.length; i++) {
    const idx    = validIndices[i]
    const ts     = sp500.timestamps[idx]
    const currMV = portfolioValues[idx]

    if (i === 0) {
      points.push({ ts, portfolio: 0, sp500: 0 })
      continue
    }

    const T = ts - startTs   // total period length in ms up to this point

    let netCF      = 0       // Σ CF_i   (unadjusted)
    let weightedCF = 0       // Σ CF_i × W_i

    for (const cf of periodCFs) {
      if (cf.ts > ts) break                           // only CFs up to current date
      const elapsed = cf.ts - startTs
      const W       = T > 0 ? (T - elapsed) / T : 0
      netCF      += cf.amount
      weightedCF += cf.amount * W
    }

    const denom = startMV + weightedCF
    const mwr   = denom > 0 ? (currMV - startMV - netCF) / denom : 0

    const sp500Return = sp500.closes[idx] / sp500Base - 1

    points.push({
      ts,
      portfolio: round1(mwr * 100),
      sp500:     round1(sp500Return * 100),
    })
  }

  const last = points[points.length - 1]

  return {
    points,
    portfolioReturn: last.portfolio,
    sp500Return:     last.sp500,
    period,
  }
}

// ── Lifetime returns ──────────────────────────────────────────────────────────
// Computes two portfolio-lifetime metrics in a single weekly OHLC fetch.
//
//   lifetimeMwr     — Modified Dietz money-weighted return, inception → today
//                     (same formula as the chart; NOT annualized)
//   lifetimeTwrCagr — True TWR (sub-period daily chain) annualized as a CAGR
//                     (removes cash-flow timing effects; IS annualized)

// currentPrices is optional — if supplied, it replaces the last OHLC close for
// the final data point (more accurate).  When omitted the last weekly close is
// used, which is close enough for a multi-year lifetime metric.
export async function computeLifetimeReturns(
  transactions:  Transaction[],
  currentPrices?: Map<string, number>,
): Promise<{ lifetimeMwr: number; lifetimeTwrCagr: number }> {
  const fallback = { lifetimeMwr: 0, lifetimeTwrCagr: 0 }

  const equityTx = transactions.filter(
    tx => (tx.assetClass === 'EQUITY' || tx.assetClass === 'ETF') && tx.ticker,
  )
  if (equityTx.length === 0) return fallback

  const from  = new Date(Math.min(...equityTx.map(tx => tx.txDate.getTime())))
  const now   = new Date()
  const nowTs = now.getTime()

  // Fetch weekly OHLC for every ticker ever held — parallel
  const tickers = [...new Set(equityTx.map(tx => tx.ticker))]
  const rawData = new Map<string, OHLC>()
  await Promise.allSettled(
    tickers.map(async ticker => {
      rawData.set(ticker, await fetchOHLC(ticker, from, now, '1wk'))
    }),
  )

  // Pre-build share timelines and CF list
  const shareTimelines = buildShareTimelines(transactions)
  const sortedCFs      = flattenCfMap(buildCashFlowMap(transactions))

  // Union of all tickers' weekly timestamps → unified x-axis
  const tsSet = new Set<number>()
  for (const ohlc of rawData.values()) {
    for (const ts of ohlc.timestamps) tsSet.add(ts)
  }
  const histTs = [...tsSet].sort((a, b) => a - b)
  if (histTs.length < 2) return fallback

  // Portfolio MV at each historical weekly timestamp (transaction replay)
  const histMV = histTs.map(ts => {
    let mv = 0
    for (const [key, timeline] of shareTimelines) {
      const shares = sharesAtTs(timeline, ts)
      if (shares <= 0) continue
      const ticker = key.split('::').slice(1).join('::')
      const ohlc   = rawData.get(ticker)
      if (!ohlc || ohlc.timestamps.length === 0) continue
      const idx   = findLastIndex(ohlc.timestamps, t => t <= ts)
      const price = idx >= 0 ? ohlc.closes[idx] : 0
      if (price > 0) mv += shares * price
    }
    return mv
  })

  // Append today's portfolio value.  If live prices were supplied use them;
  // otherwise fall back to each ticker's most-recent OHLC close (negligible
  // difference for a multi-year lifetime metric).
  const currentMV = [...shareTimelines.entries()].reduce((sum, [key, tl]) => {
    const shares = sharesAtTs(tl, nowTs)
    if (shares <= 0) return sum
    const ticker = key.split('::').slice(1).join('::')
    let price = currentPrices?.get(ticker) ?? 0
    if (price === 0) {
      const ohlc = rawData.get(ticker)
      if (ohlc && ohlc.closes.length > 0) price = ohlc.closes[ohlc.closes.length - 1]
    }
    return sum + shares * price
  }, 0)

  // Merge and filter to dates where portfolio has non-zero value
  const ts_all  = [...histTs, nowTs]
  const mv_all  = [...histMV, currentMV]
  const validIdx = ts_all.map((_, i) => i).filter(i => mv_all[i] > 0)
  if (validIdx.length < 2) return fallback

  const ts_v  = validIdx.map(i => ts_all[i])
  const mv_v  = validIdx.map(i => mv_all[i])

  const startTs = ts_v[0]
  const startMV = mv_v[0]
  const endMV   = mv_v[mv_v.length - 1]
  const T       = nowTs - startTs

  // Only CFs that arrive strictly after the period start (earlier ones are
  // already baked into startMV via the share-timeline / price computation)
  const periodCFs = sortedCFs.filter(cf => cf.ts > startTs)

  // ── Modified Dietz MWR (full lifetime, not annualized) ──────────────────
  let netCF = 0, weightedCF = 0
  for (const cf of periodCFs) {
    const W = T > 0 ? (T - (cf.ts - startTs)) / T : 0
    netCF      += cf.amount
    weightedCF += cf.amount * W
  }
  const mwrDenom    = startMV + weightedCF
  const lifetimeMwr = mwrDenom > 0
    ? round1((endMV - startMV - netCF) / mwrDenom * 100)
    : 0

  // ── TWR (sub-period chain) → annualized as CAGR ─────────────────────────
  let cumulativeFactor = 1.0
  for (let i = 1; i < ts_v.length; i++) {
    const prevTs = ts_v[i - 1]
    const ts     = ts_v[i]
    const prevMV = mv_v[i - 1]
    const currMV = mv_v[i]

    // Sum CFs that landed strictly in (prevTs, ts]
    let subCF = 0
    for (const cf of periodCFs) {
      if (cf.ts > ts)     break
      if (cf.ts > prevTs) subCF += cf.amount
    }

    const denom = prevMV + subCF
    cumulativeFactor *= denom > 0 ? currMV / denom : 1
  }

  const totalYears    = T / (365.25 * MS_PER_DAY)
  const lifetimeTwrCagr = totalYears > 0.5
    ? round1((Math.pow(cumulativeFactor, 1 / totalYears) - 1) * 100)
    : 0

  return { lifetimeMwr, lifetimeTwrCagr }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function round1(n: number) { return Math.round(n * 10) / 10 }

function findLastIndex<T>(arr: T[], pred: (v: T) => boolean): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i
  }
  return -1
}
