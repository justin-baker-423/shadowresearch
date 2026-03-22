"use client"
import { useState, useMemo } from "react"
import type { DeereModelConfig, Scenario } from "@/lib/deere-models"
import {
  runDeereDCF,
  buildDeereSensitivity,
  SENS_SUB_PCTS,
  SENS_WACCS,
  PE_EXIT_MULTIPLE,
} from "@/lib/deere-engine"

const SC_COLORS: Record<Scenario, { color: string; dim: string }> = {
  bear: { color: "var(--red)",    dim: "var(--red-dim)"    },
  base: { color: "var(--accent)", dim: "var(--accent-dim)" },
  bull: { color: "var(--green)",  dim: "var(--green-dim)"  },
}

function f1(n: number) { return n.toFixed(1) }
function f2(n: number) { return n.toFixed(2) }
function fPct(n: number) { return f1(n * 100) + "%" }
function fB(n: number) { return "$" + f1(n) + "B" }
function fShare(n: number) { return "$" + Math.round(n) }

export default function DeereModelShell({
  model,
  priceSource,
}: {
  model: DeereModelConfig
  priceSource?: string
}) {
  const [sc,       setSc]       = useState<Scenario>("base")
  const [subPct10, setSubPct10] = useState(model.subPctDefault)
  const [wacc,     setWacc]     = useState(model.waccDefault)
  const [termG,    setTermG]    = useState(model.termGrowth)
  const [tab,      setTab]      = useState<"model" | "capital" | "sensitivity" | "assumptions">("model")

  const M    = useMemo(() => runDeereDCF(model, sc, subPct10, wacc, termG),    [model, sc, subPct10, wacc, termG])
  const SENS = useMemo(() => buildDeereSensitivity(model, sc, termG),          [model, sc, termG])

  const scColors = SC_COLORS[sc]
  const accent   = model.accentColor ?? "var(--accent)"
  const upCol    = M.updown > 0 ? "var(--green)" : "var(--red)"

  // Sensitivity color thresholds relative to current price
  function sensColor(val: number) {
    const ratio = val / model.currentPrice
    if (ratio >= 1.3) return "sens-cell-green"
    if (ratio >= 1.0) return "sens-cell-accent"
    if (ratio >= 0.7) return "sens-cell-amber"
    return "sens-cell-red"
  }

  // ── KPI strip ─────────────────────────────────────────────────
  const kpis = [
    {
      label: "Intrinsic Value / Share",
      value: fShare(M.intrinsicPerShare),
      sub:   `vs $${model.currentPrice} · ${M.updown > 0 ? "+" : ""}${f1(M.updown)}% implied`,
      color: upCol,
    },
    {
      label: "10-Yr Implied CAGR",
      value: `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`,
      sub:   `from $${model.currentPrice} to ${fShare(M.intrinsicPerShare)} · WACC-accreted`,
      color: upCol,
    },
    {
      label: "Avg Dividend Yield",
      value: fPct(M.avgDivYield15xPE),
      sub:   `${PE_EXIT_MULTIPLE}× P/E price: $${Math.round(PE_EXIT_MULTIPLE * M.rows[0].eps)} → ${fShare(M.peExitPrice)} · display only`,
      color: accent,
    },
    {
      label: "TV / EV",
      value: f1(M.tvWeight * 100) + "%",
      sub:   `PV(NI) ${fB(M.pvSum)} · PV(TV) ${fB(M.pvTerminal)}`,
      color: "var(--amber)",
    },
    {
      label: "2035E Net Income",
      value: fB(M.rows[9].netIncome),
      sub:   `EPS $${f2(M.rows[9].eps)} · Sub mix ${fPct(M.rows[9].subPct)}`,
      color: scColors.color,
    },
    {
      label: "2035E Total Revenue",
      value: fB(M.rows[9].totalRev),
      sub:   `Equip ${fB(M.rows[9].equipRev)} · FS ${fB(M.rows[9].fsRev)}`,
      color: "var(--text-1)",
    },
    {
      label: "2035E Shares Outstanding",
      value: f1(M.rows[9].shares * 1000) + "M",
      sub:   `−${f1((1 - M.rows[9].shares / model.sharesOut) * 100)}% vs today via buyback`,
      color: "var(--purple)",
    },
  ]

  return (
    <div>
      {/* header */}
      <div className="model-header">
        <div className="model-header-row">
          <div
            className="model-ticker-badge"
            style={{ background: accent }}
          >
            {model.ticker}
          </div>
          <div className="model-header-label">
            {model.name} · {model.exchange} · DCF Model
          </div>
        </div>
        <div className="model-subline">
          Base year FY{model.baseYear}A · $32.9B equip + $6.2B FS FY2026E ·{" "}
          {Math.round(model.sharesOut * 1000)}M diluted shares · Net debt ${model.netDebt}B (consolidated) · Price ref ${model.currentPrice}{" "}
          {priceSource && (
            <span
              style={{
                color: priceSource.startsWith("Live") ? "var(--green)" : "var(--text-3)",
                fontWeight: 500,
              }}
            >
              ({priceSource})
            </span>
          )}
        </div>
        <div className="model-subline">
          Ag Cycle + Mix-Shift engine · FCF = Net Income (EO D&amp;A ≈ EO capex) ·
          Year 1 anchored to FY2026E guidance · FS interest scales with FS book ·
          WACC {fPct(wacc)} · Terminal g {fPct(termG)} · Sub% target {fPct(subPct10)}
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

        {/* subscription mix slider */}
        <div className="control-group">
          <div className="section-label">Sub% Year 10: {fPct(subPct10)}</div>
          <input
            type="range" min={5} max={25} step={1} value={subPct10 * 100}
            onChange={e => setSubPct10(Number(e.target.value) / 100)}
            style={{ width: 180, accentColor: accent }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>5%</span><span>25%</span>
          </div>
        </div>

        {/* WACC */}
        <div className="control-group">
          <div className="section-label">WACC: {fPct(wacc)}</div>
          <input
            type="range" min={7} max={12} step={0.5} value={wacc * 100}
            onChange={e => setWacc(Number(e.target.value) / 100)}
            style={{ width: 180, accentColor: scColors.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>7%</span><span>12%</span>
          </div>
        </div>

        {/* terminal growth */}
        <div className="control-group">
          <div className="section-label">Terminal growth: {fPct(termG)}</div>
          <input
            type="range" min={1} max={5} step={0.5} value={termG * 100}
            onChange={e => setTermG(Number(e.target.value) / 100)}
            style={{ width: 180, accentColor: scColors.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>1%</span><span>5%</span>
          </div>
        </div>

        {/* tabs */}
        <div className="control-group">
          <div className="section-label">View</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["model", "capital", "sensitivity", "assumptions"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`tab-btn ${tab === t ? "active" : ""}`}
              >
                {t === "capital" ? "capital return" : t}
              </button>
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
            FY2026–2035 Income Statement — {sc.charAt(0).toUpperCase() + sc.slice(1)} Case · Sub% target {fPct(subPct10)}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Equip Rev</th>
                  <th>Sub%</th>
                  <th>Total Rev</th>
                  <th>GM%</th>
                  <th>Int Exp</th>
                  <th>Pre-Tax</th>
                  <th>Net Income</th>
                  <th>EPS</th>
                  <th>PV(NI)</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map((r, i) => {
                  const isGuided = r.year === 2026
                  const isCycle  = r.year === 2029  // approximate peak
                  return (
                    <tr
                      key={r.year}
                      style={{
                        borderBottom: `1px solid ${isCycle ? scColors.color + "55" : "rgba(37,43,59,0.88)"}`,
                      }}
                    >
                      <td style={{
                        color:      isCycle ? scColors.color : "var(--text-1)",
                        fontWeight: isCycle ? 700 : 400,
                      }}>
                        {r.year}{isCycle ? " ★" : ""}
                      </td>
                      <td>{fB(r.equipRev)}</td>
                      <td style={{ color: accent }}>{fPct(r.subPct)}</td>
                      <td>{fB(r.totalRev)}</td>
                      <td style={{ color: scColors.color }}>{fPct(r.gmPct)}</td>
                      <td style={{ color: "var(--amber)" }}>{fB(r.interestExp)}</td>
                      <td style={{ color: r.preTaxIncome < 0 ? "var(--red)" : "var(--text-2)" }}>
                        {r.preTaxIncome < 0 ? `(${fB(Math.abs(r.preTaxIncome))})` : fB(r.preTaxIncome)}
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {fB(r.netIncome)}
                      </td>
                      <td style={{ color: "var(--text-2)" }}>${f2(r.eps)}</td>
                      <td style={{ color: "var(--accent)" }}>
                        {isGuided
                          ? <><span style={{ color: scColors.color }}>†</span> {fB(r.pv)}</>
                          : fB(r.pv)
                        }
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={9} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    Terminal value · g={fPct(termG)} · WACC={fPct(wacc)} · {f1(M.gordon)}× Gordon multiple on FY2035E NI
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 600 }}>{fB(M.pvTerminal)}</td>
                </tr>
                <tr className="ev-row">
                  <td colSpan={9} style={{ color: "var(--accent)", fontWeight: 600, textAlign: "left" }}>
                    Enterprise Value (Σ PV(NI) + PV(TV))
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>{fB(M.enterpriseValue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* equity bridge */}
          <div className="bridge-card">
            <div className="section-label">EV → Per-Share Value Bridge</div>
            {[
              ["Enterprise Value",                      fB(M.enterpriseValue),                             "var(--text-1)"],
              ["(−) Consolidated net debt (FY2025A)",   `($${model.netDebt}B)`,                            "var(--red)"   ],
              ["  · Total debt ($63.9B) − Cash/Secs ($9.7B)",   "−",                                      "var(--text-3)"],
              ["  · − Financing receivables ($51.4B)",           "−",                                      "var(--text-3)"],
              ["Equity Value",                          fB(M.equityValue),                                 "var(--accent)"],
              ["÷ Diluted shares (FY2025A base)",       `${Math.round(model.sharesOut * 1000)}M`,          "var(--text-2)"],
              ["Intrinsic Value / Share",               fShare(M.intrinsicPerShare),                       scColors.color ],
              ["Current price reference",               `$${model.currentPrice}`,                          "var(--text-3)"],
              ["Implied upside / (downside)",           `${M.updown > 0 ? "+" : ""}${f1(M.updown)}%`,     upCol          ],
              ["10-yr implied CAGR",                    `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`, upCol],
            ].map(([k, v, col]) => (
              <div key={k} className="bridge-row">
                <span className="bridge-label">{k}</span>
                <span className="bridge-value" style={{ color: col }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="phase-legend">
            <div className="phase-item">
              <span className="phase-dot" style={{ background: scColors.color + "22", border: `1px solid ${scColors.color}55` }} />
              FY2026: Guidance anchor · equipment cycle trough
            </div>
            <div className="phase-item">
              <span className="phase-dot" style={{ background: "var(--green-dim)", border: "1px solid rgba(74,222,128,.4)" }} />
              FY2027–2030: Ag cycle recovery · sub% ramp begins
            </div>
            <div className="phase-item">
              <span className="phase-dot" style={{ background: "var(--purple-dim)", border: "1px solid rgba(167,139,250,.4)" }} />
              FY2031–2035: Terminal approach · sub% ramp completes FY2034
            </div>
            <span style={{ fontSize: 11, color: scColors.color }}>★ = approximate cycle peak year</span>
          </div>
        </div>
      )}

      {/* ── CAPITAL RETURN TAB ── */}
      {tab === "capital" && (
        <div>
          <div className="section-label">
            Capital Allocation Waterfall — {sc.charAt(0).toUpperCase() + sc.slice(1)} Case
          </div>

          {/* Debt treatment note */}
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6, lineHeight: 1.6 }}>
            <span style={{ color: "var(--amber)" }}>Priority order: </span>
            <span style={{ color: "var(--text-2)" }}>① Interest expense</span>
            <span style={{ color: "var(--text-3)" }}> (deducted in P&amp;L — NI is already after interest) → </span>
            <span style={{ color: "var(--text-2)" }}>② Debt principal</span>
            <span style={{ color: "var(--text-3)" }}> ($2.8B consolidated net debt assumed refinanced at maturity; EO is ~net-cash; FS debt self-funded by fin. receivables) → </span>
            <span style={{ color: "var(--text-2)" }}>③ Dividends</span>
            <span style={{ color: "var(--text-3)" }}> (grow {fPct(model.scenarios[sc].divGrowthRate)}/yr) → </span>
            <span style={{ color: "var(--text-2)" }}>④ FCF surplus</span>
            <span style={{ color: "var(--text-3)" }}> (buyback capacity)</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            Buyback rate {fPct(model.scenarios[sc].buybackRate)}/yr applied to shares outstanding · Implied cost at {PE_EXIT_MULTIPLE}× P/E vs FCF surplus confirms feasibility
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Net Income</th>
                  <th>Div / Share</th>
                  <th>Total Divs</th>
                  <th>Payout Ratio</th>
                  <th>FCF Surplus</th>
                  <th>Shares Retired (M)</th>
                  <th>Buyback Cost</th>
                  <th>Shares Out (M)</th>
                  <th>EPS</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => {
                  const payout     = r.totalDiv / r.netIncome
                  const surplusCol = r.fcfSurplus > 0 ? "var(--green)" : "var(--text-3)"
                  const buybackAffordable = r.impliedBuybackCost <= r.fcfSurplus
                  return (
                    <tr key={r.year}>
                      <td>{r.year}</td>
                      <td style={{ fontWeight: 600 }}>{fB(r.netIncome)}</td>
                      <td style={{ color: accent }}>${f2(r.divPerShare)}</td>
                      <td style={{ color: "var(--amber)" }}>{fB(r.totalDiv)}</td>
                      <td style={{ color: payout > 0.8 ? "var(--red)" : payout > 0.6 ? "var(--amber)" : "var(--text-2)" }}>
                        {fPct(payout)}
                      </td>
                      <td style={{ color: surplusCol, fontWeight: r.fcfSurplus > 0 ? 600 : 400 }}>
                        {r.fcfSurplus > 0 ? fB(r.fcfSurplus) : "—"}
                      </td>
                      <td style={{ color: "var(--purple)" }}>
                        {r.sharesBoughtBack > 0 ? f1(r.sharesBoughtBack * 1000) : "—"}
                      </td>
                      <td style={{ color: buybackAffordable ? "var(--text-2)" : "var(--amber)", fontSize: 11 }}>
                        {r.impliedBuybackCost > 0 ? fB(r.impliedBuybackCost) : "—"}
                      </td>
                      <td style={{ color: "var(--purple)" }}>{f1(r.shares * 1000)}</td>
                      <td style={{ color: "var(--text-2)" }}>${f2(r.eps)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    Cumulative dividend growth · FY2035E
                  </td>
                  <td colSpan={2} style={{ color: accent, fontWeight: 600 }}>
                    ${f2(M.rows[9].divPerShare)}/share
                  </td>
                  <td colSpan={3} style={{ color: "var(--purple)", fontWeight: 600 }}>
                    {f1(M.rows[9].shares * 1000)}M shares (−{f1((1 - M.rows[9].shares / model.sharesOut) * 100)}%)
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bridge-card" style={{ marginTop: 20 }}>
            <div className="section-label">Capital Return Assumptions by Scenario</div>
            {(["bear", "base", "bull"] as Scenario[]).map(s => {
              const sc2 = model.scenarios[s]
              const col2 = SC_COLORS[s].color
              return (
                <div key={s} className="bridge-row">
                  <span className="bridge-label" style={{ color: col2, textTransform: "capitalize" }}>{s}</span>
                  <span className="bridge-value" style={{ color: "var(--text-2)", fontSize: 11 }}>
                    Buyback {fPct(sc2.buybackRate)}/yr · Div growth {fPct(sc2.divGrowthRate)}/yr · FS growth {fPct(sc2.fsGrowthRate)}/yr
                  </span>
                </div>
              )
            })}
            <div className="bridge-row" style={{ marginTop: 8 }}>
              <span className="bridge-label">FY2026E dividend anchor</span>
              <span className="bridge-value" style={{ color: accent }}>${model.divPerShare}/share ($1.62 × 4 quarters)</span>
            </div>
            <div className="bridge-row">
              <span className="bridge-label">Dividend source</span>
              <span className="bridge-value" style={{ color: "var(--text-2)", fontSize: 11 }}>Q1'26 earnings letter (Feb 19, 2026) · confirmed $1.62/quarter</span>
            </div>
          </div>
        </div>
      )}

      {/* ── SENSITIVITY TAB ── */}
      {tab === "sensitivity" && (
        <div>
          <div className="section-label">
            Intrinsic Value / Share ($) — Sub% Year 10 × WACC — {sc.charAt(0).toUpperCase() + sc.slice(1)} Scenario
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            Rows = subscription mix target at FY2034E · Columns = WACC · Terminal growth held at {fPct(termG)} · Highlighted = current sliders
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="sens-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Sub% ↓ / WACC →</th>
                  {SENS.waccs.map(w => (
                    <th
                      key={w}
                      style={{
                        color:      Math.abs(w - wacc) < 0.001 ? scColors.color : "var(--text-3)",
                        fontWeight: Math.abs(w - wacc) < 0.001 ? 700 : 400,
                      }}
                    >
                      {fPct(w)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SENS.subPcts.map((sp, ri) => (
                  <tr key={sp}>
                    <td
                      style={{
                        color:      Math.abs(sp - subPct10) < 0.001 ? scColors.color : "var(--text-2)",
                        fontWeight: Math.abs(sp - subPct10) < 0.001 ? 700 : 400,
                      }}
                    >
                      {fPct(sp)}
                    </td>
                    {SENS.waccs.map((w, ci) => {
                      const val = SENS.grid[ri][ci]
                      const sel = Math.abs(w - wacc) < 0.001 && Math.abs(sp - subPct10) < 0.001
                      const cls = sensColor(val)
                      return (
                        <td
                          key={w}
                          className={`${cls} ${sel ? "sens-cell-selected" : ""}`}
                          style={sel ? { borderColor: scColors.color, color: scColors.color } : {}}
                        >
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
            All Three Scenarios at {fPct(model.waccDefault)} WACC / {fPct(model.termGrowth)} Terminal Growth / {fPct(model.subPctDefault)} Sub% Target
          </div>
          <div className="sc-compare">
            {(["bear", "base", "bull"] as Scenario[]).map(s => {
              const m2 = runDeereDCF(model, s, model.subPctDefault, model.waccDefault, model.termGrowth)
              const mt = SC_COLORS[s]
              return (
                <div key={s} className="sc-card" style={{ background: mt.dim + "88", border: `1px solid ${mt.color}44` }}>
                  <div className="sc-card-label" style={{ color: mt.color }}>
                    {s.charAt(0).toUpperCase() + s.slice(1)} Case
                  </div>
                  <div className="sc-card-value" style={{ color: mt.color }}>{fShare(m2.intrinsicPerShare)}</div>
                  <div className="sc-card-updown" style={{ color: "var(--text-2)" }}>
                    {m2.updown > 0 ? "+" : ""}{f1(m2.updown)}% vs ${model.currentPrice}
                  </div>
                  <div className="sc-card-stat">2035E NI: {fB(m2.rows[9].netIncome)}</div>
                  <div className="sc-card-stat">2035E EPS: ${f2(m2.rows[9].eps)}</div>
                  <div className="sc-card-stat">EV: {fB(m2.enterpriseValue)}</div>
                  <div className="sc-card-stat">Div FY2035E: ${f2(m2.rows[9].divPerShare)}/shr</div>
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
              title: "Ag Cycle — Equipment Growth",
              color: accent,
              rows: [
                ["FY2026E anchor (guidance)",  `$${model.y1EquipRev}B — below FY2025A $38.9B`],
                ["Cycle thesis",               "Historical 2016–2023 trough→peak→trough replayed"],
                ["Bear growth FY2027–FY2035",  model.scenarios.bear.equipGrowth.map(g => fPct(g)).join(" → ")],
                ["Base growth FY2027–FY2035",  model.scenarios.base.equipGrowth.map(g => fPct(g)).join(" → ")],
                ["Bull growth FY2027–FY2035",  model.scenarios.bull.equipGrowth.map(g => fPct(g)).join(" → ")],
                ["Year 1 exchange",             "NYSE · FY2026E guidance anchored to Q1'26 letter (Feb 19, 2026)"],
              ],
            },
            {
              title: "Precision-Ag Mix-Shift",
              color: "var(--green)",
              rows: [
                ["Sub% Year 1 (FY2026E)",       "5.0% of (equip + sub) revenue"],
                ["Sub% Year 10 default",        `${fPct(model.subPctDefault)} — adjustable via slider (5%–25%)`],
                ["Sub% ramp formula",           "5% + min(1, i/8) × (target − 5%) — linear to Year 9"],
                ["GM model",                    "GM = 0.344 + 0.456 × subPct (blended on total revenue)"],
                ["Calibration points",          "subPct=5% → GM=36.7% · subPct=14% → GM=40.8%"],
                ["Sub margin premium",          "~80% gross margin on precision-ag vs ~28% on equipment"],
              ],
            },
            {
              title: "Cost Model & Capital Return",
              color: "var(--amber)",
              rows: [
                ["R&D",                         "5.0% of equipment sales (held fixed; FY2025A ≈4.5%)"],
                ["SG&A path",                   model.sgaPct.map(s2 => fPct(s2)).join(" → ") + " of equip sales"],
                ["Interest expense",            `$${model.y1InterestExp}B × (fsRev / $${model.y1FsRev}B) — scales with FS book`],
                ["Other op ex",                 `$${model.otherOpEx}B fixed`],
                ["Tax rate",                    fPct(model.taxRate) + " normalized effective"],
                ["FCF proxy",                   "Net Income (EO D&A $1.28B ≈ EO capex $1.36B; net capex ~$78M)"],
                ["FS lease originations",       "FS-funded, embedded in FS revenue & net debt — not additional capex"],
                ["Dividend FY2026E anchor",     `$${model.divPerShare}/share · $1.62/quarter (confirmed Q1'26)`],
                ["Base buyback / div growth",   `${fPct(model.scenarios.base.buybackRate)}/yr · ${fPct(model.scenarios.base.divGrowthRate)}/yr`],
                ["Bear buyback / div growth",   `${fPct(model.scenarios.bear.buybackRate)}/yr · ${fPct(model.scenarios.bear.divGrowthRate)}/yr`],
                ["Bull buyback / div growth",   `${fPct(model.scenarios.bull.buybackRate)}/yr · ${fPct(model.scenarios.bull.divGrowthRate)}/yr`],
              ],
            },
            {
              title: "Valuation & Equity Bridge",
              color: "var(--purple)",
              rows: [
                ["Default WACC",                fPct(model.waccDefault)],
                ["Default terminal growth",     fPct(model.termGrowth)],
                ["Gordon multiple (defaults)",  f1((1 + model.termGrowth) / (model.waccDefault - model.termGrowth)) + "×"],
                ["Consolidated net debt",       `$${model.netDebt}B — total debt $63.9B − cash/secs $9.7B − fin. receivables $51.4B`],
                ["FS net debt netting",         "FS debt self-funded by fin. receivables; equity value = EO earnings power"],
                ["Shares (base)",               `${Math.round(model.sharesOut * 1000)}M diluted (FY2025A 271.7M; est. ~267.1M at FY2026E start)`],
                ["Buyback in Year 1",           "Zero — Deere suspended buybacks at cycle trough (Q4 FY2025: $0)"],
                ["Share count formula",         "shares₀ × (1 − rate)^i for i≥1"],
                ["Model last updated",          model.lastUpdated],
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
        Ag Cycle + Services Mix-Shift engine · FCF = Net Income proxy · FS integrated via consolidated net debt ·
        Ag cycle based on 2016–2023 historical pattern · Precision-ag sub% mix-shift drives gross margin expansion ·
        Interest expense scales with Financial Services revenue · Updated {model.lastUpdated}
      </div>
    </div>
  )
}
