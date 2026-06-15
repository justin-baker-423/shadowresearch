'use client'
// requires: npm install chart.js react-chartjs-2
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { Doughnut } from 'react-chartjs-2'
import { HoldingDetail } from '@/lib/portfolio/types'
import { getLogoUrl }    from '@/lib/portfolio/logos'

ChartJS.register(ArcElement, Tooltip, Legend)

// ── Color palette ─────────────────────────────────────────────────────────────

const COLORS = [
  '#4f8ef7','#3ecf8e','#a78bfa','#f5a623','#f25c5c',
  '#22d3ee','#fb923c','#84cc16','#e879f9','#38bdf8',
  '#facc15','#4ade80','#c084fc','#f87171','#60a5fa',
]
const OTHER_COLOR = '#94a3b8'   // slate — for "Other"

// ── Preload logos ─────────────────────────────────────────────────────────────

function usePreloadedLogos(tickers: string[]): Map<string, HTMLImageElement> {
  const [logos, setLogos] = useState<Map<string, HTMLImageElement>>(new Map())

  useEffect(() => {
    const map = new Map<string, HTMLImageElement>()
    let loaded = 0

    tickers.forEach(ticker => {
      const url = getLogoUrl(ticker)
      if (!url) { loaded++; return }

      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        map.set(ticker, img)
        loaded++
        if (loaded === tickers.length) setLogos(new Map(map))
      }
      img.onerror = () => {
        loaded++
        if (loaded === tickers.length) setLogos(new Map(map))
      }
      img.src = url
    })

    if (tickers.length === 0) setLogos(new Map())
  }, [tickers.join(',')])   // eslint-disable-line

  return logos
}

// ── Custom plugin: leader lines + logo labels (with collision avoidance) ───────

const LOGO_R  = 10
const H_LEN   = 20   // horizontal segment length
const R_SPOKE = 36   // how far out the radial elbow sits
const MIN_GAP = 26   // minimum vertical gap between label centres

type LabelInfo = {
  i:        number
  slice:    { ticker: string; weightPct: number; color: string }
  lx1:      number   // line start on arc edge
  ly1:      number
  elbowX:   number   // radial elbow X (fixed — moves with arc)
  isRight:  boolean
  naturalY: number   // ideal Y from arc mid-angle
  finalY:   number   // Y after collision avoidance
}

function spreadLabels(group: LabelInfo[]) {
  // Sort top-to-bottom by natural position then relax until no overlap
  group.sort((a, b) => a.naturalY - b.naturalY)
  for (let iter = 0; iter < 30; iter++) {
    let moved = false
    for (let j = 1; j < group.length; j++) {
      const overlap = MIN_GAP - (group[j].finalY - group[j - 1].finalY)
      if (overlap > 0) {
        group[j - 1].finalY -= overlap / 2
        group[j].finalY     += overlap / 2
        moved = true
      }
    }
    if (!moved) break
  }
}

function makeOuterLabelsPlugin(
  slicesRef: React.MutableRefObject<{ ticker: string; weightPct: number; color: string }[]>,
  logosRef:  React.MutableRefObject<Map<string, HTMLImageElement>>,
) {
  return {
    id: 'outerLabels',
    afterDatasetsDraw(chart: ChartJS) {
      const slices = slicesRef.current
      const logos  = logosRef.current
      const { ctx } = chart
      const meta    = chart.getDatasetMeta(0)
      if (!meta.data.length) return

      // ── Pass 1: collect natural positions ────────────────────────────────────
      const left:  LabelInfo[] = []
      const right: LabelInfo[] = []

      meta.data.forEach((arcEl, i) => {
        const slice = slices[i]
        if (!slice || slice.weightPct < 1) return

        const props = (arcEl as any).getProps(
          ['x', 'y', 'startAngle', 'endAngle', 'outerRadius'],
          true,
        )
        const midAngle = (props.startAngle + props.endAngle) / 2
        const cos      = Math.cos(midAngle)
        const sin      = Math.sin(midAngle)
        const isRight  = cos >= 0

        const r1 = props.outerRadius + 6
        const lx1 = props.x + r1 * cos
        const ly1 = props.y + r1 * sin

        const r2     = props.outerRadius + R_SPOKE
        const elbowX = props.x + r2 * cos
        const naturalY = props.y + r2 * sin

        const info: LabelInfo = { i, slice, lx1, ly1, elbowX, isRight, naturalY, finalY: naturalY }
        ;(isRight ? right : left).push(info)
      })

      // ── Pass 2: spread each side independently ───────────────────────────────
      spreadLabels(left)
      spreadLabels(right)

      // ── Pass 3: draw ─────────────────────────────────────────────────────────
      ;[...left, ...right].forEach(({ i, slice, lx1, ly1, elbowX, isRight, finalY }) => {
        const hEnd = elbowX + (isRight ? H_LEN : -H_LEN)

        // Leader line: arc → elbow (adjusted Y) → horizontal tip
        ctx.save()
        ctx.beginPath()
        ctx.moveTo(lx1, ly1)
        ctx.lineTo(elbowX, finalY)
        ctx.lineTo(hEnd,   finalY)
        ctx.strokeStyle = 'rgba(80,90,110,0.65)'
        ctx.lineWidth   = 1
        ctx.stroke()
        ctx.restore()

        // Logo circle
        const logoX = isRight ? hEnd + LOGO_R + 2 : hEnd - LOGO_R - 2
        const logoY = finalY

        ctx.save()
        ctx.beginPath()
        ctx.arc(logoX, logoY, LOGO_R, 0, Math.PI * 2)
        ctx.clip()

        const img = logos.get(slice.ticker)
        if (img?.complete && img.naturalHeight > 0) {
          try { ctx.drawImage(img, logoX - LOGO_R, logoY - LOGO_R, LOGO_R * 2, LOGO_R * 2) } catch {}
        } else {
          ctx.fillStyle = slice.color
          ctx.fill()
          ctx.fillStyle    = '#fff'
          ctx.font         = `bold ${slice.ticker === 'CASH' ? 11 : 8}px Inter, sans-serif`
          ctx.textAlign    = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(slice.ticker === 'CASH' ? '$' : slice.ticker.slice(0, 2), logoX, logoY)
        }
        ctx.restore()

        // Ticker + weight text
        const textX = isRight ? logoX + LOGO_R + 5 : logoX - LOGO_R - 5
        ctx.save()
        ctx.textAlign    = isRight ? 'left' : 'right'
        ctx.textBaseline = 'middle'
        ctx.fillStyle    = '#e8eaf0'
        ctx.font         = `600 10px Inter, sans-serif`
        ctx.fillText(slice.ticker, textX, logoY - 5.5)
        ctx.fillStyle    = '#8892a4'
        ctx.font         = `10px Inter, sans-serif`
        ctx.fillText(`${slice.weightPct.toFixed(1)}%`, textX, logoY + 5.5)
        ctx.restore()
      })
    },
  }
}

// ── Projection helpers ─────────────────────────────────────────────────────────

type Slice = { ticker: string; weightPct: number; color: string }

const MIN_LABEL_PCT = 1   // Slices below this are grouped as "Other"
const MAX_YEARS     = 10

/** Build pie slices (with "Other" grouping) from projected values, ordered largest→smallest. */
function buildSlices(
  values:        { ticker: string; value: number }[],
  colorByTicker: Map<string, string>,
): Slice[] {
  const total = values.reduce((s, v) => s + v.value, 0)
  if (total <= 0) return []

  // Re-sort by *this year's* weight so the pie always reads in descending order.
  const withPct = values
    .map(v => ({ ticker: v.ticker, weightPct: (v.value / total) * 100 }))
    .sort((a, b) => b.weightPct - a.weightPct)

  const labelled = withPct.filter(w => w.weightPct >= MIN_LABEL_PCT)
  const otherPct = withPct
    .filter(w => w.weightPct < MIN_LABEL_PCT)
    .reduce((s, w) => s + w.weightPct, 0)

  return [
    ...labelled.map(w => ({
      ticker:    w.ticker,
      weightPct: w.weightPct,
      color:     colorByTicker.get(w.ticker) ?? OTHER_COLOR,
    })),
    ...(otherPct > 0
      ? [{ ticker: 'Other', weightPct: Math.round(otherPct * 10) / 10, color: OTHER_COLOR }]
      : []),
  ]
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  details:       HoldingDetail[]
  /** Implied 10-yr CAGR (decimal, e.g. 0.186) keyed by ticker. */
  cagrByTicker?: Record<string, number>
  /** MV-weighted average CAGR (decimal) — fallback for any holding lacking an estimate. */
  avgCagr?:      number
  /** Calendar year represented by the "today" position (slider year 0). */
  startYear?:    number
}

export default function PortfolioBreakdown({
  details,
  cagrByTicker = {},
  avgCagr      = 0,
  startYear    = new Date().getFullYear(),
}: Props) {
  const chartRef = useRef<ChartJS<'doughnut'>>(null)
  const [year, setYear] = useState(0)   // 0 = today, up to MAX_YEARS out

  // Stable per-ticker color, assigned by *today's* weight so each company keeps
  // its color even though slice ordering re-sorts each year.
  const colorByTicker = useMemo(() => {
    const sorted = [...details].sort((a, b) => b.weightPct - a.weightPct)
    const map = new Map<string, string>()
    sorted.forEach((h, i) => map.set(h.ticker, COLORS[i % COLORS.length]))
    map.set('CASH', '#64748b')   // neutral slate so cash reads as cash
    return map
  }, [details])

  // Projected market value of each holding at the selected year, compounding
  // at its implied CAGR (dividends reinvested ⇒ growth applies to full value).
  const { slices, totalGrowth } = useMemo(() => {
    const values = details.map(h => {
      // Cash doesn't compound — hold it flat across the projection.
      const cagr = h.ticker === 'CASH' ? 0 : (cagrByTicker[h.ticker] ?? avgCagr)
      return { ticker: h.ticker, value: h.marketValue * Math.pow(1 + cagr, year) }
    })
    const valueNow    = details.reduce((s, h) => s + h.marketValue, 0)
    const valueFuture = values.reduce((s, v) => s + v.value, 0)
    return {
      slices:      buildSlices(values, colorByTicker),
      totalGrowth: valueNow > 0 ? valueFuture / valueNow - 1 : 0,
    }
  }, [details, cagrByTicker, avgCagr, year, colorByTicker])

  // Preload logos for every holding (composition shifts with the slider)
  const logos    = usePreloadedLogos(useMemo(() => details.map(h => h.ticker), [details]))
  const logosRef = useRef<Map<string, HTMLImageElement>>(new Map())

  // Live refs so the (stable, id-deduped) plugin always draws the latest
  // slices + logos. Chart.js keeps the first plugin registered under an id,
  // so the plugin must read through refs rather than a captured closure.
  const slicesRef = useRef(slices)
  slicesRef.current = slices

  useEffect(() => {
    logosRef.current = logos
    chartRef.current?.update()
  }, [logos])

  const plugin = useMemo(
    () => makeOuterLabelsPlugin(slicesRef, logosRef),
    [],
  )

  const chartData = {
    labels:   slices.map(s => s.ticker),
    datasets: [{
      data:            slices.map(s => s.weightPct),
      backgroundColor: slices.map(s => s.color),
      borderColor:     '#181c27',
      borderWidth:     2,
      hoverBorderWidth: 3,
      hoverBorderColor: '#181c27',
    }],
  }

  const options: Parameters<typeof Doughnut>[0]['options'] = {
    cutout:    '60%',
    animation: { duration: 450 },
    plugins: {
      legend:  { display: false },
      tooltip: {
        backgroundColor: '#181c27',
        borderColor:     '#252b3b',
        borderWidth:     1,
        titleColor:      '#e8eaf0',
        bodyColor:       '#8892a4',
        padding:         10,
        callbacks: {
          label: ctx => ` ${(ctx.raw as number).toFixed(1)}% of portfolio`,
        },
      },
    },
    // leave extra padding for the outer labels
    layout: { padding: { top: 55, bottom: 55, left: 115, right: 115 } },
  }

  const targetYear = startYear + year
  const growthPct  = totalGrowth * 100
  const isToday    = year === 0

  return (
    <div className="port-breakdown-proj">
      {/* ── Projected-growth readout ── */}
      <div className="port-proj-readout">
        <div className="port-proj-stat">
          <span className="port-proj-label">{isToday ? 'Today' : 'Projected'}</span>
          <span className="port-proj-year">{targetYear}</span>
        </div>
        <div className="port-proj-stat" style={{ textAlign: 'right' }}>
          <span className="port-proj-label">Portfolio value vs today</span>
          <span
            className="port-proj-growth"
            style={{ color: isToday ? 'var(--text-2)' : growthPct >= 0 ? 'var(--green)' : 'var(--red)' }}
          >
            {isToday ? '—' : `${growthPct >= 0 ? '+' : ''}${growthPct.toFixed(0)}%`}
          </span>
        </div>
      </div>

      {/* ── Pie ── */}
      <div className="port-breakdown-wrap">
        <Doughnut
          ref={chartRef}
          data={chartData}
          options={options}
          plugins={[plugin as any]}
        />
      </div>

      {/* ── Year slider ── */}
      <div className="port-year-control">
        <input
          type="range"
          className="port-year-slider"
          min={0}
          max={MAX_YEARS}
          step={1}
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          aria-label="Projection year"
        />
        <div className="port-year-ticks">
          {Array.from({ length: MAX_YEARS + 1 }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`port-year-tick${i === year ? ' active' : ''}`}
              onClick={() => setYear(i)}
            >
              {`'${String((startYear + i) % 100).padStart(2, '0')}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
