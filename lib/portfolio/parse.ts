import 'server-only'
import fs   from 'fs'
import path from 'path'
import { Transaction, AccountFull, TxType, AssetClass } from './types'

const CSV_PATH = path.join(process.cwd(), 'data', 'portfolio_fact_table.csv')

// ── CSV parser (handles quoted fields and embedded commas) ────────────────────

function parseCsvLine(line: string): string[] {
  const fields: string[] = []
  let current  = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (c === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += c
    }
  }
  fields.push(current)
  return fields
}

function parseCSV(content: string): Record<string, string>[] {
  // Walk character-by-character so multi-line quoted fields (e.g. Robinhood
  // descriptions that embed a newline before the CUSIP line) are kept together
  // as a single logical row rather than being split into two broken lines.
  const logicalLines: string[] = []
  let current  = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const c = content[i]
    if (c === '\r') continue            // strip CR from CRLF files
    if (c === '"') {
      if (inQuotes && content[i + 1] === '"') { current += '"'; i++ }  // escaped ""
      else inQuotes = !inQuotes
      current += c
    } else if (c === '\n' && !inQuotes) {
      if (current.trim()) logicalLines.push(current)
      current = ''
    } else {
      current += c
    }
  }
  if (current.trim()) logicalLines.push(current)

  if (logicalLines.length < 2) return []
  const headers = parseCsvLine(logicalLines[0]).map(h => h.trim())
  const rows: Record<string, string>[] = []

  for (let i = 1; i < logicalLines.length; i++) {
    const values = parseCsvLine(logicalLines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = (values[idx] ?? '').trim()
    })
    rows.push(row)
  }
  return rows
}

// ── field parsers ─────────────────────────────────────────────────────────────

function parseDate(s: string): Date | null {
  if (!s || !s.trim()) return null
  // Append noon UTC to avoid timezone-induced off-by-one day shifts
  const d = new Date(s.trim() + 'T12:00:00Z')
  return isNaN(d.getTime()) ? null : d
}

function parseNum(s: string): number {
  if (!s || !s.trim()) return 0
  return parseFloat(s.trim()) || 0
}

// ── main export ───────────────────────────────────────────────────────────────

export function loadTransactions(): Transaction[] {
  const content = fs.readFileSync(CSV_PATH, 'utf-8')
  const rows    = parseCSV(content)

  const transactions: Transaction[] = []

  for (const row of rows) {
    const txDate = parseDate(row['tx_date'])
    if (!txDate) continue

    // Normalize FB → META (Facebook renamed; Schwab CSV uses META throughout)
    let ticker = (row['ticker'] ?? '').trim()
    if (ticker === 'FB') ticker = 'META'

    transactions.push({
      txDate,
      settleDate:  parseDate(row['settle_date']),
      account:     (row['account']    ?? '') as AccountFull,
      ticker,
      description: (row['description'] ?? '').trim(),
      txType:      (row['tx_type']     ?? '') as TxType,
      assetClass:  (row['asset_class'] ?? '') as AssetClass,
      quantity:    parseNum(row['quantity']),
      price:       parseNum(row['price']),
      amount:      parseNum(row['amount']),
      fees:        parseNum(row['fees']),
      source:      (row['source'] ?? '').trim(),
      notes:       (row['notes']  ?? '').trim(),
    })
  }

  // Chronological order is required for FIFO lot tracking
  transactions.sort((a, b) => a.txDate.getTime() - b.txDate.getTime())
  return transactions
}

// ── transaction append (for future transaction-entry UI) ──────────────────────
// Reads the current CSV, appends one row, re-sorts, and writes back.

export interface NewTransaction {
  txDate:      string   // YYYY-MM-DD
  settleDate?: string
  account:     AccountFull
  ticker:      string
  description: string
  txType:      TxType
  assetClass:  AssetClass
  quantity:    number
  price:       number
  amount:      number
  fees?:       number
  notes?:      string
}

export function appendTransaction(tx: NewTransaction): void {
  const content  = fs.readFileSync(CSV_PATH, 'utf-8')
  const lines    = content.split('\n').filter(l => l.trim())
  const header   = lines[0]

  // Build a CSV row in column order matching the header
  const cols = parseCsvLine(header).map(h => h.trim())
  const vals: Record<string, string> = {
    tx_date:      tx.txDate,
    settle_date:  tx.settleDate ?? '',
    account:      tx.account,
    ticker:       tx.ticker.toUpperCase(),
    description:  tx.description,
    tx_type:      tx.txType,
    asset_class:  tx.assetClass,
    quantity:     String(tx.quantity),
    price:        String(tx.price),
    amount:       String(tx.amount),
    fees:         String(tx.fees ?? 0),
    source:       'UI',
    notes:        tx.notes ?? '',
  }

  const newRow = cols.map(c => {
    const v = vals[c] ?? ''
    return v.includes(',') ? `"${v}"` : v
  }).join(',')

  // Re-sort all rows (including the new one) by date
  const dataRows = [...lines.slice(1), newRow]
  dataRows.sort((a, b) => {
    const da = parseCsvLine(a)[0] ?? ''
    const db = parseCsvLine(b)[0] ?? ''
    return da.localeCompare(db)
  })

  fs.writeFileSync(CSV_PATH, [header, ...dataRows].join('\n') + '\n', 'utf-8')
}
