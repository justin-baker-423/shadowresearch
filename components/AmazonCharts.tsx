"use client"
// Small chart.js wrappers for the Amazon SOTP segment tabs.
// One y-axis per chart (no dual axes); values in $B or %.

import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, BarController,
  LineElement, LineController, PointElement,
  Tooltip, Legend,
} from "chart.js"
import { Chart } from "react-chartjs-2"

ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, BarController,
  LineElement, LineController, PointElement,
  Tooltip, Legend,
)

export const C = {
  accent: "#4f8ef7", green: "#3ecf8e", amber: "#f5a623", red: "#f25c5c",
  purple: "#a78bfa", orange: "#ff9900", grey: "#8892a4", muted: "#505a6e",
}

export interface Series {
  label: string
  data:  number[]
  color: string
  type?: "bar" | "line"
  stack?: string
}

export function SegmentChart({ title, years, series, unit, stacked = false, height = 220 }: {
  title: string
  years: number[]
  series: Series[]
  unit: "$B" | "%"
  stacked?: boolean
  height?: number
}) {
  const fmt = (v: number) =>
    unit === "%" ? `${v.toFixed(1)}%`
      : (v < 0 ? "−" : "") + (Math.abs(v) >= 1000 ? `$${(Math.abs(v) / 1000).toFixed(2)}T` : `$${Math.round(Math.abs(v))}B`)

  const data = {
    labels: years.map(String),
    datasets: series.map(s => ({
      type:            s.type ?? "bar",
      label:           s.label,
      data:            s.data,
      backgroundColor: s.type === "line" ? s.color : s.color + "bb",
      borderColor:     s.color,
      borderWidth:     s.type === "line" ? 2 : 0,
      pointRadius:     s.type === "line" ? 2 : 0,
      tension:         0.2,
      stack:           s.stack,
      borderRadius:    2,
    })),
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 300 },
    interaction: { mode: "index" as const, intersect: false },
    plugins: {
      legend: { display: true, labels: { color: C.grey, boxWidth: 10, font: { size: 10 } } },
      tooltip: {
        backgroundColor: "#181c27", borderColor: "#252b3b", borderWidth: 1,
        titleColor: "#e8eaf0", bodyColor: "#8892a4", padding: 10,
        callbacks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label: (ctx: any) => ` ${ctx.dataset.label}: ${fmt(ctx.parsed.y as number)}`,
        },
      },
    },
    scales: {
      x: { stacked, grid: { color: "rgba(37,43,59,0.6)" }, ticks: { color: C.muted, font: { size: 10 } } },
      y: {
        stacked,
        grid:  { color: "rgba(37,43,59,0.6)" },
        ticks: { color: C.muted, font: { size: 10 }, callback: (v: string | number) => fmt(Number(v)) },
      },
    },
  }

  return (
    <div className="kpi-card" style={{ padding: 14 }}>
      <div className="section-label" style={{ marginBottom: 8 }}>{title}</div>
      <div style={{ height }}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Chart type="bar" data={data as any} options={options as any} />
      </div>
    </div>
  )
}
