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
function f2(n: number) { return n.toFixed(2) }
function fPct(n: number) { return f1(n * 100) + "%" }
function fB(n: number) { return "$" + f1(n) + "B" }
function fM(n: number) { return "$" + Math.round(n * 1000) + "M" }
function fShare(n: number) { return "$" + Math.round(n) }

// Preferred dividends: Series A $26.25M + Series B $11.375M ≈ $37.6M/yr
const PREF_DIV_B = 0.0376  // $37.6M in $B

function computeDebtWaterfall(fcfRows: { fcf: number; year: number }[]) {
  let debt = 0.700  // $700M term loan at FY2025A close
  const rows = []
  for (const r of fcfRows) {
    if (debt <= 0) break
    const afterPref = Math.max(0, r.fcf - PREF_DIV_B)
    const paydown   = Math.min(afterPref, debt)
    debt = Math.max(0, debt - paydown)
    rows.push({
      year:    r.year,
      fcf:     r.fcf,
      paydown,
      debtEnd: debt,
      excess:  Math.max(0, afterPref - paydown),
    })
  }
  return rows
}

export default function CelsiusModelShell({
  model,
  priceSource,
}: {
  model: ModelConfig
  priceSource?: string
}) {
  const [sc,    setSc]    = useState<Scenario>("base")
  const [wacc,  setWacc]  = useState(model.waccDefault)
  const [termG, setTermG] = useState(model.termGrowth)
  const [tab,   setTab]   = useState<"model" | "sensitivity" | "assumptions">("model")

  const M    = useMemo(() => runDCF(model, sc, wacc, termG), [model, sc, wacc, termG])
  const SENS = useMemo(() => buildSensitivity(model, sc),    [model, sc])

  const scColors = SC_COLORS[sc]
  const accent   = model.accentColor ?? "#2BD9A5"
  const upCol    = M.updown > 0 ? "var(--green)" : "var(--red)"

  const waterfall = useMemo(() => computeDebtWaterfall(M.rows), [M.rows])

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
      value: fB(M.rows[9].rev),
      sub:   `${f1(M.rows[9].rev / model.baseRevenue)}× FY2025 base`,
      color: "var(--text-1)",
    },
    {
      label: "2035E FCF Margin",
      value: fPct(M.rows[9].fcfM),
      sub:   "Post-tax owner earnings",
      color: scColors.color,
    },
    {
      label: "2035E Shares",
      value: f1(M.rows[9].shares * 1000) + "M",
      sub:   `−${f1((1 - M.rows[9].shares / model.sharesOut) * 100)}% vs today`,
      color: "var(--purple)",
    },
  ]

  return (
    <div>
      {/* ── header ─────────────────────────────────────────────── */}
      <div className="model-header">
        <div className="model-header-row">
          <div className="model-ticker-badge" style={{ background: accent }}>
            {model.ticker}
          </div>
          <div className="model-header-label">{model.name} · {model.exchange} · DCF Model</div>
        </div>
        <div className="model-subline">
          Base year FY{model.baseYear}A · Revenue {fB(model.baseRevenue)} ·{" "}
          294.6M fully diluted shares · Net debt $326M · Price ref ${model.currentPrice}{" "}
          {priceSource && (
            <span style={{ color: priceSource.startsWith("Live") ? "var(--green)" : "var(--text-3)", fontWeight: 500 }}>
              ({priceSource})
            </span>
          )}
        </div>
        <div className="model-subline">
          Gross margin ~50% · Normalized FY2025 op. margin 18.6% (ex $327.5M one-time termination fees) ·{" "}
          Op. margin = (Op. margin − {fPct(model.sbcHaircut)} SBC) × (1 − {fPct(model.taxRate)} tax) ·{" "}
          {model.buybackPE
            ? `100% FCF buybacks at ${model.buybackPE}× owner earnings (~${fPct(1 / model.buybackPE)}/yr)`
            : `${fPct(model.buybackRate)}/yr share reduction`
          } · WACC {fPct(wacc)} · Terminal g {fPct(termG)}
        </div>
      </div>

      {/* ── controls ───────────────────────────────────────────── */}
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

      {/* ── KPI strip ──────────────────────────────────────────── */}
      <div className="kpi-strip">
        {kpis.map(k => (
          <div key={k.label} className="kpi-card">
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value" style={{ color: k.color }}>{k.value}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════
          MODEL TAB
      ══════════════════════════════════════════════════════════ */}
      {tab === "model" && (
        <div>
          <div className="section-label">2026–2035 Explicit Forecast — {sc.charAt(0).toUpperCase() + sc.slice(1)} Case</div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Revenue</th>
                  <th>Rev Δ</th>
                  <th>Op. Margin</th>
                  <th>Post-SBC Op. Margin</th>
                  <th>FCF Margin</th>
                  <th>FCF</th>
                  <th>Shares Out</th>
                  <th>PV of FCF</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => {
                  const star = r.year === 2031
                  const p2   = r.year > 2031
                  return (
                    <tr key={r.year} style={{ borderBottom: `1px solid ${star ? scColors.color + "55" : "rgba(37,43,59,0.88)"}` }}>
                      <td style={{ color: star ? scColors.color : p2 ? "var(--purple)" : "var(--text-1)", fontWeight: star ? 700 : 400 }}>
                        {r.year}{star ? " ★" : ""}
                      </td>
                      <td>{fB(r.rev)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fPct(r.revGrowth)}</td>
                      <td style={{ color: scColors.color }}>{fPct(r.niM)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fPct(r.oeM)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fPct(r.fcfM)}</td>
                      <td>{fB(r.fcf)}</td>
                      <td style={{ color: "var(--text-2)" }}>{f1(r.shares * 1000)}M</td>
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
                  <td colSpan={7} style={{ color: "var(--accent)", fontWeight: 600, textAlign: "left" }}>Enterprise Value</td>
                  <td style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>{fB(M.ev)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* EV bridge */}
          <div className="bridge-card">
            <div className="section-label">EV → Per-Share Value Bridge</div>
            {[
              ["Enterprise Value",                   fB(M.ev),                                             "var(--text-1)"],
              ["(−) Net debt (FY2025A)",              "−$0.3B",                                             "var(--red)"   ],
              ["Equity Value",                        fB(M.equity),                                         "var(--accent)"],
              ["÷ Shares (post-buyback, 2035E)",      f1(M.rows[9].shares * 1000) + "M",                    "var(--text-2)"],
              ["Intrinsic Value / Share",             fShare(M.perShare),                                   scColors.color ],
              ["Current price reference",             `$${model.currentPrice}`,                             "var(--text-3)"],
              ["Implied upside / (downside)",         `${M.updown > 0 ? "+" : ""}${f1(M.updown)}%`,         upCol          ],
              ["10-yr implied CAGR",                  `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`, upCol ],
            ].map(([k, v, col]) => (
              <div key={k} className="bridge-row">
                <span className="bridge-label">{k}</span>
                <span className="bridge-value" style={{ color: col }}>{v}</span>
              </div>
            ))}
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 10, paddingTop: 8, borderTop: "1px solid rgba(37,43,59,0.9)" }}>
              Net debt = $399M unrestricted cash − $700M term loan − $25M contingent consideration = −$326M.
              $141M restricted cash excluded (contractually pledged to distributor termination settlements).
              <br />
              Shares: 256.9M common + 22.0M Series A converts + 11.3M Series B converts + 4.4M options/RSUs = 294.6M fully diluted.
              Preferred treated as equity (not debt) per Note 14: most likely settlement is conversion to common stock.
            </div>
          </div>

          {/* Debt paydown waterfall */}
          {waterfall.length > 0 && (
            <div className="bridge-card" style={{ marginTop: 16 }}>
              <div className="section-label">FCF Waterfall — Debt Paydown Priority</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 10 }}>
                FCF first covers preferred dividends (~$37.6M/yr), then retires the $700M term loan. Excess FCF available for buybacks.
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th>Year</th>
                      <th>FCF</th>
                      <th>Pref. Divs</th>
                      <th>Debt Paydown</th>
                      <th>Debt Remaining</th>
                      <th>Excess / Buybacks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waterfall.map(r => (
                      <tr key={r.year}>
                        <td>{r.year}</td>
                        <td>{fM(r.fcf)}</td>
                        <td style={{ color: "var(--amber)" }}>{fM(PREF_DIV_B)}</td>
                        <td style={{ color: "var(--red)" }}>{r.paydown > 0 ? `−${fM(r.paydown)}` : "—"}</td>
                        <td style={{ color: r.debtEnd < 0.01 ? "var(--green)" : "var(--text-2)" }}>
                          {r.debtEnd < 0.01 ? "Paid off ✓" : fM(r.debtEnd)}
                        </td>
                        <td style={{ color: r.excess > 0 ? "var(--purple)" : "var(--text-3)" }}>
                          {r.excess > 0.001 ? fM(r.excess) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* phase legend */}
          <div className="phase-legend">
            <div className="phase-item">
              <span className="phase-dot" style={{ background: scColors.color + "33", border: `1px solid ${scColors.color}66` }} />
              2026–2031: Phase 1 growth / margin expansion
            </div>
            <div className="phase-item">
              <span className="phase-dot" style={{ background: "var(--purple-dim)", border: "1px solid rgba(167,139,250,.4)" }} />
              2032–2035: Phase 2 (terminal approach)
            </div>
            <span style={{ fontSize: 11, color: scColors.color }}>★ = mid-period milestone year</span>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          SENSITIVITY TAB
      ══════════════════════════════════════════════════════════ */}
      {tab === "sensitivity" && (
        <div>
          <div className="section-label">
            Intrinsic Value / Share ($) — {sc.charAt(0).toUpperCase() + sc.slice(1)} Revenue & Margin Profile
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
            All Three Scenarios at {fPct(model.waccDefault)} WACC / {fPct(model.termGrowth)} Terminal Growth
          </div>
          <div className="sc-compare">
            {(["bear", "base", "bull"] as Scenario[]).map(s => {
              const m2 = runDCF(model, s, model.waccDefault, model.termGrowth)
              const mt = SC_COLORS[s]
              return (
                <div key={s} className="sc-card" style={{ background: mt.dim + "88", border: `1px solid ${mt.color}44` }}>
                  <div className="sc-card-label" style={{ color: mt.color }}>{s.charAt(0).toUpperCase() + s.slice(1)} Case</div>
                  <div className="sc-card-value" style={{ color: mt.color }}>{fShare(m2.perShare)}</div>
                  <div className="sc-card-updown" style={{ color: "var(--text-2)" }}>
                    {m2.updown > 0 ? "+" : ""}{f1(m2.updown)}% vs ${model.currentPrice}
                  </div>
                  <div className="sc-card-stat">2035E Rev: {fB(m2.rows[9].rev)}</div>
                  <div className="sc-card-stat">2035E FCF Margin: {fPct(m2.rows[9].fcfM)}</div>
                  <div className="sc-card-stat">EV: {fB(m2.ev)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          ASSUMPTIONS TAB
      ══════════════════════════════════════════════════════════ */}
      {tab === "assumptions" && (
        <div className="assumptions-grid">
          {/* Revenue Model */}
          <div className="assumption-card">
            <div className="assumption-card-title" style={{ color: "var(--accent)" }}>Revenue Model</div>
            {[
              ["Base year", "FY2025A · $2.515B net revenue"],
              ["Revenue composition", "~$1.35B Celsius core + ~$1.17B Alani Nu (acquired Q1 2025)"],
              ["Bear growth (Phase 1)", model.scenarios.bear.revGrowth.slice(0, 5).map(g => fPct(g)).join(" → ")],
              ["Base growth (Phase 1)", model.scenarios.base.revGrowth.slice(0, 5).map(g => fPct(g)).join(" → ")],
              ["Bull growth (Phase 1)", model.scenarios.bull.revGrowth.slice(0, 5).map(g => fPct(g)).join(" → ")],
              ["Phase 2 (2032–2035)", model.scenarios.base.revGrowth.slice(5).map(g => fPct(g)).join(" → ") + " — maturing brand mix"],
              ["Distribution", "Pepsi PBNA (exclusive U.S. distribution); direct international channels"],
              ["Gross margin", "~50% (held constant); Alani Nu brand premium supports pricing"],
            ].map(([k, v]) => (
              <div key={k} className="assumption-row">
                <div className="assumption-key">{k}</div>
                <div className="assumption-val">{v}</div>
              </div>
            ))}
          </div>

          {/* Operating Margin Path */}
          <div className="assumption-card">
            <div className="assumption-card-title" style={{ color: "var(--green)" }}>Operating Margin Path</div>
            {[
              ["FY2025A reported op. margin", "5.6% — includes $327.5M one-time distributor termination fees (non-recurring)"],
              ["FY2025A normalized op. margin", "~18.6% ex one-time charges — the true run-rate margin baseline"],
              ["Bear margin path (2026→2030)", model.scenarios.bear.niMargin.slice(0, 5).map(m => fPct(m)).join(" → ")],
              ["Base margin path (2026→2030)", model.scenarios.base.niMargin.slice(0, 5).map(m => fPct(m)).join(" → ")],
              ["Bull margin path (2026→2030)", model.scenarios.bull.niMargin.slice(0, 5).map(m => fPct(m)).join(" → ")],
              ["Margin drivers", "Operating leverage on fixed SG&A; Alani Nu synergies; Pepsi channel vs. self-distribution savings"],
              ["SBC haircut", fPct(model.sbcHaircut) + " (~$28M FY2025 SBC / $2,515M revenue) deducted from op. margin"],
              ["Tax rate", fPct(model.taxRate) + " normalized (FY23: 22.3%, FY24: 25.6%; FY25 13.6% was atypical DTA release)"],
              ["FCF approximation", "D&A ($29.5M) ≈ Capex ($36.1M) → net capex ~$0 → FCF ≈ NOPAT (capital-light model)"],
            ].map(([k, v]) => (
              <div key={k} className="assumption-row">
                <div className="assumption-key">{k}</div>
                <div className="assumption-val">{v}</div>
              </div>
            ))}
          </div>

          {/* Preferred Stock & Dilution — CRITICAL */}
          <div className="assumption-card" style={{ borderColor: accent + "66" }}>
            <div className="assumption-card-title" style={{ color: accent }}>Preferred Stock & Dilution (Critical)</div>
            {[
              ["Series A Preferred", "$852M face value · 3.25% dividend ($27.7M/yr) · converts to ~22.0M common shares"],
              ["Series B Preferred", "$908M face value · 1.25% dividend ($11.4M/yr) · converts to ~11.3M common shares"],
              ["Settlement method", "Note 14 (10-K): 'most likely settlement = conversion to common stock' — treated as equity, NOT debt"],
              ["Why preferred is not subtracted from EV", "Convertible preferred with equity-like settlement is economically equivalent to diluted common shares, not fixed-income debt"],
              ["Total preferred dividends", "~$37.6M/yr ($26.25M Ser A + $11.375M Ser B) — shown in waterfall, paid from FCF before buybacks"],
              ["Common shares outstanding", "256.9M at FY2025A year-end (post Alani Nu close)"],
              ["Series A conversion shares", "~22.0M (based on conversion ratio in Note 14)"],
              ["Series B conversion shares", "~11.3M (based on conversion ratio in Note 14)"],
              ["Options / RSUs", "~4.4M weighted dilutive securities"],
              ["Fully diluted share count", "294.6M = 256.9M + 22.0M + 11.3M + 4.4M"],
              ["Acquisition cost", "$1.8B cash + $150M contingent → financed with $700M term loan + $852M Ser A + $908M Ser B preferred"],
            ].map(([k, v]) => (
              <div key={k} className="assumption-row">
                <div className="assumption-key">{k}</div>
                <div className="assumption-val">{v}</div>
              </div>
            ))}
          </div>

          {/* Balance Sheet & Capital Allocation */}
          <div className="assumption-card">
            <div className="assumption-card-title" style={{ color: "var(--purple)" }}>Balance Sheet & Capital Allocation</div>
            {[
              ["Cash (unrestricted)", "$399M at FY2025A year-end"],
              ["Restricted cash (excluded)", "$141M — contractually pledged to distributor termination settlements; not available for operations"],
              ["Term loan", "$700M — 5-year facility used to fund Alani Nu cash consideration"],
              ["Contingent consideration", "$25M — earnout tied to Alani Nu performance milestones"],
              ["Net debt (model input)", "$399M − $700M − $25M = −$326M (subtracted from EV in bridge)"],
              ["FCF priority", "1) Preferred dividends (~$37.6M/yr) · 2) Term loan paydown · 3) Residual for buybacks/dividends"],
              ...(model.buybackPE
                ? [
                    ["Buyback method", "100% of annual FCF returned as share repurchases"],
                    ["Repurchase price", `${model.buybackPE}× current-year owner earnings per share`],
                    ["Implied annual reduction", `~${fPct(1 / model.buybackPE)}/yr (shares ÷ ${model.buybackPE} retired each year)`],
                  ]
                : [
                    ["Buyback rate", fPct(model.buybackRate) + "/yr modeled share count reduction"],
                  ]
              ),
              ["2035E shares", f1(runDCF(model, "base", model.waccDefault, model.termGrowth).rows[9].shares * 1000) + "M (base case)"],
            ].map(([k, v]) => (
              <div key={k} className="assumption-row">
                <div className="assumption-key">{k}</div>
                <div className="assumption-val">{v}</div>
              </div>
            ))}
          </div>

          {/* Valuation */}
          <div className="assumption-card">
            <div className="assumption-card-title" style={{ color: "var(--amber)" }}>Valuation</div>
            {[
              ["Default WACC", fPct(model.waccDefault)],
              ["Default terminal growth", fPct(model.termGrowth)],
              ["Gordon multiple (defaults)", f2((1 + model.termGrowth) / (model.waccDefault - model.termGrowth)) + "×"],
              ["Current price reference", `$${model.currentPrice}/share`],
              ["Market cap (approx)", `$${f1(model.currentPrice * model.sharesOut)}B`],
              ["Currency", "USD"],
              ["Model last updated", model.lastUpdated],
              ["Engine", "Standard DCF (earnings-based) · FCF = (Op. margin − SBC) × (1 − tax) × Revenue"],
            ].map(([k, v]) => (
              <div key={k} className="assumption-row">
                <div className="assumption-key">{k}</div>
                <div className="assumption-val">{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="disclaimer">
        For informational and educational purposes only · Not investment advice · All figures USD ·
        Owner earnings = (Op. margin − {fPct(model.sbcHaircut)} SBC) × (1 − {fPct(model.taxRate)} tax) ·
        {model.buybackPE ? `100% FCF buybacks at ${model.buybackPE}× owner earnings` : `${model.buybackRate * 100}%/yr share reduction`} ·
        Preferred stock treated as equity per Note 14 (FY2025 10-K) ·
        Updated {model.lastUpdated}
      </div>
    </div>
  )
}
