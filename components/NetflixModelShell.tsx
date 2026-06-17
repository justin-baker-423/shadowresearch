"use client"
import { useState, useMemo } from "react"
import type { NetflixModelConfig, Scenario } from "@/lib/netflix-models"
import { runNetflixDCF, buildNetflixSensitivity } from "@/lib/netflix-engine"

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

export default function NetflixModelShell({
  model,
  priceSource,
}: {
  model: NetflixModelConfig
  priceSource?: string
}) {
  const [sc,    setSc]    = useState<Scenario>("base")
  const [wacc,  setWacc]  = useState(model.waccDefault)
  const [termG, setTermG] = useState(model.termGrowth)
  const [tab,   setTab]   = useState<"model" | "sensitivity" | "assumptions">("model")

  const M    = useMemo(() => runNetflixDCF(model, sc, wacc, termG), [model, sc, wacc, termG])
  const SENS = useMemo(() => buildNetflixSensitivity(model, sc),     [model, sc])

  const scColors = SC_COLORS[sc]
  const accent   = model.accentColor ?? "var(--accent)"
  const upCol    = M.updown > 0 ? "var(--green)" : "var(--red)"
  const finalRow = M.rows[9]

  // margin expansion (FY2025A → 2035E)
  const grossExp = finalRow.grossMargin - model.baseGrossMargin
  const ebitExp  = finalRow.ebitMargin  - model.baseEbitMargin

  // capital allocation
  const cumBuyback   = M.rows.reduce((s, r) => s + r.buyback, 0)
  const sharesRetired = (1 - finalRow.shares / model.sharesOut) * 100

  function sensColor(val: number) {
    const ratio = val / model.currentPrice
    if (ratio >= 1.3) return "sens-cell-green"
    if (ratio >= 1.0) return "sens-cell-accent"
    if (ratio >= 0.7) return "sens-cell-amber"
    return "sens-cell-red"
  }

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
      label: "2035E Gross Margin",
      value: fPct(finalRow.grossMargin),
      sub:   `+${f1(grossExp * 100)} pts vs ${fPct(model.baseGrossMargin)} FY${model.baseYear}A`,
      color: "var(--green)",
    },
    {
      label: "2035E Operating Margin",
      value: fPct(finalRow.ebitMargin),
      sub:   `+${f1(ebitExp * 100)} pts vs ${fPct(model.baseEbitMargin)} FY${model.baseYear}A`,
      color: scColors.color,
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
      value: fB(finalRow.rev),
      sub:   `${f2(finalRow.rev / model.baseRevenue)}× FY${model.baseYear} base`,
      color: "var(--text-1)",
    },
    {
      label: "2035E Shares",
      value: f1(finalRow.shares) + "B",
      sub:   `−${f1((1 - finalRow.shares / model.sharesOut) * 100)}% via buybacks · ${model.buybackPE}× EPS`,
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
          <div className="model-header-label">
            {model.name} · {model.exchange} · DCF Model
          </div>
        </div>
        <div className="model-subline">
          Base year FY{model.baseYear}A · Revenue ${model.baseRevenue}B ·{" "}
          {model.sharesOut}B diluted shares · Net debt ${Math.abs(model.netCash)}B · Price ref ${model.currentPrice}{" "}
          {priceSource && (
            <span style={{ color: priceSource.startsWith("Live") ? "var(--green)" : "var(--text-3)", fontWeight: 500 }}>
              ({priceSource})
            </span>
          )}
        </div>
        <div className="model-subline">
          Content-amortization engine · amort = {fPct(model.amortRate)} × content-asset balance · non-content COGS +{fPct(model.scenarios[sc].nonContentCOGSGrowth)} ·
          opex flat at {fPct(model.marketingPct + model.techDevPct + model.gaPct)} of revenue · {model.cashMonthsTarget}-mo revenue cash floor, excess → buybacks @ {model.buybackPE}× EPS · WACC {fPct(wacc)} · Terminal g {fPct(termG)}
        </div>
      </div>

      {/* controls */}
      <div className="controls-row">
        <div className="control-group">
          <div className="section-label">Scenario</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["bear", "base", "bull"] as Scenario[]).map(s => (
              <button key={s} onClick={() => setSc(s)} className={`sc-btn ${sc === s ? `active-${s}` : ""}`}>
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
            type="range" min={2} max={5} step={0.5} value={termG * 100}
            onChange={e => setTermG(Number(e.target.value) / 100)}
            style={{ width: 180, accentColor: scColors.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>2%</span><span>5%</span>
          </div>
        </div>

        <div className="control-group">
          <div className="section-label">View</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["model", "sensitivity", "assumptions"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`tab-btn ${tab === t ? "active" : ""}`}>
                {t}
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
          {/* margin expansion banner */}
          <div className="bridge-card" style={{ marginBottom: 18 }}>
            <div className="section-label">
              Margin Expansion — Content Amortization Compounds Slower Than Revenue
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginTop: 6 }}>
              <MarginStat
                label="Gross margin"
                from={model.baseGrossMargin} to={finalRow.grossMargin}
                color="var(--green)"
              />
              <MarginStat
                label="Operating margin"
                from={model.baseEbitMargin} to={finalRow.ebitMargin}
                color={scColors.color}
              />
              <div>
                <div className="kpi-label">Content amort CAGR</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--purple)" }}>
                  {fPct(Math.pow(finalRow.contentAmort / M.rows[0].contentAmort, 1 / 9) - 1)}
                </div>
                <div className="kpi-sub">vs revenue CAGR {fPct(Math.pow(finalRow.rev / model.baseRevenue, 0.1) - 1)}</div>
              </div>
              <div>
                <div className="kpi-label">Content assets 2035E</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)" }}>
                  {fB(finalRow.contentAsset)}
                </div>
                <div className="kpi-sub">from ${model.contentAssetBase}B · +{fPct(model.scenarios[sc].excessContent[0] / model.contentAssetBase)}→ excess</div>
              </div>
            </div>
          </div>

          {/* capital allocation banner */}
          <div className="bridge-card" style={{ marginBottom: 18 }}>
            <div className="section-label">
              Capital Allocation — {model.cashMonthsTarget}-Month Revenue Cash Floor, Excess Swept to Buybacks
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 24, marginTop: 6 }}>
              <div>
                <div className="kpi-label">Cash on hand</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)" }}>
                  ${model.cashBase}B <span style={{ color: "var(--text-3)" }}>→</span> {fB(finalRow.cashEnd)}
                </div>
                <div className="kpi-sub">held at {model.cashMonthsTarget} mo of revenue (2035E floor {fB(finalRow.cashTarget)})</div>
              </div>
              <div>
                <div className="kpi-label">Cumulative buybacks</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--purple)" }}>
                  {fB(cumBuyback)}
                </div>
                <div className="kpi-sub">2026–2035 · at {model.buybackPE}× EPS</div>
              </div>
              <div>
                <div className="kpi-label">Shares retired</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--purple)" }}>
                  −{f1(sharesRetired)}%
                </div>
                <div className="kpi-sub">{model.sharesOut}B <span style={{ color: "var(--text-3)" }}>→</span> {f2(finalRow.shares)}B shares</div>
              </div>
              <div>
                <div className="kpi-label">Cash build</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-1)" }}>
                  Levered FCF
                </div>
                <div className="kpi-sub">UFCF − after-tax net interest (${model.netInterestBase}B)</div>
              </div>
            </div>
          </div>

          <div className="section-label">
            FY2026–2035 Explicit Forecast — {sc.charAt(0).toUpperCase() + sc.slice(1)} Case
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Revenue</th>
                  <th>Rev Δ</th>
                  <th>Content Amort</th>
                  <th>COGS</th>
                  <th>Gross M%</th>
                  <th>Op M%</th>
                  <th>FCF</th>
                  <th>Buyback</th>
                  <th>Cash EOY</th>
                  <th>Shares</th>
                  <th>PV of FCF</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => (
                  <tr key={r.year} style={{ borderBottom: "1px solid rgba(37,43,59,0.88)" }}>
                    <td>{r.year}</td>
                    <td>{fB(r.rev)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fPct(r.revGrowth)}</td>
                    <td style={{ color: "var(--purple)" }}>{fB(r.contentAmort)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fB(r.cogs)}</td>
                    <td style={{ color: "var(--green)" }}>{fPct(r.grossMargin)}</td>
                    <td style={{ color: scColors.color }}>{fPct(r.ebitMargin)}</td>
                    <td>{fB(r.fcf)}</td>
                    <td style={{ color: "var(--purple)" }}>{fB(r.buyback)}</td>
                    <td style={{ color: "var(--text-2)" }} title={`2-mo revenue floor = ${fB(r.cashTarget)}`}>{fB(r.cashEnd)}</td>
                    <td style={{ color: "var(--text-2)" }}>{f2(r.shares)}B</td>
                    <td style={{ color: "var(--accent)" }}>{fB(r.pvFcf)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={11} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    Terminal value · g={fPct(termG)} · WACC={fPct(wacc)} · {f1(M.gordon)}× Gordon multiple
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 600 }}>{fB(M.pvTv)}</td>
                </tr>
                <tr className="ev-row">
                  <td colSpan={11} style={{ color: "var(--accent)", fontWeight: 600, textAlign: "left" }}>
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
            {([
              ["Enterprise Value",                       fB(M.ev),                                          "var(--text-1)"],
              [`(−) Net debt (FY${model.baseYear}A)`,    `$${f1(model.netCash)}B`,                          "var(--red)"   ],
              ["Equity Value",                           fB(M.equity),                                      "var(--accent)"],
              ["÷ Shares (post-buyback, 2035E)",         f2(finalRow.shares) + "B",                         "var(--text-2)"],
              ["Intrinsic Value / Share",                fShare(M.perShare),                                scColors.color ],
              ["Current price reference",                `$${model.currentPrice}`,                          "var(--text-3)"],
              ["Implied upside / (downside)",            `${M.updown > 0 ? "+" : ""}${f1(M.updown)}%`,      upCol          ],
              ["10-yr implied CAGR",                     `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`, upCol],
              ["Cumulative shares retired",              `−${f1((1 - finalRow.shares / model.sharesOut) * 100)}%`, "var(--purple)"],
            ] as [string, string, string][]).map(([k, v, col]) => (
              <div key={k} className="bridge-row">
                <span className="bridge-label">{k}</span>
                <span className="bridge-value" style={{ color: col }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SENSITIVITY TAB ── */}
      {tab === "sensitivity" && (
        <div>
          <div className="section-label">
            Intrinsic Value / Share ($) — {sc.charAt(0).toUpperCase() + sc.slice(1)} Case
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            Rows = Terminal growth · Columns = WACC · Highlighted = current sliders
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
                      const sel = Math.abs(tg - termG) < 0.001 && Math.abs(w - wacc) < 0.001
                      return (
                        <td key={w} className={`${sensColor(val)} ${sel ? "sens-cell-selected" : ""}`} style={sel ? { borderColor: scColors.color, color: scColors.color } : {}}>
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

          <div className="section-label" style={{ marginTop: 24 }}>
            All Three Scenarios at {fPct(model.waccDefault)} WACC / {fPct(model.termGrowth)} Terminal Growth
          </div>
          <div className="sc-compare">
            {(["bear", "base", "bull"] as Scenario[]).map(s => {
              const m2 = runNetflixDCF(model, s, model.waccDefault, model.termGrowth)
              const mt = SC_COLORS[s]
              return (
                <div key={s} className="sc-card" style={{ background: mt.dim + "88", border: `1px solid ${mt.color}44` }}>
                  <div className="sc-card-label" style={{ color: mt.color }}>{s.charAt(0).toUpperCase() + s.slice(1)} Case</div>
                  <div className="sc-card-value" style={{ color: mt.color }}>{fShare(m2.perShare)}</div>
                  <div className="sc-card-updown" style={{ color: "var(--text-2)" }}>
                    {m2.updown > 0 ? "+" : ""}{f1(m2.updown)}% vs ${model.currentPrice}
                  </div>
                  <div className="sc-card-stat">2035E Rev: {fB(m2.rows[9].rev)}</div>
                  <div className="sc-card-stat">2035E Gross M: {fPct(m2.rows[9].grossMargin)}</div>
                  <div className="sc-card-stat">2035E Op M: {fPct(m2.rows[9].ebitMargin)}</div>
                  <div className="sc-card-stat">2035E FCF: {fB(m2.rows[9].fcf)}</div>
                  <div className="sc-card-stat">EV: {fB(m2.ev)}</div>
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
              title: "Content-Amortization Engine",
              color: "var(--purple)",
              rows: [
                ["Mechanic",                "amort(t) = amortRate × content-asset balance(t−1)"],
                ["Amortization rate",       `${fPct(model.amortRate)} (FY${model.baseYear}: $16.42B ÷ $32.45B begin)`],
                ["Content assets (begin)",  `$${model.contentAssetBase}B at 1-Jan-2026`],
                ["Balance growth",          "ContentAsset(t) = ContentAsset(t−1) + excess investment"],
                ["Base excess content",     model.scenarios.base.excessContent.map(e => "$" + f1(e)).join(" → ") + "B"],
                ["Cash content spend",      "additions = amortization + excess"],
              ],
            },
            {
              title: "Cost & Margin Structure",
              color: "var(--green)",
              rows: [
                ["COGS",                    "content amortization + non-content COGS"],
                ["Non-content COGS base",   `$${model.nonContentCOGSBase}B (FY${model.baseYear})`],
                ["Non-content COGS growth", `bear ${fPct(model.scenarios.bear.nonContentCOGSGrowth)} · base ${fPct(model.scenarios.base.nonContentCOGSGrowth)} · bull ${fPct(model.scenarios.bull.nonContentCOGSGrowth)}`],
                ["Marketing",               `${fPct(model.marketingPct)} of revenue (flat at FY${model.baseYear})`],
                ["Technology & development", `${fPct(model.techDevPct)} of revenue (flat)`],
                ["General & administrative", `${fPct(model.gaPct)} of revenue (flat)`],
                [`FY${model.baseYear}A gross margin`, fPct(model.baseGrossMargin)],
                [`FY${model.baseYear}A operating margin`, fPct(model.baseEbitMargin)],
              ],
            },
            {
              title: "Revenue Growth",
              color: "var(--accent)",
              rows: [
                ["Bear (2026→2035)", model.scenarios.bear.revGrowth.map(g => fPct(g)).join(" → ")],
                ["Base (2026→2035)", model.scenarios.base.revGrowth.map(g => fPct(g)).join(" → ")],
                ["Bull (2026→2035)", model.scenarios.bull.revGrowth.map(g => fPct(g)).join(" → ")],
              ],
            },
            {
              title: "Free Cash Flow & Capital Allocation",
              color: "var(--amber)",
              rows: [
                ["FCF formula",         "NOPAT + other D&A − excess content − capex"],
                ["NOPAT",               `EBIT × (1 − ${fPct(model.taxRate)} tax)`],
                ["Capex",               `$${model.capexBase}B base · grows with revenue`],
                ["Other D&A",           `$${model.otherDABase}B base · grows with revenue`],
                ["Working capital",     "assumed neutral (deferred revenue ≈ offsets)"],
                ["SBC",                 "treated as cash cost (inside EBIT, not added back)"],
                ["Cash floor",          `hold ${model.cashMonthsTarget} months of revenue (rev ÷ ${12 / model.cashMonthsTarget}) as cash on hand`],
                ["Opening cash",        `$${model.cashBase}B (FY${model.baseYear}A cash & equivalents)`],
                ["Buybacks",            `all cash above the floor → repurchases at ${model.buybackPE}× current-year EPS`],
                ["Cash build",          "levered FCF = UFCF − after-tax net interest"],
                ["Net interest",        `$${model.netInterestBase}B (bridges EBIT→net income & UFCF→levered FCF)`],
              ],
            },
            {
              title: "Valuation",
              color: "var(--text-1)",
              rows: [
                ["Default WACC",           fPct(model.waccDefault)],
                ["Default terminal growth", fPct(model.termGrowth)],
                ["Gordon multiple (defaults)", f1((1 + model.termGrowth) / (model.waccDefault - model.termGrowth)) + "×"],
                ["Net debt (FY2025A)",     `$${Math.abs(model.netCash)}B — subtracted from EV`],
                ["Shares outstanding",     `${model.sharesOut}B diluted (post 10-for-1 split)`],
                ["WBD acquisition",        "excluded — standalone Netflix"],
                ["Current price reference", `$${model.currentPrice}/share`],
                ["Model last updated",     model.lastUpdated],
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
        Content-Amortization Engine · FCF = NOPAT + D&amp;A − excess content − capex ·
        Content amort = {fPct(model.amortRate)} × content-asset balance · {model.cashMonthsTarget}-mo revenue cash floor, excess → buybacks @ {model.buybackPE}× EPS ·
        WBD acquisition excluded · Updated {model.lastUpdated}
      </div>
    </div>
  )
}

function MarginStat({ label, from, to, color }: { label: string; from: number; to: number; color: string }) {
  return (
    <div>
      <div className="kpi-label">{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>
        {fPct(from)} <span style={{ color: "var(--text-3)" }}>→</span> {fPct(to)}
      </div>
      <div className="kpi-sub" style={{ color }}>+{f1((to - from) * 100)} pts</div>
    </div>
  )
}
