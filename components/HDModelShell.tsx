"use client"
import { useState, useMemo } from "react"
import type { HDModelConfig, Scenario } from "@/lib/hd-models"
import {
  runHDDCF,
  buildHDSensRevMargin,
  buildHDSensWaccTg,
} from "@/lib/hd-engine"

const SC_COLORS: Record<Scenario, { color: string; dim: string }> = {
  bear: { color: "var(--red)",    dim: "var(--red-dim)"    },
  base: { color: "var(--accent)", dim: "var(--accent-dim)" },
  bull: { color: "var(--green)",  dim: "var(--green-dim)"  },
}

function f1(n: number)   { return n.toFixed(1) }
function f2(n: number)   { return n.toFixed(2) }
function fPct(n: number) { return f1(n * 100) + "%" }
function fB(n: number)   { return "$" + f1(n) + "B" }
function fShare(n: number) { return "$" + Math.round(n) }

export default function HDModelShell({
  model,
  priceSource,
}: {
  model: HDModelConfig
  priceSource?: string
}) {
  const [sc,        setSc]        = useState<Scenario>("base")
  const [revGrowth, setRevGrowth] = useState(model.scenarios.base.revGrowth)
  const [opMargin,  setOpMargin]  = useState(model.scenarios.base.opMargin)
  const [wacc,      setWacc]      = useState(model.waccDefault)
  const [termG,     setTermG]     = useState(model.termGrowth)
  const [tab, setTab] = useState<"model" | "capital" | "sensitivity" | "assumptions">("model")

  function handleScenario(s: Scenario) {
    setSc(s)
    setRevGrowth(model.scenarios[s].revGrowth)
    setOpMargin(model.scenarios[s].opMargin)
  }

  const M       = useMemo(() => runHDDCF(model, revGrowth, opMargin, wacc, termG), [model, revGrowth, opMargin, wacc, termG])
  const SENS_RM = useMemo(() => buildHDSensRevMargin(model, wacc, termG),          [model, wacc, termG])
  const SENS_WT = useMemo(() => buildHDSensWaccTg(model, revGrowth, opMargin),     [model, revGrowth, opMargin])

  const accent   = model.accentColor
  const scColors = SC_COLORS[sc]
  const upCol    = M.updown > 0 ? "var(--green)" : "var(--red)"

  // Year buybacks first resume
  const buybackYear = M.rows.find(r => r.netDebtEbitda < model.buybackTrigger)?.year ?? "—"

  // Forward dividend yield (year-1 DPS / current price)
  const fwdDivYield = M.rows[0].dps / model.currentPrice

  function sensColor(val: number) {
    const ratio = val / model.currentPrice
    if (ratio >= 1.3) return "sens-cell-green"
    if (ratio >= 1.0) return "sens-cell-accent"
    if (ratio >= 0.7) return "sens-cell-amber"
    return "sens-cell-red"
  }

  // Closest indices for sensitivity highlighting
  function closestIdx(arr: number[], val: number) {
    let best = 0
    let bestDist = Math.abs(arr[0] - val)
    for (let i = 1; i < arr.length; i++) {
      const d = Math.abs(arr[i] - val)
      if (d < bestDist) { bestDist = d; best = i }
    }
    return best
  }
  const rmRevIdx  = closestIdx(SENS_RM.revGrowths, revGrowth)
  const rmOpmIdx  = closestIdx(SENS_RM.opMargins,  opMargin)
  const wtWaccIdx = closestIdx(SENS_WT.waccs,  wacc)
  const wtTgIdx   = closestIdx(SENS_WT.tgrows, termG)

  const kpis = [
    {
      label: "Intrinsic Value / Share",
      value: fShare(M.perShare),
      sub:   `vs $${model.currentPrice} · ${M.updown > 0 ? "+" : ""}${f1(M.updown)}% implied`,
      color: upCol,
    },
    {
      label: "10-Yr Implied CAGR",
      value: `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`,
      sub:   `fair value accreted at ${fPct(wacc)} WACC from $${model.currentPrice}`,
      color: upCol,
    },
    {
      label: "Fwd Dividend Yield",
      value: fPct(fwdDivYield),
      sub:   `FY2026E DPS $${f2(M.rows[0].dps)} · payout ${fPct(M.rows[0].dps / M.rows[0].eps)}`,
      color: accent,
    },
    {
      label: "TV / EV",
      value: f1(M.tvWeight * 100) + "%",
      sub:   `PV(UFCF) ${fB(M.sumPvFcf)} · PV(TV) ${fB(M.pvTv)} · ${f1(M.gordon)}× Gordon`,
      color: "var(--amber)",
    },
    {
      label: "2035E UFCF",
      value: fB(M.rows[9].ufcf),
      sub:   `Revenue ${fB(M.rows[9].revenue)} · EBIT margin ${fPct(opMargin)}`,
      color: scColors.color,
    },
    {
      label: "Buybacks Resume",
      value: String(buybackYear),
      sub:   `when net debt/EBITDA < ${model.buybackTrigger}× · currently ~2.1×`,
      color: "var(--purple)",
    },
    {
      label: "Net Debt FY2035E",
      value: fB(M.rows[9].netDebt),
      sub:   `from $${model.netDebt}B today · EBITDA ${fB(M.rows[9].ebitda)}`,
      color: "var(--text-2)",
    },
  ]

  return (
    <div>
      {/* ── Header ── */}
      <div className="model-header">
        <div className="model-header-row">
          <div className="model-ticker-badge" style={{ background: accent }}>
            {model.ticker}
          </div>
          <div className="model-header-label">
            {model.name} · {model.exchange} · DCF Model
          </div>
        </div>
        <div className="model-subline">
          Base year FY2025A (ended Feb 1, 2026) · $164.7B revenue · {Math.round(model.sharesOut * 1000)}M diluted shares ·
          Net debt $49.9B · Adj op margin 13.1% actual · Price ref ${model.currentPrice}{" "}
          {priceSource && (
            <span style={{ color: priceSource.startsWith("Live") ? "var(--green)" : "var(--text-3)", fontWeight: 500 }}>
              ({priceSource})
            </span>
          )}
        </div>
        <div className="model-subline">
          UFCF engine (NOPAT + D&amp;A − Capex) · Equity = EV − $49.9B net debt ·
          Dividends grow with EPS · Buybacks resume when ND/EBITDA &lt; {model.buybackTrigger}× ·
          WACC {fPct(wacc)} · Terminal g {fPct(termG)} · Rev growth {fPct(revGrowth)} · Adj op margin {fPct(opMargin)}
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="controls-row">
        {/* Scenario */}
        <div className="control-group">
          <div className="section-label">Scenario</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["bear", "base", "bull"] as Scenario[]).map(s => (
              <button
                key={s}
                onClick={() => handleScenario(s)}
                className={`sc-btn ${sc === s ? `active-${s}` : ""}`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Revenue growth slider */}
        <div className="control-group">
          <div className="section-label">Revenue Growth: {fPct(revGrowth)}</div>
          <input
            type="range" min={2} max={8} step={0.5} value={revGrowth * 100}
            onChange={e => setRevGrowth(Number(e.target.value) / 100)}
            style={{ width: 180, accentColor: accent }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>2%</span><span>8%</span>
          </div>
        </div>

        {/* Operating margin slider */}
        <div className="control-group">
          <div className="section-label">Adj Op Margin: {fPct(opMargin)}</div>
          <input
            type="range" min={11} max={16} step={0.5} value={opMargin * 100}
            onChange={e => setOpMargin(Number(e.target.value) / 100)}
            style={{ width: 180, accentColor: accent }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>11%</span><span>16%</span>
          </div>
        </div>

        {/* WACC */}
        <div className="control-group">
          <div className="section-label">WACC: {fPct(wacc)}</div>
          <input
            type="range" min={7} max={11} step={0.5} value={wacc * 100}
            onChange={e => setWacc(Number(e.target.value) / 100)}
            style={{ width: 160, accentColor: scColors.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 160 }}>
            <span>7%</span><span>11%</span>
          </div>
        </div>

        {/* Terminal growth */}
        <div className="control-group">
          <div className="section-label">Terminal g: {fPct(termG)}</div>
          <input
            type="range" min={1} max={4} step={0.5} value={termG * 100}
            onChange={e => setTermG(Number(e.target.value) / 100)}
            style={{ width: 160, accentColor: scColors.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 160 }}>
            <span>1%</span><span>4%</span>
          </div>
        </div>

        {/* View tabs */}
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

      {/* ── KPI strip ── */}
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
            FY2026–2035 UFCF Projections · Rev Growth {fPct(revGrowth)} · Adj Op Margin {fPct(opMargin)}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Revenue</th>
                  <th>EBIT</th>
                  <th>EBIT Margin</th>
                  <th>NOPAT</th>
                  <th>D&amp;A</th>
                  <th>Capex</th>
                  <th>UFCF</th>
                  <th>PV(UFCF)</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => (
                  <tr key={r.year}>
                    <td style={{ color: "var(--text-1)" }}>{r.year}</td>
                    <td>{fB(r.revenue)}</td>
                    <td style={{ fontWeight: 600 }}>{fB(r.ebit)}</td>
                    <td style={{ color: accent }}>{fPct(opMargin)}</td>
                    <td>{fB(r.nopat)}</td>
                    <td style={{ color: "var(--text-3)" }}>{fB(r.dna)}</td>
                    <td style={{ color: "var(--amber)" }}>({fB(r.capex)})</td>
                    <td style={{ fontWeight: 600, color: scColors.color }}>{fB(r.ufcf)}</td>
                    <td style={{ color: "var(--accent)" }}>{fB(r.pvFcf)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={8} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    Terminal value · g={fPct(termG)} · WACC={fPct(wacc)} · {f1(M.gordon)}× Gordon on FY2035E UFCF
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 600 }}>{fB(M.pvTv)}</td>
                </tr>
                <tr>
                  <td colSpan={8} style={{ color: "var(--accent)", fontWeight: 600, textAlign: "left" }}>
                    Σ PV(UFCF)
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 600 }}>{fB(M.sumPvFcf)}</td>
                </tr>
                <tr className="ev-row">
                  <td colSpan={8} style={{ color: "var(--accent)", fontWeight: 700, textAlign: "left" }}>
                    Enterprise Value
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>{fB(M.ev)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Equity bridge */}
          <div className="bridge-card">
            <div className="section-label">EV → Per-Share Value Bridge</div>
            {[
              ["Enterprise Value",                  fB(M.ev),                                         "var(--text-1)"],
              ["(−) Net Debt (FY2025A)",             `($${model.netDebt}B)`,                           "var(--red)"   ],
              ["  · Total debt ~$51.3B − cash $1.4B",  "—",                                           "var(--text-3)"],
              ["Equity Value",                       fB(M.equity),                                     "var(--accent)"],
              ["÷ Diluted shares (FY2025A)",         `${Math.round(model.sharesOut * 1000)}M`,         "var(--text-2)"],
              ["Intrinsic Value / Share",            fShare(M.perShare),                               scColors.color ],
              ["Current price reference",            `$${model.currentPrice}`,                         "var(--text-3)"],
              ["Implied upside / (downside)",        `${M.updown > 0 ? "+" : ""}${f1(M.updown)}%`,    upCol          ],
              ["10-yr Implied CAGR",                 `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`, upCol],
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
              FY2026–2027: SRS/GMS integration · delevering · buybacks suspended
            </div>
            <div className="phase-item">
              <span className="phase-dot" style={{ background: "var(--green-dim)", border: "1px solid rgba(74,222,128,.4)" }} />
              FY2028–2031: Housing recovery · Pro distribution scaling · margin recovery
            </div>
            <div className="phase-item">
              <span className="phase-dot" style={{ background: "var(--purple-dim)", border: "1px solid rgba(167,139,250,.4)" }} />
              FY2032–2035: Terminal approach · full synergies · steady-state compounder
            </div>
          </div>
        </div>
      )}

      {/* ── CAPITAL RETURN TAB ── */}
      {tab === "capital" && (
        <div>
          <div className="section-label">
            Capital Allocation Waterfall — Rev Growth {fPct(revGrowth)} · Adj Op Margin {fPct(opMargin)}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6, lineHeight: 1.6 }}>
            <span style={{ color: "var(--amber)" }}>Priority order: </span>
            <span style={{ color: "var(--text-2)" }}>① Dividends</span>
            <span style={{ color: "var(--text-3)" }}> (grow with EPS, never cut) → </span>
            <span style={{ color: "var(--text-2)" }}>② Debt paydown</span>
            <span style={{ color: "var(--text-3)" }}> (while net debt/EBITDA &gt; {model.buybackTrigger}×) → </span>
            <span style={{ color: "var(--text-2)" }}>③ Buybacks</span>
            <span style={{ color: "var(--text-3)" }}> (residual FCF at ~{model.buybackPE}× P/E when leverage is comfortable)</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            HD has paid dividends for 156 consecutive quarters · 10-yr dividend CAGR ~17% (FY2015→FY2026) ·
            Buybacks suspended post-SRS ($18.25B) · FCF after dividends ~$3–6B/yr available for debt reduction
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Net Income</th>
                  <th>EPS</th>
                  <th>DPS</th>
                  <th>Div Growth</th>
                  <th>Div Paid</th>
                  <th>FCF After Div</th>
                  <th>Debt Repaid</th>
                  <th>Buybacks</th>
                  <th>Net Debt</th>
                  <th>ND/EBITDA</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => {
                  const leveraged = r.netDebtEbitda > model.buybackTrigger
                  const ndColor   = r.netDebtEbitda > 2.5 ? "var(--red)" :
                                    r.netDebtEbitda > model.buybackTrigger ? "var(--amber)" : "var(--green)"
                  return (
                    <tr key={r.year}>
                      <td>{r.year}</td>
                      <td style={{ fontWeight: 600 }}>{fB(r.netIncome)}</td>
                      <td style={{ color: "var(--text-2)" }}>${f2(r.eps)}</td>
                      <td style={{ color: accent, fontWeight: 600 }}>${f2(r.dps)}</td>
                      <td style={{ color: r.divGrowth > 0 ? "var(--green)" : "var(--text-3)" }}>
                        {r.divGrowth > 0.001 ? "+" : ""}{fPct(r.divGrowth)}
                      </td>
                      <td style={{ color: "var(--amber)" }}>{fB(r.totalDiv)}</td>
                      <td style={{ color: r.fcfAfterDiv > 0 ? "var(--green)" : "var(--text-3)" }}>
                        {r.fcfAfterDiv > 0.05 ? fB(r.fcfAfterDiv) : "—"}
                      </td>
                      <td style={{ color: leveraged ? "var(--text-2)" : "var(--text-3)" }}>
                        {r.debtRepaid > 0.05 ? fB(r.debtRepaid) : "—"}
                      </td>
                      <td style={{ color: "var(--purple)" }}>
                        {r.buybacks > 0.05 ? fB(r.buybacks) : "—"}
                      </td>
                      <td style={{ color: "var(--text-2)" }}>{fB(r.netDebt)}</td>
                      <td style={{ color: ndColor, fontWeight: 600 }}>
                        {f1(r.netDebtEbitda)}×
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    FY2035E dividend · 10-yr DPS CAGR
                  </td>
                  <td style={{ color: accent, fontWeight: 600 }}>${f2(M.rows[9].dps)}/shr</td>
                  <td style={{ color: "var(--green)", fontWeight: 600 }}>
                    {fPct(Math.pow(M.rows[9].dps / model.dps0, 0.1) - 1)}
                  </td>
                  <td colSpan={6} />
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bridge-card" style={{ marginTop: 20 }}>
            <div className="section-label">Scenario Defaults</div>
            {(["bear", "base", "bull"] as Scenario[]).map(s => {
              const col2 = SC_COLORS[s].color
              const sc2  = model.scenarios[s]
              return (
                <div key={s} className="bridge-row">
                  <span className="bridge-label" style={{ color: col2, textTransform: "capitalize" }}>{s}</span>
                  <span className="bridge-value" style={{ color: "var(--text-2)", fontSize: 11 }}>
                    Rev growth {fPct(sc2.revGrowth)} · Adj op margin {fPct(sc2.opMargin)} — {sc2.description}
                  </span>
                </div>
              )
            })}
            <div className="bridge-row" style={{ marginTop: 8 }}>
              <span className="bridge-label">Current dividend</span>
              <span className="bridge-value" style={{ color: accent }}>$2.33/quarter · ${model.dps0}/year · 156 consecutive qtrs</span>
            </div>
            <div className="bridge-row">
              <span className="bridge-label">Buyback resumption trigger</span>
              <span className="bridge-value" style={{ color: "var(--text-2)", fontSize: 11 }}>Net debt/EBITDA &lt; {model.buybackTrigger}× · current ~2.1× · FY2026 guidance: no buybacks guided</span>
            </div>
          </div>
        </div>
      )}

      {/* ── SENSITIVITY TAB ── */}
      {tab === "sensitivity" && (
        <div>
          {/* Primary: Rev Growth × Op Margin */}
          <div className="section-label">
            Intrinsic Value / Share ($) — Revenue Growth × Adj Op Margin · WACC {fPct(wacc)} · Terminal g {fPct(termG)}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            Rows = adj operating margin · Columns = uniform annual revenue growth · Highlighted = current sliders
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="sens-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Margin ↓ / Growth →</th>
                  {SENS_RM.revGrowths.map((rg, ci) => (
                    <th
                      key={rg}
                      style={{
                        color:      ci === rmRevIdx ? accent : "var(--text-3)",
                        fontWeight: ci === rmRevIdx ? 700 : 400,
                      }}
                    >
                      {fPct(rg)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SENS_RM.opMargins.map((om, ri) => (
                  <tr key={om}>
                    <td
                      style={{
                        color:      ri === rmOpmIdx ? accent : "var(--text-2)",
                        fontWeight: ri === rmOpmIdx ? 700 : 400,
                      }}
                    >
                      {fPct(om)}
                    </td>
                    {SENS_RM.revGrowths.map((rg, ci) => {
                      const val = SENS_RM.grid[ri][ci]
                      const sel = ri === rmOpmIdx && ci === rmRevIdx
                      const cls = sensColor(val)
                      return (
                        <td
                          key={rg}
                          className={`${cls} ${sel ? "sens-cell-selected" : ""}`}
                          style={sel ? { borderColor: accent, color: accent } : {}}
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

          <div className="sens-legend" style={{ marginTop: 12 }}>
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

          {/* Secondary: WACC × Terminal Growth */}
          <div className="section-label" style={{ marginTop: 28 }}>
            Intrinsic Value / Share ($) — WACC × Terminal Growth · Rev Growth {fPct(revGrowth)} · Margin {fPct(opMargin)}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            Rows = terminal growth rate · Columns = WACC · Highlighted = current sliders
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="sens-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Term g ↓ / WACC →</th>
                  {SENS_WT.waccs.map((w, ci) => (
                    <th
                      key={w}
                      style={{
                        color:      ci === wtWaccIdx ? scColors.color : "var(--text-3)",
                        fontWeight: ci === wtWaccIdx ? 700 : 400,
                      }}
                    >
                      {fPct(w)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SENS_WT.tgrows.map((tg, ri) => (
                  <tr key={tg}>
                    <td
                      style={{
                        color:      ri === wtTgIdx ? scColors.color : "var(--text-2)",
                        fontWeight: ri === wtTgIdx ? 700 : 400,
                      }}
                    >
                      {fPct(tg)}
                    </td>
                    {SENS_WT.waccs.map((w, ci) => {
                      const val = SENS_WT.grid[ri][ci]
                      const sel = ri === wtTgIdx && ci === wtWaccIdx
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

          {/* Scenario compare */}
          <div className="section-label" style={{ marginTop: 24 }}>
            Scenario Comparison · {fPct(model.waccDefault)} WACC · {fPct(model.termGrowth)} Terminal Growth
          </div>
          <div className="sc-compare">
            {(["bear", "base", "bull"] as Scenario[]).map(s => {
              const m2  = runHDDCF(model, model.scenarios[s].revGrowth, model.scenarios[s].opMargin, model.waccDefault, model.termGrowth)
              const mt  = SC_COLORS[s]
              const uc2 = m2.updown > 0 ? "var(--green)" : "var(--red)"
              return (
                <div key={s} className="sc-card" style={{ background: mt.dim + "88", border: `1px solid ${mt.color}44` }}>
                  <div className="sc-card-label" style={{ color: mt.color }}>
                    {s.charAt(0).toUpperCase() + s.slice(1)} Case
                  </div>
                  <div className="sc-card-value" style={{ color: mt.color }}>{fShare(m2.perShare)}</div>
                  <div className="sc-card-updown" style={{ color: uc2 }}>
                    {m2.updown > 0 ? "+" : ""}{f1(m2.updown)}% vs ${model.currentPrice}
                  </div>
                  <div className="sc-card-stat">Rev growth: {fPct(model.scenarios[s].revGrowth)}</div>
                  <div className="sc-card-stat">Adj op margin: {fPct(model.scenarios[s].opMargin)}</div>
                  <div className="sc-card-stat">2035E UFCF: {fB(m2.rows[9].ufcf)}</div>
                  <div className="sc-card-stat">2035E DPS: ${f2(m2.rows[9].dps)}/shr</div>
                  <div className="sc-card-stat">10-yr CAGR: {m2.impliedCAGR > 0 ? "+" : ""}{f1(m2.impliedCAGR * 100)}%</div>
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
              color: accent,
              rows: [
                ["Base year",                   "FY2025A ended Feb 1, 2026 · $164.7B net sales"],
                ["Revenue growth (slider)",     "Uniform annual rate applied to $164.7B base · 2–8% range"],
                ["FY2026 guidance (actual)",    "2.5–4.5% total sales growth (comp +flat to +2%) — midpoint ~3.5%"],
                ["Growth drivers",              "Comparable sales + ~15 new stores + SRS/GMS organic growth"],
                ["SRS contribution",            "~$13B in FY2025 · run-rate ~$14–16B entering FY2026 (SRS + GMS)"],
                ["Core retail context",         "Primary segment ~flat FY2023–FY2025; all growth was inorganic (SRS/GMS)"],
                ["Comp drivers",                "Transactions −1% · ticket +2% · net comp +0.5% in FY2025"],
                ["Housing market link",         "~500K unit increase in existing home sales ≈ +100–200bps comp (rule of thumb)"],
                ["Store count",                 "2,361 stores + 1,280+ SRS branch locations as of Q1 FY2026"],
              ],
            },
            {
              title: "Margin Model",
              color: "var(--green)",
              rows: [
                ["Adj op margin (slider)",       "Uniform applied from Year 1 · 11–16% range"],
                ["FY2025A actual",               "GAAP 12.7% · Adj 13.1% (ex acquired intangible amortization)"],
                ["FY2026 guidance",              "Adj operating margin 12.8–13.0% · GAAP 12.4–12.6%"],
                ["Peak margin",                  "FY2022 ~15.3% (COVID boom) · FY2019 ~14.4%"],
                ["Compression drivers",          "SRS/GMS SG&A deleveraging −60 to −80bps · acquired amortization −37bps"],
                ["Gross margin",                 "Remarkably stable 33–34% over the decade · not the swing factor"],
                ["Margin recovery path",         "Dependent on SRS integration, housing market recovery, operating leverage"],
                ["Intangible amortization",      "~$0.6B/yr ($0.17 per quarter acquired; ~40bps GAAP-to-adj gap)"],
              ],
            },
            {
              title: "FCF & Dividend Model",
              color: "var(--amber)",
              rows: [
                ["UFCF formula",                 "NOPAT + D&A − Capex · pre-interest · for enterprise value"],
                ["D&A rate",                     "~2.0% of revenue ($3.3B / $164.7B in FY2025)"],
                ["Capex rate",                   "~2.5% of revenue · management guidance · net capex drag ~0.5%"],
                ["FY2025A FCF",                  "$12.6B ($16.3B OCF − $3.7B capex) · post working capital changes"],
                ["Dividend policy",              "156 consecutive quarters · $9.32/year current · DPS grows with EPS"],
                ["Dividend growth",              "YoY EPS growth applied to DPS each year · floored at 0% (no cuts)"],
                ["Historical div CAGR",          "~17% over 10 years (FY2015 $2.76/yr → FY2026 $9.32/yr)"],
                ["FY2025A dividends paid",       "$9.2B · FY2026 guidance: $2.33/qtr ($9.32/yr annualized)"],
                ["Tax rate",                     "24.3% — FY2026 guidance effective rate"],
              ],
            },
            {
              title: "Balance Sheet & Valuation",
              color: "var(--purple)",
              rows: [
                ["Net debt (FY2025A end)",       "$49.9B · total debt ~$51.3B − cash $1.4B"],
                ["Leverage ratio (FY2025A)",     "~2.1× net debt / EBITDA ($49.9B / $24.2B)"],
                ["Interest rate assumed",        "~4.6% effective ($2.3B FY2026 guided interest / $49.9B)"],
                ["Buyback resumption trigger",   `Net debt/EBITDA < ${model.buybackTrigger}× · current status: suspended post-SRS`],
                ["Buyback assumed price",        `${model.buybackPE}× EPS · share count begins declining after trigger`],
                ["Equity bridge",                "EV − $49.9B initial net debt ÷ 995M shares"],
                ["WACC default",                 fPct(model.waccDefault) + " · investment grade, significant leverage"],
                ["Terminal growth default",      fPct(model.termGrowth) + " · home improvement sector · ~GDP"],
                ["Gordon multiple (defaults)",   f1((1 + model.termGrowth) / (model.waccDefault - model.termGrowth)) + "× on FY2035E UFCF"],
                ["SRS/GMS context",              "$18.25B SRS (June 2024) + $5.4B GMS (Sep 2025) · largest acquisitions in HD history"],
                ["Model last updated",           model.lastUpdated],
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
        UFCF engine (NOPAT + D&amp;A − Capex) · Equity = EV − $49.9B net debt ·
        Dividends grow with EPS · Buybacks resume when ND/EBITDA &lt; {model.buybackTrigger}× ·
        Revenue growth and operating margin are uniform across the 10-year projection period ·
        FY2025A actuals sourced from SEC filings · Updated {model.lastUpdated}
      </div>
    </div>
  )
}
