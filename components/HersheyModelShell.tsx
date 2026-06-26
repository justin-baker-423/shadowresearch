"use client"
import { useState, useMemo } from "react"
import type { HersheyModelConfig, HersheyScenario } from "@/lib/hershey-models"
import { runHersheyDCF, buildHersheySensitivity } from "@/lib/hershey-engine"

const SC_COLORS: Record<HersheyScenario, { color: string; dim: string }> = {
  bear: { color: "var(--red)",    dim: "var(--red-dim)"    },
  base: { color: "var(--accent)", dim: "var(--accent-dim)" },
  bull: { color: "var(--green)",  dim: "var(--green-dim)"  },
}

function f1(n: number) { return n.toFixed(1) }
function fPct(n: number) { return f1(n * 100) + "%" }
function fUsdB(n: number) { return "$" + f1(n) + "B" }
function fUsd2(n: number) { return "$" + n.toFixed(2) }

export default function HersheyModelShell({ model, priceSource }: {
  model: HersheyModelConfig; priceSource?: string
}) {
  const [sc,    setSc]    = useState<HersheyScenario>("base")
  const [wacc,  setWacc]  = useState(model.waccDefault)
  const [termG, setTermG] = useState(model.termGrowth)
  const [tab,   setTab]   = useState<"model" | "sensitivity" | "assumptions">("model")

  const M    = useMemo(() => runHersheyDCF(model, sc, wacc, termG), [model, sc, wacc, termG])
  const SENS = useMemo(() => buildHersheySensitivity(model, sc),     [model, sc])

  const scColors = SC_COLORS[sc]
  const accent   = model.accentColor ?? "var(--accent)"
  const upCol    = M.updown > 0 ? "var(--green)" : "var(--red)"
  const A        = model.scenarios[sc]
  const cap      = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  const kpis = [
    {
      label: "Intrinsic Value / Share",
      value: fUsd2(M.perShare),
      sub:   `vs $${model.currentPrice} · ${M.updown > 0 ? "+" : ""}${f1(M.updown)}% implied`,
      color: upCol,
    },
    {
      label: "10-yr Implied CAGR",
      value: `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`,
      sub:   `+ ${fPct(M.divYieldFwd)} dividend on top`,
      color: upCol,
    },
    {
      label: "Enterprise Value",
      value: fUsdB(M.ev),
      sub:   `PV NOPAT ${fUsdB(M.sumPvNopat)} · PV TV ${fUsdB(M.pvTv)}`,
      color: "var(--text-1)",
    },
    {
      label: "Intrinsic Equity Value",
      value: fUsdB(M.equity),
      sub:   `EV − $${f1(model.netDebt)}B net debt`,
      color: scColors.color,
    },
    {
      label: "2035E EPS",
      value: fUsd2(M.rows[9].eps),
      sub:   `from $${f1(M.baseEps)} base · DPS ${fUsd2(M.rows[9].dps)}`,
      color: "var(--text-1)",
    },
    {
      label: "Dividend Yield",
      value: fPct(M.divYieldFwd),
      sub:   `2026E $${M.rows[0].dps.toFixed(2)}/sh · ${fPct(M.rows[0].payout)} payout`,
      color: "var(--purple)",
    },
  ]

  return (
    <div>
      {/* header */}
      <div className="model-header">
        <div className="model-header-row">
          <div className="model-ticker-badge" style={{ background: accent === "var(--accent)" ? "#1457c8" : accent }}>
            {model.ticker}
          </div>
          <div className="model-header-label">{model.name} · {model.exchange} · Simple Earnings DCF</div>
        </div>
        <div className="model-subline">
          Base year FY{model.baseYear}A · Net sales {fUsdB(model.baseRevenue)} ·{" "}
          {f1(model.sharesOut * 1000)}M shares · Net debt ${f1(model.netDebt)}B ·{" "}
          Price ref ${model.currentPrice}{" "}
          {priceSource && (
            <span style={{ color: priceSource.startsWith("Live") ? "var(--green)" : "var(--text-3)", fontWeight: 500 }}>
              ({priceSource})
            </span>
          )}
        </div>
        <div className="model-subline">
          Three drivers: revenue {fPct(A.revGrowth)}/yr · gross margin {fPct(A.grossMargin)} · operating margin {fPct(A.opMargin)} ·{" "}
          dividend grows with EPS off ${model.dps0.toFixed(2)} · tax {fPct(model.taxRate)} · WACC {fPct(wacc)} · Terminal g {fPct(termG)}
        </div>
      </div>

      {/* controls */}
      <div className="controls-row">
        <div className="control-group">
          <div className="section-label">Scenario</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["bear", "base", "bull"] as HersheyScenario[]).map(s => (
              <button key={s} onClick={() => setSc(s)} className={`sc-btn ${sc === s ? `active-${s}` : ""}`}>
                {cap(s)}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <div className="section-label">WACC: {fPct(wacc)}</div>
          <input
            type="range" min={7} max={14} step={0.5} value={wacc * 100}
            onChange={e => setWacc(Number(e.target.value) / 100)}
            style={{ width: 160, accentColor: scColors.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 160 }}>
            <span>7%</span><span>14%</span>
          </div>
        </div>

        <div className="control-group">
          <div className="section-label">Terminal growth: {fPct(termG)}</div>
          <input
            type="range" min={1.5} max={5} step={0.5} value={termG * 100}
            onChange={e => setTermG(Number(e.target.value) / 100)}
            style={{ width: 160, accentColor: scColors.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 160 }}>
            <span>1.5%</span><span>5%</span>
          </div>
        </div>

        <div className="control-group">
          <div className="section-label">View</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["model", "sensitivity", "assumptions"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`tab-btn ${tab === t ? "active" : ""}`}>{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="kpi-strip">
        {kpis.map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── MODEL TAB ── */}
      {tab === "model" && (
        <div>
          <div className="section-label">{model.baseYear + 1}–{model.baseYear + 10} Valuation Forecast — {cap(sc)} Case (unlevered, $B)</div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Revenue</th>
                  <th>Rev Δ</th>
                  <th>EBIT ({fPct(A.opMargin)})</th>
                  <th>NOPAT</th>
                  <th>PV of NOPAT</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => {
                  const star = r.year === model.baseYear + 5
                  const p2   = r.year > model.baseYear + 5
                  return (
                    <tr key={r.year} style={{ borderBottom: `1px solid ${star ? scColors.color + "55" : "rgba(37,43,59,0.88)"}` }}>
                      <td style={{ color: star ? scColors.color : p2 ? "var(--purple)" : "var(--text-1)", fontWeight: star ? 700 : 400 }}>
                        {r.year}{star ? " ★" : ""}
                      </td>
                      <td>{fUsdB(r.rev)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fPct(r.revGrowth)}</td>
                      <td style={{ color: scColors.color }}>{fUsdB(r.ebit)}</td>
                      <td>{fUsdB(r.nopat)}</td>
                      <td style={{ color: "var(--accent)" }}>{fUsdB(r.pvNopat)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    Terminal value · g={fPct(termG)} · WACC={fPct(wacc)} · {f1(M.gordon)}× Gordon multiple
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 600 }}>{fUsdB(M.pvTv)}</td>
                </tr>
                <tr className="ev-row">
                  <td colSpan={5} style={{ color: "var(--accent)", fontWeight: 600, textAlign: "left" }}>Enterprise Value (PV NOPAT + PV TV)</td>
                  <td style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>{fUsdB(M.ev)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* per-share earnings & dividend */}
          <div className="section-label" style={{ marginTop: 22 }}>
            Per-Share Earnings & Dividend — {cap(sc)} Case (levered, after ${f1(model.netInterest)}B net interest)
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Gross Profit ({fPct(A.grossMargin)})</th>
                  <th>Net Income</th>
                  <th>EPS</th>
                  <th>DPS</th>
                  <th>Div Δ</th>
                  <th>Payout</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => {
                  const star = r.year === model.baseYear + 5
                  const p2   = r.year > model.baseYear + 5
                  return (
                    <tr key={r.year} style={{ borderBottom: `1px solid ${star ? scColors.color + "55" : "rgba(37,43,59,0.88)"}` }}>
                      <td style={{ color: star ? scColors.color : p2 ? "var(--purple)" : "var(--text-1)", fontWeight: star ? 700 : 400 }}>
                        {r.year}{star ? " ★" : ""}
                      </td>
                      <td style={{ color: "var(--text-2)" }}>{fUsdB(r.gross)}</td>
                      <td>{fUsdB(r.ni)}</td>
                      <td style={{ color: "var(--text-1)" }}>{fUsd2(r.eps)}</td>
                      <td style={{ color: "var(--purple)" }}>{fUsd2(r.dps)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fPct(r.divGrowth)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fPct(r.payout)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* bridge */}
          <div className="bridge-card">
            <div className="section-label">Value Bridge → Per Share</div>
            {[
              ["Enterprise value (PV NOPAT + PV TV)",  fUsdB(M.ev),                                 "var(--text-1)"],
              [`(−) Net debt (FY${model.baseYear}A)`,  `$${f1(model.netDebt)}B`,                     "var(--red)"],
              ["(=) Intrinsic equity value",           fUsdB(M.equity),                             "var(--accent)"],
              [`÷ Shares (${f1(model.sharesOut * 1000)}M)`, fUsd2(M.perShare),                       "var(--text-2)"],
              ["Intrinsic value / share",              fUsd2(M.perShare),                           scColors.color],
              ["Current price",                        `$${model.currentPrice}`,                    "var(--text-3)"],
              ["Implied upside / (downside)",          `${M.updown > 0 ? "+" : ""}${f1(M.updown)}%`, upCol        ],
              ["10-yr implied CAGR (ex-dividend)",     `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`, upCol ],
              ["Forward dividend yield",               fPct(M.divYieldFwd),                         "var(--purple)"],
            ].map(([k, v, col]) => (
              <div key={k} className="bridge-row">
                <span className="bridge-label">{k}</span>
                <span className="bridge-value" style={{ color: col }}>{v}</span>
              </div>
            ))}
          </div>

          {/* legend */}
          <div className="phase-legend">
            <div className="phase-item">
              <span className="phase-dot" style={{ background: scColors.color + "33", border: `1px solid ${scColors.color}66` }} />
              {model.baseYear + 1}–{model.baseYear + 5}: Phase 1
            </div>
            <div className="phase-item">
              <span className="phase-dot" style={{ background: "var(--purple-dim)", border: "1px solid rgba(167,139,250,.4)" }} />
              {model.baseYear + 6}–{model.baseYear + 10}: Phase 2 (terminal approach)
            </div>
            <span style={{ fontSize: 11, color: scColors.color }}>★ = mid-period milestone year</span>
          </div>
        </div>
      )}

      {/* ── SENSITIVITY TAB ── */}
      {tab === "sensitivity" && (
        <div>
          <div className="section-label">
            Intrinsic Value / Share ($) — {cap(sc)} Case
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            Rows = terminal growth · Columns = WACC · Highlighted = current sliders
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="sens-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Term g ↓ / WACC →</th>
                  {SENS.waccs.map(w => (
                    <th key={w} style={{ color: Math.abs(w - wacc) < 0.001 ? scColors.color : "var(--text-3)", fontWeight: Math.abs(w - wacc) < 0.001 ? 700 : 400 }}>
                      {fPct(w)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SENS.tgrows.map((tg, ri) => (
                  <tr key={tg}>
                    <td style={{ color: Math.abs(tg - termG) < 0.001 ? scColors.color : "var(--text-2)", fontWeight: Math.abs(tg - termG) < 0.001 ? 700 : 400 }}>
                      {fPct(tg)}
                    </td>
                    {SENS.waccs.map((w, ci) => {
                      const val = SENS.grid[ri][ci]
                      const sel = Math.abs(w - wacc) < 0.001 && Math.abs(tg - termG) < 0.001
                      const ratio = val / model.currentPrice
                      const cls = ratio >= 1.3 ? "sens-cell-green" : ratio >= 1.0 ? "sens-cell-accent" : ratio >= 0.7 ? "sens-cell-amber" : "sens-cell-red"
                      return (
                        <td key={w} className={`${cls} ${sel ? "sens-cell-selected" : ""}`}
                          style={sel ? { borderColor: scColors.color, color: scColors.color } : {}}>
                          ${val}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sens-legend">
            {[
              ["var(--green)",  "var(--green-dim)",  `>$${Math.round(model.currentPrice * 1.3)} (>30% upside)`],
              ["var(--accent)", "var(--accent-dim)", `$${Math.round(model.currentPrice)}–$${Math.round(model.currentPrice * 1.3)} (0–30%)`],
              ["var(--amber)",  "var(--amber-dim)",  `$${Math.round(model.currentPrice * 0.7)}–$${Math.round(model.currentPrice)} (−30%–0%)`],
              ["var(--red)",    "var(--red-dim)",    `<$${Math.round(model.currentPrice * 0.7)} (>30% down)`],
            ].map(([col, bg, lbl]) => (
              <div key={lbl} className="sens-legend-item" style={{ color: col }}>
                <span className="sens-legend-swatch" style={{ background: bg, border: `1px solid ${col}66` }} />
                {lbl}
              </div>
            ))}
          </div>

          {/* scenario compare */}
          <div className="section-label" style={{ marginTop: 24 }}>
            All Three Scenarios at {fPct(model.waccDefault)} WACC / {fPct(model.termGrowth)} Terminal
          </div>
          <div className="sc-compare">
            {(["bear", "base", "bull"] as HersheyScenario[]).map(s => {
              const m2 = runHersheyDCF(model, s, model.waccDefault, model.termGrowth)
              const mt = SC_COLORS[s]
              const a2 = model.scenarios[s]
              return (
                <div key={s} className="sc-card" style={{ background: mt.dim + "88", border: `1px solid ${mt.color}44` }}>
                  <div className="sc-card-label" style={{ color: mt.color }}>{cap(s)} Case</div>
                  <div className="sc-card-value" style={{ color: mt.color }}>{fUsd2(m2.perShare)}</div>
                  <div className="sc-card-updown" style={{ color: "var(--text-2)" }}>
                    {m2.updown > 0 ? "+" : ""}{f1(m2.updown)}% vs ${model.currentPrice}
                  </div>
                  <div className="sc-card-stat">Rev {fPct(a2.revGrowth)} · GM {fPct(a2.grossMargin)} · OM {fPct(a2.opMargin)}</div>
                  <div className="sc-card-stat">2035E EPS: {fUsd2(m2.rows[9].eps)}</div>
                  <div className="sc-card-stat">2035E DPS: {fUsd2(m2.rows[9].dps)}</div>
                  <div className="sc-card-stat">Equity IV: {fUsdB(m2.equity)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ASSUMPTIONS TAB ── */}
      {tab === "assumptions" && (
        <div className="assumptions-grid">
          {[
            {
              title: "Three Drivers",
              color: "var(--accent)",
              rows: [
                ["Base year", `${model.baseYear}A · ${fUsdB(model.baseRevenue)} net sales`],
                ["Revenue growth", `${fPct(model.scenarios.bear.revGrowth)} / ${fPct(model.scenarios.base.revGrowth)} / ${fPct(model.scenarios.bull.revGrowth)} (bear/base/bull)`],
                ["Gross margin", `${fPct(model.scenarios.bear.grossMargin)} / ${fPct(model.scenarios.base.grossMargin)} / ${fPct(model.scenarios.bull.grossMargin)} — display line`],
                ["Operating margin", `${fPct(model.scenarios.bear.opMargin)} / ${fPct(model.scenarios.base.opMargin)} / ${fPct(model.scenarios.bull.opMargin)} — value driver`],
                ["Normalization note", "45% GM / 25% OM ≈ 2024 profile, not the cocoa-spike-depressed 2025 actual (33.5% / 12.3%)"],
              ],
            },
            {
              title: "Earnings & Dividend",
              color: "var(--purple)",
              rows: [
                ["Net interest", `$${f1(model.netInterest)}B/yr, held flat`],
                ["Tax rate", `${fPct(model.taxRate)} normalized (FY2025 reported 27.3%; 2023–24 ran ~10–15%)`],
                ["Shares", `${f1(model.sharesOut * 1000)}M (Common + Class B), held flat`],
                ["Current dividend", `$${model.dps0.toFixed(2)}/share`],
                ["Dividend policy", "Grows in line with EPS year over year"],
                ["Base / 2026E / 2035E EPS", `$${f1(M.baseEps)} → ${fUsd2(M.rows[0].eps)} → ${fUsd2(M.rows[9].eps)}`],
              ],
            },
            {
              title: "Valuation",
              color: "var(--amber)",
              rows: [
                ["Cash flow", "NOPAT = EBIT × (1 − tax); ≈ FCF (D&A ≈ capex)"],
                ["Default WACC", fPct(model.waccDefault)],
                ["Default terminal growth", fPct(model.termGrowth)],
                ["Gordon multiple (defaults)", f1((1 + model.termGrowth) / (model.waccDefault - model.termGrowth)) + "×"],
                ["Net debt", `$${f1(model.netDebt)}B (FY${model.baseYear}A)`],
                ["Current price", `$${model.currentPrice}`],
                ["Model last updated", model.lastUpdated],
              ],
            },
          ].map(sec => (
            <div key={sec.title} className="assumption-card">
              <div className="assumption-card-title" style={{ color: sec.color }}>{sec.title}</div>
              {sec.rows.map(([k, v]) => (
                <div key={k} className="assumption-row">
                  <div className="assumption-key">{k}</div>
                  <div className="assumption-val">{v}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="disclaimer">
        For informational and educational purposes only · Not investment advice ·
        Value/share = (Σ PV NOPAT + PV terminal − net debt) ÷ shares · dividend grows with EPS ·
        Updated {model.lastUpdated}
      </div>
    </div>
  )
}
