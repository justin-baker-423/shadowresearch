'use client'
// requires: npm install chart.js react-chartjs-2
import { useState, useEffect, useCallback } from 'react'
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  TimeScale,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import 'chartjs-adapter-date-fns'
import { Line } from 'react-chartjs-2'
import { PerformanceData } from '@/lib/portfolio/types'

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Filler, Tooltip, Legend)

// ── Period configuration ──────────────────────────────────────────────────────

const PERIODS = ['D', 'W', 'M', 'Q', 'YTD', '1Y', '5Y', 'Custom'] as const
type Period = typeof PERIODS[number]

// ── Helper ────────────────────────────────────────────────────────────────────

function fmtReturn(v: number) {
  const sign = v >= 0 ? '+' : ''
  return `${sign}${v.toFixed(1)}%`
}

function retColor(v: number) {
  return v >= 0 ? 'var(--green)' : 'var(--red)'
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PerformanceChart() {
  const [period, setPeriod]           = useState<Period>('1Y')
  const [customStart, setCustomStart] = useState('')
  const [customEnd,   setCustomEnd]   = useState(() => toISODate(new Date()))
  const [data,  setData]              = useState<PerformanceData | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ period })
      if (period === 'Custom' && customStart && customEnd) {
        params.set('start', customStart)
        params.set('end',   customEnd)
      }
      const res  = await fetch(`/api/portfolio/performance?${params}`)
      if (!res.ok) throw new Error('fetch failed')
      const json = await res.json() as PerformanceData
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [period, customStart, customEnd])

  useEffect(() => {
    if (period === 'Custom' && !customStart) return  // wait for user to pick a start date
    fetchData()
  }, [fetchData, period, customStart])

  // ── Chart config ────────────────────────────────────────────────────────────

  const timeUnit = period === 'D' ? 'hour'
    : period === 'W' || period === 'M' ? 'day'
    : period === 'Q' || period === 'YTD' ? 'week'
    : period === '1Y' ? 'month'
    : 'quarter'

  const chartData = data && data.points.length > 0 ? {
    datasets: [
      {
        label:           'Portfolio',
        data:            data.points.map(p => ({ x: p.ts, y: p.portfolio })),
        borderColor:     '#4f8ef7',
        backgroundColor: 'rgba(79,142,247,0.08)',
        borderWidth:     2,
        pointRadius:     0,
        pointHoverRadius: 4,
        fill:            true,
        tension:         0.3,
      },
      {
        label:           'S&P 500',
        data:            data.points.map(p => ({ x: p.ts, y: p.sp500 })),
        borderColor:     '#505a6e',
        backgroundColor: 'transparent',
        borderWidth:     1.5,
        borderDash:      [4, 3],
        pointRadius:     0,
        pointHoverRadius: 3,
        fill:            false,
        tension:         0.3,
      },
    ],
  } : null

  const options: Parameters<typeof Line>[0]['options'] = {
    responsive:          true,
    maintainAspectRatio: false,
    animation:           { duration: 400 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#181c27',
        borderColor:     '#252b3b',
        borderWidth:     1,
        titleColor:      '#e8eaf0',
        bodyColor:       '#8892a4',
        padding:         10,
        callbacks: {
          title: items => {
            const ts = items[0]?.parsed?.x
            if (ts == null) return ''
            return new Date(ts as number).toLocaleDateString('en-US', {
              month: 'short', day: 'numeric', year: 'numeric',
            })
          },
          label: ctx => {
            const v     = ctx.parsed?.y ?? 0
            const sign  = v >= 0 ? '+' : ''
            return ` ${ctx.dataset.label}: ${sign}${v.toFixed(2)}%`
          },
        },
      },
    },
    scales: {
      x: {
        type: 'time',
        time: { unit: timeUnit as any },
        grid:   { color: 'rgba(37,43,59,0.6)' },
        border: { display: false },
        ticks: { color: '#505a6e', font: { size: 10 }, maxTicksLimit: 8 },
      },
      y: {
        grid:   { color: 'rgba(37,43,59,0.6)' },
        border: { display: false },
        ticks: {
          color: '#505a6e',
          font:  { size: 10 },
          callback: (v: unknown) => `${Number(v).toFixed(0)}%`,
        },
      },
    },
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Period selectors */}
      <div className="port-chart-periods">
        {PERIODS.filter(p => p !== 'Custom').map(p => (
          <button
            key={p}
            className={`port-period-btn${period === p ? ' active' : ''}`}
            onClick={() => setPeriod(p)}
          >
            {p}
          </button>
        ))}
        <button
          className={`port-period-btn${period === 'Custom' ? ' active' : ''}`}
          onClick={() => setPeriod('Custom')}
        >
          Custom
        </button>
      </div>

      {/* Custom date range inputs */}
      {period === 'Custom' && (
        <div className="port-custom-range" style={{ marginBottom: 12 }}>
          <input
            type="date"
            className="port-date-input"
            value={customStart}
            onChange={e => setCustomStart(e.target.value)}
            max={customEnd}
          />
          <span style={{ color: 'var(--text-3)', fontSize: 11 }}>→</span>
          <input
            type="date"
            className="port-date-input"
            value={customEnd}
            onChange={e => setCustomEnd(e.target.value)}
            min={customStart}
            max={toISODate(new Date())}
          />
        </div>
      )}

      {/* Legend */}
      <div className="port-chart-legend">
        <div className="port-chart-legend-item">
          <div className="port-chart-legend-dot" style={{ background: '#4f8ef7' }} />
          Portfolio
        </div>
        <div className="port-chart-legend-item">
          <div className="port-chart-legend-dot" style={{ background: '#505a6e', borderTop: '1px dashed #505a6e', height: 0 }} />
          S&amp;P 500
        </div>
      </div>

      {/* Chart */}
      <div className="port-chart-wrap">
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
            {[1,2,3,4].map(i => (
              <div key={i} className="port-skeleton" style={{ height: 40, opacity: 1 - i * 0.15 }} />
            ))}
          </div>
        )}
        {!loading && error && (
          <div className="port-chart-empty">Unable to load performance data</div>
        )}
        {!loading && !error && (!chartData || data?.points.length === 0) && (
          <div className="port-chart-empty">No data available for this period</div>
        )}
        {!loading && !error && chartData && (
          <Line data={chartData} options={options} />
        )}
      </div>

      {/* Summary row */}
      {data && !loading && (
        <div className="port-chart-summary">
          <div className="port-chart-stat">
            <span className="port-chart-stat-label">Portfolio</span>
            <span className="port-chart-stat-value" style={{ color: retColor(data.portfolioReturn) }}>
              {fmtReturn(data.portfolioReturn)}
            </span>
          </div>
          <div className="port-chart-stat">
            <span className="port-chart-stat-label">S&amp;P 500</span>
            <span className="port-chart-stat-value" style={{ color: retColor(data.sp500Return) }}>
              {fmtReturn(data.sp500Return)}
            </span>
          </div>
          <div className="port-chart-stat">
            <span className="port-chart-stat-label">vs Benchmark</span>
            <span
              className="port-chart-stat-value"
              style={{ color: retColor(data.portfolioReturn - data.sp500Return) }}
            >
              {fmtReturn(data.portfolioReturn - data.sp500Return)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
