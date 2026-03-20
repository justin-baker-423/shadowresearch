"use client"
import { useState, useMemo } from "react"
import type { ModelConfig, Scenario } from "@/lib/models"
import { runDCF, buildSensitivity } from "@/lib/dcf-engine"

const SC_COLORS: Record<Scenario, { color: string; dim: string }> = {
  bear: { color: "var(--red)",    dim: "var(--red-dim)"    },
  base: { color: "var(--accent)", dim: "var(--accent-dim)" },
  bull: { color: "var(--green)",  dim: "var(--green-dim)"  },
}

function f1(n: number) { return n.toFixed(1) }
function fPct(n: number) { return f1(n * 100) + "%" }
function fB(n: number, curr: string) { return curr + f1(n) + "B" }
function fShare(n: number, curr: string) { return curr + Math.round(n) }

export default function ModelShell({ model, priceSource }: { model: ModelConfig; priceSource?: string }) {
  const curr = model.currency === "EUR" ? "€" : model.currency === "GBP" ? "£" : "$"

  const [sc,    setSc]    = useState<Scenario>("base")
  const [wacc,  setWacc]  = useState(model.waccDefault)
  const [termG, setTermG] = useState(model.termGrowth)
  const [tab,   setTab]   = useState<"model" | "sensitivity" | "assumptions">("model")

  const M    = useMemo(() => runDCF(model, sc, wacc, termG), [model, sc, wacc, termG])
  const SENS = useMemo(() => buildSensitivity(model, sc),     [model, sc])

  const scColors = SC_COLORS[sc]
  const accent   = model.accentColor ?? "var(--accent)"
  const upCol    = M.updown > 0 ? "var(--green)" : "var(--red)"

  // ── KPI data ──────────────────────────────────────────────────
  const kpis = [
    {
      label: "Intrinsic Value / Share",
      value: fShare(M.perShare, curr),
      sub:   `vs ${curr}${model.currentPrice} · ${M.updown > 0 ? "+" : ""}${f1(M.updown)}% implied`,
      color: upCol,
    },
    {
      label: "Enterprise Value",
      value: fB(M.ev, curr),
      sub:   `PV FCFs ${fB(M.sumPvFcf, curr)} · PV TV ${fB(M.pvTv, curr)}`,
      color: "var(--text-1)",
    },
    {
      label: "TV / EV",
      value: f1(M.tvWeight * 100) + "%",
      sub:   "Terminal value weight",
      color: "var(--amber)",
    },
    {
      label: `${model.baseYear + 10}E Revenue`,
      value: fB(M.rows[9].rev, curr),
      sub:   `${f1(M.rows[9].rev / model.baseRevenue)}× ${model.baseYear} base`,
      color: "var(--text-1)",
    },
    {
      label: `${model.baseYear + 10}E FCF Margin`,
      value: fPct(M.rows[9].fcfM),
      sub:   "Post-tax owner earnings",
      color: scColors.color,
    },
    {
      label: `${model.baseYear + 10}E Shares`,
      value: f1(M.rows[9].shares) + "B",
      sub:   `−${f1((1 - M.rows[9].shares / model.sharesOut) * 100)}% vs today`,
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
          <div className="model-header-label">{model.name} · {model.exchange} · DCF Model</div>
        </div>
        <div className="model-subline">
          Base year FY{model.baseYear}A · Revenue {fB(model.baseRevenue, curr)} ·{" "}
          {model.sharesOut}B diluted shares · Net cash {curr}{model.netCash}B · Price ref {curr}{model.currentPrice}{" "}
          {priceSource && (
            <span style={{ color: priceSource.startsWith("Live") ? "var(--green)" : "var(--text-3)", fontWeight: 500 }}>
              ({priceSource})
            </span>
          )}
        </div>
        <div className="model-subline">
          Owner earnings = (Non-IFRS margin − {fPct(model.sbcHaircut)} SBC) × (1 − {fPct(model.taxRate)} tax) ·{" "}
          {fPct(model.buybackRate)}/yr share reduction · WACC {fPct(wacc)} · Terminal g {fPct(termG)}
        </div>
      </div>

      {/* controls */}
      <div className="controls-row">
        {/* scenario */}
        <div className="control-group">
          <div className="section-label">Scenario</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["bear", "base", "bull"] as Scenario[]).map(s => (
              <button
                key={s}
                onClick={() => setSc(s)}
                className={`sc-btn ${sc === s ? `active-${s}` : ""}`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* wacc */}
        <div className="control-group">
          <div className="section-label">WACC: {fPct(wacc)}</div>
          <input
            type="range" min={7} max={14} step={0.5} value={wacc * 100}
            onChange={e => setWacc(Number(e.target.value) / 100)}
            style={{ width: 180, accentColor: scColors.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>7%</span><span>14%</span>
          </div>
        </div>

        {/* terminal growth */}
        <div className="control-group">
          <div className="section-label">Terminal growth: {fPct(termG)}</div>
          <input
            type="range" min={1.5} max={5} step={0.5} value={termG * 100}
            onChange={e => setTermG(Number(e.target.value) / 100)}
            style={{ width: 180, accentColor: scColors.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>1.5%</span><span>5%</span>
          </div>
        </div>

        {/* tabs */}
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
          <div className="section-label">{model.baseYear + 1}–{model.baseYear + 10} Explicit Forecast — {sc.charAt(0).toUpperCase() + sc.slice(1)} Case</div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Revenue</th>
                  <th>Rev Δ</th>
                  <th>Non-IFRS Margin</th>
                  <th>Owner-Earnings Margin</th>
                  <th>FCF Margin</th>
                  <th>FCF</th>
                  <th>PV of FCF</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map((r, i) => {
                  const star = r.year === model.baseYear + 5
                  const p2   = r.year > model.baseYear + 5
                  return (
                    <tr key={r.year} style={{ borderBottom: `1px solid ${star ? scColors.color + "55" : "rgba(37,43,59,0.88)"}` }}>
                      <td style={{ color: star ? scColors.color : p2 ? "var(--purple)" : "var(--text-1)", fontWeight: star ? 700 : 400 }}>
                        {r.year}{star ? " ★" : ""}
                      </td>
                      <td>{fB(r.rev, curr)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fPct(r.revGrowth)}</td>
                      <td style={{ color: scColors.color }}>{fPct(r.niM)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fPct(r.oeM)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fPct(r.fcfM)}</td>
                      <td>{fB(r.fcf, curr)}</td>
                      <td style={{ color: "var(--accent)" }}>{fB(r.pvFcf, curr)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={7} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    Terminal value · g={fPct(termG)} · WACC={fPct(wacc)} · {f1(M.gordon)}× Gordon multiple
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 600 }}>{fB(M.pvTv, curr)}</td>
                </tr>
                <tr className="ev-row">
                  <td colSpan={7} style={{ color: "var(--accent)", fontWeight: 600, textAlign: "left" }}>Enterprise Value</td>
                  <td style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>{fB(M.ev, curr)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* bridge */}
          <div className="bridge-card">
            <div className="section-label">EV → Per-Share Value Bridge</div>
            {[
              ["Enterprise Value",                    fB(M.ev, curr),                              "var(--text-1)"],
              [`(+) Net cash (FY${model.baseYear}A)`, `${curr}${f1(model.netCash)}B`,              "var(--green)" ],
              ["Equity Value",                        fB(M.equity, curr),                          "var(--accent)"],
              ["÷ Shares (post-buyback)",             f1(M.rows[9].shares) + "B",                  "var(--text-2)"],
              ["Intrinsic Value / Share",             fShare(M.perShare, curr),                    scColors.color ],
              ["Current price reference",             `${curr}${model.currentPrice}`,              "var(--text-3)"],
              ["Implied upside / (downside)",         `${M.updown > 0 ? "+" : ""}${f1(M.updown)}%`, upCol        ],
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
              {model.baseYear + 1}–{model.baseYear + 5}: Phase 1 growth
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
            Intrinsic Value / Share ({curr}) — {sc.charAt(0).toUpperCase() + sc.slice(1)} Revenue & Margin Profile
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
                      const cls = val > 220 ? "sens-cell-green" : val > 175 ? "sens-cell-accent" : val > 140 ? "sens-cell-amber" : "sens-cell-red"
                      return (
                        <td key={w} className={`${cls} ${sel ? "sens-cell-selected" : ""}`}
                          style={sel ? { borderColor: scColors.color, color: scColors.color } : {}}>
                          {curr}{val}
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
              ["var(--green)",  "var(--green-dim)",  `>${curr}220 (>26% upside)`],
              ["var(--accent)", "var(--accent-dim)",  `${curr}175–220 (0–26%)`],
              ["var(--amber)",  "var(--amber-dim)",   `${curr}140–175 (−20%–0%)`],
              ["var(--red)",    "var(--red-dim)",     `<${curr}140 (>20% down)`],
            ].map(([col, bg, lbl]) => (
              <div key={lbl} className="sens-legend-item" style={{ color: col }}>
                <span className="sens-legend-swatch" style={{ background: bg, border: `1px solid ${col}66` }} />
                {lbl}
              </div>
            ))}
          </div>

          {/* scenario compare */}
          <div className="section-label" style={{ marginTop: 24 }}>
            All Three Scenarios at {fPct(model.waccDefault)} WACC / {fPct(model.termGrowth)} Terminal Growth
          </div>
          <div className="sc-compare">
            {(["bear", "base", "bull"] as Scenario[]).map(s => {
              const m2  = runDCF(model, s, model.waccDefault, model.termGrowth)
              const mt  = SC_COLORS[s]
              return (
                <div key={s} className="sc-card" style={{ background: mt.dim + "88", border: `1px solid ${mt.color}44` }}>
                  <div className="sc-card-label" style={{ color: mt.color }}>{s.charAt(0).toUpperCase() + s.slice(1)} Case</div>
                  <div className="sc-card-value" style={{ color: mt.color }}>{fShare(m2.perShare, curr)}</div>
                  <div className="sc-card-updown" style={{ color: "var(--text-2)" }}>
                    {m2.updown > 0 ? "+" : ""}{f1(m2.updown)}% vs {curr}{model.currentPrice}
                  </div>
                  <div className="sc-card-stat">2035E Rev: {fB(m2.rows[9].rev, curr)}</div>
                  <div className="sc-card-stat">2035E FCF Margin: {fPct(m2.rows[9].fcfM)}</div>
                  <div className="sc-card-stat">EV: {fB(m2.ev, curr)}</div>
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
              title: "Revenue Model",
              color: "var(--accent)",
              rows: [
                ["Base year", `${model.baseYear}A · ${fB(model.baseRevenue, curr)} total revenue`],
                ["Bear growth (Phase 1)", model.scenarios.bear.revGrowth.slice(0, 5).map(g => fPct(g)).join(" → ")],
                ["Base growth (Phase 1)", model.scenarios.base.revGrowth.slice(0, 5).map(g => fPct(g)).join(" → ")],
                ["Bull growth (Phase 1)", model.scenarios.bull.revGrowth.slice(0, 5).map(g => fPct(g)).join(" → ")],
                ["Phase 2 (2031–2035)", model.scenarios.base.revGrowth.slice(5).map(g => fPct(g)).join(" → ") + " — post-conversion, pricing-led"],
              ],
            },
            {
              title: "Margin Path",
              color: "var(--green)",
              rows: [
                ["Bear margin path (2026→2030)", model.scenarios.bear.niMargin.slice(0, 5).map(m => fPct(m)).join(" → ")],
                ["Base margin path (2026→2030)", model.scenarios.base.niMargin.slice(0, 5).map(m => fPct(m)).join(" → ")],
                ["Bull margin path (2026→2030)", model.scenarios.bull.niMargin.slice(0, 5).map(m => fPct(m)).join(" → ")],
                ["SBC haircut", fPct(model.sbcHaircut) + " deducted from non-IFRS margin to arrive at owner-earnings margin"],
                ["Tax rate", fPct(model.taxRate) + " effective (non-IFRS basis, held constant)"],
                ["FCF approach", "Direct: FCF margin = (Non-IFRS − SBC) × (1 − tax)"],
              ],
            },
            {
              title: "Capital Allocation",
              color: "var(--purple)",
              rows: [
                ["Shares outstanding", model.sharesOut + "B diluted"],
                ["Annual buyback rate", fPct(model.buybackRate) + "/yr share count reduction"],
                [`${model.baseYear + 10}E shares`, f1(runDCF(model, "base", model.waccDefault, model.termGrowth).rows[9].shares) + "B"],
                ["Net cash / (debt)", `${curr}${f1(model.netCash)}B — added to equity value`],
              ],
            },
            {
              title: "Valuation",
              color: "var(--amber)",
              rows: [
                ["Default WACC", fPct(model.waccDefault)],
                ["Default terminal growth", fPct(model.termGrowth)],
                ["Gordon multiple (defaults)", f1((1 + model.termGrowth) / (model.waccDefault - model.termGrowth)) + "×"],
                ["Current price reference", `${curr}${model.currentPrice}/share`],
                ["Currency", model.currency],
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
        For informational and educational purposes only · Not investment advice · All figures in {model.currency} ·
        Owner earnings = (Non-IFRS op. margin − {fPct(model.sbcHaircut)} SBC) × (1 − {fPct(model.taxRate)} tax) ·
        {model.buybackRate * 100}%/yr share reduction · Updated {model.lastUpdated}
      </div>
    </div>
  )
}
