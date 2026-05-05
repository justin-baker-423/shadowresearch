import { computePortfolio } from '@/lib/portfolio/compute'
import PortfolioBreakdown   from '@/components/portfolio/PortfolioBreakdown'
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
                </tbody>
              </table>
            ) : (
              <div style={{ color: 'var(--text-3)', fontSize: 12 }}>
                Unable to load data
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
