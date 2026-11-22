"use client"
import { useState, useMemo } from "react"
import type { AnthropicModelConfig, AnthropicScenario } from "@/lib/anthropic-models"
import { runAnthropicDCF, buildAnthropicSensitivity, buildAnthropicGrowthSens } from "@/lib/anthropic-engine"

const SC_COLORS: Record<AnthropicScenario, { color: string; dim: string }> = {
  bear: { color: "var(--red)",    dim: "var(--red-dim)"    },
  base: { color: "var(--accent)", dim: "var(--accent-dim)" },
  bull: { color: "var(--green)",  dim: "var(--green-dim)"  },
}

function f1(n: number) { return n.toFixed(1) }
function f0(n: number) { return Math.round(n).toLocaleString() }
function fPct(n: number) { return f1(n * 100) + "%" }
function fUsdB(n: number) { return n >= 1000 ? "$" + (n / 1000).toFixed(2) + "T" : "$" + f0(n) + "B" }
function fUsd2(n: number) { return "$" + n.toFixed(2) }
function sgn(n: number) { return n > 0 ? "+" : "" }

export default function AnthropicModelShell({ model, priceSource }: {
  model: AnthropicModelConfig; priceSource?: string
}) {
  const [sc,     setSc]     = useState<AnthropicScenario>("base")
  const [wacc,   setWacc]   = useState(model.waccDefault)
  const [termG,  setTermG]  = useState(model.termGrowth)
  const [margin, setMargin] = useState(model.netMarginDefault)
  const [extG,   setExtG]   = useState(model.scenarios.bull.extGrowth)
  const [tab,    setTab]    = useState<"model" | "sensitivity" | "assumptions">("model")

  const extOverride = sc === "bull" ? extG : undefined
  const M    = useMemo(() => runAnthropicDCF(model, sc, wacc, termG, margin, extOverride), [model, sc, wacc, termG, margin, extOverride])
  const SENS = useMemo(() => buildAnthropicSensitivity(model, sc, termG, extOverride), [model, sc, termG, extOverride])
  const GSENS = useMemo(() => buildAnthropicGrowthSens(model, wacc, termG, margin), [model, wacc, termG, margin])
  // Underlying-margin path (no breakeven years), for the price-of-the-moat comparison
  const U    = useMemo(() => runAnthropicDCF(model, "base", wacc, termG, margin), [model, wacc, termG, margin])

  const scColors = SC_COLORS[sc]
  const accent   = model.accentColor ?? "var(--accent)"
  const upCol    = M.updown > 0 ? "var(--green)" : "var(--red)"
  const hurdleCol = M.impliedCAGR >= model.hurdle ? "var(--green)" : "var(--amber)"
  const A        = model.scenarios[sc]
  const cap      = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const netCash  = -model.netDebt
  const opEquiv  = margin / (1 - model.taxRate)
  const breakevenTraining = 1 - model.servingRate - model.peopleRate
  const targetTraining    = breakevenTraining - opEquiv
  const r2036    = M.rows[9]

  const kpis = [
    {
      label: "Intrinsic Value / Share",
      value: fUsd2(M.perShare),
      sub:   `vs $${model.currentPrice} · ${sgn(M.updown)}${f1(M.updown)}% implied`,
      color: upCol,
    },
    {
      label: "10-yr Implied CAGR",
      value: `${sgn(M.impliedCAGR)}${f1(M.impliedCAGR * 100)}%`,
      sub:   `${M.impliedCAGR >= model.hurdle ? "Clears" : "Fails"} the ${fPct(model.hurdle)} hurdle`,
      color: hurdleCol,
    },
    {
      label: `${fPct(model.hurdle)}-Hurdle Buy Price`,
      value: fUsd2(M.hurdlePrice),
      sub:   `${M.hurdlePrice >= model.currentPrice ? "Above" : "Below"} today's $${model.currentPrice}`,
      color: M.hurdlePrice >= model.currentPrice ? "var(--green)" : "var(--amber)",
    },
    {
      label: "Intrinsic Equity Value",
      value: fUsdB(M.equity),
      sub:   `PV earnings ${fUsdB(M.sumPvFcf)} · PV TV ${fUsdB(M.pvTv)} · cash ${fUsdB(netCash)}`,
      color: scColors.color,
    },
    {
      label: "Implied 2036 Exit P/E",
      value: f1(M.exitPE) + "×",
      sub:   `on 2036E net income of ${fUsdB(r2036.ni)}`,
      color: "var(--text-1)",
    },
    {
      label: "2036E Training / Revenue",
      value: fPct(r2036.trainingPct),
      sub:   `vs ${fPct(breakevenTraining)} at breakeven · ${f1(r2036.gw)} GW total`,
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
          <div className="model-header-label">{model.name} · {model.exchange} · Compute-Driven Underlying-Economics DCF</div>
        </div>
        <div className="model-subline">
          Base year {model.baseYear}E · Revenue ~{fUsdB(model.baseRevenue)} (Oct-26 run-rate ~$81B) ·{" "}
          {f1(model.sharesOut)}B fully diluted shares · Net cash {fUsdB(netCash)} (post-IPO) ·{" "}
          Price ref ${model.currentPrice}{" "}
          {priceSource && (
            <span style={{ color: priceSource.startsWith("Live") ? "var(--green)" : "var(--text-3)", fontWeight: 500 }}>
              ({priceSource})
            </span>
          )}
        </div>
        <div className="model-subline">
          Revenue {fUsdB(model.firstRevenue)} (2027) → {fUsdB(model.capRevenue)} (2036) at an even {fPct(M.stage1Growth)}/yr ·{" "}
          serving compute {fPct(model.servingRate)} · people &amp; SG&amp;A {fPct(model.peopleRate)} ·{" "}
          training = plug · {fPct(margin)} net margin ≈ {fPct(opEquiv)} operating at {fPct(model.taxRate)} tax
        </div>
        <div className="model-subline">
          {cap(sc)} case = {A.label}
          {sc === "bull" && <> · {fPct(extG)}/yr revenue growth 2037–{2036 + A.extYears}</>}
          {" "}· then {fPct(termG)} forever · WACC {fPct(wacc)} · FCF ≈ net income
        </div>
      </div>

      {/* controls */}
      <div className="controls-row">
        <div className="control-group">
          <div className="section-label">Scenario</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["bear", "base", "bull"] as AnthropicScenario[]).map(s => (
              <button key={s} onClick={() => setSc(s)} className={`sc-btn ${sc === s ? `active-${s}` : ""}`}>
                {cap(s)}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <div className="section-label">WACC: {fPct(wacc)}</div>
          <input
            type="range" min={8} max={15} step={0.5} value={wacc * 100}
            onChange={e => setWacc(Number(e.target.value) / 100)}
            style={{ width: 150, accentColor: scColors.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 150 }}>
            <span>8%</span><span>15%</span>
          </div>
        </div>

        <div className="control-group">
          <div className="section-label">Terminal growth: {fPct(termG)}</div>
          <input
            type="range" min={1.5} max={5} step={0.5} value={termG * 100}
            onChange={e => setTermG(Number(e.target.value) / 100)}
            style={{ width: 150, accentColor: scColors.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 150 }}>
            <span>1.5%</span><span>5%</span>
          </div>
        </div>

        <div className="control-group">
          <div className="section-label">Underlying net margin: {fPct(margin)}</div>
          <input
            type="range" min={15} max={40} step={0.5} value={margin * 100}
            onChange={e => setMargin(Number(e.target.value) / 100)}
            style={{ width: 150, accentColor: scColors.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 150 }}>
            <span>15%</span><span>40%</span>
          </div>
        </div>

        {sc === "bull" && (
          <div className="control-group">
            <div className="section-label">2037–46 growth: {fPct(extG)}</div>
            <input
              type="range" min={3} max={25} step={1} value={extG * 100}
              onChange={e => setExtG(Number(e.target.value) / 100)}
              style={{ width: 150, accentColor: scColors.color }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 150 }}>
              <span>3%</span><span>25%</span>
            </div>
          </div>
        )}

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
            {model.baseYear + 1}–{M.lastYear} Compute P&amp;L — {cap(sc)} Case ($B · training is the plug that sets the margin)
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Revenue</th>
                  <th>Rev Δ</th>
                  <th>Serving ({fPct(model.servingRate)})</th>
                  <th>People &amp; SG&amp;A</th>
                  <th>Training</th>
                  <th>% Rev</th>
                  <th>Total compute</th>
                  <th>GW</th>
                  <th>Op profit</th>
                  <th>Net income ≈ FCF</th>
                  <th>PV</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => {
                  const star = r.year === 2036
                  const p2   = r.stage === 2
                  return (
                    <tr key={r.year} style={{ borderBottom: `1px solid ${star ? scColors.color + "55" : "rgba(37,43,59,0.88)"}` }}>
                      <td style={{ color: star ? scColors.color : p2 ? "var(--purple)" : "var(--text-1)", fontWeight: star ? 700 : 400 }}>
                        {r.year}{star ? " ★" : ""}
                      </td>
                      <td>{fUsdB(r.rev)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fPct(r.revGrowth)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fUsdB(r.serving)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fUsdB(r.people)}</td>
                      <td style={{ color: "var(--purple)" }}>{fUsdB(r.training)}</td>
                      <td style={{ color: r.breakeven ? "var(--amber)" : "var(--text-2)" }}>{fPct(r.trainingPct)}</td>
                      <td>{fUsdB(r.compute)}</td>
                      <td style={{ color: "var(--text-3)" }}>{f1(r.gw)}</td>
                      <td style={{ color: scColors.color }}>{fUsdB(r.ebit)}</td>
                      <td style={{ color: r.ni > 0 ? "var(--green)" : "var(--text-3)" }}>{fUsdB(r.ni)}</td>
                      <td style={{ color: "var(--accent)" }}>{fUsdB(r.pvFcf)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={11} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    Terminal value on {M.lastYear} net income · g={fPct(termG)} · WACC={fPct(wacc)} · {f1(M.gordon)}× Gordon multiple
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 600 }}>{fUsdB(M.pvTv)}</td>
                </tr>
                <tr className="ev-row">
                  <td colSpan={11} style={{ color: "var(--accent)", fontWeight: 600, textAlign: "left" }}>Enterprise Value (PV earnings + PV TV)</td>
                  <td style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>{fUsdB(M.ev)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* value mix */}
          <div className="section-label" style={{ marginTop: 22 }}>Where the Value Comes From — {cap(sc)} Case</div>
          {(() => {
            const parts = [
              { label: `2027–36 earnings`, v: M.sumPvStage1, col: "var(--accent)" },
              ...(M.sumPvStage2 > 0 ? [{ label: `2037–${M.lastYear} growth decade`, v: M.sumPvStage2, col: "var(--purple)" }] : []),
              { label: `Terminal value (post-${M.lastYear})`, v: M.pvTv, col: scColors.color },
              { label: "Net cash today", v: netCash, col: "var(--text-3)" },
            ]
            return (
              <div>
                <div style={{ display: "flex", height: 14, borderRadius: 4, overflow: "hidden", border: "1px solid rgba(37,43,59,0.88)" }}>
                  {parts.map(p => (
                    <div key={p.label} title={p.label} style={{ width: `${(p.v / M.equity) * 100}%`, background: p.col, opacity: 0.75 }} />
                  ))}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8, fontSize: 11, color: "var(--text-2)" }}>
                  {parts.map(p => (
                    <span key={p.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: p.col, opacity: 0.75 }} />
                      {p.label}: {fUsdB(p.v)} ({f0((p.v / M.equity) * 100)}%)
                    </span>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* bridge */}
          <div className="bridge-card">
            <div className="section-label">Value Bridge → Per Share</div>
            {[
              ["Enterprise value (PV earnings + PV TV)",  fUsdB(M.ev),                         "var(--text-1)"],
              ["(+) Post-IPO net cash",                   fUsdB(netCash),                       "var(--green)"],
              ["(=) Intrinsic equity value",             fUsdB(M.equity),                      "var(--accent)"],
              [`÷ Fully diluted shares (${f1(model.sharesOut)}B)`, fUsd2(M.perShare),          "var(--text-2)"],
              ["Intrinsic value / share",                fUsd2(M.perShare),                    scColors.color],
              ["Current price",                          `$${model.currentPrice}`,             "var(--text-3)"],
              ["Implied upside / (downside)",            `${sgn(M.updown)}${f1(M.updown)}%`,   upCol],
              ["10-yr implied CAGR",                     `${sgn(M.impliedCAGR)}${f1(M.impliedCAGR * 100)}%`, hurdleCol],
              [`Buy price for a ${fPct(model.hurdle)} CAGR`, fUsd2(M.hurdlePrice),              "var(--text-2)"],
              ...(sc === "bear"
                ? [["Price of the moat (PV of profits forgone 2027–35)", `${fUsd2(M.moatCost)} / sh · underlying path ${fUsd2(U.perShare)}`, "var(--amber)"]]
                : []),
            ].map(([k, v, col]) => (
              <div key={k} className="bridge-row">
                <span className="bridge-label">{k}</span>
                <span className="bridge-value" style={{ color: col }}>{v}</span>
              </div>
            ))}
          </div>

          {/* legend */}
          <div className="phase-legend">
            <div className="phase-item">
              <span className="phase-dot" style={{ background: scColors.color + "33", border: `1px solid ${scColors.color}66` }} />
              2027–2036: build-out to ~$1T
            </div>
            {sc === "bull" && (
              <div className="phase-item">
                <span className="phase-dot" style={{ background: "var(--purple-dim)", border: "1px solid rgba(167,139,250,.4)" }} />
                2037–{M.lastYear}: growth decade
              </div>
            )}
            <span style={{ fontSize: 11, color: scColors.color }}>★ = 2036, the $1T cap year</span>
            <span style={{ fontSize: 11, color: "var(--text-3)" }}>
              GW = total compute ÷ ${model.usdPerGwYear}B per GW-year (Claude&apos;s conversion; the filing discloses no GW)
            </span>
          </div>
        </div>
      )}

      {/* ── SENSITIVITY TAB ── */}
      {tab === "sensitivity" && (
        <div>
          <div className="section-label">
            Intrinsic Value / Share ($) — {cap(sc)} Case · terminal g {fPct(termG)}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            Rows = underlying net margin (23.7% ≈ a 30% operating margin) · Columns = WACC · Highlighted = current sliders
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="sens-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Net margin ↓ / WACC →</th>
                  {SENS.waccs.map(w => (
                    <th key={w} style={{ color: Math.abs(w - wacc) < 0.001 ? scColors.color : "var(--text-3)", fontWeight: Math.abs(w - wacc) < 0.001 ? 700 : 400 }}>
                      {fPct(w)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SENS.margins.map((nm, ri) => (
                  <tr key={nm}>
                    <td style={{ color: Math.abs(nm - margin) < 0.001 ? scColors.color : "var(--text-2)", fontWeight: Math.abs(nm - margin) < 0.001 ? 700 : 400 }}>
                      {fPct(nm)}
                    </td>
                    {SENS.waccs.map((w, ci) => {
                      const val = SENS.grid[ri][ci]
                      const sel = Math.abs(w - wacc) < 0.001 && Math.abs(nm - margin) < 0.001
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

          {/* growth decade */}
          <div className="section-label" style={{ marginTop: 24 }}>
            Is $1T a Ceiling or a Waypoint? — Bull Case, 2037–46 Growth · {fPct(margin)} net · WACC {fPct(wacc)}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ maxWidth: 560 }}>
              <thead>
                <tr><th>2037–46 growth</th><th>2046E revenue</th><th>Value / share</th><th>Implied CAGR</th><th>vs {fPct(model.hurdle)} hurdle</th></tr>
              </thead>
              <tbody>
                {GSENS.map(g => (
                  <tr key={g.growth}>
                    <td>{fPct(g.growth)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fUsdB(model.capRevenue * Math.pow(1 + g.growth, 10))}</td>
                    <td style={{ color: "var(--text-1)" }}>{fUsd2(g.perShare)}</td>
                    <td style={{ color: g.cagr >= model.hurdle ? "var(--green)" : "var(--amber)" }}>{sgn(g.cagr)}{fPct(g.cagr)}</td>
                    <td style={{ color: g.cagr >= model.hurdle ? "var(--green)" : "var(--text-3)" }}>{g.cagr >= model.hurdle ? "Clears" : "Fails"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* scenario compare */}
          <div className="section-label" style={{ marginTop: 24 }}>
            All Three Cases at {fPct(model.waccDefault)} WACC / {fPct(model.termGrowth)} Terminal / {fPct(model.netMarginDefault)} Net Margin
          </div>
          <div className="sc-compare">
            {(["bear", "base", "bull"] as AnthropicScenario[]).map(s => {
              const m2 = runAnthropicDCF(model, s, model.waccDefault, model.termGrowth)
              const mt = SC_COLORS[s]
              return (
                <div key={s} className="sc-card" style={{ background: mt.dim + "88", border: `1px solid ${mt.color}44` }}>
                  <div className="sc-card-label" style={{ color: mt.color }}>{cap(s)} Case</div>
                  <div className="sc-card-value" style={{ color: mt.color }}>{fUsd2(m2.perShare)}</div>
                  <div className="sc-card-updown" style={{ color: "var(--text-2)" }}>
                    {sgn(m2.updown)}{f1(m2.updown)}% vs ${model.currentPrice} · CAGR {fPct(m2.impliedCAGR)}
                  </div>
                  <div className="sc-card-stat">{model.scenarios[s].label}</div>
                  <div className="sc-card-stat">2036E net income: {fUsdB(m2.rows[9].ni)}</div>
                  <div className="sc-card-stat">Exit P/E (2036): {f1(m2.exitPE)}×</div>
                  <div className="sc-card-stat">{fPct(model.hurdle)}-hurdle buy price: {fUsd2(m2.hurdlePrice)}</div>
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
              title: "Compute P&L Identity",
              color: "var(--accent)",
              rows: [
                ["Revenue path", `${fUsdB(model.firstRevenue)} (2027) → ${fUsdB(model.capRevenue)} (2036), even ${fPct(M.stage1Growth)}/yr — the supply-feasible base (23–38% of non-OpenAI US AI capacity each year)`],
                ["Serving compute", `${fPct(model.servingRate)} of revenue ≈ 85% gross margin (9M 2026: 85.5%) · revenue per serving $ held flat (~$6.90), per Justin's conservative guardrail`],
                ["People, other R&D & SG&A", `${fPct(model.peopleRate)} of revenue · includes SBC, donation matching and public-benefit spend as real costs`],
                ["Training / R&D compute", `Plug = revenue − serving − people − op profit · ${fPct(breakevenTraining)} of revenue at breakeven, ${fPct(targetTraining)} at a ${fPct(margin)} net margin`],
                ["Margin", `${fPct(margin)} net ≈ ${fPct(opEquiv)} operating at ${fPct(model.taxRate)} tax (Justin chose net-margin framing)`],
                ["GW conversion", `Total compute ÷ $${model.usdPerGwYear}B per GW-year (Claude's estimate; the filing gives no GW)`],
              ],
            },
            {
              title: "Cases (ANT.md §10)",
              color: "var(--purple)",
              rows: [
                ["Bear (A)", "Breakeven 2027–35 (training absorbs the margin), 30% net in 2036, then 3% forever — the 'spend to escape velocity' path taken literally"],
                ["Base (B)", "30% net every year 2027–36 — valued on underlying economics, but with ~$1T as a ceiling"],
                ["Bull (C)", "30% net every year + 15%/yr revenue 2037–46 (~$4T by 2046) before a 3% terminal — Justin's 20-year case"],
                ["Internal inconsistency", "A 30% margin in 2027 leaves ~$48B for training vs ~$79B in the 2027 plan, yet the path to $1T assumed the bigger budget — B and C are upper bounds on the build-out"],
                ["Success-case inputs", "Each case assumes the thesis works. Prefer probability-weighting at ~10% over padding the discount rate"],
              ],
            },
            {
              title: "Balance Sheet & Shares (424B4)",
              color: "var(--amber)",
              rows: [
                ["Net cash", `${fUsdB(netCash)} = $131.9B (9/30/26) + $104.8B net IPO/private placement − $4.3B RSU withholding · counted in full (no-equity-draw thesis)`],
                ["Undrawn capacity", "$15B revolver + $67B partner facilities (Broadcom $42B, Amazon $15B, Google $10B — all convert to stock if drawn) — not counted"],
                ["Fully diluted shares", `${f1(model.sharesOut)}B: 13.22B outstanding + options 1.71B + RSUs 1.07B + Amazon rollover notes 1.55B + matching 0.58B`],
                ["SAFE fair-value loss", "$94.3B (9M 2026) is non-cash and excluded — its dilution is already in the share count"],
                ["Default WACC / terminal", `${fPct(model.waccDefault)} / ${fPct(model.termGrowth)} · Gordon ${f1((1 + model.termGrowth) / (model.waccDefault - model.termGrowth))}× · hurdle ${fPct(model.hurdle)}`],
                ["Current price", `$${model.currentPrice} (IPO $83 on Nov 19, 2026)`],
              ],
            },
            {
              title: "What Would Change the Verdict",
              color: "var(--red)",
              rows: [
                ["Growth vs maintenance training", "The whole valuation hinges on training falling from ~70% to ~32% of revenue. If rivals (Google, OpenAI, Meta) force the spend, it never stops and 30% isn't the underlying margin"],
                ["Token pricing", "Revenue per serving $ is the biggest long-run swing — 10%/yr price declines after 2029 would halve 2036 revenue"],
                ["$1T: ceiling or waypoint?", "~$1T ≈ the US white-collar seat TAM ($1,000/mo × ~72–102M workers); anything above needs agents, international and new businesses"],
                ["PBC governance", "'If they wanted to' carries a discount — the board balances stockholders against the public-benefit purpose"],
                ["Dilution", "Amazon rollover-note conversion pace, SBC, future Public Benefit Issuances, any partner-facility draws"],
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
        For informational and educational purposes only · Not investment advice ·
        2027+ figures are scenario outputs under stated assumptions, not company guidance ·
        Value/share = (Σ PV net income + PV terminal + net cash) ÷ fully diluted shares ·
        Updated {model.lastUpdated}
      </div>
    </div>
  )
}
