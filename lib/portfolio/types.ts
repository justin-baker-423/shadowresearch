// Portfolio data types
// All server-computed; consumed by /api/portfolio and performance page

export type AccountFull  = 'Schwab IRA' | 'Robinhood'
export type AccountShort = 'IRA' | 'RH'

export type TxType =
  | 'BUY' | 'SELL' | 'DEPOSIT' | 'WITHDRAWAL'
  | 'DIVIDEND' | 'REINVEST' | 'INTEREST' | 'FEE'
  | 'TRANSFER_IN' | 'SPLIT'
  | 'OPTION_BUY' | 'OPTION_SELL' | 'OPTION_EXPIRE' | 'OPTION_EXERCISE'

export type AssetClass = 'EQUITY' | 'ETF' | 'OPTION' | 'CASH' | ''

export interface Transaction {
  txDate:      Date
  settleDate:  Date | null
  account:     AccountFull
  ticker:      string
  description: string
  txType:      TxType
  assetClass:  AssetClass
  quantity:    number
  price:       number
  amount:      number   // negative = cash outflow from account (buys, deposits into investment)
  fees:        number
  source:      string
  notes:       string
}

export interface Lot {
  date:         Date
  shares:       number
  costPerShare: number
}

// ── Per-account holding (for internal use / backward compat) ─────────────────

export interface Holding {
  rank:            number
  ticker:          string
  account:         AccountShort
  shares:          number
  avgCostDate:     string        // ISO date of weighted-avg acquisition
  holdingPeriod:   string        // human-readable, e.g. "1 yr 7 mo"
  avgCostPerShare: number
  currentPrice:    number
  marketValue:     number
  costBasis:       number
  gainLoss:        number
  returnPct:       number        // %
  cagrPct:         number        // %
  weightPct:       number        // % of total portfolio MV
  shortHold:       boolean       // < 6 months — CAGR unreliable
}

// ── Per-ticker merged holding (for table + pie chart) ────────────────────────

export interface HoldingDetail {
  ticker:              string
  companyName:         string
  accounts:            AccountShort[]
  shares:              number           // total across accounts
  marketValue:         number
  costBasis:           number
  currentPrice:        number
  avgCostPerShare:     number           // weighted average across accounts
  weightPct:           number           // % of total portfolio MV
  returnPct:           number           // %
  cagrPct:             number           // %
  holdingPeriod:       string           // share-weighted avg (weighted avg date → today)
  totalHoldingStart:   string           // ISO date of first ever buy
  totalHoldingPeriod:  string           // formatted, from first buy to today
  change3moShares:     number | null    // net shares added/removed in 90 days (null = no activity)
  change3moPct:        number | null    // % change in shares (null = no activity or new position)
  isNewPosition3mo:    boolean          // true if position opened within past 90 days
}

// ── Open option position ──────────────────────────────────────────────────────

export interface OpenOption {
  ticker:        string
  description:   string
  account:       AccountShort
  contracts:     number
  costBasis:     number
  openDate:      string          // ISO date
  holdingPeriod: string
}

// ── Return metrics ────────────────────────────────────────────────────────────

export interface ReturnMetric {
  label:          string         // "Combined" | "Schwab IRA" | "Robinhood"
  period:         string         // e.g. "Dec 2020 – Mar 2026"
  years:          number
  totalDeposits:  number
  endingMV:       number
  cumulativeTWR:  number         // %
  annualisedTWR:  number         // %
  irr:            number         // % (XIRR money-weighted)
}

// ── Portfolio totals ──────────────────────────────────────────────────────────

export interface PortfolioTotals {
  marketValue:       number
  costBasis:         number
  gainLoss:          number
  positionCount:     number
  top5Pct:           number      // sum of top 5 position weights
  avgHoldingPeriod:  string      // MV-weighted avg of share-weighted holding periods
  asOf:              string      // human-readable date
  lifetimeMwr:       number      // Modified Dietz MWR, inception → today (%)
  lifetimeTwrCagr:   number      // TWR annualized as CAGR, inception → today (%)
}

// ── Root response ─────────────────────────────────────────────────────────────

export interface PortfolioData {
  holdings:       Holding[]          // per-account rows (for internal reference)
  holdingDetails: HoldingDetail[]    // per-ticker merged rows (for UI)
  openOptions:    OpenOption[]
  returnMetrics:  ReturnMetric[]
  totals:         PortfolioTotals
  lastUpdated:    string             // ISO timestamp of last computation
  pricesFetched:  boolean
}

// ── Performance chart ─────────────────────────────────────────────────────────

export interface PerformancePoint {
  ts:        number    // Unix ms timestamp
  portfolio: number    // % return from start (0 = 0%, 24.6 = +24.6%)
  sp500:     number    // S&P500 % return from start
}

export interface PerformanceData {
  points:          PerformancePoint[]
  portfolioReturn: number    // total % return over the period
  sp500Return:     number
  period:          string
}
