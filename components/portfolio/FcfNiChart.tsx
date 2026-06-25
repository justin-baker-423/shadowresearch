'use client'

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Chart } from 'react-chartjs-2'

ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, BarController,
  LineElement, LineController,
  PointElement, Tooltip, Legend,
)

// ── Static data ───────────────────────────────────────────────────────────────
// Methodology: (company total FCF or NI ÷ current diluted shares outstanding)
// × user's current share count. Fiscal year → calendar year mapping:
//   DE (Oct/Nov FY) → same CY  |  SNOW (Jan FY) → prior CY  |  TEAM (Jun FY) → same CY
//   NFLX (Dec FY) → same CY  (70 sh ÷ 4.30B post-split diluted shares ⇒ ×16.279/$B)
// NFLX GAAP figures ($M) — NI: 2761/5116/4492/5408/8712/10981 ·
//   FCF: 1922/-132/1619/6926/6922/9461 (stockanalysis.com / FY2025 10-K).
// All values in USD.

const YEARS = ['2020', '2021', '2022', '2023', '2024', '2025']

// Portfolio-attributed FCF per year ($)  — incl. NFLX [31, -2, 26, 113, 113, 154]
const FCF = [378, 607, 525, 921, 1384, 1438]

// Portfolio-attributed Net Income per year ($)  — incl. NFLX [45, 83, 73, 88, 142, 179]
const NI = [434, 608, 548, 1105, 1189, 1388]

// YoY growth rates — null for 2020 (no prior year)
const FCF_GROWTH: (number | null)[] = [null, 60.6, -13.5, 75.4, 50.3, 3.9]
const NI_GROWTH:  (number | null)[] = [null, 40.1,  -9.9, 101.6, 7.6, 16.7]

const FCF_CAGR = 30.6
const NI_CAGR  = 26.2

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDollar(v: number) {
  return v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function FcfNiChart() {
  const chartData = {
    labels: YEARS,
    datasets: [
      {
        type:            'bar' as const,
        label:           'FCF',
        data:            FCF,
        backgroundColor: 'rgba(79,142,247,0.65)',
        borderColor:     'rgba(79,142,247,0.9)',
        borderWidth:     1,
        yAxisID:         'y',
        order:           2,
      },
      {
        type:            'bar' as const,
        label:           'Net Income',
        data:            NI,
        backgroundColor: 'rgba(72,199,142,0.55)',
        borderColor:     'rgba(72,199,142,0.85)',
        borderWidth:     1,
        yAxisID:         'y',
        order:           2,
      },
      {
        type:            'line' as const,
        label:           'FCF YoY',
        data:            FCF_GROWTH,
        borderColor:     '#4f8ef7',
        backgroundColor: 'transparent',
        borderWidth:     2,
        pointRadius:     3,
        pointHoverRadius: 5,
        yAxisID:         'growth',
        order:           1,
        tension:         0.2,
        spanGaps:        false,
      },
      {
        type:            'line' as const,
        label:           'NI YoY',
        data:            NI_GROWTH,
        borderColor:     '#48c78e',
        backgroundColor: 'transparent',
        borderWidth:     2,
        pointRadius:     3,
        pointHoverRadius: 5,
        yAxisID:         'growth',
        order:           1,
        tension:         0.2,
        spanGaps:        false,
      },
    ],
  }

  const options = {
    responsive:          true,
    maintainAspectRatio: false,
    animation:           { duration: 400 },
    interaction:         { mode: 'index' as const, intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#181c27',
        borderColor:     '#252b3b',
        borderWidth:     1,
        titleColor:      '#e8eaf0',
        bodyColor:       '#8892a4',
        padding:         10,
        filter: (item: { parsed: { y: number | null } }) => item.parsed.y != null,
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) => {
            if (ctx.dataset.yAxisID === 'growth') {
              const v = ctx.parsed.y as number
              return ` ${ctx.dataset.label ?? ''}: ${v >= 0 ? '+' : ''}${v.toFixed(1)}%`
            }
            return ` ${ctx.dataset.label ?? ''}: ${fmtDollar(ctx.parsed.y as number)}`
          },
        },
      },
    },
    scales: {
      x: {
        grid:   { color: 'rgba(37,43,59,0.6)' },
        border: { display: false },
        ticks:  { color: '#505a6e', font: { size: 10 } },
      },
      y: {
        type:     'linear' as const,
        position: 'left' as const,
        grid:     { color: 'rgba(37,43,59,0.6)' },
        border:   { display: false },
        ticks: {
          color: '#505a6e',
          font:  { size: 10 },
          callback: (v: unknown) => fmtDollar(Number(v)),
        },
      },
      growth: {
        type:     'linear' as const,
        position: 'right' as const,
        grid:     { drawOnChartArea: false },
        border:   { display: false },
        ticks: {
          color: '#505a6e',
          font:  { size: 10 },
          callback: (v: unknown) => `${Number(v).toFixed(0)}%`,
        },
      },
    },
  }

  return (
    <div>
      {/* Legend */}
      <div className="port-chart-legend">
        <div className="port-chart-legend-item">
          <div className="port-chart-legend-dot" style={{ background: 'rgba(79,142,247,0.75)' }} />
          FCF
        </div>
        <div className="port-chart-legend-item">
          <div className="port-chart-legend-dot" style={{ background: 'rgba(72,199,142,0.65)' }} />
          Net Income
        </div>
        <div style={{ marginLeft: 'auto', color: '#505a6e', fontSize: 11, alignSelf: 'center' }}>
          Lines = YoY Growth →
        </div>
      </div>

      {/* Chart */}
      <div className="port-chart-wrap">
        <Chart type="bar" data={chartData} options={options} />
      </div>

      {/* CAGR summary */}
      <div className="port-chart-summary">
        <div className="port-chart-stat">
          <span className="port-chart-stat-label">FCF 5Y CAGR</span>
          <span className="port-chart-stat-value" style={{ color: 'var(--green)' }}>
            +{FCF_CAGR.toFixed(1)}%
          </span>
        </div>
        <div className="port-chart-stat">
          <span className="port-chart-stat-label">NI 5Y CAGR</span>
          <span className="port-chart-stat-value" style={{ color: 'var(--green)' }}>
            +{NI_CAGR.toFixed(1)}%
          </span>
        </div>
        <div className="port-chart-stat">
          <span className="port-chart-stat-label">2025 FCF</span>
          <span className="port-chart-stat-value" style={{ color: '#e8eaf0' }}>
            {fmtDollar(FCF[FCF.length - 1])}
          </span>
        </div>
        <div className="port-chart-stat">
          <span className="port-chart-stat-label">2025 NI</span>
          <span className="port-chart-stat-value" style={{ color: '#e8eaf0' }}>
            {fmtDollar(NI[NI.length - 1])}
          </span>
        </div>
      </div>

      <p className="disclaimer" style={{ marginTop: 8 }}>
        Values = (company FCF or NI ÷ diluted shares outstanding) × current share count · Current positions only ·
        Non-Dec FY mapped: DE (Oct) → same CY, SNOW (Jan) → prior CY, TEAM (Jun) → same CY
      </p>
    </div>
  )
}
