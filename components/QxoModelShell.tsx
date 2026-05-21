"use client"
import { useState, useMemo } from "react"
import type { QxoModelConfig, QxoScenario } from "@/lib/qxo-models"
import { runQxoDCF, buildQxoSensitivity } from "@/lib/qxo-engine"

// ── Formatters ───────────────────────────────────────────────────
function f1(n: number)   { return n.toFixed(1) }
function f2(n: number)   { return n.toFixed(2) }
function fPct(n: number) { return f1(n * 100) + "%" }
function fB(n: number)   { return "$" + f1(n) + "B" }
function fShare(n: number) { return "$" + Math.round(n) }

const SC_COLORS: Record<QxoScenario, { color: string; dim: string }> = {
  bear: { color: "var(--red)",    dim: "var(--red-dim)"    },
  base: { color: "var(--accent)", dim: "var(--accent-dim)" },
  bull: { color: "var(--green)",  dim: "var(--green-dim)"  },
}

export default function QxoModelShell({
  model,
  priceSource,
}: {
  model:        QxoModelConfig
  priceSource?: string
}) {
  const [sc,      setSc]      = useState<QxoScenario>("base")
  const [wacc,    setWacc]    = useState(model.waccDefault)
  const [termG,   setTermG]   = useState(model.termGrowth)
  const [sharesM, setSharesM] = useState(Math.round(model.sharesOut * 1000))
  const [maRate,  setMaRate]  = useState(0)
  const [tab,     setTab]     = useState<"model" | "sensitivity" | "assumptions">("model")

  const sharesB = sharesM / 1000

  const M    = useMemo(() => runQxoDCF(model, sc, wacc, termG, sharesB, maRate),    [model, sc, wacc, termG, sharesB, maRate])
  const SENS = useMemo(() => buildQxoSensitivity(model, sc, sharesB, maRate),        [model, sc, sharesB, maRate])

  const scC    = SC_COLORS[sc]
  const upCol  = M.updown > 0 ? "var(--green)" : "var(--red)"
  const accent = model.accentColor

  function sensColor(val: number) {
    const ratio = val / model.currentPrice
    if (ratio >= 1.3) return "sens-cell-green"
    if (ratio >= 1.0) return "sens-cell-accent"
    if (ratio >= 0.7) return "sens-cell-amber"
    return "sens-cell-red"
  }

  // ── KPI strip ─────────────────────────────────────────────────
  const lastRow = M.rows[9]
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
      sub:   `from $${model.currentPrice} today · WACC-accreted`,
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
      sub:   `${f1(M.gordon)}× Gordon multiple`,
      color: "var(--amber)",
    },
    {
      label: `${lastRow.year}E Revenue`,
      value: fB(lastRow.rev),
      sub:   maRate > 0
        ? `Org ${fB(lastRow.organicRev)} · M&A ${fB(lastRow.maRev)} (${f1(lastRow.maRev / lastRow.rev * 100)}%)`
        : `${f2(lastRow.rev / model.baseRevenue)}× 2026E base`,
      color: "var(--text-1)",
    },
    {
      label: `${lastRow.year}E Adj EBITDA Margin`,
      value: fPct(lastRow.ebitdaM),
      sub:   `from ${fPct(model.startMargin)} · +${model.scenarios[sc].totalExpBps} bps`,
      color: scC.color,
    },
  ]

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────── */}
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
          Pro forma 2026E revenue ${model.baseRevenue}B ·{" "}
          {model.startMargin * 100}% starting EBITDA margin · {sharesM.toLocaleString()}M diluted shares ·
          Net debt ${model.netDebt}B{maRate > 0 ? ` · M&A reinvestment ${Math.round(maRate * 100)}% of UFCF @ ${model.maMultiple}× EBITDA` : ""} · Price ref ${model.currentPrice}{" "}
          {priceSource && (
            <span style={{ color: priceSource.startsWith("Live") ? "var(--green)" : "var(--text-3)", fontWeight: 500 }}>
              ({priceSource})
            </span>
          )}
        </div>
      </div>

      {/* ── Controls ───────────────────────────────────────────── */}
      <div className="controls-row">
        {/* scenario */}
        <div className="control-group">
          <div className="section-label">Scenario</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["bear", "base", "bull"] as QxoScenario[]).map(s => (
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
            type="range" min={8} max={12} step={1} value={wacc * 100}
            onChange={e => setWacc(Number(e.target.value) / 100)}
            style={{ width: 180, accentColor: scC.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>8%</span><span>12%</span>
          </div>
        </div>

        {/* terminal growth */}
        <div className="control-group">
          <div className="section-label">Terminal growth: {fPct(termG)}</div>
          <input
            type="range" min={2} max={4} step={0.5} value={termG * 100}
            onChange={e => setTermG(Number(e.target.value) / 100)}
            style={{ width: 180, accentColor: scC.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>2%</span><span>4%</span>
          </div>
        </div>

        {/* diluted shares */}
        <div className="control-group">
          <div className="section-label">Diluted shares: {sharesM.toLocaleString()}M</div>
          <input
            type="range" min={1400} max={2000} step={50} value={sharesM}
            onChange={e => setSharesM(Number(e.target.value))}
            style={{ width: 180, accentColor: scC.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>1,400M</span><span>2,000M</span>
          </div>
        </div>

        {/* M&A reinvestment */}
        <div className="control-group">
          <div className="section-label">M&A reinvestment: {Math.round(maRate * 100)}% of UFCF</div>
          <input
            type="range" min={0} max={60} step={5} value={maRate * 100}
            onChange={e => setMaRate(Number(e.target.value) / 100)}
            style={{ width: 180, accentColor: scC.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>0% (none)</span><span>60%</span>
          </div>
        </div>

        {/* tabs */}
        <div className="control-group">
          <div className="section-label">View</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["model", "sensitivity", "assumptions"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`tab-btn ${tab === t ? "active" : ""}`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────── */}
      <div className="kpi-strip">
        {kpis.map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── MODEL TAB ──────────────────────────────────────────── */}
      {tab === "model" && (
        <div>
          <div className="section-label">
            2027–2035 Explicit Forecast — {sc.charAt(0).toUpperCase() + sc.slice(1)} Case ·{" "}
            {fPct(model.scenarios[sc].revGrowth)} growth · +{model.scenarios[sc].totalExpBps} bps margin over {model.yrsExpansion} yrs
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Revenue</th>
                  {maRate > 0 && <th style={{ color: "var(--purple)" }}>M&A Rev</th>}
                  <th>EBITDA Margin</th>
                  <th>NOPAT</th>
                  <th>ΔWC</th>
                  {maRate > 0 && <th style={{ color: "var(--purple)" }}>M&A Spend</th>}
                  <th>{maRate > 0 ? "Distr. UFCF" : "UFCF"}</th>
                  <th>PV of FCF</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => {
                  const isStable = r.year > 2026 + model.yrsExpansion
                  return (
                    <tr key={r.year}>
                      <td style={{ color: isStable ? "var(--purple)" : "var(--text-1)" }}>
                        {r.year}
                      </td>
                      <td>{fB(r.rev)}</td>
                      {maRate > 0 && (
                        <td style={{ color: r.maRev > 0 ? "var(--purple)" : "var(--text-3)", fontSize: 11 }}>
                          {r.maRev > 0.005 ? fB(r.maRev) : "—"}
                        </td>
                      )}
                      <td style={{ color: scC.color }}>{fPct(r.ebitdaM)}</td>
                      <td>{fB(r.nopat)}</td>
                      <td style={{ color: "var(--amber)" }}>(${f1(r.dwc * 1000)}M)</td>
                      {maRate > 0 && (
                        <td style={{ color: "var(--purple)", fontSize: 11 }}>
                          {r.maSpend > 0.005 ? `(${fB(r.maSpend)})` : "—"}
                        </td>
                      )}
                      <td style={{ fontWeight: 600 }}>{fB(r.ufcf)}</td>
                      <td style={{ color: "var(--accent)" }}>{fB(r.pvFcf)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={7} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    Terminal value · g={fPct(termG)} · WACC={fPct(wacc)} · {f1(M.gordon)}× Gordon multiple
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 600 }}>{fB(M.pvTv)}</td>
                </tr>
                <tr className="ev-row">
                  <td colSpan={7} style={{ color: "var(--accent)", fontWeight: 600, textAlign: "left" }}>
                    Enterprise Value
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>{fB(M.ev)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* bridge */}
          <div className="bridge-card">
            <div className="section-label">EV → Per-Share Value Bridge</div>
            {[
              ["Enterprise Value",               fB(M.ev),                                                         "var(--text-1)"],
              ["(−) Net Debt (at TopBuild close)", `$${f1(model.netDebt)}B`,                                       "var(--red)"   ],
              ["Equity Value",                   fB(M.equity),                                                     "var(--accent)"],
              ["÷ Diluted Shares",               `${sharesM.toLocaleString()}M (${f2(sharesB)}B)`,                "var(--text-2)"],
              ["Intrinsic Value / Share",         fShare(M.perShare),                                              scC.color      ],
              ["Current price reference",         `$${model.currentPrice}`,                                        "var(--text-3)"],
              ["Implied upside / (downside)",     `${M.updown > 0 ? "+" : ""}${f1(M.updown)}%`,                  upCol          ],
              ["10-yr implied CAGR",              `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`,  upCol          ],
            ].map(([k, v, col]) => (
              <div key={k} className="bridge-row">
                <span className="bridge-label">{k}</span>
                <span className="bridge-value" style={{ color: col as string }}>{v}</span>
              </div>
            ))}
          </div>

          {/* phase legend */}
          <div className="phase-legend">
            <div className="phase-item">
              <span className="phase-dot" style={{ background: scC.dim + "88", border: `1px solid ${scC.color}44` }} />
              2027–{2026 + model.yrsExpansion}: Margin expansion phase (+{model.scenarios[sc].totalExpBps / model.yrsExpansion} bps/yr)
            </div>
            <div className="phase-item">
              <span className="phase-dot" style={{ background: "var(--purple-dim)", border: "1px solid rgba(167,139,250,.4)" }} />
              {2027 + model.yrsExpansion}–2035: Stable margin phase · terminal approach
            </div>
          </div>
        </div>
      )}

      {/* ── SENSITIVITY TAB ────────────────────────────────────── */}
      {tab === "sensitivity" && (
        <div>
          <div className="section-label">
            Intrinsic Value / Share ($) — {sc.charAt(0).toUpperCase() + sc.slice(1)} Case
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            Rows = Terminal Growth Rate · Columns = WACC · Diluted shares {sharesM.toLocaleString()}M · Highlighted = current sliders
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="sens-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>TGR ↓ / WACC →</th>
                  {SENS.waccs.map(w => (
                    <th
                      key={w}
                      style={{
                        color:      Math.abs(w - wacc) < 0.001 ? scC.color : "var(--text-3)",
                        fontWeight: Math.abs(w - wacc) < 0.001 ? 700 : 400,
                      }}
                    >
                      {fPct(w)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SENS.tgrs.map((tg, ri) => (
                  <tr key={tg}>
                    <td
                      style={{
                        color:      Math.abs(tg - termG) < 0.001 ? scC.color : "var(--text-2)",
                        fontWeight: Math.abs(tg - termG) < 0.001 ? 700 : 400,
                      }}
                    >
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
                          ${Math.round(val)}
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
            All Three Scenarios at {fPct(model.waccDefault)} WACC / {fPct(model.termGrowth)} TGR / {sharesM.toLocaleString()}M shares
          </div>
          <div className="sc-compare">
            {(["bear", "base", "bull"] as QxoScenario[]).map(s => {
              const m2 = runQxoDCF(model, s, model.waccDefault, model.termGrowth, sharesB)
              const mt = SC_COLORS[s]
              const cfg = model.scenarios[s]
              return (
                <div key={s} className="sc-card" style={{ background: mt.dim + "88", border: `1px solid ${mt.color}44` }}>
                  <div className="sc-card-label" style={{ color: mt.color }}>
                    {s.charAt(0).toUpperCase() + s.slice(1)} Case
                  </div>
                  <div className="sc-card-value" style={{ color: mt.color }}>{fShare(m2.perShare)}</div>
                  <div className="sc-card-updown" style={{ color: "var(--text-2)" }}>
                    {m2.updown > 0 ? "+" : ""}{f1(m2.updown)}% vs ${model.currentPrice}
                  </div>
                  <div className="sc-card-stat">Rev growth: {fPct(cfg.revGrowth)}/yr</div>
                  <div className="sc-card-stat">Margin exp: +{cfg.totalExpBps} bps</div>
                  <div className="sc-card-stat">2035E Rev: {fB(m2.rows[9].rev)}</div>
                  <div className="sc-card-stat">2035E UFCF: {fB(m2.rows[9].ufcf)}</div>
                  <div className="sc-card-stat">EV: {fB(m2.ev)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── ASSUMPTIONS TAB ────────────────────────────────────── */}
      {tab === "assumptions" && (
        <div className="assumptions-grid">
          {[
            {
              title: "DCF Framework",
              color: "var(--accent)",
              rows: [
                ["Engine",               "NOPAT-based UFCF bridge"],
                ["FCF formula",          "NOPAT + D&A − CapEx − ΔWC"],
                ["D&A",                  `${fPct(model.daRate)} of revenue (asset-light distribution)`],
                ["CapEx",                `${fPct(model.capexRate)} of revenue (maintenance ≈ D&A → net capex ≈ 0)`],
                ["Net working capital",  `${fPct(model.nwcRate)} of revenue · ΔWC = ${fPct(model.nwcRate)} × ΔRev`],
                ["Tax rate",             fPct(model.taxRate) + " effective (per QXO Q3 2025 adj. rate)"],
              ],
            },
            {
              title: "Revenue Assumptions",
              color: "var(--green)",
              rows: [
                ["2026E pro forma base",  `$${model.baseRevenue}B (Beacon ~$9.0B + Kodiak ~$2.4B + TopBuild ~$6.2B + adj)`],
                ["Bear rev growth",       fPct(model.scenarios.bear.revGrowth) + "/yr — housing downturn scenario"],
                ["Base rev growth",       fPct(model.scenarios.base.revGrowth) + "/yr — per QXO mid-single digit guidance"],
                ["Bull rev growth",       fPct(model.scenarios.bull.revGrowth) + "/yr — housing recovery + M&A tuck-ins"],
                ["Horizon",              "10-year explicit (2027–2035); terminal value after Year 10"],
                ["Acquisition growth",   "No additional acquisitions assumed beyond Beacon, Kodiak, TopBuild"],
              ],
            },
            {
              title: "EBITDA Margin Path",
              color: "var(--amber)",
              rows: [
                ["Starting margin (all scenarios)", fPct(model.startMargin) + " blended (Beacon ~11%, TopBuild ~18%, Kodiak ~11%)"],
                ["Expansion period",               `Years 1–${model.yrsExpansion}; stable in Years ${model.yrsExpansion + 1}–10`],
                ["Bear: total expansion",           `+${model.scenarios.bear.totalExpBps} bps → ${fPct(model.startMargin + model.scenarios.bear.totalExpBps / 10000)} final`],
                ["Base: total expansion",           `+${model.scenarios.base.totalExpBps} bps → ${fPct(model.startMargin + model.scenarios.base.totalExpBps / 10000)} final (per QXO guidance)`],
                ["Bull: total expansion",           `+${model.scenarios.bull.totalExpBps} bps → ${fPct(model.startMargin + model.scenarios.bull.totalExpBps / 10000)} final`],
                ["Drivers",                         "ZBB, vendor rebates at scale, branch integration, SG&A leverage"],
              ],
            },
            {
              title: "Capital Structure",
              color: "var(--purple)",
              rows: [
                ["Net debt at TopBuild close",   `$${model.netDebt}B (gross $9.1B − ~$2.1B cash)`],
                ["Gross debt breakdown",          "$2.25B notes + $0.85B TLB + $3.0B new TLB + $3.0B HY notes"],
                ["Default diluted shares",        `${Math.round(model.sharesOut * 1000).toLocaleString()}M (all preferred converted)`],
                ["Preferred cash burden",         "~$173M/yr ($30.7M Series B + $142.5M Series C at 4.75%)"],
                ["Shares slider range",           "1,400M–2,000M: captures TopBuild exchange ratio & Series C conversion uncertainty"],
                ["Default WACC / TGR",            `${fPct(model.waccDefault)} / ${fPct(model.termGrowth)}`],
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
        NOPAT-based UFCF engine · FCF = NOPAT + D&A − CapEx − ΔWC · Pro forma combined (Beacon + Kodiak + TopBuild) ·
        No additional acquisitions assumed · All preferred treated as converted to common equity ·
        Updated {model.lastUpdated}
      </div>
    </div>
  )
}
