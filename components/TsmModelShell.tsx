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

export default function TsmModelShell({ model, priceSource }: { model: ModelConfig; priceSource?: string }) {
  const curr = "$"
  const accent = model.accentColor ?? "#e31837"

  const [sc,    setSc]    = useState<Scenario>("base")
  const [wacc,  setWacc]  = useState(model.waccDefault)
  const [termG, setTermG] = useState(model.termGrowth)
  const [tab,   setTab]   = useState<"model" | "sensitivity" | "assumptions">("model")

  const M    = useMemo(() => runDCF(model, sc, wacc, termG), [model, sc, wacc, termG])
  const SENS = useMemo(() => buildSensitivity(model, sc),     [model, sc])

  const scColors = SC_COLORS[sc]
  const upCol    = M.updown > 0 ? "var(--green)" : "var(--red)"

  const kpis = [
    {
      label: "Intrinsic Value / ADR",
      value: fShare(M.perShare, curr),
      sub:   `vs ${curr}${model.currentPrice} · ${M.updown > 0 ? "+" : ""}${f1(M.updown)}% implied`,
      color: upCol,
    },
    {
      label: "10-yr Implied CAGR",
      value: `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`,
      sub:   `from ${curr}${model.currentPrice} today`,
      color: upCol,
    },
    {
      label: "Enterprise Value",
      value: fB(M.ev, curr),
      sub:   `PV Earnings ${fB(M.sumPvFcf, curr)} · PV TV ${fB(M.pvTv, curr)}`,
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
      label: `${model.baseYear + 10}E NI Margin`,
      value: fPct(M.rows[9].niM),
      sub:   "Post-tax net income margin",
      color: scColors.color,
    },
    {
      label: "ADRs Outstanding",
      value: f1(model.sharesOut) + "B",
      sub:   "Flat · no buyback program",
      color: "var(--purple)",
    },
  ]

  return (
    <div>
      {/* header */}
      <div className="model-header">
        <div className="model-header-row">
          <div className="model-ticker-badge" style={{ background: accent }}>
            {model.ticker}
          </div>
          <div className="model-header-label">{model.name} · {model.exchange} · DCF Model</div>
        </div>
        <div className="model-subline">
          Base year FY{model.baseYear}A · Revenue {fB(model.baseRevenue, curr)} ·{" "}
          {model.sharesOut}B diluted ADRs (1 ADR = 5 ordinary shares) · Net cash {curr}{model.netCash}B ·{" "}
          Price ref {curr}{model.currentPrice}/ADR{" "}
          {priceSource && (
            <span style={{ color: priceSource.startsWith("Live") ? "var(--green)" : "var(--text-3)", fontWeight: 500 }}>
              ({priceSource})
            </span>
          )}
        </div>
        <div className="model-subline">
          Earnings-based DCF · CapEx treated as durable asset investment, not subtracted from earnings ·{" "}
          Effective tax ~15% embedded in NI margins · Annual dividend $3.80/ADR · WACC {fPct(wacc)} · Terminal g {fPct(termG)}
        </div>
      </div>

      {/* controls */}
      <div className="controls-row">
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
          <div className="section-label">
            {model.baseYear + 1}–{model.baseYear + 10} Explicit Forecast — {sc.charAt(0).toUpperCase() + sc.slice(1)} Case
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Revenue</th>
                  <th>Rev Δ</th>
                  <th>NI Margin</th>
                  <th>Net Income</th>
                  <th>PV of NI</th>
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
                      <td>{fB(r.rev, curr)}</td>
                      <td style={{ color: r.revGrowth < 0 ? "var(--red)" : "var(--text-2)" }}>
                        {fPct(r.revGrowth)}
                      </td>
                      <td style={{ color: scColors.color }}>{fPct(r.niM)}</td>
                      <td>{fB(r.fcf, curr)}</td>
                      <td style={{ color: "var(--accent)" }}>{fB(r.pvFcf, curr)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    Terminal value · g={fPct(termG)} · WACC={fPct(wacc)} · {f1(M.gordon)}× Gordon multiple
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 600 }}>{fB(M.pvTv, curr)}</td>
                </tr>
                <tr className="ev-row">
                  <td colSpan={5} style={{ color: "var(--accent)", fontWeight: 600, textAlign: "left" }}>Enterprise Value</td>
                  <td style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>{fB(M.ev, curr)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* bridge */}
          <div className="bridge-card">
            <div className="section-label">EV → Per-ADR Value Bridge</div>
            {[
              ["Enterprise Value",                    fB(M.ev, curr),                                  "var(--text-1)"],
              [`(+) Net cash (FY${model.baseYear}A)`, `${curr}${f1(model.netCash)}B`,                  "var(--green)" ],
              ["Equity Value",                        fB(M.equity, curr),                              "var(--accent)"],
              ["÷ ADRs outstanding",                  f1(model.sharesOut) + "B (flat — no buybacks)",  "var(--text-2)"],
              ["Intrinsic Value / ADR",               fShare(M.perShare, curr),                        scColors.color ],
              ["Current price reference",             `${curr}${model.currentPrice}/ADR`,              "var(--text-3)"],
              ["Implied upside / (downside)",         `${M.updown > 0 ? "+" : ""}${f1(M.updown)}%`,   upCol          ],
              ["10-yr implied CAGR",                  `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`, upCol],
            ].map(([k, v, col]) => (
              <div key={k} className="bridge-row">
                <span className="bridge-label">{k}</span>
                <span className="bridge-value" style={{ color: col }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="phase-legend">
            <div className="phase-item">
              <span className="phase-dot" style={{ background: scColors.color + "33", border: `1px solid ${scColors.color}66` }} />
              {model.baseYear + 1}–{model.baseYear + 5}: Peak growth + cyclical downturn
            </div>
            <div className="phase-item">
              <span className="phase-dot" style={{ background: "var(--purple-dim)", border: "1px solid rgba(167,139,250,.4)" }} />
              {model.baseYear + 6}–{model.baseYear + 10}: 17%/yr steady-state recovery
            </div>
            <span style={{ fontSize: 11, color: scColors.color }}>★ = mid-period milestone year</span>
          </div>
        </div>
      )}

      {/* ── SENSITIVITY TAB ── */}
      {tab === "sensitivity" && (
        <div>
          <div className="section-label">
            Intrinsic Value / ADR ({curr}) — {sc.charAt(0).toUpperCase() + sc.slice(1)} Revenue & NI Margin Profile
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
              ["var(--green)",  "var(--green-dim)",  `>${curr}${Math.round(model.currentPrice * 1.3)} (>30% upside)`],
              ["var(--accent)", "var(--accent-dim)", `${curr}${Math.round(model.currentPrice)}–${curr}${Math.round(model.currentPrice * 1.3)} (0–30%)`],
              ["var(--amber)",  "var(--amber-dim)",  `${curr}${Math.round(model.currentPrice * 0.7)}–${curr}${Math.round(model.currentPrice)} (−30%–0%)`],
              ["var(--red)",    "var(--red-dim)",    `<${curr}${Math.round(model.currentPrice * 0.7)} (>30% down)`],
            ].map(([col, bg, lbl]) => (
              <div key={lbl} className="sens-legend-item" style={{ color: col }}>
                <span className="sens-legend-swatch" style={{ background: bg, border: `1px solid ${col}66` }} />
                {lbl}
              </div>
            ))}
          </div>

          <div className="section-label" style={{ marginTop: 24 }}>
            All Three Scenarios at {fPct(model.waccDefault)} WACC / {fPct(model.termGrowth)} Terminal Growth
          </div>
          <div className="sc-compare">
            {(["bear", "base", "bull"] as Scenario[]).map(s => {
              const m2 = runDCF(model, s, model.waccDefault, model.termGrowth)
              const mt = SC_COLORS[s]
              return (
                <div key={s} className="sc-card" style={{ background: mt.dim + "88", border: `1px solid ${mt.color}44` }}>
                  <div className="sc-card-label" style={{ color: mt.color }}>{s.charAt(0).toUpperCase() + s.slice(1)} Case</div>
                  <div className="sc-card-value" style={{ color: mt.color }}>{fShare(m2.perShare, curr)}</div>
                  <div className="sc-card-updown" style={{ color: "var(--text-2)" }}>
                    {m2.updown > 0 ? "+" : ""}{f1(m2.updown)}% vs {curr}{model.currentPrice}
                  </div>
                  <div className="sc-card-stat">2035E Rev: {fB(m2.rows[9].rev, curr)}</div>
                  <div className="sc-card-stat">2035E NI Margin: {fPct(m2.rows[9].niM)}</div>
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
                ["Base year",            "FY2025A · $121.4B · Q1 2026A $35.9B (+35% YoY · +6% QoQ)"],
                ["Q2 2026 guidance",     "$39.0–40.2B · GM 65.5–67.5% · OM 56.5–58.5%"],
                ["Node mix (Q1 2026A)",  "3nm 25% · 5nm 36% · 7nm 13% · Advanced (7nm+) 74%"],
                ["Bear growth 2026–29",  model.scenarios.bear.revGrowth.slice(0, 4).map(g => fPct(g)).join(" → ") + " (deeper cycle)"],
                ["Base growth 2026–29",  model.scenarios.base.revGrowth.slice(0, 4).map(g => fPct(g)).join(" → ") + " (two down years)"],
                ["Bull growth 2026–29",  model.scenarios.bull.revGrowth.slice(0, 4).map(g => fPct(g)).join(" → ") + " (shallower cycle)"],
                ["Recovery 2030–35",     "17%/yr all scenarios · AI/HPC demand + node breadth expansion"],
              ],
            },
            {
              title: "Net Income Margins",
              color: "var(--green)",
              rows: [
                ["Methodology",         "Earnings-based DCF · CapEx treated as value-creating fab investment"],
                ["Rationale",           "TSMC's CapEx builds durable leading-edge capacity worth > GAAP depreciation implies"],
                ["NI derivation",       "OM × (1 − ~15% tax) + interest income · Q1 2026A: OM 58% → NI ~50%"],
                ["Effective tax rate",  "~15% embedded · TSMC benefits from Taiwan R&D tax incentives"],
                ["CapEx (reference)",   "~30% of revenue · 2026 guidance $52–56B · 3nm/2nm capacity buildout"],
                ["Bear NI margins",     model.scenarios.bear.niMargin.slice(0, 5).map(m => fPct(m)).join(" → ") + " → " + fPct(model.scenarios.bear.niMargin[9]) + " (2035E)"],
                ["Base NI margins",     model.scenarios.base.niMargin.slice(0, 5).map(m => fPct(m)).join(" → ") + " → " + fPct(model.scenarios.base.niMargin[9]) + " (2035E)"],
                ["Bull NI margins",     model.scenarios.bull.niMargin.slice(0, 5).map(m => fPct(m)).join(" → ") + " → " + fPct(model.scenarios.bull.niMargin[9]) + " (2035E)"],
                ["Implied GM (base)",   "Peak ~66% (Q1 2026A: 66.2%) · trough ~54–55% · recovery mid-60s"],
                ["Implied GM (bull)",   "Peak ~68% · trough ~57% · recovery high-60s"],
              ],
            },
            {
              title: "Capital Structure",
              color: "var(--purple)",
              rows: [
                ["ADR structure",       "5.19B diluted ADRs · 1 ADR = 5 ordinary shares · 25.93B ordinary total"],
                ["No buyback program",  "TSMC returns capital exclusively via dividends"],
                ["Annual dividend",     "$3.80/ADR ($0.95/quarter) · ~0.9% yield at $416 · grows with revenue"],
                ["Balance sheet",       "Cash $99.7B · Debt $28.5B · Net cash $71.1B (FY2025A)"],
                ["Shares (all years)",  f1(model.sharesOut) + "B flat · no dilution or repurchase modeled"],
              ],
            },
            {
              title: "Valuation",
              color: "var(--amber)",
              rows: [
                ["Default WACC",            fPct(model.waccDefault) + " · reflects Taiwan geopolitical + currency risk vs US tech"],
                ["Default terminal growth", fPct(model.termGrowth)],
                ["Gordon multiple",         f1((1 + model.termGrowth) / (model.waccDefault - model.termGrowth)) + "× at default WACC/g"],
                ["Current price ref",       `${curr}${model.currentPrice}/ADR · ~$2.16T market cap · ~36× TTM P/E`],
                ["Currency",                "USD (TSMC reports financials in both USD and TWD)"],
                ["FX assumption",           "1 USD = 31.7 TWD (Q2 2026 guidance basis)"],
                ["Model last updated",      model.lastUpdated],
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
        For informational and educational purposes only · Not investment advice · All figures USD ·
        Earnings-based DCF · CapEx treated as durable asset investment · No buyback modeled ·
        $3.80/ADR annual dividend · 5.19B ADRs (1 ADR = 5 ordinary shares) · Updated {model.lastUpdated}
      </div>
    </div>
  )
}
