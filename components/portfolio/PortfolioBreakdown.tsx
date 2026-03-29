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
  '#94a3b8',  // slate — for "Other"
]

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
  slices:    { ticker: string; weightPct: number; color: string }[],
  logosRef:  React.MutableRefObject<Map<string, HTMLImageElement>>,
  fallbackBg: string[],
) {
  return {
    id: 'outerLabels',
    afterDatasetsDraw(chart: ChartJS) {
      const logos = logosRef.current
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
          ctx.fillStyle = fallbackBg[i % fallbackBg.length]
          ctx.fill()
          ctx.fillStyle    = '#fff'
          ctx.font         = `bold 8px Inter, sans-serif`
          ctx.textAlign    = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(slice.ticker.slice(0, 2), logoX, logoY)
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

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  details: HoldingDetail[]
}

const MIN_LABEL_PCT = 1   // Slices below this are grouped as "Other"

export default function PortfolioBreakdown({ details }: Props) {
  const chartRef = useRef<ChartJS<'doughnut'>>(null)

  // Split into labelled slices and "Other"
  const labelled = details.filter(h => h.weightPct >= MIN_LABEL_PCT)
  const otherPct = details.filter(h => h.weightPct < MIN_LABEL_PCT)
    .reduce((s, h) => s + h.weightPct, 0)

  const slices = [
    ...labelled.map((h, i) => ({
      ticker:   h.ticker,
      weightPct: h.weightPct,
      color:    COLORS[i % COLORS.length],
    })),
    ...(otherPct > 0
      ? [{ ticker: 'Other', weightPct: Math.round(otherPct * 10) / 10, color: COLORS[COLORS.length - 1] }]
      : []),
  ]

  const tickers  = labelled.map(h => h.ticker)
  const logos    = usePreloadedLogos(tickers)

  // Stable ref so the plugin closure always reads the latest logos map
  // without needing to be recreated (Chart.js dedupes plugins by id)
  const logosRef = useRef<Map<string, HTMLImageElement>>(new Map())

  useEffect(() => {
    logosRef.current = logos
    chartRef.current?.update()
  }, [logos])

  // Plugin is memoized by slice composition — logosRef is stable so the
  // closure always picks up the current map via logosRef.current
  const sliceKey = slices.map(s => s.ticker + s.weightPct).join()
  const plugin   = useMemo(
    () => makeOuterLabelsPlugin(slices, logosRef, COLORS),
    [sliceKey], // eslint-disable-line react-hooks/exhaustive-deps
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
    animation: { duration: 600 },
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

  return (
    <div className="port-breakdown-wrap">
      <Doughnut
        ref={chartRef}
        data={chartData}
        options={options}
        plugins={[plugin as any]}
      />
    </div>
  )
}
