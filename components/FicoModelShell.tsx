"use client"
import { useState, useMemo } from "react"
import type { FicoModelConfig, FicoScenario } from "@/lib/fico-models"
import {
  runFicoSotp,
  buildFicoSensScoresSoftware,
  buildFicoSensWaccTg,
} from "@/lib/fico-engine"

const SC_COLORS: Record<FicoScenario, { color: string; dim: string }> = {
  bear: { color: "var(--red)",    dim: "var(--red-dim)"    },
  base: { color: "var(--accent)", dim: "var(--accent-dim)" },
  bull: { color: "var(--green)",  dim: "var(--green-dim)"  },
}

function f1(n: number)     { return n.toFixed(1) }
function fPct(n: number)   { return f1(n * 100) + "%" }
function fB(n: number)     { return "$" + n.toFixed(2) + "B" }
function fShare(n: number) { return "$" + Math.round(n).toLocaleString() }
function fM(n: number)     { return (n * 1000).toFixed(1) + "M" }

export default function FicoModelShell({
  model,
  priceSource,
}: {
  model: FicoModelConfig
  priceSource?: string
}) {
  const [sc,                  setSc]                  = useState<FicoScenario>("base")
  const [scoresPriceGrowth,   setScoresPriceGrowth]   = useState(model.scenarios.base.scoresPriceGrowth)
  const [softwareGrowth,      setSoftwareGrowth]      = useState(model.scenarios.base.softwareGrowth)
  const [softwareMarginTarget, setSoftwareMarginTarget] = useState(model.scenarios.base.softwareMarginTarget)
  const [wacc,                setWacc]                = useState(model.waccDefault)
  const [termG,               setTermG]               = useState(model.termGrowth)
  const [tab,                 setTab]                 = useState<"sotp" | "model" | "buybacks" | "sensitivity" | "assumptions">("sotp")

  function handleScenario(s: FicoScenario) {
    setSc(s)
    setScoresPriceGrowth(model.scenarios[s].scoresPriceGrowth)
    setSoftwareGrowth(model.scenarios[s].softwareGrowth)
    setSoftwareMarginTarget(model.scenarios[s].softwareMarginTarget)
  }

  const M = useMemo(
    () => runFicoSotp(model, scoresPriceGrowth, softwareGrowth, softwareMarginTarget, wacc, termG),
    [model, scoresPriceGrowth, softwareGrowth, softwareMarginTarget, wacc, termG],
  )

  const SENS_SS = useMemo(
    () => buildFicoSensScoresSoftware(model, softwareMarginTarget, wacc, termG),
    [model, softwareMarginTarget, wacc, termG],
  )
  const SENS_WT = useMemo(
    () => buildFicoSensWaccTg(model, scoresPriceGrowth, softwareGrowth, softwareMarginTarget),
    [model, scoresPriceGrowth, softwareGrowth, softwareMarginTarget],
  )

  const accent   = model.accentColor
  const scColors = SC_COLORS[sc]
  const upCol    = M.updown > 0 ? "var(--green)" : "var(--red)"

  const sharesRetired10yr = M.rows[9].cumulRetired
  const sharesYear10      = M.rows[9].shares

  function sensColor(val: number) {
    const ratio = val / model.currentPrice
    if (ratio >= 1.3) return "sens-cell-green"
    if (ratio >= 1.0) return "sens-cell-accent"
    if (ratio >= 0.7) return "sens-cell-amber"
    return "sens-cell-red"
  }

  function closestIdx(arr: number[], val: number) {
    let best = 0, bestDist = Math.abs(arr[0] - val)
    for (let i = 1; i < arr.length; i++) {
      const d = Math.abs(arr[i] - val)
      if (d < bestDist) { bestDist = d; best = i }
    }
    return best
  }

  const ssScoresIdx   = closestIdx(SENS_SS.rowLabels, scoresPriceGrowth)
  const ssSoftwareIdx = closestIdx(SENS_SS.colLabels, softwareGrowth)
  const wtWaccIdx     = closestIdx(SENS_WT.colLabels, wacc)
  const wtTgIdx       = closestIdx(SENS_WT.rowLabels, termG)

  const kpis = [
    {
      label: "Intrinsic Value / Share",
      value: fShare(M.perShare),
      sub:   `vs $${model.currentPrice.toLocaleString()} · ${M.updown > 0 ? "+" : ""}${f1(M.updown)}% implied`,
      color: upCol,
    },
    {
      label: "10-Yr Implied CAGR",
      value: `${M.impliedCAGR > 0 ? "+" : ""}${f1(M.impliedCAGR * 100)}%`,
      sub:   `fair value accreted at ${fPct(wacc)} WACC from $${model.currentPrice.toLocaleString()}`,
      color: upCol,
    },
    {
      label: "Baked-In Scores Growth",
      value: `${fPct(M.impliedScoresGrowth)} price CAGR`,
      sub:   `Scores pricing implied by $${model.currentPrice.toLocaleString()} — is that achievable?`,
      color: M.impliedScoresGrowth > scoresPriceGrowth ? "var(--red)" : "var(--green)",
    },
    {
      label: "TV / EV",
      value: f1(M.tvWeight * 100) + "%",
      sub:   `Σ PV(FCF) ${fB(M.sumPvFcf)} · PV(TV) ${fB(M.pvTv)} · ${f1(M.gordon)}× Gordon`,
      color: "var(--amber)",
    },
    {
      label: "Scores EV (standalone)",
      value: fB(M.scoresEv),
      sub:   `${fPct(scoresPriceGrowth)} price CAGR · fixed-cost base expands at ${fPct(model.scoresFixedCostGrowth)}/yr`,
      color: accent,
    },
    {
      label: "Software EV (standalone)",
      value: fB(M.softwareEv),
      sub:   `${fPct(softwareGrowth)} ARR growth · margin ${fPct(model.softwareMarginStart)} → ${fPct(softwareMarginTarget)}`,
      color: "var(--green)",
    },
    {
      label: "Shares Retired (10yr, net)",
      value: fM(sharesRetired10yr),
      sub:   `${fM(sharesYear10)} remaining 2035 vs ${fM(model.sharesOut)} today · net of SBC`,
      color: "var(--purple)",
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
            {model.name} · {model.exchange} · SOTP DCF Model
          </div>
        </div>
        <div className="model-subline">
          Base year FY2025A (ended Sep 30, 2025) · Scores $1.08B rev · Software $0.78B rev ·
          23.2M diluted shares · Net debt $3.37B · Price ref ${model.currentPrice.toLocaleString()}{" "}
          {priceSource && (
            <span style={{ color: priceSource.startsWith("Live") ? "var(--green)" : "var(--text-3)", fontWeight: 500 }}>
              ({priceSource})
            </span>
          )}
        </div>
        <div className="model-subline">
          Two-segment SOTP · Scores: pricing moat + fixed-cost leverage → expanding margin ·
          Software: SaaS margin recovery · Net buybacks net of SBC ·
          WACC {fPct(wacc)} · Terminal g {fPct(termG)}
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="controls-row">
        {/* Scenario */}
        <div className="control-group">
          <div className="section-label">Scenario</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["bear", "base", "bull"] as FicoScenario[]).map(s => (
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

        {/* Scores Price Growth */}
        <div className="control-group">
          <div className="section-label">Scores Growth: {fPct(scoresPriceGrowth)}</div>
          <input
            type="range" min={4} max={20} step={0.5} value={scoresPriceGrowth * 100}
            onChange={e => setScoresPriceGrowth(Number(e.target.value) / 100)}
            style={{ width: 160, accentColor: accent }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 160 }}>
            <span>4%</span><span>20%</span>
          </div>
        </div>

        {/* Software ARR Growth */}
        <div className="control-group">
          <div className="section-label">Software Growth: {fPct(softwareGrowth)}</div>
          <input
            type="range" min={4} max={20} step={0.5} value={softwareGrowth * 100}
            onChange={e => setSoftwareGrowth(Number(e.target.value) / 100)}
            style={{ width: 160, accentColor: "var(--green)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 160 }}>
            <span>4%</span><span>20%</span>
          </div>
        </div>

        {/* Software Margin Target */}
        <div className="control-group">
          <div className="section-label">Sw Margin Target: {fPct(softwareMarginTarget)}</div>
          <input
            type="range" min={25} max={55} step={1} value={softwareMarginTarget * 100}
            onChange={e => setSoftwareMarginTarget(Number(e.target.value) / 100)}
            style={{ width: 160, accentColor: "var(--green)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 160 }}>
            <span>25%</span><span>55%</span>
          </div>
        </div>

        {/* WACC */}
        <div className="control-group">
          <div className="section-label">WACC: {fPct(wacc)}</div>
          <input
            type="range" min={7} max={13} step={0.25} value={wacc * 100}
            onChange={e => setWacc(Number(e.target.value) / 100)}
            style={{ width: 140, accentColor: scColors.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 140 }}>
            <span>7%</span><span>13%</span>
          </div>
        </div>

        {/* Terminal Growth */}
        <div className="control-group">
          <div className="section-label">Terminal g: {fPct(termG)}</div>
          <input
            type="range" min={2} max={4} step={0.5} value={termG * 100}
            onChange={e => setTermG(Number(e.target.value) / 100)}
            style={{ width: 140, accentColor: scColors.color }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 140 }}>
            <span>2%</span><span>4%</span>
          </div>
        </div>

        {/* View tabs */}
        <div className="control-group">
          <div className="section-label">View</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["sotp", "model", "buybacks", "sensitivity", "assumptions"] as const).map(t => (
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

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── SOTP TAB ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "sotp" && (
        <div>
          <div className="section-label">
            Sum-of-the-Parts Bridge · Scores + Software → Equity Value
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14, lineHeight: 1.6 }}>
            Each segment is valued independently using its own post-tax operating income stream.
            Corporate overhead, interest, and non-cash items are bridged separately to reach total integrated EV.
          </div>

          {/* SOTP bridge table */}
          <div className="bridge-card">
            <div className="section-label">Enterprise Value Bridge</div>

            {/* Scores segment */}
            <div className="bridge-row">
              <span className="bridge-label" style={{ color: accent }}>Scores Segment — Standalone EV</span>
              <span className="bridge-value" style={{ color: accent, fontWeight: 700 }}>{fB(M.scoresEv)}</span>
            </div>
            <div className="bridge-row" style={{ paddingLeft: 16 }}>
              <span className="bridge-label" style={{ color: "var(--text-3)", fontSize: 11 }}>
                Σ PV(Scores post-tax op income)
              </span>
              <span className="bridge-value" style={{ color: "var(--text-3)", fontSize: 11 }}>
                {fB(M.scoresSumPvPostTax)}
              </span>
            </div>
            <div className="bridge-row" style={{ paddingLeft: 16 }}>
              <span className="bridge-label" style={{ color: "var(--text-3)", fontSize: 11 }}>
                PV(Terminal value) · {f1(M.gordon)}× Gordon on FY2035E
              </span>
              <span className="bridge-value" style={{ color: "var(--text-3)", fontSize: 11 }}>
                {fB(M.scoresPvTv)}
              </span>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />

            {/* Software segment */}
            <div className="bridge-row">
              <span className="bridge-label" style={{ color: "var(--green)" }}>Software Segment — Standalone EV</span>
              <span className="bridge-value" style={{ color: "var(--green)", fontWeight: 700 }}>{fB(M.softwareEv)}</span>
            </div>
            <div className="bridge-row" style={{ paddingLeft: 16 }}>
              <span className="bridge-label" style={{ color: "var(--text-3)", fontSize: 11 }}>
                Σ PV(Software post-tax op income)
              </span>
              <span className="bridge-value" style={{ color: "var(--text-3)", fontSize: 11 }}>
                {fB(M.softwareSumPvPostTax)}
              </span>
            </div>
            <div className="bridge-row" style={{ paddingLeft: 16 }}>
              <span className="bridge-label" style={{ color: "var(--text-3)", fontSize: 11 }}>
                PV(Terminal value) · {f1(M.gordon)}× Gordon on FY2035E
              </span>
              <span className="bridge-value" style={{ color: "var(--text-3)", fontSize: 11 }}>
                {fB(M.softwarePvTv)}
              </span>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />

            {/* Corp bridge */}
            <div className="bridge-row">
              <span className="bridge-label" style={{ color: "var(--amber)" }}>
                Corporate Items (drag)
              </span>
              <span className="bridge-value" style={{ color: "var(--amber)", fontWeight: 700 }}>
                {M.corpBridge >= 0 ? "+" : ""}{fB(M.corpBridge)}
              </span>
            </div>
            <div className="bridge-row" style={{ paddingLeft: 16 }}>
              <span className="bridge-label" style={{ color: "var(--text-3)", fontSize: 11 }}>
                Reflects PV of: −CorpG&A −Interest +D&A +SBC −Capex (all post-tax, discounted)
              </span>
              <span className="bridge-value" style={{ color: "var(--text-3)", fontSize: 11 }}>
                residual
              </span>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />

            {/* Total EV */}
            <div className="bridge-row">
              <span className="bridge-label" style={{ color: "var(--text-1)", fontWeight: 700 }}>
                Total Enterprise Value (Integrated FCF DCF)
              </span>
              <span className="bridge-value" style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>
                {fB(M.ev)}
              </span>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />

            {/* Equity bridge */}
            <div className="bridge-row">
              <span className="bridge-label">(−) Net Debt (Q2 FY2026)</span>
              <span className="bridge-value" style={{ color: "var(--red)" }}>
                ({fB(model.netDebt)}) · $3.64B debt − $272M cash
              </span>
            </div>
            <div className="bridge-row">
              <span className="bridge-label" style={{ fontWeight: 600 }}>Equity Value</span>
              <span className="bridge-value" style={{ color: "var(--accent)", fontWeight: 600 }}>
                {fB(M.equity)}
              </span>
            </div>
            <div className="bridge-row">
              <span className="bridge-label">÷ Diluted shares (year 10, net of buybacks)</span>
              <span className="bridge-value" style={{ color: "var(--text-2)" }}>
                {fM(sharesYear10)} ({fM(model.sharesOut)} today − {fM(sharesRetired10yr)} net retired)
              </span>
            </div>

            <div style={{ borderTop: "1px solid var(--border)", margin: "8px 0" }} />

            <div className="bridge-row">
              <span className="bridge-label" style={{ fontWeight: 700 }}>Intrinsic Value / Share</span>
              <span className="bridge-value" style={{ color: upCol, fontWeight: 700, fontSize: 16 }}>
                {fShare(M.perShare)}
              </span>
            </div>
            <div className="bridge-row">
              <span className="bridge-label">Current price reference</span>
              <span className="bridge-value" style={{ color: "var(--text-3)" }}>
                ${model.currentPrice.toLocaleString()}
              </span>
            </div>
            <div className="bridge-row">
              <span className="bridge-label">Implied upside / (downside)</span>
              <span className="bridge-value" style={{ color: upCol, fontWeight: 600 }}>
                {M.updown > 0 ? "+" : ""}{f1(M.updown)}%
              </span>
            </div>
            <div className="bridge-row">
              <span className="bridge-label">10-yr implied CAGR</span>
              <span className="bridge-value" style={{ color: upCol }}>
                {M.impliedCAGR > 0 ? "+" : ""}{f1(M.impliedCAGR * 100)}%
              </span>
            </div>
            <div className="bridge-row">
              <span className="bridge-label">Baked-in Scores pricing (reverse DCF)</span>
              <span className="bridge-value" style={{ color: M.impliedScoresGrowth > scoresPriceGrowth ? "var(--red)" : "var(--green)" }}>
                {fPct(M.impliedScoresGrowth)} annual CAGR
              </span>
            </div>
          </div>

          {/* Segment-level year-10 metrics */}
          <div className="section-label" style={{ marginTop: 24 }}>Year-10 Segment Snapshot (FY2035E)</div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Segment</th>
                  <th>FY2025A Rev</th>
                  <th>FY2035E Rev</th>
                  <th>10yr CAGR</th>
                  <th>FY2025A Op Margin</th>
                  <th>FY2035E Op Margin</th>
                  <th>FY2035E Op Income</th>
                  <th>Standalone EV</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ color: accent, fontWeight: 600 }}>Scores</td>
                  <td style={{ color: "var(--text-2)" }}>{fB(model.scoresBaseRev)}</td>
                  <td style={{ color: accent }}>{fB(M.rows[9].scoresRev)}</td>
                  <td style={{ color: accent }}>{fPct(scoresPriceGrowth)}</td>
                  <td style={{ color: "var(--text-2)" }}>
                    {fPct((model.scoresBaseRev - model.scoresFixedCosts) / model.scoresBaseRev)}
                  </td>
                  <td style={{ color: accent }}>{fPct(M.rows[9].scoresOpMargin)}</td>
                  <td style={{ color: accent }}>{fB(M.rows[9].scoresOpIncome)}</td>
                  <td style={{ color: accent, fontWeight: 700 }}>{fB(M.scoresEv)}</td>
                </tr>
                <tr>
                  <td style={{ color: "var(--green)", fontWeight: 600 }}>Software</td>
                  <td style={{ color: "var(--text-2)" }}>{fB(model.softwareBaseRev)}</td>
                  <td style={{ color: "var(--green)" }}>{fB(M.rows[9].softwareRev)}</td>
                  <td style={{ color: "var(--green)" }}>{fPct(softwareGrowth)}</td>
                  <td style={{ color: "var(--text-2)" }}>{fPct(model.softwareMarginStart)}</td>
                  <td style={{ color: "var(--green)" }}>{fPct(M.rows[9].softwareMargin)}</td>
                  <td style={{ color: "var(--green)" }}>{fB(M.rows[9].softwareOpIncome)}</td>
                  <td style={{ color: "var(--green)", fontWeight: 700 }}>{fB(M.softwareEv)}</td>
                </tr>
                <tr>
                  <td style={{ color: "var(--text-2)", fontWeight: 600 }}>Total</td>
                  <td style={{ color: "var(--text-2)" }}>{fB(model.scoresBaseRev + model.softwareBaseRev)}</td>
                  <td style={{ color: "var(--text-1)" }}>{fB(M.rows[9].totalRev)}</td>
                  <td style={{ color: "var(--text-3)" }}>blended</td>
                  <td style={{ color: "var(--text-3)" }}>—</td>
                  <td style={{ color: "var(--text-1)" }}>{fPct(M.rows[9].ebitMargin)}</td>
                  <td style={{ color: "var(--text-1)" }}>{fB(M.rows[9].ebit)}</td>
                  <td style={{ color: "var(--accent)", fontWeight: 700 }}>{fB(M.ev)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Scenario compare */}
          <div className="section-label" style={{ marginTop: 24 }}>
            Scenario Comparison · {fPct(model.waccDefault)} WACC · {fPct(model.termGrowth)} Terminal Growth
          </div>
          <div className="sc-compare">
            {(["bear", "base", "bull"] as FicoScenario[]).map(s => {
              const sc2 = model.scenarios[s]
              const m2  = runFicoSotp(model, sc2.scoresPriceGrowth, sc2.softwareGrowth, sc2.softwareMarginTarget, model.waccDefault, model.termGrowth)
              const mt  = SC_COLORS[s]
              const uc2 = m2.updown > 0 ? "var(--green)" : "var(--red)"
              return (
                <div key={s} className="sc-card" style={{ background: mt.dim + "88", border: `1px solid ${mt.color}44` }}>
                  <div className="sc-card-label" style={{ color: mt.color }}>
                    {s.charAt(0).toUpperCase() + s.slice(1)} Case
                  </div>
                  <div className="sc-card-value" style={{ color: mt.color }}>{fShare(m2.perShare)}</div>
                  <div className="sc-card-updown" style={{ color: uc2 }}>
                    {m2.updown > 0 ? "+" : ""}{f1(m2.updown)}% vs ${model.currentPrice.toLocaleString()}
                  </div>
                  <div className="sc-card-stat">Scores growth: {fPct(sc2.scoresPriceGrowth)}</div>
                  <div className="sc-card-stat">Software growth: {fPct(sc2.softwareGrowth)}</div>
                  <div className="sc-card-stat">Sw margin target: {fPct(sc2.softwareMarginTarget)}</div>
                  <div className="sc-card-stat">Scores EV: {fB(m2.scoresEv)}</div>
                  <div className="sc-card-stat">Software EV: {fB(m2.softwareEv)}</div>
                  <div className="sc-card-stat">Shares Y10: {fM(m2.rows[9].shares)} (vs {fM(model.sharesOut)})</div>
                  <div className="sc-card-stat">10-yr CAGR: {m2.impliedCAGR > 0 ? "+" : ""}{f1(m2.impliedCAGR * 100)}%</div>
                  <div className="sc-card-stat" style={{ color: "var(--text-3)" }}>{sc2.description}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── MODEL TAB ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "model" && (
        <div>
          <div className="section-label">
            FY2026–2035 Integrated P&L · Scores {fPct(scoresPriceGrowth)} · Software {fPct(softwareGrowth)} · Sw margin → {fPct(softwareMarginTarget)}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Scores Rev</th>
                  <th>Scores OI</th>
                  <th>Scores Margin</th>
                  <th>Sw Rev</th>
                  <th>Sw OI</th>
                  <th>Sw Margin</th>
                  <th>EBIT</th>
                  <th>EBIT Margin</th>
                  <th>Net Income</th>
                  <th>FCF</th>
                  <th>PV(FCF)</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => (
                  <tr key={r.year}>
                    <td style={{ color: "var(--text-1)" }}>{r.year}</td>
                    <td style={{ color: accent }}>{fB(r.scoresRev)}</td>
                    <td style={{ color: accent, fontWeight: 600 }}>{fB(r.scoresOpIncome)}</td>
                    <td style={{ color: accent }}>{fPct(r.scoresOpMargin)}</td>
                    <td style={{ color: "var(--green)" }}>{fB(r.softwareRev)}</td>
                    <td style={{ color: "var(--green)", fontWeight: 600 }}>{fB(r.softwareOpIncome)}</td>
                    <td style={{ color: "var(--green)" }}>{fPct(r.softwareMargin)}</td>
                    <td style={{ color: "var(--text-1)", fontWeight: 600 }}>{fB(r.ebit)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fPct(r.ebitMargin)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fB(r.netIncome)}</td>
                    <td style={{ color: scColors.color, fontWeight: 600 }}>{fB(r.totalFcf)}</td>
                    <td style={{ color: "var(--accent)" }}>{fB(r.pvFcf)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={10} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    Terminal value · g={fPct(termG)} · WACC={fPct(wacc)} · {f1(M.gordon)}× Gordon on FY2035E FCF
                  </td>
                  <td colSpan={2} style={{ color: "var(--accent)", fontWeight: 600 }}>{fB(M.pvTv)}</td>
                </tr>
                <tr className="ev-row">
                  <td colSpan={10} style={{ color: "var(--accent)", fontWeight: 700, textAlign: "left" }}>
                    Enterprise Value
                  </td>
                  <td colSpan={2} style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>{fB(M.ev)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Corp line items */}
          <div className="section-label" style={{ marginTop: 24 }}>Corporate & Financing Line Items (FY2026–2035)</div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>Corp G&amp;A</th>
                  <th>Interest</th>
                  <th>D&amp;A</th>
                  <th>SBC</th>
                  <th>Capex</th>
                  <th>Net Adds (D&A+SBC−Capex)</th>
                  <th>Pre-Tax Income</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => (
                  <tr key={r.year}>
                    <td style={{ color: "var(--text-1)" }}>{r.year}</td>
                    <td style={{ color: "var(--amber)" }}>({fB(r.corpGandA)})</td>
                    <td style={{ color: "var(--red)" }}>({fB(model.interestExpense)})</td>
                    <td style={{ color: "var(--text-2)" }}>{fB(model.dnaAnnual)}</td>
                    <td style={{ color: "var(--purple)" }}>{fB(r.sbcYear)}</td>
                    <td style={{ color: "var(--red)" }}>({fB(model.capexAnnual)})</td>
                    <td style={{ color: "var(--green)" }}>
                      +{fB(model.dnaAnnual + r.sbcYear - model.capexAnnual)}
                    </td>
                    <td style={{ color: "var(--text-2)" }}>{fB(r.preTaxIncome)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="phase-legend">
            <div className="phase-item">
              <span className="phase-dot" style={{ background: scColors.color + "22", border: `1px solid ${scColors.color}55` }} />
              FY2026–2027: MDLP launch · FICO 10T pent-up demand · mortgage volume recovery uncertain
            </div>
            <div className="phase-item">
              <span className="phase-dot" style={{ background: "var(--green-dim)", border: "1px solid rgba(74,222,128,.4)" }} />
              FY2028–2031: Software SaaS margins expanding · Falcon platform cross-sell scaling
            </div>
            <div className="phase-item">
              <span className="phase-dot" style={{ background: "var(--purple-dim)", border: "1px solid rgba(167,139,250,.4)" }} />
              FY2032–2035: Terminal approach · mature SaaS margins · steady Scores compounding
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── BUYBACKS TAB ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "buybacks" && (
        <div>
          <div className="section-label">
            Buyback Cannibal — Net Share Retirement Schedule
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 6, lineHeight: 1.6 }}>
            <span style={{ color: "var(--amber)" }}>FICO pays no dividend. </span>
            <span style={{ color: "var(--text-2)" }}>
              Buyback capacity = FCF − SBC (SBC add-back in FCF inflates cash appearance but creates new shares —
              net retirement = capacity ÷ buyback price).
            </span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            Buyback price = ${model.currentPrice.toLocaleString()} × (1+termG)^year (conservative: grows at terminal rate only) ·
            FY2024 actual: 606K shares at avg ~$1,366 · Share count down ~22% since FY2019 · Negative book equity: feature, not bug
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th>
                  <th>FCF</th>
                  <th>SBC</th>
                  <th>Net Buyback Capacity</th>
                  <th>Buyback Price</th>
                  <th>Net Shares Retired</th>
                  <th>Cumul. Retired</th>
                  <th>Shares Out</th>
                  <th>% Reduction</th>
                </tr>
              </thead>
              <tbody>
                {M.rows.map(r => {
                  const pctReduced = (model.sharesOut - r.shares) / model.sharesOut
                  return (
                    <tr key={r.year}>
                      <td style={{ color: "var(--text-1)" }}>{r.year}</td>
                      <td style={{ fontWeight: 600, color: scColors.color }}>{fB(r.totalFcf)}</td>
                      <td style={{ color: "var(--purple)" }}>({fB(r.sbcYear)})</td>
                      <td style={{ color: "var(--text-2)", fontWeight: 600 }}>{fB(r.buybackCapacity)}</td>
                      <td style={{ color: "var(--text-2)" }}>${Math.round(r.buybackPrice).toLocaleString()}</td>
                      <td style={{ color: "var(--purple)" }}>{fM(r.netSharesRetired)}</td>
                      <td style={{ color: "var(--text-2)" }}>{fM(r.cumulRetired)}</td>
                      <td style={{ color: accent, fontWeight: 600 }}>{fM(r.shares)}</td>
                      <td style={{ color: pctReduced > 0.20 ? "var(--green)" : "var(--text-3)" }}>
                        −{f1(pctReduced * 100)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>Today</td>
                  <td colSpan={6} style={{ color: "var(--text-3)" }}>—</td>
                  <td style={{ color: "var(--text-2)", fontWeight: 600 }}>{fM(model.sharesOut)}</td>
                  <td style={{ color: "var(--text-3)" }}>0.0%</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bridge-card" style={{ marginTop: 20 }}>
            <div className="section-label">Capital Allocation Summary</div>
            <div className="bridge-row">
              <span className="bridge-label">Dividend policy</span>
              <span className="bridge-value" style={{ color: "var(--amber)" }}>No dividend — 100% via buybacks</span>
            </div>
            <div className="bridge-row">
              <span className="bridge-label">SBC treatment</span>
              <span className="bridge-value" style={{ color: "var(--text-2)", fontSize: 11 }}>
                Add-back in FCF removed before computing net buybacks · avoids overstating share retirement
              </span>
            </div>
            <div className="bridge-row">
              <span className="bridge-label">Net debt position</span>
              <span className="bridge-value" style={{ color: "var(--text-2)", fontSize: 11 }}>
                $3.37B net debt (Q2 FY2026) · Investment-grade · historically debt-funded additional buybacks beyond FCF
              </span>
            </div>
            <div className="bridge-row">
              <span className="bridge-label">FY2026 SBC base</span>
              <span className="bridge-value" style={{ color: "var(--purple)" }}>
                ${fB(model.sbcAnnual)} · growing {fPct(model.sbcGrowthRate)}/yr with headcount
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── SENSITIVITY TAB ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "sensitivity" && (
        <div>
          {/* Primary: Scores Growth × Software Growth */}
          <div className="section-label">
            Intrinsic Value / Share ($) — Scores Price Growth × Software ARR Growth
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            Software margin target fixed at {fPct(softwareMarginTarget)} · WACC {fPct(wacc)} · Terminal g {fPct(termG)} ·
            Market prices in {fPct(M.impliedScoresGrowth)} Scores CAGR at ${model.currentPrice.toLocaleString()}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="sens-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Scores g ↓ / Sw g →</th>
                  {SENS_SS.colLabels.map((w, ci) => (
                    <th key={w} style={{
                      color:      ci === ssSoftwareIdx ? "var(--green)" : "var(--text-3)",
                      fontWeight: ci === ssSoftwareIdx ? 700 : 400,
                    }}>
                      {fPct(w)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SENS_SS.rowLabels.map((g, ri) => (
                  <tr key={g}>
                    <td style={{
                      color:      ri === ssScoresIdx ? accent : "var(--text-2)",
                      fontWeight: ri === ssScoresIdx ? 700 : 400,
                    }}>
                      {fPct(g)}
                    </td>
                    {SENS_SS.colLabels.map((_, ci) => {
                      const val = SENS_SS.grid[ri][ci]
                      const sel = ri === ssScoresIdx && ci === ssSoftwareIdx
                      const cls = sensColor(val)
                      return (
                        <td key={ci}
                          className={`${cls} ${sel ? "sens-cell-selected" : ""}`}
                          style={sel ? { borderColor: accent, color: accent } : {}}
                        >
                          ${val.toLocaleString()}
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
              ["var(--green)",  "var(--green-dim)",  `>$${Math.round(model.currentPrice * 1.3).toLocaleString()} (>30% upside)`],
              ["var(--accent)", "var(--accent-dim)", `$${Math.round(model.currentPrice).toLocaleString()}–$${Math.round(model.currentPrice * 1.3).toLocaleString()} (0–30%)`],
              ["var(--amber)",  "var(--amber-dim)",  `$${Math.round(model.currentPrice * 0.7).toLocaleString()}–$${Math.round(model.currentPrice).toLocaleString()} (−30%–0%)`],
              ["var(--red)",    "var(--red-dim)",    `<$${Math.round(model.currentPrice * 0.7).toLocaleString()} (>30% down)`],
            ].map(([col, bg, lbl]) => (
              <div key={lbl} className="sens-legend-item" style={{ color: col }}>
                <span className="sens-legend-swatch" style={{ background: bg, border: `1px solid ${col}66` }} />
                {lbl}
              </div>
            ))}
          </div>

          {/* Secondary: WACC × Terminal Growth */}
          <div className="section-label" style={{ marginTop: 28 }}>
            Intrinsic Value / Share ($) — WACC × Terminal Growth
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            Scores {fPct(scoresPriceGrowth)} · Software {fPct(softwareGrowth)} · Sw margin target {fPct(softwareMarginTarget)}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="sens-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Term g ↓ / WACC →</th>
                  {SENS_WT.colLabels.map((w, ci) => (
                    <th key={w} style={{
                      color:      ci === wtWaccIdx ? scColors.color : "var(--text-3)",
                      fontWeight: ci === wtWaccIdx ? 700 : 400,
                    }}>
                      {fPct(w)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SENS_WT.rowLabels.map((tg, ri) => (
                  <tr key={tg}>
                    <td style={{
                      color:      ri === wtTgIdx ? scColors.color : "var(--text-2)",
                      fontWeight: ri === wtTgIdx ? 700 : 400,
                    }}>
                      {fPct(tg)}
                    </td>
                    {SENS_WT.colLabels.map((_, ci) => {
                      const val = SENS_WT.grid[ri][ci]
                      const sel = ri === wtTgIdx && ci === wtWaccIdx
                      const cls = sensColor(val)
                      return (
                        <td key={ci}
                          className={`${cls} ${sel ? "sens-cell-selected" : ""}`}
                          style={sel ? { borderColor: scColors.color, color: scColors.color } : {}}
                        >
                          ${val.toLocaleString()}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* ── ASSUMPTIONS TAB ── */}
      {/* ══════════════════════════════════════════════════════════ */}
      {tab === "assumptions" && (
        <div className="assumptions-grid">
          {[
            {
              title: "Scores Segment — The Moat",
              color: accent,
              rows: [
                ["Revenue (FY2025A)",          "$1.08B · ~60% of total company revenue"],
                ["Business model",             "Algorithm licensing royalty · per-inquiry fee paid to FICO by Equifax, Experian, TransUnion"],
                ["MDLP (new channel)",         "Direct lender license · ~$0.99 pull fee + $33–$65 closed-loan funding fee — additive to existing"],
                ["Pricing power",              "~15–20%+ annual price CAGR for a decade · revenue grew despite flat/down origination volumes"],
                ["Fixed cost base",            `~$100M fixed: algorithm R&D + legal + small headcount · grows at just ${fPct(model.scoresFixedCostGrowth)}/yr`],
                ["Why margin expands",         "Every incremental revenue dollar has near-zero marginal cost → margin rises each year automatically"],
                ["FY2025 Scores op margin",    `${fPct((model.scoresBaseRev - model.scoresFixedCosts) / model.scoresBaseRev)} → expands to ${fPct(M.rows[9].scoresOpMargin)} by FY2035E at ${fPct(scoresPriceGrowth)} growth`],
                ["FHFA / GSE mandate",         "Fannie + Freddie require FICO on conforming mortgages — regulatory bedrock, can't be removed"],
                ["VantageScore (bi-score)",    "FHFA requires BOTH FICO and VantageScore — ADDS VantageScore, does NOT replace FICO"],
                ["FICO 10T",                   "Next-gen model · pent-up demand unmonetized until FHFA finalizes data publication protocols"],
                ["Moat analogy",               "Moody's / S&P Global — financial toll bridge; lenders have no substitute for credit decisions"],
              ],
            },
            {
              title: "Software Segment — The Growth Catalyst",
              color: "var(--green)",
              rows: [
                ["Revenue (FY2025A)",          "$0.78B · ~40% of total company revenue"],
                ["Falcon Fraud Manager",       "Industry-leading real-time fraud detection · extremely high switching costs after 10+ years"],
                ["FICO Platform",              "Cloud-native decision intelligence · Originations, Customer Mgmt, Collections, Marketing modules"],
                ["Cross-sell thesis",          "Banks on Falcon can 'turn on' Originations with no new IT security review — data already cleared"],
                ["Real-world traction",        "T-Mobile: 1M+ apps/month on Platform · banks scaling payroll lending 100× on FICO cloud"],
                ["Margin start",               `${fPct(model.softwareMarginStart)} today — intentional investment phase: cloud infra + eng headcount + bank migrations`],
                ["Margin path",                `Ramps linearly to ${fPct(softwareMarginTarget)} by FY2035E as migration complexity diminishes`],
                ["Phase 2 economics",          "Once migrations complete → new modules = near-zero marginal cost → step-function margin improvement"],
                ["Professional Services",      "Lower-margin advisory/implementation — strategic wedge accelerating SaaS adoption"],
                ["SaaS benchmarks",            "Pure-play SaaS companies at 40–50%+ operating margin · FICO Software converging over model period"],
              ],
            },
            {
              title: "SOTP Methodology & FCF Mechanics",
              color: "var(--amber)",
              rows: [
                ["SOTP approach",              "Each segment valued independently on post-tax operating income · corp items bridged separately"],
                ["Scores standalone EV",       "Σ PV(ScoresOpIncome × (1−tax)) + PV(TV_scores) — pure royalty stream, no capex at segment level"],
                ["Software standalone EV",     "Σ PV(SoftwareOpIncome × (1−tax)) + PV(TV_software) — SaaS ARR stream"],
                ["Corporate bridge",           "Total integrated EV − Scores EV − Software EV = PV of net corporate drag (G&A, interest, capex, D&A, SBC)"],
                ["Integrated FCF",             "NetIncome + D&A + SBC − Capex (standard unlevered FCF build)"],
                ["SBC treatment",              "SBC added back in FCF (GAAP accounting) but creates new shares → net buybacks = FCF − SBC"],
                ["Buyback price",              `$${model.currentPrice.toLocaleString()} × (1+termG)^year — conservative; grows at terminal rate only`],
                ["Corp G&A growth",            `${fPct(model.corpGrowthRate)}/yr — GDP-like inflation on $${(model.corpGandABase * 1000).toFixed(0)}M base`],
                ["Interest expense",           `$${(model.interestExpense * 1000).toFixed(0)}M fixed — $3.37B net debt × ~5% average rate`],
                ["D&A",                        `$${(model.dnaAnnual * 1000).toFixed(0)}M fixed annual add-back`],
                ["Capex",                      `$${(model.capexAnnual * 1000).toFixed(0)}M fixed annual — asset-light profile`],
                ["SBC base & growth",          `$${(model.sbcAnnual * 1000).toFixed(0)}M base · ${fPct(model.sbcGrowthRate)}/yr with headcount`],
                ["Tax rate",                   `${fPct(model.taxRate)} effective (FY2025 basis)`],
              ],
            },
            {
              title: "Balance Sheet & Valuation",
              color: "var(--purple)",
              rows: [
                ["Net debt (Q2 FY2026)",       "$3.37B · $3.64B total debt − $272M cash"],
                ["Leverage context",           "Investment-grade · FCF ~$900M covers ~5× annual interest · deliberate, not distressed"],
                ["Negative book equity",       "Feature of asset-light buyback cannibals — cash flows, not assets, support value"],
                ["WACC default",               `${fPct(model.waccDefault)} · high-quality compounder + investment-grade credit + minimal capex`],
                ["Terminal growth default",    `${fPct(model.termGrowth)} · financial data monopoly · GDP+ long-run growth is defensible`],
                ["Gordon multiple",            `${f1(M.gordon)}× on FY2035E FCF at current sliders`],
                ["TV / EV",                    `${f1(M.tvWeight * 100)}% of total EV — typical for high-quality compounder DCFs`],
                ["Reverse DCF",                `Market prices ${fPct(M.impliedScoresGrowth)} Scores CAGR at $${model.currentPrice.toLocaleString()} — is that achievable given structural pricing trajectory?`],
                ["Shares today",               `${fM(model.sharesOut)} diluted (Q2 FY2026) · down ~22% since FY2019`],
                ["Model last updated",         model.lastUpdated],
              ],
            },
            {
              title: "Key Risks",
              color: "var(--red)",
              rows: [
                ["VantageScore adoption",      "Bi-score mandate gives VantageScore lender familiarity over time · managed risk for now, monitor closely"],
                ["Mortgage originations",      "Structural suppression at $1.6–2.2T/yr · pricing power has offset but volume recovery = upside not modeled"],
                ["Software execution",         "Bank cloud migrations complex · revenue recognition lumpy · multi-year buildout with margin uncertainty"],
                ["Leverage / rates",           "~$3.64B debt · higher-for-longer rates compress FCF available for buybacks"],
                ["Valuation / premium",        "High-multiple stock requires sustained growth delivery · reverse DCF anchors the required bar"],
                ["Antitrust / regulation",     "Monopoly-level pricing scrutiny · FICO has navigated FHFA/CFPB for decades · manageable but real"],
                ["FICO 10T delay",             "Pent-up demand unmonetized; FHFA data publication finalization remains uncertain on timeline"],
                ["SBC creep",                  "SBC growing with headcount reduces net buyback capacity — modeled at 3%/yr, watch actuals"],
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
        Two-segment SOTP DCF · Scores: pricing moat + fixed-cost leverage · Software: SaaS margin recovery ·
        Net buybacks = FCF − SBC · Per-share uses year-10 diluted count ·
        FY2025A actuals from SEC filings and public data · Updated {model.lastUpdated}
      </div>
    </div>
  )
}
