"use client"
import { useState, useMemo } from "react"
import type { MetaModelConfig, Scenario } from "@/lib/meta-models"
import { runMetaDCF, buildMetaSensitivity } from "@/lib/meta-dcf-engine"

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

export default function MetaModelShell({
  model,
  priceSource,
}: {
  model: MetaModelConfig
  priceSource?: string
}) {
  const [sc,          setSc]          = useState<Scenario>("base")
  const [wacc,        setWacc]        = useState(model.waccDefault)
  const [termG,       setTermG]       = useState(model.termGrowth)
  const [roic,        setRoic]        = useState(model.roicDefault)
  const [adMktGrowth, setAdMktGrowth] = useState(model.adMarketGrowthDefault)
  const [tab,         setTab]         = useState<"model" | "sensitivity" | "assumptions">("model")

  const M    = useMemo(
    () => runMetaDCF(model, sc, wacc, termG, roic, adMktGrowth),
    [model, sc, wacc, termG, roic, adMktGrowth],
  )
  const SENS = useMemo(
    () => buildMetaSensitivity(model, sc, termG, wacc),
    [model, sc, termG, wacc],
  )

  const scColors = SC_COLORS[sc]
  const accent   = model.accentColor ?? "var(--accent)"
  const upCol    = M.updown > 0 ? "var(--green)" : "var(--red)"

  const finalRow = M.rows[9]

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
      label: "2035E FoA Revenue",
      value: fB(finalRow.rev),
      sub:   `${f2(finalRow.rev / model.foaBaseRevenue)}× FY${model.baseYear} base`,
      color: "var(--text-1)",
    },
    {
      label: "2035E FCF",
      value: fB(finalRow.fcf),
      sub:   `FCF margin ${fPct(finalRow.fcfM)}`,
      color: scColors.color,
    },
    {
      label: "2035E Global Ad Share",
      value: fPct(finalRow.mktShare),
      sub:   `of $${Math.round(finalRow.adTAM)}B total ad market · from ${fPct(M.rows[0].mktShare)} in 2026`,
      color: "var(--purple)",
    },
    {
      label: "2035E Shares",
      value: f1(finalRow.shares) + "B",
      sub:   `−${f1((1 - finalRow.shares / model.sharesOut) * 100)}% vs today`,
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
            style={{ background: accent === "var(--accent)" ? "#1457c8" : accent }}
          >
            {model.ticker}
          </div>
          <div className="model-header-label">
            {model.name} · {model.exchange} · DCF Model
          </div>
        </div>
        <div className="model-subline">
          Base year FY{model.baseYear}A · FoA Revenue ${model.foaBaseRevenue}B ·{" "}
          {model.sharesOut}B diluted shares · Net cash ${model.netCash}B · Price ref ${model.currentPrice}{" "}
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
          Three-driver revenue model · {fPct(adMktGrowth)} market floor + AI shareGain + ROIC × Net Capex(t−2) ·
          Capex lag 2 yrs · WACC {fPct(wacc)} · Terminal g {fPct(termG)} · ROIC {fPct(roic)}
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

        {/* Ad market growth */}
        <div className="control-group">
          <div className="section-label">Ad Market Growth: {fPct(adMktGrowth)}</div>
          <input
            type="range" min={4} max={10} step={0.5} value={adMktGrowth * 100}
            onChange={e => setAdMktGrowth(Number(e.target.value) / 100)}
            style={{ width: 180, accentColor: scColors.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>4%</span><span>10%</span>
          </div>
        </div>

        {/* ROIC */}
        <div className="control-group">
          <div className="section-label">Capex ROIC: {fPct(roic)}</div>
          <input
            type="range" min={12} max={30} step={1} value={roic * 100}
            onChange={e => setRoic(Number(e.target.value) / 100)}
            style={{ width: 180, accentColor: scColors.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>12%</span><span>30%</span>
          </div>
        </div>

        {/* WACC */}
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

        {/* terminal growth */}
        <div className="control-group">
          <div className="section-label">Terminal growth: {fPct(termG)}</div>
          <input
            type="range" min={2} max={5.5} step={0.5} value={termG * 100}
            onChange={e => setTermG(Number(e.target.value) / 100)}
            style={{ width: 180, accentColor: scColors.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 180 }}>
            <span>2%</span><span>5.5%</span>
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
            FY2026–2035 Explicit Forecast — {sc.charAt(0).toUpperCase() + sc.slice(1)} Case
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>FoA Revenue</th>
                  <th>Rev Δ</th>
                  <th>Ad Mkt Share</th>
                  <th>FoA Op Margin</th>
                  <th>NOPAT</th>
                  <th>D&amp;A</th>
                  <th>Capex</th>
                  <th>FCF</th>
                  <th>PV of FCF</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map((r) => {
                  const isGuided    = r.year === 2026
                  const isMilestone = r.year === 2031
                  const isPhase2    = r.year >= 2031
                  const fcfNeg      = r.fcf < 0
                  return (
                    <tr
                      key={r.year}
                      style={{
                        borderBottom: `1px solid ${isMilestone ? scColors.color + "55" : "rgba(37,43,59,0.88)"}`,
                      }}
                    >
                      <td
                        style={{
                          color:      isMilestone ? scColors.color : isPhase2 ? "var(--purple)" : "var(--text-1)",
                          fontWeight: isMilestone ? 700 : 400,
                        }}
                      >
                        {r.year}{isMilestone ? " ★" : ""}
                      </td>
                      <td>{fB(r.rev)}</td>
                      <td style={{ color: "var(--text-2)" }}>
                        {isGuided
                          ? <><span style={{ color: scColors.color }}>†</span> {fPct(r.revGrowth)}</>
                          : fPct(r.revGrowth)
                        }
                      </td>
                      <td style={{ color: "var(--purple)", fontSize: 11 }}>
                        {fPct(r.mktShare)}
                      </td>
                      <td style={{ color: scColors.color }}>{fPct(r.foaOpMargin)}</td>
                      <td>{fB(r.nopat)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fB(r.da)}</td>
                      <td style={{ color: "var(--amber)" }}>{fB(r.capex)}</td>
                      <td style={{ color: fcfNeg ? "var(--red)" : "var(--text-1)", fontWeight: fcfNeg ? 600 : 400 }}>
                        {fcfNeg ? `(${fB(Math.abs(r.fcf))})` : fB(r.fcf)}
                      </td>
                      <td style={{ color: fcfNeg ? "var(--red-dim)" : "var(--accent)" }}>
                        {fcfNeg ? `(${fB(Math.abs(r.pvFcf))})` : fB(r.pvFcf)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={9} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    Terminal value · g={fPct(termG)} · WACC={fPct(wacc)} · {f1(M.gordon)}× Gordon multiple
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

          {/* bridge */}
          <div className="bridge-card">
            <div className="section-label">EV → Per-Share Value Bridge</div>
            {[
              ["Enterprise Value",                      fB(M.ev),                                          "var(--text-1)"],
              [`(+) Net cash (FY${model.baseYear}A)`,   `$${f1(model.netCash)}B`,                          "var(--green)" ],
              ["Equity Value",                          fB(M.equity),                                      "var(--accent)"],
              ["÷ Shares (post-buyback)",               f1(finalRow.shares) + "B",                         "var(--text-2)"],
              ["Intrinsic Value / Share",               fShare(M.perShare),                                scColors.color ],
              ["Current price reference",               `$${model.currentPrice}`,                          "var(--text-3)"],
              ["Implied upside / (downside)",           `${M.updown > 0 ? "+" : ""}${f1(M.updown)}%`,     upCol          ],
              ["10-yr implied CAGR",                    `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`, upCol],
              ["2035E global ad share",                 fPct(finalRow.mktShare),                           "var(--purple)" ],
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
              <span
                className="phase-dot"
                style={{ background: "var(--red-dim)", border: "1px solid rgba(248,113,113,.4)" }}
              />
              2026: Guidance anchor · FCF negative · ~100% of cash flow absorbed by capex
            </div>
            <div className="phase-item">
              <span
                className="phase-dot"
                style={{ background: scColors.color + "22", border: `1px solid ${scColors.color}55` }}
              />
              2027–2028: Near-zero FCF · AI shareGain + $125B capex monetises (2028 re-acceleration)
            </div>
            <div className="phase-item">
              <span
                className="phase-dot"
                style={{ background: "var(--purple-dim)", border: "1px solid rgba(167,139,250,.4)" }}
              />
              2029–2031: shareGain fades · capex contribution sustains growth above market floor
            </div>
            <div className="phase-item">
              <span
                className="phase-dot"
                style={{ background: "rgba(167,139,250,.1)", border: "1px solid rgba(167,139,250,.3)" }}
              />
              2032–2035: Growth converges toward 7–9% · market floor + residual capex ROIC
            </div>
            <span style={{ fontSize: 11, color: scColors.color }}>★ = Phase 2 start (2031)</span>
          </div>
        </div>
      )}

      {/* ── SENSITIVITY TAB ── */}
      {tab === "sensitivity" && (
        <div>
          <div className="section-label">
            Intrinsic Value / Share ($) — {sc.charAt(0).toUpperCase() + sc.slice(1)} Margin &amp; Capex Profile
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            Rows = Ad Market Growth · Columns = Capex ROIC · WACC held at {fPct(wacc)} · Terminal g {fPct(termG)} · Highlighted = current sliders
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="sens-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Ad Mkt Growth ↓ / ROIC →</th>
                  {SENS.roics.map(r => (
                    <th
                      key={r}
                      style={{
                        color:      Math.abs(r - roic) < 0.001 ? scColors.color : "var(--text-3)",
                        fontWeight: Math.abs(r - roic) < 0.001 ? 700 : 400,
                      }}
                    >
                      {fPct(r)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SENS.adMktGrowths.map((g, gi) => (
                  <tr key={g}>
                    <td
                      style={{
                        color:      Math.abs(g - adMktGrowth) < 0.001 ? scColors.color : "var(--text-2)",
                        fontWeight: Math.abs(g - adMktGrowth) < 0.001 ? 700 : 400,
                      }}
                    >
                      {fPct(g)}
                    </td>
                    {SENS.roics.map((r, ci) => {
                      const val = SENS.grid[gi][ci]
                      const sel = Math.abs(g - adMktGrowth) < 0.001 && Math.abs(r - roic) < 0.001
                      const cls = sensColor(val)
                      return (
                        <td
                          key={r}
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
            All Three Scenarios at {fPct(model.waccDefault)} WACC / {fPct(model.termGrowth)} Terminal Growth / {fPct(model.roicDefault)} ROIC / {fPct(model.adMarketGrowthDefault)} Ad Growth
          </div>
          <div className="sc-compare">
            {(["bear", "base", "bull"] as Scenario[]).map(s => {
              const m2 = runMetaDCF(model, s, model.waccDefault, model.termGrowth, model.roicDefault, model.adMarketGrowthDefault)
              const mt = SC_COLORS[s]
              return (
                <div key={s} className="sc-card" style={{ background: mt.dim + "88", border: `1px solid ${mt.color}44` }}>
                  <div className="sc-card-label" style={{ color: mt.color }}>
                    {s.charAt(0).toUpperCase() + s.slice(1)} Case
                  </div>
                  <div className="sc-card-value" style={{ color: mt.color }}>{fShare(m2.perShare)}</div>
                  <div className="sc-card-updown" style={{ color: "var(--text-2)" }}>
                    {m2.updown > 0 ? "+" : ""}{f1(m2.updown)}% vs ${model.currentPrice}
                  </div>
                  <div className="sc-card-stat">2035E Rev: {fB(m2.rows[9].rev)}</div>
                  <div className="sc-card-stat">2035E FCF: {fB(m2.rows[9].fcf)}</div>
                  <div className="sc-card-stat">2035E Ad Share: {fPct(m2.rows[9].mktShare)}</div>
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
              title: "Investment Framework",
              color: "var(--accent)",
              rows: [
                ["Engine",            "Capex-Adjusted NOPAT · Two-Driver Revenue Model"],
                ["FCF formula",       "NOPAT + D&A − Capex"],
                ["Asset useful life", `${model.assetLife} years → ${fPct(1 / model.assetLife)} D&A rate`],
                ["PP&E base (FY2026 start)", `$${model.basePPE}B gross`],
                ["FY2026 capex",      `$${model.capexYear1}B (guidance-anchored, absolute)`],
                ["Scope",             "Family of Apps only · Reality Labs fully excluded"],
              ],
            },
            {
              title: "Revenue Growth Drivers",
              color: "var(--green)",
              rows: [
                ["Formula",                `adMarketGrowth + shareGain(t) + ROIC × max(0, NetCapex(t−2)) / Rev(t−1)`],
                ["Driver 1 — Market floor",  `${fPct(model.adMarketGrowth)} annual global ad TAM growth · permanent`],
                ["Driver 2 — AI advantage",  "shareGain: compound monetization (Advantage+, Llama, WhatsApp) · decays to 0"],
                ["Bear shareGain (27→35)",   model.scenarios.bear.shareGainSchedule.map(g => fPct(g)).join(" → ")],
                ["Base shareGain (27→35)",   model.scenarios.base.shareGainSchedule.map(g => fPct(g)).join(" → ")],
                ["Bull shareGain (27→35)",   model.scenarios.bull.shareGainSchedule.map(g => fPct(g)).join(" → ")],
                ["Driver 3 — Capex upside",  "ROIC × net capex from 2 years prior / prior-year revenue"],
                ["Capex monetisation lag",   "2 years · FY2026 $125B capex monetises in FY2028"],
                ["FY2027 seed (t−2)",        `FY2025 net capex $${model.netCapexSeed}B (actual)`],
                ["Global ad TAM (2025)",     `$${model.adTam2025}B · growing at ${fPct(model.adMarketGrowth)}/yr`],
                ["Starting share",           `~${fPct(model.foaBaseRevenue / model.adTam2025)} of total global advertising`],
              ],
            },
            {
              title: "Operating Margin Path",
              color: "var(--text-1)",
              rows: [
                ["FY2026 anchor",            fPct(model.scenarios.base.foaOpMargin[0]) + " (all scenarios)"],
                ["Bear path (2026→2035)",     model.scenarios.bear.foaOpMargin.map(m => fPct(m)).join(" → ")],
                ["Base path (2026→2035)",     model.scenarios.base.foaOpMargin.map(m => fPct(m)).join(" → ")],
                ["Bull path (2026→2035)",     model.scenarios.bull.foaOpMargin.map(m => fPct(m)).join(" → ")],
                ["Tax rate",                  fPct(model.taxRate) + " effective (held constant)"],
                ["SBC",                       "Captured in FoA operating income · no separate haircut"],
              ],
            },
            {
              title: "Capital Deployment",
              color: "var(--amber)",
              rows: [
                ["FY2026 capex / revenue",    fPct(model.capexYear1 / model.foaYear1Revenue) + " (guidance-implied)"],
                ["Base capex path (2027→35)", model.scenarios.base.capexPct.map(c => fPct(c)).join(" → ")],
                ["Default ROIC",              fPct(model.roicDefault) + " (adjustable via slider)"],
                ["Buyback schedule",          model.buybackSchedule.map(b => fPct(b)).join(" → ")],
                ["Shares outstanding",        model.sharesOut + "B diluted"],
              ],
            },
            {
              title: "Valuation",
              color: "var(--purple)",
              rows: [
                ["Default WACC",              fPct(model.waccDefault)],
                ["Default terminal growth",   fPct(model.termGrowth)],
                ["Default ROIC",              fPct(model.roicDefault)],
                ["Default ad market growth",  fPct(model.adMarketGrowthDefault)],
                ["Gordon multiple (defaults)", f1((1 + model.termGrowth) / (model.waccDefault - model.termGrowth)) + "×"],
                ["Net cash (FY2025A)",        `$${model.netCash}B — added to equity value`],
                ["Current price reference",   `$${model.currentPrice}/share`],
                ["Model last updated",        model.lastUpdated],
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
        Three-Driver Revenue Model · FCF = NOPAT + D&amp;A − Capex · Family of Apps only · Reality Labs excluded ·
        FY2026 anchored to guidance · FY2027+ = {fPct(adMktGrowth)} market floor + AI shareGain + ROIC × Net Capex(t−2) ·
        Updated {model.lastUpdated}
      </div>
    </div>
  )
}
