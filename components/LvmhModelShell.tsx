"use client"
import { useState, useMemo } from "react"
import type { LvmhModelConfig, LvmhScenario } from "@/lib/lvmh-models"
import { runLvmhDCF, buildLvmhSensitivity } from "@/lib/lvmh-engine"

const SC_COLORS: Record<LvmhScenario, { color: string; dim: string }> = {
  bear: { color: "var(--red)",    dim: "var(--red-dim)"    },
  base: { color: "var(--accent)", dim: "var(--accent-dim)" },
  bull: { color: "var(--green)",  dim: "var(--green-dim)"  },
}

function f1(n: number) { return n.toFixed(1) }
function fPct(n: number) { return f1(n * 100) + "%" }
function fEur(n: number) { return "€" + f1(n) + "B" }
function fUsd2(n: number) { return "$" + n.toFixed(2) }

export default function LvmhModelShell({ model, priceSource, fx }: {
  model: LvmhModelConfig; priceSource?: string; fx: number
}) {
  const [sc,    setSc]    = useState<LvmhScenario>("base")
  const [wacc,  setWacc]  = useState(model.waccDefault)
  const [termG, setTermG] = useState(model.termGrowth)
  const [tab,   setTab]   = useState<"model" | "sensitivity" | "assumptions">("model")

  const M    = useMemo(() => runLvmhDCF(model, sc, wacc, termG, fx), [model, sc, wacc, termG, fx])
  const SENS = useMemo(() => buildLvmhSensitivity(model, sc, fx),     [model, sc, fx])

  const scColors = SC_COLORS[sc]
  const accent   = model.accentColor ?? "var(--accent)"
  const upCol    = M.updown > 0 ? "var(--green)" : "var(--red)"

  const kpis = [
    {
      label: "Intrinsic Value / ADR",
      value: fUsd2(M.perShare),
      sub:   `vs $${model.currentPrice} · ${M.updown > 0 ? "+" : ""}${f1(M.updown)}% implied`,
      color: upCol,
    },
    {
      label: "10-yr Implied CAGR",
      value: `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`,
      sub:   `from $${model.currentPrice} today`,
      color: upCol,
    },
    {
      label: "Earnings DCF Value",
      value: fEur(M.earningsValue),
      sub:   `PV earnings ${fEur(M.sumPvEarn)} · PV TV ${fEur(M.pvTv)}`,
      color: "var(--text-1)",
    },
    {
      label: "Intrinsic Equity Value",
      value: fEur(M.equity),
      sub:   `€${Math.round(M.perOrdinaryEur)}/ordinary share`,
      color: scColors.color,
    },
    {
      label: `${model.baseYear + 10}E Revenue`,
      value: fEur(M.rows[9].rev),
      sub:   `${f1(M.rows[9].rev / model.baseRevenue)}× ${model.baseYear} base`,
      color: "var(--text-1)",
    },
    {
      label: "ADR Dividend Yield",
      value: fPct(M.divYieldAdr),
      sub:   `€${f1(model.dps)}/share × FX ÷ ${model.adrPerShare}`,
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
          <div className="model-header-label">{model.name} · {model.exchange} · Earnings DCF (ADR)</div>
        </div>
        <div className="model-subline">
          Base year FY{model.baseYear}A · Revenue {fEur(model.baseRevenue)} · Net income {fEur(model.baseEarnings)} ·{" "}
          {f1(model.sharesOut * 1000)}M ordinary shares ·{" "}
          Price ref ${model.currentPrice}{" "}
          {priceSource && (
            <span style={{ color: priceSource.startsWith("Live") ? "var(--green)" : "var(--text-3)", fontWeight: 500 }}>
              ({priceSource})
            </span>
          )}
        </div>
        <div className="model-subline">
          ADR bridge: IV per ordinary share (€) × EUR/USD {fx.toFixed(4)} ÷ {model.adrPerShare} ADRs/share ·{" "}
          Earnings = revenue × net margin (accretive price → net margin expands {fPct(M.rows[0].niM)}→{fPct(M.rows[9].niM)}) ·{" "}
          WACC {fPct(wacc)} · Terminal g {fPct(termG)}
        </div>
      </div>

      {/* controls */}
      <div className="controls-row">
        <div className="control-group">
          <div className="section-label">Scenario</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["bear", "base", "bull"] as LvmhScenario[]).map(s => (
              <button key={s} onClick={() => setSc(s)} className={`sc-btn ${sc === s ? `active-${s}` : ""}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
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
          <div className="section-label">{model.baseYear + 1}–{model.baseYear + 10} Explicit Forecast — {sc.charAt(0).toUpperCase() + sc.slice(1)} Case (€)</div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Revenue</th>
                  <th>Rev Δ</th>
                  <th>Net Margin</th>
                  <th>Net Income</th>
                  <th>PV of Earnings</th>
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
                      <td>{fEur(r.rev)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fPct(r.revGrowth)}</td>
                      <td style={{ color: scColors.color }}>{fPct(r.niM)}</td>
                      <td>{fEur(r.earnings)}</td>
                      <td style={{ color: "var(--accent)" }}>{fEur(r.pvEarn)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    Terminal value · g={fPct(termG)} · WACC={fPct(wacc)} · {f1(M.gordon)}× Gordon multiple
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 600 }}>{fEur(M.pvTv)}</td>
                </tr>
                <tr className="ev-row">
                  <td colSpan={5} style={{ color: "var(--accent)", fontWeight: 600, textAlign: "left" }}>Earnings DCF Value (PV earnings + PV TV)</td>
                  <td style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>{fEur(M.earningsValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* bridge */}
          <div className="bridge-card">
            <div className="section-label">Value Bridge → Per-ADR (USD)</div>
            {[
              ["Earnings DCF value (€)",              fEur(M.earningsValue),                       "var(--text-1)"],
              [`(+) Net cash / (debt) (FY${model.baseYear}A)`, `€${f1(M.netCash)}B`,               M.netCash >= 0 ? "var(--green)" : "var(--red)"],
              ["(=) Intrinsic equity value (€)",      fEur(M.equity),                              "var(--accent)"],
              [`÷ Ordinary shares (${f1(model.sharesOut * 1000)}M)`, `€${Math.round(M.perOrdinaryEur)}`, "var(--text-2)"],
              ["IV per ordinary share (€)",           `€${Math.round(M.perOrdinaryEur)}`,          "var(--text-1)"],
              [`× EUR/USD ${fx.toFixed(4)} ÷ ${model.adrPerShare} ADRs`, fUsd2(M.perShare),         scColors.color ],
              ["Intrinsic Value / ADR (LVMUY)",       fUsd2(M.perShare),                           scColors.color ],
              ["Current ADR price",                   `$${model.currentPrice}`,                    "var(--text-3)"],
              ["Implied upside / (downside)",         `${M.updown > 0 ? "+" : ""}${f1(M.updown)}%`, upCol        ],
              ["10-yr implied CAGR",                  `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`, upCol ],
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
            Intrinsic Value / ADR ($) — {sc.charAt(0).toUpperCase() + sc.slice(1)} Case
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
            {(["bear", "base", "bull"] as LvmhScenario[]).map(s => {
              const m2 = runLvmhDCF(model, s, model.waccDefault, model.termGrowth, fx)
              const mt = SC_COLORS[s]
              return (
                <div key={s} className="sc-card" style={{ background: mt.dim + "88", border: `1px solid ${mt.color}44` }}>
                  <div className="sc-card-label" style={{ color: mt.color }}>{s.charAt(0).toUpperCase() + s.slice(1)} Case</div>
                  <div className="sc-card-value" style={{ color: mt.color }}>{fUsd2(m2.perShare)}</div>
                  <div className="sc-card-updown" style={{ color: "var(--text-2)" }}>
                    {m2.updown > 0 ? "+" : ""}{f1(m2.updown)}% vs ${model.currentPrice}
                  </div>
                  <div className="sc-card-stat">2035E Rev: {fEur(m2.rows[9].rev)}</div>
                  <div className="sc-card-stat">2035E Net Margin: {fPct(m2.rows[9].niM)}</div>
                  <div className="sc-card-stat">Equity IV: {fEur(m2.equity)}</div>
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
              title: "Earnings Engine",
              color: "var(--accent)",
              rows: [
                ["Base year", `${model.baseYear}A · ${fEur(model.baseRevenue)} revenue · ${fEur(model.baseEarnings)} net income`],
                ["Organic growth thesis", "8% = 1% volume (corporate margin) + 7% price"],
                ["Price treatment", `Accretive — beats cost inflation → net margin expands ${fPct(M.rows[0].niM)} → ${fPct(M.rows[9].niM)} over the period`],
                ["Bear growth", model.scenarios.bear.revGrowth.slice(0, 5).map(g => fPct(g)).join(" → ") + " …"],
                ["Base growth", model.scenarios.base.revGrowth.slice(0, 5).map(g => fPct(g)).join(" → ") + " …"],
                ["Bull growth", model.scenarios.bull.revGrowth.slice(0, 5).map(g => fPct(g)).join(" → ") + " …"],
              ],
            },
            {
              title: "ADR Conversion",
              color: "var(--purple)",
              rows: [
                ["ADR", `${model.ticker} · 1 ADR = 1/${model.adrPerShare} ordinary MC.PA share`],
                ["EUR/USD", fx.toFixed(4) + " (live)"],
                ["Bridge", `IV/ordinary (€) × ${fx.toFixed(4)} ÷ ${model.adrPerShare} = IV/ADR ($)`],
                ["Ordinary shares", f1(model.sharesOut * 1000) + "M"],
                ["Trailing DPS", `€${f1(model.dps)}/ordinary → $${(model.dps * fx / model.adrPerShare).toFixed(2)}/ADR`],
              ],
            },
            {
              title: "Valuation",
              color: "var(--amber)",
              rows: [
                ["Default WACC", fPct(model.waccDefault)],
                ["Default terminal growth", fPct(model.termGrowth)],
                ["Gordon multiple (defaults)", f1((1 + model.termGrowth) / (model.waccDefault - model.termGrowth)) + "×"],
                ["Net cash / (debt)", fEur(model.netCash)],
                ["Current ADR price", `$${model.currentPrice}`],
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
        For informational and educational purposes only · Not investment advice · Earnings in EUR, value per ADR in USD ·
        IV/ADR = (earnings DCF + net cash) ÷ ordinary shares × EUR/USD ÷ {model.adrPerShare} ·
        Updated {model.lastUpdated}
      </div>
    </div>
  )
}
