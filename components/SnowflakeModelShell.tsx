"use client"
import { useState, useMemo } from "react"
import type { SnowflakeModelConfig, Scenario } from "@/lib/snowflake-models"
import { runSnowflakeDCF, buildSnowflakeSensitivity } from "@/lib/snowflake-engine"

// ── Formatters ────────────────────────────────────────────────────
function f1(n: number) { return n.toFixed(1) }
function f2(n: number) { return n.toFixed(2) }
function fPct(n: number) { return f1(n * 100) + "%" }
function fB(n: number) { return "$" + f2(Math.abs(n)) + "B" }
function fShare(n: number) { return "$" + Math.round(n) }
function fM(n: number) { return Math.round(n * 1000) + "M" }

const SC_COLORS: Record<Scenario, { color: string; dim: string }> = {
  bear: { color: "var(--red)",    dim: "var(--red-dim)"    },
  base: { color: "var(--accent)", dim: "var(--accent-dim)" },
  bull: { color: "var(--green)",  dim: "var(--green-dim)"  },
}

export default function SnowflakeModelShell({
  model,
  priceSource,
}: {
  model: SnowflakeModelConfig
  priceSource?: string
}) {
  const [sc,     setSc]     = useState<Scenario>("base")
  const [wacc,   setWacc]   = useState(model.waccDefault)
  const [exitMx, setExitMx] = useState(model.exitMultipleDefault)
  const [tab,    setTab]    = useState<"model" | "dilution" | "sensitivity" | "assumptions">("model")

  const M    = useMemo(() => runSnowflakeDCF(model, sc, wacc, exitMx),   [model, sc, wacc, exitMx])
  const SENS = useMemo(() => buildSnowflakeSensitivity(model, sc, wacc), [model, sc, wacc])

  const scColors  = SC_COLORS[sc]
  const accent    = model.accentColor ?? "#29B5E8"
  const upCol     = M.updown > 0 ? "var(--green)" : "var(--red)"
  const lastRow   = M.rows[9]
  const firstRow  = M.rows[0]

  // Deferred revenue at base year
  const baseDeferredRev = model.baseRevenue * model.deferredRatio

  function sensColor(val: number) {
    const r = val / model.currentPrice
    if (r >= 1.3) return "sens-cell-green"
    if (r >= 1.0) return "sens-cell-accent"
    if (r >= 0.7) return "sens-cell-amber"
    return "sens-cell-red"
  }

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
      sub:   `PV FCF ${fB(M.sumPvFcf)} · PV terminal ${fB(M.pvTv)}`,
      color: "var(--text-1)",
    },
    {
      label: "TV / EV",
      value: f1(M.tvWeight * 100) + "%",
      sub:   `${exitMx}× FY36 FCF of ${fB(lastRow.fcf)}`,
      color: "var(--amber)",
    },
    {
      label: "FY36E Revenue",
      value: fB(lastRow.rev),
      sub:   `${f2(lastRow.rev / model.baseRevenue)}× FY${model.baseYear} base`,
      color: "var(--text-1)",
    },
    {
      label: "FY36E FCF",
      value: fB(lastRow.fcf),
      sub:   `${fPct(lastRow.fcfMargin)} FCF margin · EBIT ${fPct(lastRow.ebitMargin)}`,
      color: scColors.color,
    },
    {
      label: "FY36E Shares",
      value: fM(lastRow.sharesEnd),
      sub:   `vs ${fM(model.sharesOut)} today · ${lastRow.sharesEnd < model.sharesOut ? "net reduction" : "net dilution"}`,
      color: lastRow.sharesEnd < model.sharesOut ? "var(--green)" : "var(--amber)",
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
          {fM(model.sharesOut)} diluted shares · Net cash ${model.netCash}B · Price ref ${Math.round(model.currentPrice)}{" "}
          {priceSource && (
            <span style={{ color: priceSource.startsWith("Live") ? "var(--green)" : "var(--text-3)", fontWeight: 500 }}>
              ({priceSource})
            </span>
          )}
        </div>
        <div className="model-subline">
          Consumption-model FCF DCF · Deferred revenue ratio {fPct(model.deferredRatio)} ·
          SBC {fPct(model.sbcRatio)} of non-GAAP costs · {model.revMultiple}× revenue/share price proxy ·
          100% FCF → buybacks · FY ends January 31
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
          <div className="section-label">Exit P/FCF: {exitMx}×</div>
          <input
            type="range" min={15} max={55} step={1} value={exitMx}
            onChange={e => setExitMx(Number(e.target.value))}
            style={{ width: 180, accentColor: scColors.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>15×</span><span>55×</span>
          </div>
        </div>

        <div className="control-group">
          <div className="section-label">View</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["model", "dilution", "sensitivity", "assumptions"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`tab-btn ${tab === t ? "active" : ""}`}
              >
                {t === "dilution" ? "SBC & Dilution" : t.charAt(0).toUpperCase() + t.slice(1)}
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
            FY27–FY36 Free Cash Flow Projection — {sc.charAt(0).toUpperCase() + sc.slice(1)} Case
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 12 }}>
            FCF = NOPAT + D&A − CapEx + ΔDeferred Revenue ·
            NOPAT = non-GAAP EBIT × (1 − 21% tax) ·
            ΔDeferred = advance billings in excess of revenue recognised
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>FY</th>
                  <th>Revenue</th>
                  <th>Rev Δ</th>
                  <th>Gross Margin</th>
                  <th>EBIT Margin</th>
                  <th>NOPAT</th>
                  <th>ΔDeferred Rev</th>
                  <th style={{ color: scColors.color }}>FCF</th>
                  <th>FCF Margin</th>
                  <th>PV (FCF)</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => (
                  <tr key={r.year}>
                    <td style={{ color: accent, fontWeight: 600 }}>{r.fyLabel}</td>
                    <td>{fB(r.rev)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fPct(r.revGrowth)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fPct(r.grossMargin)}</td>
                    <td style={{ color: scColors.color }}>{fPct(r.ebitMargin)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fB(r.nopat)}</td>
                    <td style={{ color: "var(--purple)" }}>
                      +{fB(r.deltaDeferred)}
                    </td>
                    <td style={{ color: scColors.color, fontWeight: 700 }}>{fB(r.fcf)}</td>
                    <td style={{ color: scColors.color }}>{fPct(r.fcfMargin)}</td>
                    <td style={{ color: "var(--accent)" }}>{fB(r.pvFcf)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={9} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    Terminal value · {exitMx}× FY36 FCF of {fB(lastRow.fcf)} = {fB(exitMx * lastRow.fcf)} · WACC {fPct(wacc)}
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

          {/* Consumption model callout */}
          <div style={{
            marginTop: 18, padding: "14px 18px",
            background: "var(--card-bg)", borderRadius: 8,
            border: `1px solid ${accent}33`,
          }}>
            <div className="section-label" style={{ marginBottom: 8 }}>
              Why FCF Structurally Exceeds NOPAT — The Consumption Model Cash Engine
            </div>
            <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.75, maxWidth: 720 }}>
              Snowflake bills customers upfront against multi-year capacity contracts. Cash lands on the
              balance sheet before a single compute credit is consumed — creating deferred revenue that
              sat at{" "}
              <strong style={{ color: "var(--text-1)" }}>${f2(baseDeferredRev)}B at FY{model.baseYear} year-end</strong>
              , equal to {fPct(model.deferredRatio)} of annual revenue. As long as the business grows,
              this balance grows with it, generating a permanent cash inflow above accrual income.{" "}
              In the first year of the model alone, the deferred revenue build adds{" "}
              <strong style={{ color: "var(--purple)" }}>+{fB(firstRow.deltaDeferred)}</strong>
              {" "}of cash that never appears in NOPAT.{" "}
              This tailwind naturally decelerates as growth slows — but it never reverses, it simply
              compounds more slowly. The effect accounts for roughly{" "}
              <strong style={{ color: "var(--text-1)" }}>
                {fPct(firstRow.deltaDeferred / firstRow.fcf)} of FY27 FCF
              </strong>
              {" "}and compresses to{" "}
              <strong style={{ color: "var(--text-1)" }}>
                {fPct(lastRow.deltaDeferred / lastRow.fcf)} of FY36 FCF
              </strong>
              {" "}as NOPAT margin expansion takes over as the dominant driver.
            </div>
          </div>

          {/* EV → per-share bridge */}
          <div className="bridge-card">
            <div className="section-label">EV → Per-Share Value Bridge</div>
            {[
              ["PV of FCF (FY27–36)",                fB(M.sumPvFcf),                              "var(--text-1)"],
              [`(+) PV of Terminal Value (${exitMx}× FY36 FCF)`, fB(M.pvTv),                      "var(--text-1)"],
              ["Enterprise Value",                   fB(M.ev),                                    "var(--accent)"],
              ["(+) Net cash (FY26A)",                `$${model.netCash}B`,                        "var(--green)" ],
              ["Equity Value",                        fB(M.equity),                               "var(--accent)"],
              ["÷ Shares (FY36E post buybacks)",      fM(lastRow.sharesEnd),                       "var(--text-2)"],
              ["Intrinsic Value / Share",             fShare(M.perShare),                         scColors.color ],
              ["Current price reference",            `$${Math.round(model.currentPrice)}`,         "var(--text-3)"],
              ["Implied upside / (downside)",        `${M.updown > 0 ? "+" : ""}${f1(M.updown)}%`, upCol         ],
              ["10-yr implied CAGR",                 `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`, upCol],
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
              const m2 = runSnowflakeDCF(model, s, model.waccDefault, exitMx)
              const mt = SC_COLORS[s]
              const termRev   = m2.rows[9].rev
              const termFcf   = m2.rows[9].fcf
              const termShares = m2.rows[9].sharesEnd
              return (
                <div key={s} className="sc-card" style={{ background: mt.dim + "88", border: `1px solid ${mt.color}44` }}>
                  <div className="sc-card-label" style={{ color: mt.color }}>
                    {s.charAt(0).toUpperCase() + s.slice(1)} Case
                  </div>
                  <div className="sc-card-value" style={{ color: mt.color }}>{fShare(m2.perShare)}</div>
                  <div className="sc-card-updown" style={{ color: "var(--text-2)" }}>
                    {m2.updown > 0 ? "+" : ""}{f1(m2.updown)}% vs ${Math.round(model.currentPrice)}
                  </div>
                  <div className="sc-card-stat">FY36E Rev: {fB(termRev)}</div>
                  <div className="sc-card-stat">
                    FY36E FCF: {fB(termFcf)} ({fPct(termFcf / termRev)})
                  </div>
                  <div className="sc-card-stat">
                    FY36E EBIT margin: {fPct(model.scenarios[s].opMargin[9])}
                  </div>
                  <div className="sc-card-stat">
                    FY36E shares: {fM(termShares)}{" "}
                    <span style={{ color: termShares < model.sharesOut ? "var(--green)" : "var(--amber)" }}>
                      ({termShares < model.sharesOut ? "▼" : "▲"} vs today)
                    </span>
                  </div>
                  <div className="sc-card-stat">EV: {fB(m2.ev)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════
          SBC & DILUTION TAB
      ════════════════════════════════════════════════════════════ */}
      {tab === "dilution" && (
        <div>
          <div className="section-label">
            SBC & Share Count — {sc.charAt(0).toUpperCase() + sc.slice(1)} Case
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            SBC = {fPct(model.sbcRatio)} × non-GAAP total costs ·
            Price proxy = {model.revMultiple}× revenue per share ·
            100% of FCF deployed to repurchases ·
            Net share change = gross SBC issuance − buybacks
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>FY</th>
                  <th>SBC ($B)</th>
                  <th>SBC % Rev</th>
                  <th>Price Proxy</th>
                  <th style={{ color: "var(--amber)" }}>Gross Issued</th>
                  <th>FCF</th>
                  <th style={{ color: "var(--green)" }}>Repurchased</th>
                  <th>Net Δ Shares</th>
                  <th>Shares (end)</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => {
                  const netPositive = r.netShareChange > 0
                  return (
                    <tr key={r.year}>
                      <td style={{ color: accent, fontWeight: 600 }}>{r.fyLabel}</td>
                      <td style={{ color: "var(--amber)" }}>{fB(r.sbc)}</td>
                      <td style={{ color: "var(--text-3)" }}>{fPct(r.sbc / r.rev)}</td>
                      <td style={{ color: "var(--text-2)" }}>${Math.round(r.pricePerShare)}</td>
                      <td style={{ color: "var(--amber)", fontWeight: 600 }}>
                        +{fM(r.grossSharesIssued)}
                      </td>
                      <td style={{ color: "var(--text-2)" }}>{fB(r.fcf)}</td>
                      <td style={{ color: "var(--green)", fontWeight: 600 }}>
                        −{fM(r.sharesRepurchased)}
                      </td>
                      <td style={{
                        fontWeight: 600,
                        color: netPositive ? "var(--amber)" : "var(--green)",
                      }}>
                        {netPositive ? "+" : ""}{fM(r.netShareChange)}
                      </td>
                      <td style={{ fontWeight: 600, color: "var(--text-1)" }}>
                        {fM(r.sharesEnd)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* SBC dynamics callout */}
          <div style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
          }}>
            <div className="assumption-card">
              <div className="assumption-card-title" style={{ color: "var(--amber)" }}>
                The SBC Flywheel — How Buybacks Overtake Dilution
              </div>
              <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.75 }}>
                <p style={{ marginBottom: 8 }}>
                  SBC is treated here as a real cost to shareholders — it dilutes the equity base. But
                  unlike the R&D capitalisation models, we don&apos;t deduct it from FCF. Instead, we
                  track the actual shares it creates and offset them with buybacks funded by FCF.
                </p>
                <p style={{ marginBottom: 8 }}>
                  The key dynamic: gross SBC dilution shrinks as operating margins expand
                  (fewer total costs → less SBC in dollar terms), while the buyback capacity
                  grows as FCF margins widen. These two forces converge. In the{" "}
                  <strong style={{ color: scColors.color }}>
                    {sc.charAt(0).toUpperCase() + sc.slice(1)} case
                  </strong>
                  , buybacks first match — then exceed — gross SBC issuances around{" "}
                  <strong style={{ color: "var(--text-1)" }}>
                    {(() => {
                      const crossover = M.rows.find(r => r.netShareChange <= 0)
                      return crossover ? crossover.fyLabel : "beyond the forecast horizon"
                    })()}
                  </strong>
                  .
                </p>
                <p>
                  At that crossover, the share count starts declining — and each remaining shareholder
                  owns a larger fraction of a growing earnings base.
                </p>
              </div>
            </div>

            <div className="assumption-card">
              <div className="assumption-card-title" style={{ color: "var(--text-1)" }}>
                Share Count Summary
              </div>
              {[
                ["Opening shares (FY26A)",   fM(model.sharesOut)],
                ["FY36E shares",             fM(lastRow.sharesEnd)],
                ["Net change",               `${lastRow.sharesEnd < model.sharesOut ? "−" : "+"}${fM(Math.abs(lastRow.sharesEnd - model.sharesOut))}`],
                ["SBC ratio",                `${fPct(model.sbcRatio)} of non-GAAP costs`],
                ["Price proxy",              `${model.revMultiple}× revenue per share`],
                ["FCF allocation",           "100% → share repurchases"],
              ].map(([k, v]) => (
                <div key={k} className="assumption-row">
                  <div className="assumption-key">{k}</div>
                  <div className="assumption-val">{v}</div>
                </div>
              ))}
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
            Intrinsic Value / Share ($) — Exit P/FCF Multiple × WACC
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            {sc.charAt(0).toUpperCase() + sc.slice(1)} scenario ·
            Terminal value = multiple × FY36 FCF · Highlighted cell = current sliders ({exitMx}× / {fPct(wacc)})
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="sens-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>P/FCF Exit ↓ / WACC →</th>
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
            Note: at 10% WACC, a 35× P/FCF exit multiple is consistent with an enterprise
            software platform growing revenues in the high-teens and compounding FCF. For context,
            ServiceNow and Salesforce trade at 30–50× free cash flow depending on growth expectations.
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
              title: "Revenue Growth Path",
              color: "var(--accent)",
              rows: model.scenarios[sc].revGrowth.map((g, i) => [
                `FY${27 + i}`,
                fPct(g) + " → " + fB(M.rows[i].rev),
              ] as [string, string]),
            },
            {
              title: `Operating Margin Path — ${sc.charAt(0).toUpperCase() + sc.slice(1)} Case`,
              color: scColors.color,
              rows: [
                ...model.scenarios[sc].opMargin.map((m, i) => [
                  `FY${27 + i} EBIT margin`,
                  fPct(m),
                ] as [string, string]),
                ["Terminal target", fPct(model.scenarios[sc].opMargin[9])],
                ["Gross margin path", `${fPct(model.grossMargins[0])} → ${fPct(model.grossMargins[9])} (linear)`],
                ["Tax rate", fPct(model.taxRate)],
              ],
            },
            {
              title: "FCF Build",
              color: "var(--purple)",
              rows: [
                ["Engine", "Consumption-model FCF DCF"],
                ["NOPAT", "non-GAAP EBIT × (1 − 21%)"],
                ["D&A ratio", fPct(model.daRatio) + " of revenue (constant)"],
                ["CapEx ratio", fPct(model.capexRatio) + " of revenue (constant)"],
                ["Deferred revenue ratio", fPct(model.deferredRatio) + " (held constant)"],
                ["ΔDeferred formula", "ratio × prior_rev × growth_rate"],
                ["FY26A deferred balance", fB(model.baseRevenue * model.deferredRatio)],
                ["Terminal value", `${exitMx}× FY36 FCF`],
              ] as [string, string][],
            },
            {
              title: "SBC & Shares",
              color: "var(--amber)",
              rows: [
                ["SBC ratio", `${fPct(model.sbcRatio)} of non-GAAP total costs`],
                ["Price proxy", `${model.revMultiple}× revenue per share`],
                ["FCF deployment", "100% → share repurchases"],
                ["Opening shares (FY26A)", fM(model.sharesOut)],
                ["FY36E shares", fM(lastRow.sharesEnd)],
                ["Net cash (FY26A)", `$${model.netCash}B — held on balance sheet`],
                ["Default WACC", fPct(model.waccDefault)],
                ["Default exit P/FCF", `${model.exitMultipleDefault}×`],
                ["FY convention", "Snowflake FY ends January 31"],
                ["Last updated", model.lastUpdated],
              ] as [string, string][],
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
        FCF = NOPAT + D&A − CapEx + ΔDeferred Revenue ·
        NOPAT = non-GAAP EBIT × (1 − 21% tax) · SBC dilution tracked separately via {model.revMultiple}× revenue/share proxy ·
        Terminal value = {exitMx}× FY36 FCF · Snowflake FY ends January 31 · Updated {model.lastUpdated}
      </div>
    </div>
  )
}
