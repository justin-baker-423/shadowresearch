'use client'
import { useState } from 'react'
import { HoldingDetail } from '@/lib/portfolio/types'
import { getLogoUrl }    from '@/lib/portfolio/logos'

// ── Logo component with fallback ──────────────────────────────────────────────

const FALLBACK_COLORS = [
  '#4f8ef7','#3ecf8e','#a78bfa','#f5a623','#f25c5c',
  '#22d3ee','#fb923c','#84cc16','#e879f9','#38bdf8',
]

function TickerLogo({ ticker, idx }: { ticker: string; idx: number }) {
  const url = getLogoUrl(ticker)
  const [failed, setFailed] = useState(false)
  const bg = FALLBACK_COLORS[idx % FALLBACK_COLORS.length]

  if (!url || failed) {
    return (
      <span className="port-ticker-logo-fallback" style={{ background: bg }}>
        {ticker.slice(0, 2)}
      </span>
    )
  }
  return (
    <img
      src={url}
      alt={ticker}
      className="port-ticker-logo"
      onError={() => setFailed(true)}
    />
  )
}

// ── Sort state ────────────────────────────────────────────────────────────────

type SortKey =
  | 'ticker' | 'weightPct' | 'avgCostPerShare'
  | 'change3moPct' | 'totalHoldingPeriod'
  | 'returnPct' | 'cagrPct'

interface ColDef {
  key:   SortKey
  label: string
  tip?:  string
}

const COLUMNS: ColDef[] = [
  { key: 'ticker',            label: 'Ticker'                                          },
  { key: 'weightPct',         label: '% Portfolio'                                     },
  { key: 'avgCostPerShare',   label: 'Cost Basis / Share'                              },
  { key: 'change3moPct',      label: 'Chg. Shares (3mo)',   tip: '% change in share count over the past 90 days' },
  { key: 'totalHoldingPeriod',label: 'Hold Period',          tip: 'From first purchase to today'                  },
  { key: 'returnPct',         label: 'Return'                                          },
  { key: 'cagrPct',           label: 'CAGR'                                            },
]

// Map holding period strings to days for sorting ("2 yr 3 mo" → ~820)
function periodToDays(s: string): number {
  let days = 0
  const yrMatch  = s.match(/(\d+)\s*yr/)
  const moMatch  = s.match(/(\d+)\s*mo/)
  const dayMatch = s.match(/(\d+)\s*days?/)
  if (yrMatch)  days += parseInt(yrMatch[1])  * 365
  if (moMatch)  days += parseInt(moMatch[1])  * 30
  if (dayMatch) days += parseInt(dayMatch[1])
  return days
}

function sortValue(h: HoldingDetail, key: SortKey): number | string {
  switch (key) {
    case 'ticker':             return h.ticker
    case 'weightPct':          return h.weightPct
    case 'avgCostPerShare':    return h.avgCostPerShare
    case 'change3moPct':       return h.change3moPct ?? -Infinity
    case 'totalHoldingPeriod': return periodToDays(h.totalHoldingPeriod)
    case 'returnPct':          return h.returnPct
    case 'cagrPct':            return h.cagrPct
  }
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtPct(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(1)}%`
}

function Change3mo({ h }: { h: HoldingDetail }) {
  if (h.isNewPosition3mo) {
    return <span className="port-chg-new">NEW</span>
  }
  if (h.change3moPct === null) return <span style={{ color: 'var(--text-3)' }}>—</span>
  const cls = h.change3moPct >= 0 ? 'port-chg-pos' : 'port-chg-neg'
  return <span className={cls}>{fmtPct(h.change3moPct)}</span>
}

function RetCell({ v }: { v: number }) {
  const cls = v >= 0 ? 'port-ret-pos' : 'port-ret-neg'
  return <span className={cls}>{fmtPct(v)}</span>
}

// ── Table ─────────────────────────────────────────────────────────────────────

interface Props {
  details: HoldingDetail[]
}

export default function HoldingsTable({ details }: Props) {
  const [sortKey, setSortKey]   = useState<SortKey>('weightPct')
  const [sortAsc, setSortAsc]   = useState(false)

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
  }

  const sorted = [...details].sort((a, b) => {
    const va = sortValue(a, sortKey)
    const vb = sortValue(b, sortKey)
    let cmp: number
    if (typeof va === 'string' && typeof vb === 'string') {
      cmp = va.localeCompare(vb)
    } else {
      cmp = (va as number) - (vb as number)
    }
    return sortAsc ? cmp : -cmp
  })

  return (
    <div className="port-table-card">
      <table className="port-table">
        <thead>
          <tr>
            {COLUMNS.map(col => (
              <th
                key={col.key}
                className={sortKey === col.key ? 'sorted' : ''}
                onClick={() => handleSort(col.key)}
                title={col.tip}
              >
                {col.label}
                <span className="sort-arrow">
                  {sortKey === col.key ? (sortAsc ? '↑' : '↓') : '↕'}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((h, idx) => (
            <tr key={h.ticker}>
              {/* Ticker + Logo */}
              <td>
                <div className="port-ticker-cell">
                  <TickerLogo ticker={h.ticker} idx={idx} />
                  <div className="port-ticker-info">
                    <span className="port-ticker-symbol">{h.ticker}</span>
                    <span className="port-ticker-name">{h.companyName}</span>
                  </div>
                </div>
              </td>

              {/* % Portfolio */}
              <td>{h.weightPct.toFixed(1)}%</td>

              {/* Cost Basis / Share */}
              <td>${h.avgCostPerShare.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>

              {/* 3mo Share Change */}
              <td><Change3mo h={h} /></td>

              {/* Holding Period */}
              <td>{h.totalHoldingPeriod}</td>

              {/* Return */}
              <td><RetCell v={h.returnPct} /></td>

              {/* CAGR */}
              <td><RetCell v={h.cagrPct} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
