"use client"
import { useState, useMemo } from "react"
import type { NikeModelConfig } from "@/lib/nike-models"
import {
  runNikeDCF,
  buildNikeSensitivity,
  type NikeScenario,
} from "@/lib/nike-engine"

// ── Formatters ────────────────────────────────────────────────────────
function f1(n: number)    { return n.toFixed(1) }
function fPct(n: number)  { return f1(n * 100) + "%" }
function fB(n: number)    { return "$" + f1(n) + "B" }
function fShare(n: number){ return "$" + Math.round(n) }
function fM(n: number)    { return f1(n * 1000) + "M" }   // billions → millions

const SC_COLORS: Record<NikeScenario, { color: string; dim: string }> = {
  bear: { color: "var(--red)",    dim: "var(--red-dim)"    },
  base: { color: "var(--accent)", dim: "var(--accent-dim)" },
  bull: { color: "var(--green)",  dim: "var(--green-dim)"  },
}

const PHASE_STYLE: Record<string, { color: string; dim: string }> = {
  Turnaround:  { color: "var(--amber)",  dim: "var(--amber-dim)"  },
  Recovery:    { color: "var(--accent)", dim: "var(--accent-dim)" },
  Compounding: { color: "var(--green)",  dim: "var(--green-dim)"  },
}

export default function NikeModelShell({
  model,
  priceSource,
}: {
  model: NikeModelConfig
  priceSource?: string
}) {
  const [sc,   setSc]   = useState<NikeScenario>("base")
  const [wacc, setWacc] = useState(model.waccDefault)
  const [termG,setTermG]= useState(model.termGrowth)
  const [tab,  setTab]  = useState<"model" | "capital" | "sensitivity" | "assumptions">("model")

  const M    = useMemo(() => runNikeDCF(model, sc, wacc, termG),    [model, sc, wacc, termG])
  const SENS = useMemo(() => buildNikeSensitivity(model, sc),        [model, sc])

  const scC    = SC_COLORS[sc]
  const upCol  = M.updown > 0 ? "var(--green)" : "var(--red)"
  const accent = model.accentColor ?? "var(--accent)"

  function sensColor(val: number) {
    const ratio = val / model.currentPrice
    if (ratio >= 1.3) return "sens-cell-green"
    if (ratio >= 1.0) return "sens-cell-accent"
    if (ratio >= 0.7) return "sens-cell-amber"
    return "sens-cell-red"
  }

  // ── KPI strip ────────────────────────────────────────────────────────
  const lastRow = M.rows[9]
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
      sub:   `from $${model.currentPrice} → ${fShare(M.perShare)} · WACC-accreted`,
      color: upCol,
    },
    {
      label: "Enterprise Value",
      value: fB(M.ev),
      sub:   `PV(FCF) ${fB(M.sumPvFcf)} · PV(TV) ${fB(M.pvTv)} · TV ${f1(M.tvWeight * 100)}%`,
      color: "var(--accent)",
    },
    {
      label: "FY2035E Revenue",
      value: fB(lastRow.totalRev),
      sub:   `Ex-China ${fB(lastRow.exChinaRev)} · China ${fB(lastRow.chinaRev)}`,
      color: scC.color,
    },
    {
      label: "FY2035E EBIT Margin",
      value: fPct(lastRow.ebitMargin),
      sub:   `EBIT ${fB(lastRow.ebit)} · GM ${fPct(lastRow.grossMargin)}`,
      color: scC.color,
    },
    {
      label: "FY2035E Free Cash Flow",
      value: fB(lastRow.fcf),
      sub:   `NOPAT ${fB(lastRow.nopat)} + D&A ${fB(lastRow.dna)} − CapEx ${fB(lastRow.capex)}`,
      color: "var(--green)",
    },
    {
      label: "FY2035E Div / Share",
      value: `$${lastRow.dps.toFixed(2)}`,
      sub:   `Total divs ${fB(lastRow.totalDiv)} · buyback cap ${fB(lastRow.buybackCapacity)}`,
      color: "var(--purple)",
    },
    {
      label: "FY2035E Shares Out",
      value: fM(lastRow.shares),
      sub:   `−${f1((1 - lastRow.shares / model.sharesOut) * 100)}% vs today via buybacks`,
      color: "var(--purple)",
    },
    {
      label: "Avg Dividend Yield",
      value: fPct(M.avgDivYield),
      sub:   `10-yr avg DPS ÷ illustrative price path · display only`,
      color: "var(--purple)",
    },
  ]

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="model-header">
        <div className="model-header-row">
          <div className="model-ticker-badge" style={{ background: accent }}>
            {model.ticker}
          </div>
          <div className="model-header-label">
            {model.name} · {model.exchange} · Two-Segment DCF
          </div>
        </div>
        <div className="model-subline">
          Base year FY2025A · {Math.round(model.sharesOut * 1000)}M diluted shares ·
          Net debt ${Math.abs(model.netCash).toFixed(1)}B ·
          Price ref ${model.currentPrice}{" "}
          {priceSource && (
            <span style={{ color: priceSource.startsWith("Live") ? "var(--green)" : "var(--text-3)", fontWeight: 500 }}>
              ({priceSource})
            </span>
          )}
        </div>
        <div className="model-subline">
          Ex-China + China segments · Explicit FCF bridge: NOPAT + D&amp;A − CapEx ± WC ·
          Tariff headwind &amp; wholesale mix-shift treated as permanent ·
          Win Now complete end CY2026 · China stable end FY2027
        </div>
      </div>

      {/* ── Controls ───────────────────────────────────────────────── */}
      <div className="controls-row">
        {/* Scenario */}
        <div className="control-group">
          <div className="section-label">Scenario</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["bear", "base", "bull"] as NikeScenario[]).map(s => (
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

        {/* WACC */}
        <div className="control-group">
          <div className="section-label">WACC: {fPct(wacc)}</div>
          <input
            type="range" min={7} max={13} step={0.5} value={wacc * 100}
            onChange={e => setWacc(Number(e.target.value) / 100)}
            style={{ width: 180, accentColor: scC.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>7%</span><span>13%</span>
          </div>
        </div>

        {/* Terminal Growth */}
        <div className="control-group">
          <div className="section-label">Terminal growth: {fPct(termG)}</div>
          <input
            type="range" min={1.5} max={4} step={0.5} value={termG * 100}
            onChange={e => setTermG(Number(e.target.value) / 100)}
            style={{ width: 180, accentColor: scC.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>1.5%</span><span>4%</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="control-group">
          <div className="section-label">View</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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

      {/* ── KPI Strip ─────────────────────────────────────────────── */}
      <div className="kpi-strip">
        {kpis.map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════
          MODEL TAB — Revenue segments + Margin recovery + FCF bridge
          ════════════════════════════════════════════════════════════ */}
      {tab === "model" && (
        <div>
          {/* Phase legend */}
          <div className="phase-legend" style={{ marginBottom: 14 }}>
            {(["Turnaround", "Recovery", "Compounding"] as const).map(p => (
              <div key={p} className="phase-item">
                <span className="phase-dot" style={{
                  background: PHASE_STYLE[p].dim,
                  border: `1px solid ${PHASE_STYLE[p].color}55`,
                }} />
                <span style={{ color: PHASE_STYLE[p].color }}>{p}</span>
                {p === "Turnaround"  && <span>: FY2026–27 · Win Now &amp; China cleanup</span>}
                {p === "Recovery"    && <span>: FY2028–29 · First clean years · China stable</span>}
                {p === "Compounding" && <span>: FY2030+ · Operating leverage · China ramp</span>}
              </div>
            ))}
          </div>

          <div className="section-label">
            FY2026–2035 Revenue, Margins &amp; FCF — {sc.charAt(0).toUpperCase() + sc.slice(1)} Case
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Phase</th>
                  <th>Ex-China</th>
                  <th>China</th>
                  <th>Total Rev</th>
                  <th>Gross Margin</th>
                  <th>SG&amp;A</th>
                  <th>EBIT</th>
                  <th>EBIT%</th>
                  <th>D&amp;A</th>
                  <th>CapEx</th>
                  <th>WC Δ</th>
                  <th>FCF</th>
                  <th>PV(FCF)</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => {
                  const ps = PHASE_STYLE[r.phase]
                  const isFY26 = r.year === 2026
                  return (
                    <tr key={r.year} style={{
                      borderLeft: `3px solid ${ps.color}44`,
                      borderBottom: `1px solid rgba(37,43,59,0.88)`,
                    }}>
                      <td style={{ color: "var(--text-1)", fontWeight: isFY26 ? 700 : 400 }}>
                        {r.year}{isFY26 ? " †" : ""}
                      </td>
                      <td style={{ color: ps.color, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em" }}>
                        {r.phase.toUpperCase()}
                      </td>
                      <td>{fB(r.exChinaRev)}</td>
                      <td style={{ color: r.chinaRev < 6.0 ? "var(--amber)" : "var(--text-2)" }}>
                        {fB(r.chinaRev)}
                      </td>
                      <td style={{ fontWeight: 600 }}>{fB(r.totalRev)}</td>
                      <td style={{ color: r.grossMargin >= 0.42 ? "var(--green)" : "var(--amber)" }}>
                        {fPct(r.grossMargin)}
                      </td>
                      <td style={{ color: "var(--text-2)" }}>{fB(r.sga)}</td>
                      <td style={{ fontWeight: 600 }}>{fB(r.ebit)}</td>
                      <td style={{ color: scC.color }}>{fPct(r.ebitMargin)}</td>
                      <td style={{ color: "var(--text-3)" }}>{fB(r.dna)}</td>
                      <td style={{ color: "var(--text-3)" }}>({fB(r.capex)})</td>
                      <td style={{ color: r.wcDelta >= 0 ? "var(--green)" : "var(--amber)" }}>
                        {r.wcDelta >= 0 ? "+" : ""}{fB(r.wcDelta)}
                      </td>
                      <td style={{ fontWeight: 600, color: "var(--green)" }}>{fB(r.fcf)}</td>
                      <td style={{ color: "var(--accent)" }}>{fB(r.pvFcf)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={13} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    Terminal value · g={fPct(termG)} · WACC={fPct(wacc)} · {f1(M.gordon)}× Gordon multiple on FY2035E FCF
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 600 }}>{fB(M.pvTv)}</td>
                </tr>
                <tr className="ev-row">
                  <td colSpan={13} style={{ color: "var(--accent)", fontWeight: 600, textAlign: "left" }}>
                    Enterprise Value (Σ PV(FCF) + PV(TV))
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>{fB(M.ev)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* EV → Per-Share Bridge */}
          <div className="bridge-card">
            <div className="section-label">EV → Per-Share Value Bridge</div>
            {[
              ["Enterprise Value",                  fB(M.ev),                                                     "var(--text-1)"],
              ["Σ PV(FCF) explicit 10-year",        fB(M.sumPvFcf),                                               "var(--text-2)"],
              ["PV(Terminal Value)",                 fB(M.pvTv),                                                   "var(--text-2)"],
              ["TV as % of EV",                      f1(M.tvWeight * 100) + "% · " + f1(M.gordon) + "× on FY35E FCF", "var(--amber)"],
              [model.netCash >= 0 ? "(+) Net cash" : "(−) Net debt (FY2025A)", fB(Math.abs(model.netCash)),       model.netCash >= 0 ? "var(--green)" : "var(--red)"],
              ["Equity Value",                       fB(M.equity),                                                 "var(--accent)"],
              ["÷ FY2035E diluted shares",           fM(lastRow.shares) + " (after buybacks)",                     "var(--text-2)"],
              ["Intrinsic Value / Share",            fShare(M.perShare),                                           scC.color      ],
              ["Current price reference",            `$${model.currentPrice}`,                                     "var(--text-3)"],
              ["Implied upside / (downside)",        `${M.updown > 0 ? "+" : ""}${f1(M.updown)}%`,                 upCol          ],
              ["10-yr Implied CAGR",                 `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`, upCol         ],
            ].map(([k, v, col]) => (
              <div key={k} className="bridge-row">
                <span className="bridge-label">{k}</span>
                <span className="bridge-value" style={{ color: col }}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-3)" }}>
            † FY2026E anchored to Q3 actuals + Q4 guidance (reported April 2026)
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          CAPITAL RETURN TAB
          ════════════════════════════════════════════════════════════ */}
      {tab === "capital" && (
        <div>
          <div className="section-label">
            Capital Return Waterfall — {sc.charAt(0).toUpperCase() + sc.slice(1)} Case
          </div>

          {/* Priority note */}
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14, lineHeight: 1.7 }}>
            <span style={{ color: "var(--amber)" }}>Allocation priority: </span>
            <span style={{ color: "var(--text-2)" }}>① FCF</span>
            <span style={{ color: "var(--text-3)" }}> (NOPAT + D&amp;A − CapEx ± WC) → </span>
            <span style={{ color: "var(--text-2)" }}>② Dividends</span>
            <span style={{ color: "var(--text-3)" }}> (2%/yr growth through FY2028, then scenario rate) → </span>
            <span style={{ color: "var(--text-2)" }}>③ Buybacks</span>
            <span style={{ color: "var(--text-3)" }}> (residual FCF; negative FCF-after-div covered by balance sheet) · </span>
            <span style={{ color: "var(--text-3)" }}>25-year dividend growth streak commits Nike to maintaining the payout</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>FCF</th>
                  <th>Div / Shr</th>
                  <th>Total Divs</th>
                  <th>FCF After Div</th>
                  <th>Buyback Cap</th>
                  <th>Buyback Price</th>
                  <th>Shrs Retired</th>
                  <th>Shrs Out (M)</th>
                  <th>FCF Yield</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => {
                  const cfg = model.scenarios[sc]
                  const bprice = cfg.buybackPrice[r.year - 2026]
                  const coverageOk = r.fcfAfterDiv >= 0
                  const fcfYield = (r.fcf / (model.currentPrice * model.sharesOut)) * 100
                  return (
                    <tr key={r.year}>
                      <td style={{ color: PHASE_STYLE[r.phase].color }}>{r.year}</td>
                      <td style={{ fontWeight: 600, color: "var(--green)" }}>{fB(r.fcf)}</td>
                      <td style={{ color: "var(--purple)" }}>${r.dps.toFixed(2)}</td>
                      <td style={{ color: "var(--purple)" }}>{fB(r.totalDiv)}</td>
                      <td style={{
                        color: coverageOk ? "var(--text-2)" : "var(--red)",
                        fontWeight: coverageOk ? 400 : 600,
                      }}>
                        {r.fcfAfterDiv >= 0
                          ? fB(r.fcfAfterDiv)
                          : `(${fB(Math.abs(r.fcfAfterDiv))})  ← balance sheet`}
                      </td>
                      <td style={{ color: r.buybackCapacity > 0 ? "var(--accent)" : "var(--text-3)" }}>
                        {r.buybackCapacity > 0 ? fB(r.buybackCapacity) : "—"}
                      </td>
                      <td style={{ color: "var(--text-3)", fontSize: 11 }}>${bprice}</td>
                      <td style={{ color: "var(--purple)" }}>
                        {r.sharesRetired > 0.0005 ? f1(r.sharesRetired * 1000) + "M" : "—"}
                      </td>
                      <td style={{ color: "var(--purple)" }}>{fM(r.shares)}</td>
                      <td style={{ color: "var(--text-3)", fontSize: 11 }}>{f1(fcfYield)}%</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    Cumulative · FY2035E
                  </td>
                  <td colSpan={2} style={{ color: "var(--purple)", fontWeight: 600 }}>
                    ${lastRow.dps.toFixed(2)}/share div
                  </td>
                  <td />
                  <td colSpan={3} style={{ color: "var(--purple)", fontWeight: 600 }}>
                    {fM(lastRow.shares)} shares (−{f1((1 - lastRow.shares / model.sharesOut) * 100)}% vs today)
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Dividend mechanics */}
          <div className="bridge-card" style={{ marginTop: 20 }}>
            <div className="section-label">Dividend &amp; Buyback Mechanics</div>
            {[
              ["FY2026E dividend anchor",    "$1.64/share annual (4 × $0.41 quarterly, confirmed)"],
              ["Growth rate: FY2026–FY2028", "2% per annum (restrained — FCF barely covers dividend)"],
              ["Growth rate: FY2029+",        sc === "bear" ? "2% per annum (continued restraint)" : "10% per annum (FCF recovery funds acceleration)"],
              ["Buyback mechanism",          "Residual FCF after dividends ÷ pre-set price path (illustrative)"],
              ["Balance sheet support",      `Nike net debt ~$1.5B, strong investment-grade credit — dividend covered through trough`],
              ["25-year streak",             "Nike has increased the annual dividend every year since 1999 — policy commitment"],
              ["Scenario description",       model.scenarios[sc].description],
            ].map(([k, v]) => (
              <div key={k} className="bridge-row">
                <span className="bridge-label">{k}</span>
                <span className="bridge-value" style={{ color: "var(--text-2)", fontSize: 11 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          SENSITIVITY TAB
          ════════════════════════════════════════════════════════════ */}
      {tab === "sensitivity" && (
        <div>
          <div className="section-label">
            Intrinsic Value / Share ($) — WACC × Terminal Growth — {sc.charAt(0).toUpperCase() + sc.slice(1)} Scenario
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            Rows = terminal growth rate · Columns = WACC · Highlighted cell = current sliders
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="sens-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Term g ↓ / WACC →</th>
                  {SENS.waccs.map(w => (
                    <th key={w} style={{
                      color:      Math.abs(w - wacc) < 0.001 ? scC.color : "var(--text-3)",
                      fontWeight: Math.abs(w - wacc) < 0.001 ? 700 : 400,
                    }}>
                      {fPct(w)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SENS.tgrows.map((tg, ri) => (
                  <tr key={tg}>
                    <td style={{
                      color:      Math.abs(tg - termG) < 0.001 ? scC.color : "var(--text-2)",
                      fontWeight: Math.abs(tg - termG) < 0.001 ? 700 : 400,
                    }}>
                      {fPct(tg)}
                    </td>
                    {SENS.waccs.map((w, ci) => {
                      const val = SENS.grid[ri][ci]
                      const sel = Math.abs(w - wacc) < 0.001 && Math.abs(tg - termG) < 0.001
                      const cls = sensColor(val)
                      return (
                        <td
                          key={w}
                          className={`${cls} ${sel ? "sens-cell-selected" : ""}`}
                          style={sel ? { borderColor: scC.color, color: scC.color } : {}}
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

          {/* All-scenario comparison at defaults */}
          <div className="section-label" style={{ marginTop: 28 }}>
            All Three Scenarios at {fPct(model.waccDefault)} WACC / {fPct(model.termGrowth)} Terminal Growth
          </div>
          <div className="sc-compare">
            {(["bear", "base", "bull"] as NikeScenario[]).map(s => {
              const m2 = runNikeDCF(model, s, model.waccDefault, model.termGrowth)
              const mt = SC_COLORS[s]
              const lr = m2.rows[9]
              return (
                <div key={s} className="sc-card" style={{ background: mt.dim + "88", border: `1px solid ${mt.color}44` }}>
                  <div className="sc-card-label" style={{ color: mt.color }}>
                    {s.charAt(0).toUpperCase() + s.slice(1)} Case
                  </div>
                  <div className="sc-card-value" style={{ color: mt.color }}>{fShare(m2.perShare)}</div>
                  <div className="sc-card-updown" style={{ color: "var(--text-2)" }}>
                    {m2.updown > 0 ? "+" : ""}{f1(m2.updown)}% vs ${model.currentPrice}
                  </div>
                  <div className="sc-card-stat">CAGR: {m2.impliedCAGR > 0 ? "+" : ""}{f1(m2.impliedCAGR * 100)}%</div>
                  <div className="sc-card-stat">EV: {fB(m2.ev)}</div>
                  <div className="sc-card-stat">FY35 Rev: {fB(lr.totalRev)}</div>
                  <div className="sc-card-stat">FY35 FCF: {fB(lr.fcf)}</div>
                  <div className="sc-card-stat">FY35 EBIT%: {fPct(lr.ebitMargin)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          ASSUMPTIONS TAB
          ════════════════════════════════════════════════════════════ */}
      {tab === "assumptions" && (
        <div className="assumptions-grid">
          {[
            {
              title: "Revenue — Ex-China Segment",
              color: "var(--accent)",
              rows: [
                ["Definition",               "North America + EMEA + APLA + Converse"],
                ["FY2026E base",             "$40.4B · still carries Win Now drag (AF1/AJ1/Dunk liquidation)"],
                ["Win Now completion",       "End of CY2026 = Nike Q2 FY2027 (Nov 2026) · 5pt revenue headwind reverses"],
                ["Bear ex-China growth",     model.scenarios.bear.exChinaRev.map((v, i) => i ? `FY${2026+i}: $${v}B` : null).filter(Boolean).join(" · ") ],
                ["Base ex-China growth",     "+5%/yr post-Win Now (FY2028+) · 5pt recovery in H2 FY2027"],
                ["Bull ex-China growth",     "+7%/yr post-Win Now · bigger Win Now rebound (+7.5% FY2027)"],
                ["FY2035E base",             `$${model.scenarios.base.exChinaRev[9].toFixed(1)}B`],
              ],
            },
            {
              title: "Revenue — China Segment",
              color: "var(--amber)",
              rows: [
                ["Definition",               "Greater China geography (separate reset timeline from global)"],
                ["FY2026E",                  "$5.8B · Q3 down 10% · Q4 guided down ~20%"],
                ["Bear China path",          "Deeper cleanup · stable $4.8B by FY2028 · slow 5%/yr ramp"],
                ["Base China path",          "Down ~10% in FY2027 full year · stable end FY2027 (0% FY2028) · 0→10% ramp over 4 yrs"],
                ["Bull China path",          "Less severe FY2027 (-5%) · faster recovery · 10%/yr from FY2029"],
                ["Key risks",               "Anta/Li-Ning competitive pressure · macro weakness · marketplace reset depth"],
                ["Management guidance",     "\"Actions will continue throughout FY2027 and remain a headwind to revenue growth\""],
                ["FY2035E base",             `$${model.scenarios.base.chinaRev[9].toFixed(1)}B`],
              ],
            },
            {
              title: "Gross Margin & Operating Cost",
              color: "var(--green)",
              rows: [
                ["FY2024A peak",             "44.6% (full year)"],
                ["FY2026E",                  "~40.8% · trough (China -20%, liquidation, tariffs fully annualized)"],
                ["Win Now liquidation",      "~-200 to -250bps headwind · MOSTLY TEMPORARY · clearing end CY2026"],
                ["Tariff headwind (perm.)",  "~-130 to -150bps net of mitigation · $1.5B annual cost · STRUCTURAL"],
                ["Wholesale mix shift (perm.)", "~-100bps vs DTC peak · STRUCTURAL per model assumption"],
                ["China promo drag",         "~-50 to -75bps · temporary · clears with FY2027 stabilization"],
                ["Base structural ceiling",  "42.5% (FY2028+) = 44.6% − 125bps mix − 140bps tariffs"],
                ["Bull structural ceiling",  "43.5% (partial tariff relief + DTC premium re-emergence)"],
                ["Bear structural ceiling",  "41.0% (tariff escalation ~$2B, slower liquidation recovery)"],
                ["SG&A base (all scenarios)","$16.0B FY2026E · grows 2–4.5%/yr depending on scenario"],
              ],
            },
            {
              title: "FCF Bridge & Capital Return",
              color: "var(--purple)",
              rows: [
                ["FCF formula",              "NOPAT (EBIT × 81%) + D&A − CapEx ± Working Capital"],
                ["Tax rate",                 "19% (Nike normalized effective rate)"],
                ["D&A",                      "~$600M base · modest growth with capex investment"],
                ["CapEx",                    "Lean at $650–700M FY2026-27 · normalizes to $800M FY2028 · +4%/yr thereafter"],
                ["Working capital",          "Inventory drawdown = +$200–400M cash source FY2026-27 · reverses FY2028+ as restock begins"],
                ["Dividend anchor",          "$1.64/share annual (confirmed Q1 FY2026) · 25-yr consecutive growth streak"],
                ["Dividend growth",          "2%/yr through FY2028 (FCF tight) · then 10%/yr (bear: 2% throughout)"],
                ["Buyback mechanism",        "Residual FCF after dividends · retired at pre-set illustrative price path"],
                ["FY2026 FCF coverage",      "FCF ~$2.5B barely covers $2.43B dividend · effectively zero buybacks"],
                ["Margin inflection (mgmt)", "Management guided gross margin expansion beginning Q2 FY2027 (Nov 2026)"],
                ["Default WACC",             fPct(model.waccDefault) + " · consumer discretionary turnaround premium"],
                ["Default terminal growth",  fPct(model.termGrowth)],
                ["Net debt",                 `$${Math.abs(model.netCash).toFixed(1)}B (cash ~$7.3B − debt ~$8.8B)`],
                ["Shares outstanding",       `${Math.round(model.sharesOut * 1000)}M diluted · $18B buyback program (~$5–6B remaining authorization)`],
                ["Buyback price note",       "Pre-set illustrative price path · not modeled at intrinsic value (avoids circularity)"],
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
        Two-segment DCF: Ex-China + Greater China · Explicit FCF bridge: NOPAT + D&amp;A − CapEx ± WC ·
        Structural assumptions: tariff headwind ~$1.5B and wholesale mix-shift treated as permanent ·
        Win Now portfolio reset assumed complete end CY2026 · China cleanup through FY2027 ·
        Dividend buyback price path is illustrative · Updated {model.lastUpdated}
      </div>
    </div>
  )
}
