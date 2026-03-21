"use client"
import { useState, useMemo } from "react"
import type { LemonadeModelConfig } from "@/lib/lemonade-models"
import { runLemonadeDCF, buildLemonadeSensitivity } from "@/lib/lemonade-engine"

// ── Formatters ─────────────────────────────────────────────────
function f1(n: number) { return n.toFixed(1) }
function f2(n: number) { return n.toFixed(2) }
function fPct(n: number) { return (n * 100).toFixed(1) + "%" }
function fPct1(n: number) { return (n * 100).toFixed(1) + "%" }  // alias for clarity

// Sub-$1B → $mm; $1B+ → $B; parentheses for negatives
function fB(n: number): string {
  const abs = Math.abs(n)
  const neg = n < 0
  if (abs >= 1) return (neg ? "($" : "$") + abs.toFixed(1) + "B" + (neg ? ")" : "")
  const mm = Math.round(abs * 1000)
  return (neg ? "($" : "$") + mm + "M" + (neg ? ")" : "")
}
function fShare(n: number): string { return "$" + Math.round(n) }

function sensColor(val: number, currentPrice: number): string {
  const r = val / currentPrice
  if (r >= 1.3) return "sens-cell-green"
  if (r >= 1.0) return "sens-cell-accent"
  if (r >= 0.7) return "sens-cell-amber"
  return "sens-cell-red"
}

// Combined ratio color: green <90%, accent <100%, amber <110%, red ≥110%
function combinedRatioColor(cr: number): string {
  if (cr < 0.90) return "var(--green)"
  if (cr < 1.00) return "var(--accent)"
  if (cr < 1.10) return "var(--amber)"
  return "var(--red)"
}

export default function LemonadeModelShell({
  model,
  priceSource,
}: {
  model: LemonadeModelConfig
  priceSource?: string
}) {
  const [lossRatio, setLossRatio] = useState(model.lossRatioDefault)
  const [termG,     setTermG]     = useState(model.termGrowth)
  const [tab,       setTab]       = useState<"model" | "sensitivity" | "assumptions">("model")

  const M    = useMemo(() => runLemonadeDCF(model, lossRatio, termG), [model, lossRatio, termG])
  const SENS = useMemo(() => buildLemonadeSensitivity(model),          [model])

  const accent = model.accentColor ?? "var(--accent)"
  const upCol  = M.updown > 0 ? "var(--green)" : "var(--red)"

  // 2035 combined ratio for KPI
  const finalCombined = M.rows[9].combinedRatio

  const kpis = [
    {
      label: "Intrinsic Value / Share",
      value: fShare(M.perShare),
      sub:   `vs $${model.currentPrice} · ${M.updown > 0 ? "+" : ""}${f1(M.updown)}% implied`,
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
      label: "2035E IFP",
      value: fB(M.rows[9].ifp),
      sub:   `${f2(M.rows[9].ifp / model.baseIfp)}× FY${model.baseYear} base`,
      color: "var(--text-1)",
    },
    {
      label: "2035E Combined Ratio",
      value: fPct(finalCombined),
      sub:   `Loss ${fPct(M.rows[9].lossRatio)} + Expense ${fPct(M.rows[9].expenseRatio)}`,
      color: combinedRatioColor(finalCombined),
    },
    {
      label: "10-yr Implied CAGR",
      value: `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`,
      sub:   `vs $${model.currentPrice} today`,
      color: upCol,
    },
  ]

  return (
    <div>
      {/* header */}
      <div className="model-header">
        <div className="model-header-row">
          <div className="model-ticker-badge" style={{ background: "#c94f1a" }}>
            {model.ticker}
          </div>
          <div className="model-header-label">
            {model.name} · {model.exchange} · IFP-Driven DCF
          </div>
        </div>
        <div className="model-subline">
          Base year FY{model.baseYear}E · IFP ${model.baseIfp.toFixed(3)}B ·{" "}
          {Math.round(model.sharesOut * 1000)}mm diluted shares · Net cash ${model.netCash.toFixed(3)}B ·
          Price ref ${model.currentPrice}{" "}
          {priceSource && (
            <span style={{ color: priceSource.startsWith("Live") ? "var(--green)" : "var(--text-3)", fontWeight: 500 }}>
              ({priceSource})
            </span>
          )}
        </div>
        <div className="model-subline">
          IFP-driven insurance DCF · NEP = IFP × (1−cession) × 0.92 earned ratio ·
          Gross loss ratio {fPct(lossRatio)} → {fPct(Math.max(0, lossRatio - 9 * model.lossRatioStepDown))} ·
          Cession 20 %→0 % step-down · WACC {fPct(model.waccDefault)} · Terminal g {fPct(termG)}
        </div>
      </div>

      {/* controls */}
      <div className="controls-row">
        <div className="control-group">
          <div className="section-label">Gross Loss Ratio (yr 1): {fPct(lossRatio)}</div>
          <input
            type="range" min={50} max={100} step={0.5} value={lossRatio * 100}
            onChange={e => setLossRatio(Number(e.target.value) / 100)}
            style={{ width: 180, accentColor: accent }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>50%</span><span>100%</span>
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

          {/* ── SECTION 1: P&L Waterfall ─────────────────────── */}
          <div className="section-label">FY2026–2035 Underwriting P&L Waterfall</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 10 }}>
            Operating leverage: OpEx grows 5%/yr → 1.5%/yr while NEP compounds at ~28%/yr → ~17%/yr,
            collapsing the expense ratio and driving the combined ratio below 75% by 2035.
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>IFP</th>
                  <th>NEP</th>
                  <th>Loss &amp; LAE</th>
                  <th>Loss Ratio</th>
                  <th>GC Comm</th>
                  <th>OpEx</th>
                  <th>Exp Ratio</th>
                  <th style={{ borderLeft: "1px solid rgba(37,43,59,1)" }}>Combined</th>
                  <th>Inv Income</th>
                  <th>EBIT</th>
                  <th>EBIT Mgn</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => {
                  const isMile   = r.year === 2031
                  const isPhase2 = r.year >= 2031
                  const cr       = r.combinedRatio
                  const crCol    = combinedRatioColor(cr)
                  return (
                    <tr key={r.year} style={{ borderBottom: `1px solid ${isMile ? accent + "55" : "rgba(37,43,59,0.88)"}` }}>
                      <td style={{ color: isMile ? accent : isPhase2 ? "var(--purple)" : "var(--text-1)", fontWeight: isMile ? 700 : 400 }}>
                        {r.year}{isMile ? " ★" : ""}
                      </td>
                      <td style={{ color: accent }}>{fB(r.ifp)}</td>
                      <td>{fB(r.nep)}</td>
                      <td style={{ color: "var(--red-dim)" }}>{fB(r.lossAndLae)}</td>
                      <td style={{ color: "var(--text-3)" }}>{fPct1(r.lossRatio)}</td>
                      <td style={{ color: "var(--amber)" }}>{fB(r.gcCommission)}</td>
                      <td style={{ color: "var(--amber)" }}>{fB(r.opex)}</td>
                      <td style={{ color: "var(--text-3)" }}>{fPct1(r.expenseRatio)}</td>
                      <td style={{
                        color: crCol,
                        fontWeight: 600,
                        borderLeft: "1px solid rgba(37,43,59,1)",
                      }}>
                        {fPct1(cr)}
                      </td>
                      <td style={{ color: "var(--green)" }}>{fB(r.investmentIncome)}</td>
                      <td style={{ color: r.ebit < 0 ? "var(--red)" : "var(--text-1)", fontWeight: 600 }}>
                        {fB(r.ebit)}
                      </td>
                      <td style={{ color: r.ebitMargin < 0 ? "var(--red)" : "var(--text-3)" }}>
                        {fPct1(r.ebitMargin)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* combined ratio legend */}
          <div className="sens-legend" style={{ marginTop: 10, marginBottom: 24 }}>
            {[
              ["var(--green)",  "<90% (best-in-class underwriting)"],
              ["var(--accent)", "90–100% (profitable)"],
              ["var(--amber)",  "100–110% (marginal)"],
              ["var(--red)",    ">110% (underwriting loss)"],
            ].map(([col, lbl]) => (
              <div key={lbl} className="sens-legend-item" style={{ color: col }}>
                <span className="sens-legend-swatch" style={{ background: col + "22", border: `1px solid ${col}66` }} />
                {lbl}
              </div>
            ))}
          </div>

          {/* ── SECTION 2: FCF & Cash / Book Equity ─────────── */}
          <div className="section-label">FCF, Cash Balance &amp; Stockholders&apos; Equity Over Time</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 10 }}>
            Cash balance = FY{model.baseYear} net cash + cumulative FCFs received.
            Book equity = FY{model.baseYear} stockholders&apos; equity + cumulative NOPAT (net income proxy).
            No dividends paid; SBC add-back excluded.
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>NOPAT</th>
                  <th>FCF</th>
                  <th>PV of FCF</th>
                  <th>Cash Balance</th>
                  <th>Book Equity</th>
                  <th>Book Eq / Share</th>
                  <th>Shares</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => {
                  const isMile   = r.year === 2031
                  const isPhase2 = r.year >= 2031
                  const isLoss   = r.fcf < 0
                  return (
                    <tr key={r.year} style={{ borderBottom: `1px solid ${isMile ? accent + "55" : "rgba(37,43,59,0.88)"}` }}>
                      <td style={{ color: isMile ? accent : isPhase2 ? "var(--purple)" : "var(--text-1)", fontWeight: isMile ? 700 : 400 }}>
                        {r.year}{isMile ? " ★" : ""}
                      </td>
                      <td style={{ color: r.nopat < 0 ? "var(--red)" : "var(--text-2)" }}>
                        {fB(r.nopat)}
                      </td>
                      <td style={{ color: isLoss ? "var(--red)" : "var(--text-1)", fontWeight: isLoss ? 600 : 400 }}>
                        {fB(r.fcf)}
                      </td>
                      <td style={{ color: isLoss ? "var(--red-dim)" : "var(--accent)" }}>
                        {fB(r.pvFcf)}
                      </td>
                      <td style={{ color: r.cashBalance < 0 ? "var(--red)" : "var(--green)" }}>
                        {fB(r.cashBalance)}
                      </td>
                      <td style={{ color: r.bookEquity < 0 ? "var(--red)" : "var(--purple)", fontWeight: 600 }}>
                        {fB(r.bookEquity)}
                      </td>
                      <td style={{ color: r.bookEquityPerShare < 0 ? "var(--red)" : "var(--purple)", fontWeight: 700 }}>
                        ${f2(r.bookEquityPerShare)}
                      </td>
                      <td style={{ color: "var(--text-3)", fontSize: 11 }}>
                        {Math.round(r.shares * 1000)}mm
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    Terminal value · g={fPct(termG)} · WACC={fPct(model.waccDefault)} · {f1(M.gordon)}× Gordon multiple
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 600 }}>{fB(M.pvTv)}</td>
                  <td colSpan={5} />
                </tr>
                <tr className="ev-row">
                  <td colSpan={3} style={{ color: "var(--accent)", fontWeight: 600, textAlign: "left" }}>Enterprise Value</td>
                  <td style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>{fB(M.ev)}</td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ── SECTION 3: EV → Per-Share Bridge ───────────── */}
          <div className="bridge-card">
            <div className="section-label">EV → Per-Share Value Bridge</div>
            {[
              ["Enterprise Value",                    fB(M.ev),                                       "var(--text-1)"],
              [`(+) Net cash (FY${model.baseYear}E)`, fB(model.netCash),                              "var(--green)" ],
              ...(model.gcObligationB > 0
                ? [["(−) GC obligation (quasi-debt)",  `(${fB(model.gcObligationB)})`,                "var(--red)"  ] as [string,string,string]]
                : [["(−) GC obligation",               "not set — update gcObligationB in lemonade-models.ts", "var(--text-3)"] as [string,string,string]]
              ),
              ["Equity Value",                        fB(M.equity),                                   "var(--accent)"],
              ["÷ Terminal-year shares",              Math.round(M.rows[9].shares * 1000) + "mm",     "var(--text-2)"],
              ["Intrinsic Value / Share",             fShare(M.perShare),                             accent         ],
              ["Current price reference",             `$${model.currentPrice}`,                       "var(--text-3)"],
              ["Implied upside / (downside)",         `${M.updown > 0 ? "+" : ""}${f1(M.updown)}%`,  upCol          ],
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
              2026: Underwriting loss · full-year loss period
            </div>
            <div className="phase-item">
              <span className="phase-dot" style={{ background: accent + "22", border: `1px solid ${accent}55` }} />
              2027–2030: Breakeven → profitability · cession rolling off
            </div>
            <div className="phase-item">
              <span className="phase-dot" style={{ background: "var(--purple-dim)", border: "1px solid rgba(167,139,250,.4)" }} />
              2031–2035: Scale → combined ratio collapse → terminal approach
            </div>
            <span style={{ fontSize: 11, color: accent }}>★ = Phase 3 start (2031)</span>
          </div>
        </div>
      )}

      {/* ── SENSITIVITY TAB ── */}
      {tab === "sensitivity" && (
        <div>
          <div className="section-label">Intrinsic Value / Share ($)</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            Rows = starting gross loss ratio (yr 1) · Columns = terminal IFP growth · Highlighted = current sliders ·
            WACC fixed at {fPct(model.waccDefault)}
            {model.gcObligationB > 0 && ` · GC obligation of ${fB(model.gcObligationB)} deducted`}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="sens-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Loss Ratio ↓ / Term g →</th>
                  {SENS.tgrows.map(tg => (
                    <th key={tg} style={{ color: Math.abs(tg - termG) < 0.001 ? accent : "var(--text-3)", fontWeight: Math.abs(tg - termG) < 0.001 ? 700 : 400 }}>
                      {fPct(tg)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SENS.lossRatios.map((lr, ri) => (
                  <tr key={lr}>
                    <td style={{ color: Math.abs(lr - lossRatio) < 0.001 ? accent : "var(--text-2)", fontWeight: Math.abs(lr - lossRatio) < 0.001 ? 700 : 400 }}>
                      {fPct(lr)}
                    </td>
                    {SENS.tgrows.map((tg, ci) => {
                      const val = SENS.grid[ri][ci]
                      const sel = Math.abs(lr - lossRatio) < 0.001 && Math.abs(tg - termG) < 0.001
                      const cls = sensColor(val, model.currentPrice)
                      return (
                        <td key={tg} className={`${cls} ${sel ? "sens-cell-selected" : ""}`}
                          style={sel ? { borderColor: accent, color: accent } : {}}>
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
        </div>
      )}

      {/* ── ASSUMPTIONS TAB ── */}
      {tab === "assumptions" && (
        <div className="assumptions-grid">
          {[
            {
              title: "IFP Growth Model",
              color: accent,
              rows: [
                ["Base IFP (FY2025E)", `$${model.baseIfp.toFixed(3)}B (${Math.round(model.baseIfp * 1000)}mm)`],
                ["IFP growth yrs 1–5", "~27.5%/yr"],
                ["IFP growth yrs 6–10", "~17.5%/yr"],
                ["Terminal IFP growth", fPct(model.termGrowth)],
                ["2035E IFP", fB(model.ifpSchedule[9])],
                ["2035E NEP", fB(model.nepSchedule[9])],
              ],
            },
            {
              title: "Insurance Economics",
              color: "var(--green)",
              rows: [
                ["NEP formula", "IFP × (1 − cession rate) × 0.92 earned ratio"],
                ["Cession rate", "20% (2025) → 0% (2035) — ~2pp/yr step-down"],
                ["Net loss ratio", `${fPct(model.lossRatioDefault)} (2026) → ${fPct(Math.max(0, model.lossRatioDefault - 9 * model.lossRatioStepDown))} (2035) — ${fPct1(model.lossRatioStepDown)} improvement/yr`],
                ["GC synthetic commission", "16% on financed IFP (50% new IFP yrs 1–3, 25% yrs 4–6, 0% yrs 7–10)"],
                ["OpEx growth", "5.0%/yr yrs 1–5 · 1.5%/yr yrs 6–10"],
                ["OpEx base (FY2025E)", "$415mm"],
                ["Investment income", "~2–3% yield on cash / float; grows from $23mm (2026) → $199mm (2035)"],
                ["2035E combined ratio", fPct(M.rows[9].combinedRatio)],
              ],
            },
            {
              title: "General Catalyst Obligations",
              color: "var(--red)",
              rows: [
                ["GC commission (in EBIT)", "Already reflected — 16% synthetic commission on financed IFP"],
                ["GC commission (2026–2031)", "Explicit line item in P&L waterfall"],
                ["Additional GC obligation", model.gcObligationB > 0
                  ? `${fB(model.gcObligationB)} deducted from equity (set in model config)`
                  : "Not yet set — update gcObligationB in lemonade-models.ts with verified balance"
                ],
                ["Nature of obligation", "Quasi-debt: committed facility balance, profit-participation, or termination fee not captured in operating cash flows"],
              ],
            },
            {
              title: "NOPAT, FCF & Capital",
              color: "var(--amber)",
              rows: [
                ["NOPAT treatment", "Full loss in yr 1 (no DTA); EBIT × (1−25% tax) for profitable years"],
                ["FCF vs NOPAT", "FCF ≈ NOPAT + ~$10mm D&A (software intangibles amortisation)"],
                ["Dilution schedule", "+1.5%/yr yrs 1–3 · +0.5%/yr yrs 4–5 · flat yrs 6–10"],
                ["Base shares", `${Math.round(model.sharesOut * 1000)}mm diluted`],
                ["Terminal shares (2035)", `${Math.round(model.sharesSchedule[9] * 1000)}mm diluted`],
                ["Net cash (FY2025E)", fB(model.netCash)],
                ["Book equity (FY2025 actual)", fB(model.baseBookEquity) + " — Q4 2025 balance sheet"],
                ["2035E cash balance", fB(M.rows[9].cashBalance)],
                ["2035E book equity", fB(M.rows[9].bookEquity)],
                ["2035E book equity / share", "$" + f2(M.rows[9].bookEquityPerShare)],
              ],
            },
            {
              title: "Valuation",
              color: "var(--purple)",
              rows: [
                ["Default WACC", fPct(model.waccDefault)],
                ["Default terminal growth", fPct(model.termGrowth)],
                ["Gordon multiple (defaults)", f1((1 + model.termGrowth) / (model.waccDefault - model.termGrowth)) + "×"],
                ["Current price reference", `$${model.currentPrice}/share`],
                ["GC obligation deduction", model.gcObligationB > 0 ? fB(model.gcObligationB) : "Not set (0)"],
                ["Scenario", "Single scenario — bear/bull alternatives to be added"],
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
        For informational and educational purposes only · Not investment advice · All figures in USD ·
        IFP-driven insurance DCF · Full P&amp;L: NEP − Loss&amp;LAE − GC Commission − OpEx + Inv Income = EBIT ·
        {model.gcObligationB > 0
          ? ` GC obligation ${fB(model.gcObligationB)} deducted from equity ·`
          : " GC balance-sheet obligation not yet set ·"
        }{" "}
        Single scenario · Updated {model.lastUpdated}
      </div>
    </div>
  )
}
