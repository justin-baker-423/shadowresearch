"use client"
import { useState, useMemo } from "react"
import type { TeslaModelConfig } from "@/lib/tesla-models"
import { runTeslaDCF, buildTeslaSensitivity } from "@/lib/tesla-engine"

// ── Formatters ─────────────────────────────────────────────────
function f1(n: number) { return n.toFixed(1) }
function fPct(n: number) { return f1(n * 100) + "%" }
// Auto-scales $B to $T for values ≥ $1,000 B
function fB(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1000) return "$" + (n / 1000).toFixed(1) + "T"
  return "$" + n.toFixed(1) + "B"
}
function fShare(n: number): string { return "$" + Math.round(n).toLocaleString() }

// Price-relative sensitivity cell colour (same logic as MetaModelShell)
function sensColor(val: number, currentPrice: number): string {
  const r = val / currentPrice
  if (r >= 1.3) return "sens-cell-green"
  if (r >= 1.0) return "sens-cell-accent"
  if (r >= 0.7) return "sens-cell-amber"
  return "sens-cell-red"
}

export default function TeslaModelShell({
  model,
  priceSource,
}: {
  model: TeslaModelConfig
  priceSource?: string
}) {
  const [wacc,  setWacc]  = useState(model.waccDefault)
  const [termG, setTermG] = useState(model.termGrowth)
  const [tab,   setTab]   = useState<"model" | "segments" | "sensitivity" | "assumptions">("model")

  const M    = useMemo(() => runTeslaDCF(model, wacc, termG),   [model, wacc, termG])
  const SENS = useMemo(() => buildTeslaSensitivity(model),       [model])

  const accent = model.accentColor ?? "var(--accent)"
  const upCol  = M.updown > 0 ? "var(--green)" : "var(--red)"

  // ── KPI data ────────────────────────────────────────────────
  const kpis = [
    {
      label: "Intrinsic Value / Share",
      value: fShare(M.perShare),
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
      label: "Enterprise Value",
      value: fB(M.ev),
      sub:   `PV FCFs ${fB(M.sumPvFcf)} · PV TV ${fB(M.pvTv)}`,
      color: "var(--text-1)",
    },
    {
      label: "TV / EV",
      value: f1(M.tvWeight * 100) + "%",
      sub:   "Terminal value weight",
      color: "var(--amber)",
    },
    {
      label: "2035E Revenue",
      value: fB(M.rows[9].totalRev),
      sub:   `${f1(M.rows[9].totalRev / 107.0)}× FY2025 base`,
      color: "var(--text-1)",
    },
    {
      label: "2035E FCF",
      value: fB(M.rows[9].fcf),
      sub:   `${fPct(M.rows[9].fcf / M.rows[9].totalRev)} FCF margin`,
      color: "var(--green)",
    },
  ]

  return (
    <div>
      {/* header */}
      <div className="model-header">
        <div className="model-header-row">
          <div className="model-ticker-badge" style={{ background: "#cc0000" }}>
            {model.ticker}
          </div>
          <div className="model-header-label">
            {model.name} · {model.exchange} · DCF Model
          </div>
        </div>
        <div className="model-subline">
          Base year FY{model.baseYear}A · {model.sharesOut}B diluted shares (constant) ·
          Terminal net cash ${model.terminalNetCash.toLocaleString()}B (FY2035 projected) ·
          Price ref ${model.currentPrice}{" "}
          {priceSource && (
            <span style={{ color: priceSource.startsWith("Live") ? "var(--green)" : "var(--text-3)", fontWeight: 500 }}>
              ({priceSource})
            </span>
          )}
        </div>
        <div className="model-subline">
          Multi-segment bull case · 6 segments: Core Auto, Energy &amp; Services, Cybercab, FSD OEM, FSD Tesla Owners, PVN ·
          WACC {fPct(wacc)} · Terminal g {fPct(termG)}
        </div>
      </div>

      {/* controls — no scenario buttons (single scenario) */}
      <div className="controls-row">
        <div className="control-group">
          <div className="section-label">WACC: {fPct(wacc)}</div>
          <input
            type="range" min={7} max={15} step={0.5} value={wacc * 100}
            onChange={e => setWacc(Number(e.target.value) / 100)}
            style={{ width: 180, accentColor: accent }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>7%</span><span>15%</span>
          </div>
        </div>

        <div className="control-group">
          <div className="section-label">Terminal growth: {fPct(termG)}</div>
          <input
            type="range" min={1.5} max={5} step={0.5} value={termG * 100}
            onChange={e => setTermG(Number(e.target.value) / 100)}
            style={{ width: 180, accentColor: accent }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>1.5%</span><span>5%</span>
          </div>
        </div>

        <div className="control-group">
          <div className="section-label">View</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["model", "segments", "sensitivity", "assumptions"] as const).map(t => (
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
          <div className="section-label">FY2026–2035 Consolidated Forecast — Bull Case</div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Total Revenue</th>
                  <th>Rev Δ</th>
                  <th>EBIT</th>
                  <th>EBIT Margin</th>
                  <th>FCF</th>
                  <th>PV of FCF</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => {
                  const isPhase2  = r.year >= 2031
                  const isMile    = r.year === 2031
                  const fcfNeg    = r.fcf < 0
                  return (
                    <tr key={r.year} style={{ borderBottom: `1px solid ${isMile ? accent + "55" : "rgba(37,43,59,0.88)"}` }}>
                      <td style={{ color: isMile ? accent : isPhase2 ? "var(--purple)" : "var(--text-1)", fontWeight: isMile ? 700 : 400 }}>
                        {r.year}{isMile ? " ★" : ""}
                      </td>
                      <td>{fB(r.totalRev)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fPct(r.revGrowth)}</td>
                      <td style={{ color: accent }}>{fB(r.ebit)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fPct(r.ebitMargin)}</td>
                      <td style={{ color: fcfNeg ? "var(--red)" : "var(--text-1)", fontWeight: fcfNeg ? 600 : 400 }}>
                        {fcfNeg ? `(${fB(Math.abs(r.fcf))})` : fB(r.fcf)}
                      </td>
                      <td style={{ color: fcfNeg ? "var(--red-dim)" : "var(--accent)" }}>
                        {fcfNeg ? `(${fB(Math.abs(r.pvFcf))})` : fB(r.pvFcf)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    Terminal value · g={fPct(termG)} · WACC={fPct(wacc)} · {f1(M.gordon)}× Gordon multiple
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 600 }}>{fB(M.pvTv)}</td>
                </tr>
                <tr className="ev-row">
                  <td colSpan={6} style={{ color: "var(--accent)", fontWeight: 600, textAlign: "left" }}>Enterprise Value</td>
                  <td style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>{fB(M.ev)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* bridge */}
          <div className="bridge-card">
            <div className="section-label">EV → Per-Share Value Bridge</div>
            {[
              ["Enterprise Value",                   fB(M.ev),                                         "var(--text-1)"],
              ["(+) Terminal net cash (FY2035E)",     fB(model.terminalNetCash),                        "var(--green)" ],
              ["Equity Value",                        fB(M.equity),                                     "var(--accent)"],
              ["÷ Diluted shares",                    model.sharesOut + "B",                            "var(--text-2)"],
              ["Intrinsic Value / Share",             fShare(M.perShare),                               accent         ],
              ["Current price reference",             `$${model.currentPrice}`,                         "var(--text-3)"],
              ["Implied upside / (downside)",         `${M.updown > 0 ? "+" : ""}${f1(M.updown)}%`,    upCol          ],
              ["10-yr implied CAGR",                  `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`, upCol],
            ].map(([k, v, col]) => (
              <div key={k} className="bridge-row">
                <span className="bridge-label">{k}</span>
                <span className="bridge-value" style={{ color: col }}>{v}</span>
              </div>
            ))}
          </div>

          {/* phase legend */}
          <div className="phase-legend">
            <div className="phase-item">
              <span className="phase-dot" style={{ background: "var(--red-dim)", border: "1px solid rgba(248,113,113,.4)" }} />
              2026–2027: Investment / ramp · near-zero or negative FCF
            </div>
            <div className="phase-item">
              <span className="phase-dot" style={{ background: accent + "22", border: `1px solid ${accent}55` }} />
              2028–2030: Cybercab inflection · FCF acceleration
            </div>
            <div className="phase-item">
              <span className="phase-dot" style={{ background: "var(--purple-dim)", border: "1px solid rgba(167,139,250,.4)" }} />
              2031–2035: Fleet saturation · terminal approach
            </div>
            <span style={{ fontSize: 11, color: accent }}>★ = Phase 3 start (2031)</span>
          </div>
        </div>
      )}

      {/* ── SEGMENTS TAB ── */}
      {tab === "segments" && (
        <div>
          <div className="section-label">FY2026–2035 Revenue by Segment ($B)</div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th style={{ color: "var(--text-2)" }}>Core Auto</th>
                  <th style={{ color: "var(--text-2)" }}>Energy</th>
                  <th style={{ color: accent }}>Cybercab</th>
                  <th style={{ color: "var(--green)" }}>FSD OEM</th>
                  <th style={{ color: "var(--green)" }}>FSD Tesla</th>
                  <th style={{ color: "var(--purple)" }}>PVN</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => (
                  <tr key={r.year}>
                    <td style={{ color: "var(--text-1)" }}>{r.year}</td>
                    <td style={{ color: "var(--text-2)" }}>{r.coreAutoRev > 0 ? fB(r.coreAutoRev) : "—"}</td>
                    <td style={{ color: "var(--text-2)" }}>{r.energyRev > 0 ? fB(r.energyRev) : "—"}</td>
                    <td style={{ color: r.cybercabRev > 0 ? accent : "var(--text-3)" }}>
                      {r.cybercabRev > 0 ? fB(r.cybercabRev) : "—"}
                    </td>
                    <td style={{ color: r.fsdOemRev > 0 ? "var(--green)" : "var(--text-3)" }}>
                      {r.fsdOemRev > 0 ? fB(r.fsdOemRev) : "—"}
                    </td>
                    <td style={{ color: r.fsdTeslaRev > 0 ? "var(--green)" : "var(--text-3)" }}>
                      {r.fsdTeslaRev > 0 ? fB(r.fsdTeslaRev) : "—"}
                    </td>
                    <td style={{ color: r.pvnRev > 0 ? "var(--purple)" : "var(--text-3)" }}>
                      {r.pvnRev > 0 ? fB(r.pvnRev) : "—"}
                    </td>
                    <td style={{ fontWeight: 600 }}>{fB(r.totalRev)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Segment assumptions reference */}
          <div className="assumptions-grid" style={{ marginTop: 20 }}>
            {[
              {
                title: "Segment EBIT Margins",
                color: "var(--accent)",
                rows: [
                  ["Core Automotive", `${fPct(model.ebitMargins.coreAuto)} — factory/vehicle economics`],
                  ["Energy & Services", `${fPct(model.ebitMargins.energy)} — storage + solar + services`],
                  ["Cybercab", `${fPct(model.ebitMargins.cybercab)} — (Rev − $0.20 opex − $0.075 D&A) / Rev per mile`],
                  ["FSD OEM Licensing", `${fPct(model.ebitMargins.fsdOem)} — high-margin SaaS-like revenue`],
                  ["FSD Tesla Owners", `${fPct(model.ebitMargins.fsdTeslaOwners)} — subscription on cumulative fleet`],
                  ["PVN", `${fPct(model.ebitMargins.pvn)} — platform take-rate (est.)`],
                ],
              },
              {
                title: "Cybercab Fleet Economics",
                color: accent,
                rows: [
                  ["Revenue per mile", "$1.75 / mile"],
                  ["Variable opex per mile", "$0.20 / mile"],
                  ["Vehicle cost", "$30,000 / unit"],
                  ["Vehicle useful life", "400,000 miles → 2.67 yr at 150K mi/yr"],
                  ["Miles per vehicle per year", "150,000 mi/yr (active fleet)"],
                  ["Fleet activation lag", "Produced in year t → operational in year t+1"],
                ],
              },
              {
                title: "FSD Monetisation",
                color: "var(--green)",
                rows: [
                  ["FSD OEM base", "$150/mo per licensed vehicle"],
                  ["FSD Tesla Owners base", "$100/mo per subscribed vehicle"],
                  ["Revenue source", "Pre-computed from penetration ramp (see Excel)"],
                  ["FSD OEM EBIT margin", `${fPct(model.ebitMargins.fsdOem)}`],
                  ["FSD Tesla Owners EBIT margin", `${fPct(model.ebitMargins.fsdTeslaOwners)}`],
                ],
              },
              {
                title: "Valuation",
                color: "var(--purple)",
                rows: [
                  ["Default WACC", fPct(model.waccDefault)],
                  ["Default terminal growth", fPct(model.termGrowth)],
                  ["Gordon multiple (defaults)", f1((1 + model.termGrowth) / (model.waccDefault - model.termGrowth)) + "×"],
                  ["Terminal net cash", `$${model.terminalNetCash.toLocaleString()}B (accumulated FY2035E)`],
                  ["Current price reference", `$${model.currentPrice}/share`],
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
        </div>
      )}

      {/* ── SENSITIVITY TAB ── */}
      {tab === "sensitivity" && (
        <div>
          <div className="section-label">Intrinsic Value / Share ($) — Bull Case</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            Rows = terminal growth · Columns = WACC · Highlighted = current sliders
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="sens-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Term g ↓ / WACC →</th>
                  {SENS.waccs.map(w => (
                    <th key={w} style={{ color: Math.abs(w - wacc) < 0.001 ? accent : "var(--text-3)", fontWeight: Math.abs(w - wacc) < 0.001 ? 700 : 400 }}>
                      {fPct(w)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SENS.tgrows.map((tg, ri) => (
                  <tr key={tg}>
                    <td style={{ color: Math.abs(tg - termG) < 0.001 ? accent : "var(--text-2)", fontWeight: Math.abs(tg - termG) < 0.001 ? 700 : 400 }}>
                      {fPct(tg)}
                    </td>
                    {SENS.waccs.map((w, ci) => {
                      const val = SENS.grid[ri][ci]
                      const sel = Math.abs(w - wacc) < 0.001 && Math.abs(tg - termG) < 0.001
                      const cls = sensColor(val, model.currentPrice)
                      return (
                        <td key={w} className={`${cls} ${sel ? "sens-cell-selected" : ""}`}
                          style={sel ? { borderColor: accent, color: accent } : {}}>
                          ${val.toLocaleString()}
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
              ["var(--green)",  "var(--green-dim)",  `>$${Math.round(model.currentPrice * 1.3).toLocaleString()} (>30% upside)`],
              ["var(--accent)", "var(--accent-dim)", `$${Math.round(model.currentPrice).toLocaleString()}–$${Math.round(model.currentPrice * 1.3).toLocaleString()} (0–30%)`],
              ["var(--amber)",  "var(--amber-dim)",  `$${Math.round(model.currentPrice * 0.7).toLocaleString()}–$${Math.round(model.currentPrice).toLocaleString()} (−30%–0%)`],
              ["var(--red)",    "var(--red-dim)",    `<$${Math.round(model.currentPrice * 0.7).toLocaleString()} (>30% down)`],
            ].map(([col, bg, lbl]) => (
              <div key={lbl} className="sens-legend-item" style={{ color: col }}>
                <span className="sens-legend-swatch" style={{ background: bg, border: `1px solid ${col}66` }} />
                {lbl}
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, padding: "12px 16px", background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, color: "var(--text-2)" }}>
            <strong style={{ color: "var(--amber)" }}>Note:</strong> All cells assume the same FCF schedule
            (bull case). Sensitivity reflects WACC and terminal growth assumptions only.
            Terminal net cash of ${model.terminalNetCash.toLocaleString()}B is constant across all cells.
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
                ["Core Auto FY2025 base",    "$97B, growing 7%/yr"],
                ["Energy FY2025 base",       "$10B, growing 15%/yr"],
                ["Cybercab",                 "Fleet ramp: 200K→500K→1M→1.5M/yr; $1.75/mi; 150K mi/yr/vehicle; 3-yr active life"],
                ["FSD OEM",                  "$150/mo licensing; penetration ramp to 75% of US sales by 2035; 82% EBIT margin"],
                ["FSD Tesla Owners",         "$100/mo subscription; 90% penetration of cumulative fleet; 88% EBIT margin"],
                ["PVN",                      "Personal Vehicle Network; take-rate ramps 5% (2030) → 30% (2035)"],
              ],
            },
            {
              title: "FCF Framework",
              color: "var(--green)",
              rows: [
                ["FCF source",               "Pre-computed from Excel Consolidated DCF sheet"],
                ["FY2026–2027",              "Near-zero / negative (investment ramp, fleet capex)"],
                ["FY2028–2030",              "Cybercab inflection; FCF accelerates sharply"],
                ["FY2031–2035",              "Fleet saturation; FCF plateaus toward terminal"],
                ["Terminal FCF (FY2035)",    fB(model.fcfSchedule[9])],
                ["Tax rate",                 fPct(model.taxRate)],
              ],
            },
            {
              title: "Equity Bridge",
              color: "var(--amber)",
              rows: [
                ["Diluted shares",           model.sharesOut + "B (constant — no buybacks in model)"],
                ["Terminal net cash",        `$${model.terminalNetCash.toLocaleString()}B — FY2035E accumulated cash`],
                ["Bridge convention",        "Equity = EV + terminal net cash (mirrors Excel model)"],
                ["Starting cash (FY2025)",   "$33B"],
                ["Debt raise assumption",    "$20B at 5% (in Excel model)"],
              ],
            },
            {
              title: "Valuation",
              color: "var(--purple)",
              rows: [
                ["Default WACC",             fPct(model.waccDefault)],
                ["Default terminal growth",  fPct(model.termGrowth)],
                ["Gordon multiple (defaults)", f1((1 + model.termGrowth) / (model.waccDefault - model.termGrowth)) + "×"],
                ["Current price reference",  `$${model.currentPrice}/share`],
                ["Scenario",                 "Single scenario (bull case from Excel model)"],
                ["Model last updated",       model.lastUpdated],
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
        For informational and educational purposes only · Not investment advice · All figures in USD ·
        Bull case only — single scenario · FCF pre-computed from Tesla_BullCase_DCF.xlsx ·
        Terminal net cash convention mirrors Excel model · Updated {model.lastUpdated}
      </div>
    </div>
  )
}
