// FIFO lot tracking — mirrors the Python build_holdings.py logic exactly
import { Transaction, Lot } from './types'

const BUY_TYPES    = new Set(['BUY', 'REINVEST', 'TRANSFER_IN'])
const SELL_TYPES   = new Set(['SELL'])
const EQUITY_CLASSES = new Set(['EQUITY', 'ETF'])

// ── Equity positions ──────────────────────────────────────────────────────────

export interface EquityPosition {
  account:      string
  ticker:       string
  lots:         Lot[]
  firstBuyDate: Date | null   // earliest BUY/REINVEST/TRANSFER_IN for this (account, ticker)
}

export function buildEquityPositions(
  transactions: Transaction[],
): Map<string, EquityPosition> {
  // key: "${account}::${ticker}"
  const positions = new Map<string, EquityPosition>()

  for (const tx of transactions) {
    if (!EQUITY_CLASSES.has(tx.assetClass)) continue
    if (!tx.ticker) continue

    const key = `${tx.account}::${tx.ticker}`
    if (!positions.has(key)) {
      positions.set(key, { account: tx.account, ticker: tx.ticker, lots: [], firstBuyDate: null })
    }
    const pos = positions.get(key)!

    if (BUY_TYPES.has(tx.txType) && tx.quantity > 0) {
      // Unit cost = abs(amount) / qty.
      // TRANSFER_IN records that still have amount=0 fall back to the price field
      // (Schwab records transfer price in the price column even when amount=$0).
      let unitCost: number
      if (tx.amount !== 0) {
        unitCost = Math.abs(tx.amount) / tx.quantity
      } else {
        unitCost = tx.price
      }
      pos.lots.push({ date: tx.txDate, shares: tx.quantity, costPerShare: unitCost })

      // Track earliest acquisition date
      if (pos.firstBuyDate === null || tx.txDate < pos.firstBuyDate) {
        pos.firstBuyDate = tx.txDate
      }

    } else if (SELL_TYPES.has(tx.txType) && tx.quantity > 0) {
      // FIFO: consume oldest lots first
      let remaining = tx.quantity
      while (remaining > 1e-6 && pos.lots.length > 0) {
        const lot = pos.lots[0]
        if (lot.shares <= remaining + 1e-6) {
          remaining -= lot.shares
          pos.lots.shift()
        } else {
          lot.shares -= remaining
          remaining = 0
        }
      }
    }
  }

  return positions
}

// ── Option positions ──────────────────────────────────────────────────────────

interface OptionLot {
  date:     Date
  qty:      number
  unitCost: number
  ticker:   string
}

export interface OptionPosition {
  account:     string
  ticker:      string
  description: string
  contracts:   number
  totalCost:   number
  openDate:    Date
}

export function buildOptionPositions(
  transactions: Transaction[],
): Map<string, OptionPosition> {
  // key: "${account}::${description}"
  const lotQueues = new Map<string, OptionLot[]>()

  for (const tx of transactions) {
    if (tx.assetClass !== 'OPTION') continue

    const desc = tx.description.trim()
    const key  = `${tx.account}::${desc}`

    if (tx.txType === 'OPTION_BUY' && tx.quantity > 0) {
      // amount field already holds total dollars paid (do NOT multiply by 100)
      const unitCost = tx.quantity > 0 ? Math.abs(tx.amount) / tx.quantity : 0
      if (!lotQueues.has(key)) lotQueues.set(key, [])
      lotQueues.get(key)!.push({ date: tx.txDate, qty: tx.quantity, unitCost, ticker: tx.ticker })

    } else if (
      tx.txType === 'OPTION_SELL'    ||
      tx.txType === 'OPTION_EXPIRE'  ||
      tx.txType === 'OPTION_EXERCISE'
    ) {
      // Strip "Option Expiration for " prefix so expiry records match the original BTO key
      const baseDesc = desc.replace(/^Option Expiration for /i, '').trim()
      const baseKey  = `${tx.account}::${baseDesc}`

      const actualKey = lotQueues.has(key)
        ? key
        : lotQueues.has(baseKey)
          ? baseKey
          : key

      const lots = lotQueues.get(actualKey)
      if (!lots) continue

      let consume = tx.quantity > 0
        ? tx.quantity
        : lots.reduce((s, l) => s + l.qty, 0)

      while (consume > 1e-6 && lots.length > 0) {
        const lot = lots[0]
        if (lot.qty <= consume + 1e-6) {
          consume -= lot.qty
          lots.shift()
        } else {
          lot.qty -= consume
          consume = 0
        }
      }
    }
  }

  // Collect open positions (lots with remaining qty > 0)
  const positions = new Map<string, OptionPosition>()
  for (const [key, lots] of lotQueues) {
    const totalQty = lots.reduce((s, l) => s + l.qty, 0)
    if (totalQty < 0.001) continue

    const totalCost   = lots.reduce((s, l) => s + l.qty * l.unitCost, 0)
    const firstLot    = lots[0]
    const [account, ...descParts] = key.split('::')
    const description = descParts.join('::')

    positions.set(key, {
      account,
      ticker:      firstLot.ticker,
      description,
      contracts:   Math.round(totalQty),
      totalCost,
      openDate:    firstLot.date,
    })
  }

  return positions
}

// ── Earliest buy date per ticker (across all accounts) ───────────────────────
// Used for "Total Holding Period" in the UI.

export function firstBuyDates(
  positions: Map<string, EquityPosition>,
): Map<string, Date> {
  const result = new Map<string, Date>()
  for (const pos of positions.values()) {
    if (pos.firstBuyDate === null) continue
    const existing = result.get(pos.ticker)
    if (!existing || pos.firstBuyDate < existing) {
      result.set(pos.ticker, pos.firstBuyDate)
    }
  }
  return result
}
