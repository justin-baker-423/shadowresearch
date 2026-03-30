"use client"
import { useState, useMemo } from "react"
import type { AtlassianModelConfig, Scenario } from "@/lib/atlassian-models"
import { runAtlassianDCF, buildAtlassianSensitivity } from "@/lib/atlassian-engine"

// ── Formatters ────────────────────────────────────────────────────
function f1(n: number) { return n.toFixed(1) }
function f2(n: number) { return n.toFixed(2) }
function fPct(n: number) { return f1(n * 100) + "%" }
function fB(n: number, showSign = false) {
  const prefix = showSign && n > 0 ? "+" : ""
  return prefix + "$" + f1(Math.abs(n)) + "B" + (n < 0 ? " —" : "")
}
function fShare(n: number) { return "$" + Math.round(n) }

const SC_COLORS: Record<Scenario, { color: string; dim: string }> = {
  bear: { color: "var(--red)",    dim: "var(--red-dim)"    },
  base: { color: "var(--accent)", dim: "var(--accent-dim)" },
  bull: { color: "var(--green)",  dim: "var(--green-dim)"  },
}

export default function AtlassianModelShell({
  model,
  priceSource,
}: {
  model: AtlassianModelConfig
  priceSource?: string
}) {
  const [sc,     setSc]     = useState<Scenario>("base")
  const [wacc,   setWacc]   = useState(model.waccDefault)
  const [exitMx, setExitMx] = useState(model.exitMultipleDefault)
  const [tab,    setTab]    = useState<"model" | "rd" | "sensitivity" | "assumptions">("model")

  const M    = useMemo(() => runAtlassianDCF(model, sc, wacc, exitMx),   [model, sc, wacc, exitMx])
  const SENS = useMemo(() => buildAtlassianSensitivity(model, sc, wacc), [model, sc, wacc])

  const scColors = SC_COLORS[sc]
  const accent   = model.accentColor ?? "#0052cc"
  const upCol    = M.updown > 0 ? "var(--green)" : "var(--red)"

  function sensColor(val: number) {
    const r = val / model.currentPrice
    if (r >= 1.3) return "sens-cell-green"
    if (r >= 1.0) return "sens-cell-accent"
    if (r >= 0.7) return "sens-cell-amber"
    return "sens-cell-red"
  }

  const lastRow = M.rows[9]

  // Opening net R&D asset (for display)
  const openingRdAsset = model.historicalRdCohorts.reduce(
    (acc, c, i) => acc + c * (model.rdLife - 1 - i) / model.rdLife, 0
  )

  // ── KPI strip ──────────────────────────────────────────────────
  const kpis = [
    {
      label: "Intrinsic Value / Share",
      value: fShare(M.perShare),
      sub:   `vs $${Math.round(model.currentPrice)} · ${M.updown > 0 ? "+" : ""}${f1(M.updown)}%`,
      color: upCol,
    },
    {
      label: "10-yr Implied CAGR",
      value: `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`,
      sub:   `from $${Math.round(model.currentPrice)} today`,
      color: upCol,
    },
    {
      label: "Enterprise Value",
      value: fB(M.ev),
      sub:   `PV earnings ${fB(M.sumPvAdjNi)} · PV terminal ${fB(M.pvTv)}`,
      color: "var(--text-1)",
    },
    {
      label: "TV / EV",
      value: f1(M.tvWeight * 100) + "%",
      sub:   `${exitMx}× FY35 Adj NI`,
      color: "var(--amber)",
    },
    {
      label: "FY35E Revenue",
      value: fB(lastRow.rev),
      sub:   `${f2(lastRow.rev / model.baseRevenue)}× FY${model.baseYear} base`,
      color: "var(--text-1)",
    },
    {
      label: "FY35E Adj NI",
      value: fB(lastRow.adjNi),
      sub:   `${fPct(lastRow.adjNiM)} margin · GAAP was ${fPct(lastRow.gaapNiM)}`,
      color: scColors.color,
    },
    {
      label: "FY35E Hidden Earnings",
      value: fB(lastRow.hiddenEarnings),
      sub:   `GAAP understates NI by this amount in FY35`,
      color: "var(--purple)",
    },
  ]

  return (
    <div>
      {/* ── Header ───────────────────────────────────────────────── */}
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
          Base year FY{model.baseYear}A · Revenue ${model.baseRevenue}B ·{" "}
          {Math.round(model.sharesOut * 1000)}M diluted shares · Net cash ${model.netCash}B · Price ref ${Math.round(model.currentPrice)}{" "}
          {priceSource && (
            <span style={{ color: priceSource.startsWith("Live") ? "var(--green)" : "var(--text-3)", fontWeight: 500 }}>
              ({priceSource})
            </span>
          )}
        </div>
        <div className="model-subline">
          R&D Capitalisation engine · {model.rdLife}-yr straight-line amortisation ·
          Terminal value = {exitMx}× Adj NI (FY35) ·
          WACC {fPct(wacc)} · Atlassian FY ends June 30
        </div>
      </div>

      {/* ── Controls ─────────────────────────────────────────────── */}
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
          <div className="section-label">Exit P/E: {exitMx}×</div>
          <input
            type="range" min={12} max={35} step={1} value={exitMx}
            onChange={e => setExitMx(Number(e.target.value))}
            style={{ width: 180, accentColor: scColors.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>12×</span><span>35×</span>
          </div>
        </div>

        <div className="control-group">
          <div className="section-label">View</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["model", "rd", "sensitivity", "assumptions"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`tab-btn ${tab === t ? "active" : ""}`}
              >
                {t === "rd" ? "R&D Capital" : t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI strip ────────────────────────────────────────────── */}
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
          MODEL TAB
      ════════════════════════════════════════════════════════════ */}
      {tab === "model" && (
        <div>
          <div className="section-label">
            FY26–FY35 Adjusted Earnings — {sc.charAt(0).toUpperCase() + sc.slice(1)} Case
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 12 }}>
            Adj NI: R&D expensed as amortisation only · GAAP NI: full R&D expensed ·
            Hidden Earnings: the gap GAAP reporting conceals
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>FY</th>
                  <th>Revenue</th>
                  <th>Rev Δ</th>
                  <th>R&amp;D Spend</th>
                  <th>R&amp;D Amort</th>
                  <th>Adj EBIT%</th>
                  <th style={{ color: scColors.color }}>Adj NI</th>
                  <th>GAAP NI</th>
                  <th style={{ color: "var(--purple)" }}>Hidden Earnings</th>
                  <th>PV (Adj NI)</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map((r) => {
                  const amortCatchingUp = r.rdAmort / r.rdSpend
                  return (
                    <tr key={r.year}>
                      <td style={{ color: accent, fontWeight: 600 }}>{r.fyLabel}</td>
                      <td>{fB(r.rev)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fPct(r.revGrowth)}</td>
                      <td style={{ color: "var(--amber)" }}>
                        {fB(r.rdSpend)}
                        <span style={{ fontSize: 9, color: "var(--text-3)", marginLeft: 4 }}>
                          ({fPct(r.rdSpend / r.rev)})
                        </span>
                      </td>
                      <td style={{ color: "var(--text-2)" }}>
                        {fB(r.rdAmort)}
                        <span style={{
                          fontSize: 9, marginLeft: 4,
                          color: amortCatchingUp > 0.7 ? "var(--green)" : "var(--text-3)",
                        }}>
                          ({fPct(amortCatchingUp)} of spend)
                        </span>
                      </td>
                      <td style={{ color: scColors.color }}>{fPct(r.adjEbitM)}</td>
                      <td style={{ color: scColors.color, fontWeight: 700 }}>{fB(r.adjNi)}</td>
                      <td style={{ color: r.gaapNi < 0 ? "var(--red)" : "var(--text-3)" }}>
                        {fB(r.gaapNi)}
                      </td>
                      <td style={{ color: "var(--purple)", fontWeight: 600 }}>
                        +{fB(r.hiddenEarnings)}
                      </td>
                      <td style={{ color: "var(--accent)" }}>{fB(r.pvAdjNi)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={9} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    Terminal value · {exitMx}× FY35 Adj NI of {fB(lastRow.adjNi)} = {fB(exitMx * lastRow.adjNi)} · WACC {fPct(wacc)}
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 600 }}>{fB(M.pvTv)}</td>
                </tr>
                <tr className="ev-row">
                  <td colSpan={9} style={{ color: "var(--accent)", fontWeight: 600, textAlign: "left" }}>
                    Enterprise Value
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>{fB(M.ev)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Earnings convergence insight */}
          <div style={{
            marginTop: 18, padding: "14px 18px",
            background: "var(--card-bg)", borderRadius: 8,
            border: `1px solid ${accent}33`,
          }}>
            <div className="section-label" style={{ marginBottom: 8 }}>
              The Convergence Thesis — Why Adj NI Reflects True Earnings Power
            </div>
            <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.75, maxWidth: 720 }}>
              Under GAAP, Atlassian expenses the full cost of R&D immediately — treating multi-year
              software investments as if they produce no future value. Capitalising R&D replaces that
              with amortisation: only {fPct(1 / model.rdLife)} of each year's R&D cohort flows through
              the income statement per year, for {model.rdLife} years.{" "}
              <strong style={{ color: "var(--text-1)" }}>
                If Atlassian stopped all incremental R&D tomorrow,
              </strong>{" "}
              cash generation would surge immediately (the cash R&D spend stops), and over the
              following decade the only R&D charge on the P&L would be the declining amortisation of
              the existing asset — converging toward exactly these Adj NI figures as the final cohort
              runs off. The{" "}
              <strong style={{ color: "var(--purple)" }}>
                {fB(lastRow.hiddenEarnings)} of hidden earnings
              </strong>{" "}
              in FY35 represents the structural understatement built into GAAP reporting for a
              business that has already made the investment.
            </div>
          </div>

          {/* EV → per-share bridge */}
          <div className="bridge-card">
            <div className="section-label">EV → Per-Share Value Bridge</div>
            {[
              ["PV of Adj Earnings (FY26–35)",       fB(M.sumPvAdjNi),                                   "var(--text-1)"],
              [`(+) PV of Terminal Value (${exitMx}× FY35 Adj NI)`, fB(M.pvTv),                          "var(--text-1)"],
              ["Enterprise Value",                    fB(M.ev),                                           "var(--accent)"],
              [`(+) Net cash (FY${model.baseYear}A)`, `$${model.netCash}B`,                               "var(--green)" ],
              ["Equity Value",                        fB(M.equity),                                       "var(--accent)"],
              ["÷ Shares (FY35E post-dilution)",      Math.round(M.rows[9].shares * 1000) + "M",          "var(--text-2)"],
              ["Intrinsic Value / Share",              fShare(M.perShare),                                scColors.color ],
              ["Current price reference",             `$${Math.round(model.currentPrice)}`,               "var(--text-3)"],
              ["Implied upside / (downside)",         `${M.updown > 0 ? "+" : ""}${f1(M.updown)}%`,       upCol         ],
              ["10-yr implied CAGR",                  `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`, upCol],
            ].map(([k, v, col]) => (
              <div key={k} className="bridge-row">
                <span className="bridge-label">{k}</span>
                <span className="bridge-value" style={{ color: col }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Scenario compare strip */}
          <div className="section-label" style={{ marginTop: 24 }}>
            All Three Scenarios at {fPct(model.waccDefault)} WACC / {exitMx}× Exit Multiple
          </div>
          <div className="sc-compare">
            {(["bear", "base", "bull"] as Scenario[]).map(s => {
              const m2 = runAtlassianDCF(model, s, model.waccDefault, exitMx)
              const mt = SC_COLORS[s]
              return (
                <div key={s} className="sc-card" style={{ background: mt.dim + "88", border: `1px solid ${mt.color}44` }}>
                  <div className="sc-card-label" style={{ color: mt.color }}>
                    {s.charAt(0).toUpperCase() + s.slice(1)} Case
                  </div>
                  <div className="sc-card-value" style={{ color: mt.color }}>{fShare(m2.perShare)}</div>
                  <div className="sc-card-updown" style={{ color: "var(--text-2)" }}>
                    {m2.updown > 0 ? "+" : ""}{f1(m2.updown)}% vs ${Math.round(model.currentPrice)}
                  </div>
                  <div className="sc-card-stat">FY35E Rev: {fB(m2.rows[9].rev)}</div>
                  <div className="sc-card-stat">FY35E Adj NI: {fB(m2.rows[9].adjNi)} ({fPct(m2.rows[9].adjNiM)})</div>
                  <div className="sc-card-stat">Hidden Earnings FY35: +{fB(m2.rows[9].hiddenEarnings)}</div>
                  <div className="sc-card-stat">EV: {fB(m2.ev)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          R&D CAPITAL TAB
      ════════════════════════════════════════════════════════════ */}
      {tab === "rd" && (
        <div>
          <div className="section-label">
            R&D Capital Schedule — {sc.charAt(0).toUpperCase() + sc.slice(1)} Case
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            10-year straight-line rolling window ·
            Each R&D cohort contributes 1/10 of its value as amortisation per year ·
            Amort/Spend ratio → 100% as growth decelerates
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>FY</th>
                  <th>R&amp;D Spend</th>
                  <th>% of Rev</th>
                  <th>R&amp;D Amort</th>
                  <th>Net R&amp;D Invest</th>
                  <th>Net R&amp;D Asset</th>
                  <th>Asset / Rev</th>
                  <th>Amort / Spend</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => {
                  const netInvest     = r.rdSpend - r.rdAmort
                  const amortToSpend  = r.rdAmort / r.rdSpend
                  return (
                    <tr key={r.year}>
                      <td style={{ color: accent, fontWeight: 600 }}>{r.fyLabel}</td>
                      <td style={{ color: "var(--amber)", fontWeight: 600 }}>{fB(r.rdSpend)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fPct(r.rdSpend / r.rev)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fB(r.rdAmort)}</td>
                      <td style={{ color: "var(--amber)" }}>+{fB(netInvest)}</td>
                      <td style={{ color: "var(--text-1)", fontWeight: 600 }}>{fB(r.rdNetAsset)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fPct(r.rdNetAsset / r.rev)}</td>
                      <td style={{
                        fontWeight: 600,
                        color: amortToSpend > 0.75 ? "var(--green)" : amortToSpend > 0.55 ? "var(--amber)" : "var(--red)",
                      }}>
                        {fPct(amortToSpend)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Historical cohort card */}
          <div style={{
            marginTop: 18, display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12,
          }}>
            <div className="assumption-card">
              <div className="assumption-card-title" style={{ color: "var(--text-1)" }}>
                Opening R&D Intangible Asset (FY26 start)
              </div>
              <div className="assumption-row" style={{ fontWeight: 600 }}>
                <div className="assumption-key">Net opening balance</div>
                <div className="assumption-val" style={{ color: accent }}>${f2(openingRdAsset)}B</div>
              </div>
              {model.historicalRdCohorts.map((c, i) => {
                const yr        = 2025 - i
                const yrsLeft   = model.rdLife - 1 - i
                const netVal    = c * yrsLeft / model.rdLife
                return (
                  <div key={yr} className="assumption-row">
                    <div className="assumption-key">
                      FY{yr.toString().slice(2)} ({yrsLeft}yr left)
                    </div>
                    <div className="assumption-val" style={{
                      color: yrsLeft <= 2 ? "var(--red)" : yrsLeft <= 4 ? "var(--amber)" : "var(--text-2)",
                    }}>
                      ${c.toFixed(2)}B gross → ${netVal.toFixed(2)}B net
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="assumption-card">
              <div className="assumption-card-title" style={{ color: "var(--purple)" }}>
                Why Amort/Spend Rises Over Time
              </div>
              <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.75 }}>
                <p style={{ marginBottom: 8 }}>
                  In FY26, R&D amortisation reflects a 10-year backlog of cohorts including the
                  large, fast-growing FY20–FY25 vintages. The new FY26 cohort adds only 1/10 to
                  amortisation immediately.
                </p>
                <p style={{ marginBottom: 8 }}>
                  As growth decelerates from 22% toward 15%, each new cohort is a smaller
                  increment over the prior year. Meanwhile, amortisation from prior cohorts
                  continues to run. The ratio naturally converges toward 100%
                  — meaning the earnings charge equals the investment, just as for a mature CapEx
                  business where D&amp;A ≈ maintenance capex.
                </p>
                <p>
                  At convergence, Adj NI ≈ true free cash flow. This confirms the
                  earnings-power thesis.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          SENSITIVITY TAB
      ════════════════════════════════════════════════════════════ */}
      {tab === "sensitivity" && (
        <div>
          <div className="section-label">
            Intrinsic Value / Share ($) — Exit P/E Multiple × WACC
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            {sc.charAt(0).toUpperCase() + sc.slice(1)} scenario · R&D leverage path held constant ·
            Highlighted cell = current sliders ({exitMx}× / {fPct(wacc)})
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="sens-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>P/E Exit ↓ / WACC →</th>
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
                {SENS.multiples.map((m, ri) => (
                  <tr key={m}>
                    <td style={{
                      color:      m === exitMx ? scColors.color : "var(--text-2)",
                      fontWeight: m === exitMx ? 700 : 400,
                    }}>
                      {m}×
                    </td>
                    {SENS.waccs.map((w, ci) => {
                      const val = SENS.grid[ri][ci]
                      const sel = Math.abs(w - wacc) < 0.001 && m === exitMx
                      return (
                        <td
                          key={w}
                          className={`${sensColor(val)} ${sel ? "sens-cell-selected" : ""}`}
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

          <div style={{ marginTop: 16, fontSize: 11, color: "var(--text-3)" }}>
            Note: at 10% WACC, a 20× P/E exit multiple is roughly equivalent to a Gordon Growth
            terminal value with ~5% perpetuity growth, reflecting a high-quality, durable software franchise.
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
              title: "R&D Capitalisation",
              color: "var(--purple)",
              rows: [
                ["Engine",                 "R&D Capitalisation (Damodaran)"],
                ["Amortisation life",      `${model.rdLife} years straight-line`],
                ["Opening net R&D asset",  `$${f2(openingRdAsset)}B at FY26 start`],
                ["GAAP treatment",         "Full R&D expensed immediately"],
                ["Adj treatment",          "Only amortisation flows through P&L"],
                ["Terminal value driver",  `${exitMx}× exit P/E on FY35 Adj NI`],
                ["No Gordon Growth",       "Exit multiple replaces terminal growth rate"],
              ],
            },
            {
              title: "Revenue Growth (Fixed)",
              color: "var(--accent)",
              rows: [
                ["FY26 (22%)", fB(M.rows[0].rev)],
                ["FY27 (21%)", fB(M.rows[1].rev)],
                ["FY28 (20%)", fB(M.rows[2].rev)],
                ["FY29 (19%)", fB(M.rows[3].rev)],
                ["FY30 (18%)", fB(M.rows[4].rev)],
                ["FY31 (17%)", fB(M.rows[5].rev)],
                ["FY32 (16%)", fB(M.rows[6].rev)],
                ["FY33–35 (15%)", `${fB(M.rows[7].rev)} → ${fB(M.rows[9].rev)}`],
                ["Gross margin", `${fPct(model.grossMargin)} — held constant`],
              ],
            },
            {
              title: `OpEx Path — ${sc.charAt(0).toUpperCase() + sc.slice(1)} Case`,
              color: scColors.color,
              rows: [
                ["R&D % (FY26→35)", model.scenarios[sc].rdPct.map(p => fPct(p)).join(" → ")],
                ["S&M % (FY26→35)", model.scenarios[sc].smPct.map(p => fPct(p)).join(" → ")],
                ["G&A % (FY26→35)", model.scenarios[sc].gaPct.map(p => fPct(p)).join(" → ")],
                ["Tax rate",        fPct(model.taxRate)],
              ],
            },
            {
              title: "Shares & Valuation",
              color: "var(--amber)",
              rows: [
                ["Dilution FY26–30",  "+1.0%/yr net (SBC grants > buybacks)"],
                ["Dilution FY31–35",  "0% (buybacks match SBC grants)"],
                ["FY35E shares",      `${Math.round(M.rows[9].shares * 1000)}M diluted`],
                ["Default WACC",      fPct(model.waccDefault)],
                ["Default exit P/E",  `${model.exitMultipleDefault}×`],
                ["Net cash (FY25A)",  `$${model.netCash}B`],
                ["FY convention",     "Atlassian FY ends June 30"],
                ["Last updated",      model.lastUpdated],
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
        R&D Capitalisation engine · Adj NI = (GP − R&D Amortisation − OpEx) × (1−tax) ·
        Terminal value = {exitMx}× FY35 Adj NI · Atlassian FY ends June 30 · Updated {model.lastUpdated}
      </div>
    </div>
  )
}
