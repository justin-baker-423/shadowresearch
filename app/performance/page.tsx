import { computePortfolio }                       from '@/lib/portfolio/compute'
import { computeForwardReturn, ForwardReturnResult } from '@/lib/portfolio/forward-return'
import PortfolioBreakdown       from '@/components/portfolio/PortfolioBreakdown'
import PerformanceChart     from '@/components/portfolio/PerformanceChart'
import HoldingsTable        from '@/components/portfolio/HoldingsTable'
import FcfNiChart           from '@/components/portfolio/FcfNiChart'

// Revalidate every 15 minutes so live prices stay fresh
export const revalidate = 900

// ── Stat row used in Basic Stats ──────────────────────────────────────────────

function StatRow({ label, value, positive }: { label: string; value: string; positive?: boolean }) {
  return (
    <tr>
      <td>{label}</td>
      <td style={positive !== undefined ? { color: positive ? 'var(--green)' : 'var(--red)', fontWeight: 600 } : undefined}>
        {value}
      </td>
    </tr>
  )
}

function fmtPct(n: number | undefined | null) {
  if (n == null) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PerformancePage() {
  const data = await computePortfolio().catch(() => null)
  const fwdReturn: ForwardReturnResult | null = data ? computeForwardReturn(data.holdingDetails) : null

  return (
    <div className="port-page">
      <h1 className="port-page-title">Shadow Research Portfolio</h1>

      {/* ── Top grid: left (stats + chart) | right (breakdown) ── */}
      <div className="port-top">

        {/* ── Left column ── */}
        <div className="port-left">

          {/* Basic Stats */}
          <div className="port-card">
            <div className="port-card-title">Basic Stats</div>
            {data ? (
              <table className="port-stats-table">
                <tbody>
                  <StatRow
                    label="Top 5 (%)"
                    value={`${data.totals.top5Pct.toFixed(1)}%`}
                  />
                  <StatRow
                    label="Average Holding Period"
                    value={data.totals.avgHoldingPeriod}
                  />
                  <StatRow
                    label="Lifetime MWR CAGR"
                    value={fmtPct(data.returnMetrics.find(m => m.label === 'Combined')?.irr ?? null)}
                    positive={(data.returnMetrics.find(m => m.label === 'Combined')?.irr ?? 0) >= 0}
                  />
                  <StatRow
                    label="Lifetime TWR CAGR"
                    value={fmtPct(data.totals.lifetimeTwrCagr)}
                    positive={data.totals.lifetimeTwrCagr >= 0}
                  />
                  <StatRow
                    label="Est. Forward Return (10yr)"
                    value={fwdReturn != null ? fmtPct(fwdReturn.total * 100) : '—'}
                    positive={fwdReturn != null ? fwdReturn.total >= 0 : undefined}
                  />
                </tbody>
              </table>
            ) : (
              <div style={{ color: 'var(--text-3)', fontSize: 12 }}>
                Unable to load data
              </div>
            )}

            {/* Forward return breakdown */}
            {fwdReturn && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Forward Return Breakdown
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr style={{ color: 'var(--text-3)' }}>
                      <th style={{ textAlign: 'left',  paddingBottom: 4, fontWeight: 500 }}>Ticker</th>
                      <th style={{ textAlign: 'right', paddingBottom: 4, fontWeight: 500 }}>Weight</th>
                      <th style={{ textAlign: 'right', paddingBottom: 4, fontWeight: 500 }}>CAGR</th>
                      <th style={{ textAlign: 'right', paddingBottom: 4, fontWeight: 500 }}>Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fwdReturn.contributions.map(c => (
                      <tr key={c.ticker} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ paddingTop: 4, paddingBottom: 4, color: 'var(--text-1)', fontWeight: 600 }}>
                          {c.ticker}
                          {c.isManual && (
                            <span style={{ fontSize: 9, color: 'var(--text-3)', fontWeight: 400, marginLeft: 4 }}>est.</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--text-2)', fontVariantNumeric: 'tabular-nums' }}>
                          {c.weightPct.toFixed(1)}%
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: c.cagr >= 0 ? 'var(--green)' : 'var(--red)' }}>
                          {fmtPct(c.cagr * 100)}
                        </td>
                        <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: c.contribution >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                          {fmtPct(c.contribution * 100)}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ borderTop: '1px solid var(--text-3)' }}>
                      <td style={{ paddingTop: 5, fontWeight: 600, color: 'var(--text-2)', fontSize: 11 }}>Total</td>
                      <td style={{ paddingTop: 5, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>
                        {fwdReturn.contributions.reduce((s, c) => s + c.weightPct, 0).toFixed(1)}%
                      </td>
                      <td />
                      <td style={{ paddingTop: 5, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: fwdReturn.total >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {fmtPct(fwdReturn.total * 100)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Performance vs S&P 500 */}
          <div className="port-card" style={{ flex: 1 }}>
            <div className="port-card-title">Portfolio vs S&amp;P 500</div>
            <PerformanceChart />
          </div>
        </div>

        {/* ── Right column: Portfolio Breakdown ── */}
        <div className="port-right">
          <div className="port-card" style={{ height: '100%' }}>
            <div className="port-card-title">Portfolio Breakdown</div>
            {data ? (
              <PortfolioBreakdown details={data.holdingDetails} />
            ) : (
              <div style={{ color: 'var(--text-3)', fontSize: 12 }}>
                Unable to load data
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Holdings Table ── */}
      {data ? (
        <HoldingsTable details={data.holdingDetails} />
      ) : (
        <div className="port-card" style={{ color: 'var(--text-3)', fontSize: 12 }}>
          Holdings data unavailable
        </div>
      )}

      {/* FCF & Net Income Evolution */}
      <div className="port-card" style={{ marginTop: 24 }}>
        <div className="port-card-title">Portfolio FCF &amp; Net Income Evolution (2020–2025)</div>
        <FcfNiChart />
      </div>

      {/* Footnote */}
      {data && (
        <p className="disclaimer" style={{ marginTop: 16 }}>
          Prices as of {data.totals.asOf} · Refreshes every 15 minutes ·
          Performance vs S&P 500 uses Modified Dietz MWR methodology ·
          CAGR flagged ⚠ for positions held &lt;6 months
          {!data.pricesFetched && ' · ⚠ Some prices unavailable'}
        </p>
      )}
    </div>
  )
}
