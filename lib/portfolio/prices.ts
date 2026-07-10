import 'server-only'

// Yahoo Finance price + company name fetcher via yahoo-finance2.
// Uses the official npm package which handles cookie/crumb auth automatically.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchPrices(tickers: string[]): Promise<{
  prices:       Map<string, number>
  companyNames: Map<string, string>
  allFetched:   boolean
}> {
  const prices       = new Map<string, number>()
  const companyNames = new Map<string, string>()

  if (tickers.length === 0) {
    return { prices, companyNames, allFetched: true }
  }

  try {
    const quotes = await yf.quote(tickers) as Array<{
      symbol:              string
      regularMarketPrice?: number
      shortName?:          string
      longName?:           string
    }>

    for (const q of quotes) {
      if (q.regularMarketPrice && q.regularMarketPrice > 0) {
        prices.set(q.symbol, q.regularMarketPrice)
      }
      const name = q.shortName ?? q.longName
      if (name) companyNames.set(q.symbol, name)
    }
  } catch {
    // If batch fails, try per-ticker
    await Promise.allSettled(
      tickers.map(async ticker => {
        try {
          const q = await yf.quote(ticker) as {
            regularMarketPrice?: number
            shortName?:          string
            longName?:           string
          }
          if (q.regularMarketPrice && q.regularMarketPrice > 0) {
            prices.set(ticker, q.regularMarketPrice)
          }
          const name = q.shortName ?? q.longName
          if (name) companyNames.set(ticker, name)
        } catch { /* skip */ }
      }),
    )
  }

  const allFetched = tickers.every(t => prices.has(t))
  return { prices, companyNames, allFetched }
}

// ── Forward dividend rates via yahoo-finance2 ─────────────────────────────────
// Returns the live forward annual dividend per share (in the quote's native
// currency — e.g. USD for an ADR), keyed by ticker. The rate reflects the most
// recently *declared* dividend, so the resulting yield updates automatically
// when a company announces a new dividend. Tickers with no dividend are omitted.

export async function fetchDividendRates(tickers: string[]): Promise<Map<string, number>> {
  const rates = new Map<string, number>()
  if (tickers.length === 0) return rates

  const take = (q: { dividendRate?: number; trailingAnnualDividendRate?: number }) =>
    q.dividendRate ?? q.trailingAnnualDividendRate

  try {
    const quotes = await yf.quote(tickers) as Array<{
      symbol:                      string
      dividendRate?:               number
      trailingAnnualDividendRate?: number
    }>
    for (const q of quotes) {
      const rate = take(q)
      if (typeof rate === 'number' && rate > 0) rates.set(q.symbol, rate)
    }
  } catch {
    // If batch fails, try per-ticker
    await Promise.allSettled(
      tickers.map(async ticker => {
        try {
          const q = await yf.quote(ticker) as {
            dividendRate?:               number
            trailingAnnualDividendRate?: number
          }
          const rate = take(q)
          if (typeof rate === 'number' && rate > 0) rates.set(ticker, rate)
        } catch { /* skip */ }
      }),
    )
  }

  return rates
}

// ── Historical OHLC via yahoo-finance2 ────────────────────────────────────────
// Used by history.ts for the performance chart.

export async function fetchHistoricalPrices(
  ticker: string,
  from:   Date,
  to:     Date,
): Promise<Array<{ date: Date; close: number }>> {
  try {
    const rows = await yf.historical(ticker, {
      period1:  from.toISOString().slice(0, 10),
      period2:  to.toISOString().slice(0, 10),
      interval: '1d',
    }) as Array<{ date: Date; adjClose?: number; close: number }>

    return rows.map(r => ({ date: r.date, close: r.adjClose ?? r.close }))
  } catch {
    return []
  }
}

// ── Ticker → company logo URL ─────────────────────────────────────────────────
// Re-exported from logos.ts (client-safe) so server code can also use it.
export { getLogoUrl } from './logos'
