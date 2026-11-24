"use client"
import { useState, useMemo } from "react"
import type { AmazonModelConfig, AmazonScenario, StakeBasis, OtherBetsMode } from "@/lib/amazon-models"
import { runAmazonSotp, buildAmazonSensitivity } from "@/lib/amazon-engine"
import { SegmentChart, C } from "@/components/AmazonCharts"

const SC_COLORS: Record<AmazonScenario, { color: string; dim: string }> = {
  bear: { color: "var(--red)",    dim: "var(--red-dim)"    },
  base: { color: "var(--accent)", dim: "var(--accent-dim)" },
  bull: { color: "var(--green)",  dim: "var(--green-dim)"  },
}

const STAKE_LABELS: Record<StakeBasis, string> = {
  pct15:       "15% of ANT equity",
  classN:      "Class N only",
  classNNotes: "Class N + notes",
  market:      "ANT market price",
}

function f1(n: number) { return n.toFixed(1) }
function f0(n: number) { return Math.round(n).toLocaleString() }
function fPct(n: number) { return f1(n * 100) + "%" }
function fPct2(n: number) { return (n * 100).toFixed(2) + "%" }
function fUsdB(n: number) {
  const neg = n < 0, a = Math.abs(n)
  const s = a >= 1000 ? "$" + (a / 1000).toFixed(2) + "T" : "$" + f0(a) + "B"
  return neg ? "−" + s : s
}
function fUsd2(n: number) { return (n < 0 ? "−$" : "$") + Math.abs(n).toFixed(2) }
function sgn(n: number) { return n > 0 ? "+" : "" }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const EST = <sup style={{ color: "var(--amber)", fontSize: 9 }}>est.</sup>

type Tab = "sotp" | "aws" | "ads" | "commerce" | "sensitivity" | "assumptions"
const TAB_LABEL: Record<Tab, string> = {
  sotp: "SOTP", aws: "AWS", ads: "Ads", commerce: "Commerce", sensitivity: "Sensitivity", assumptions: "Assumptions",
}

export default function AmazonModelShell({ model, priceSource }: {
  model: AmazonModelConfig; priceSource?: string
}) {
  const S0 = model.scenarios.base
  const [sc,     setSc]     = useState<AmazonScenario>("base")
  const [wacc,   setWacc]   = useState(model.waccDefault)
  const [adsM,   setAdsM]   = useState(S0.adsMargin)
  const [kept,   setKept]   = useState(S0.commerceKept)
  const [s2c,    setS2c]    = useState(S0.commerceS2C)
  const [whAuto, setWhAuto] = useState(model.commerce.warehouseAutoEnd)
  const [basis,  setBasis]  = useState<StakeBasis>("pct15")
  const [obMode, setObMode] = useState<OtherBetsMode>("fade")
  const [tab,    setTab]    = useState<Tab>("sotp")
  const termG = model.termGrowth

  const pickScenario = (s: AmazonScenario) => {
    const S = model.scenarios[s]
    setSc(s); setAdsM(S.adsMargin); setKept(S.commerceKept); setS2c(S.commerceS2C)
    setWhAuto(model.commerce.warehouseAutoEnd)
  }

  const ov = useMemo(() => ({
    adsMargin: adsM, commerceKept: kept, commerceS2C: s2c, warehouseAutoEnd: whAuto,
    stakeBasis: basis, otherBetsMode: obMode,
  }), [adsM, kept, s2c, whAuto, basis, obMode])
  const M    = useMemo(() => runAmazonSotp(model, sc, wacc, termG, ov), [model, sc, wacc, termG, ov])
  const SENS = useMemo(() => buildAmazonSensitivity(model, sc, termG, ov), [model, sc, termG, ov])

  const scColors  = SC_COLORS[sc]
  const accent    = model.accentColor ?? "var(--accent)"
  const upCol     = M.updown > 0 ? "var(--green)" : "var(--red)"
  const passes    = M.impliedCAGR >= model.hurdle
  const hurdleCol = passes ? "var(--green)" : "var(--amber)"
  const A         = model.scenarios[sc]
  const years     = M.aws.rows.map(r => r.year)

  const kpis = [
    { label: "Intrinsic Value / Share", value: fUsd2(M.perShare),
      sub: `vs $${model.currentPrice.toFixed(2)} · ${sgn(M.updown)}${f1(M.updown)}% implied`, color: upCol },
    { label: "10-yr Implied CAGR", value: `${sgn(M.impliedCAGR)}${fPct2(M.impliedCAGR)}`,
      sub: `${passes ? "PASS" : "FAIL"} vs the ${f0(model.hurdle * 100)}% hurdle`, color: hurdleCol },
    { label: `${f0(model.hurdle * 100)}%-Hurdle Buy Price`, value: fUsd2(M.hurdlePrice),
      sub: `${M.hurdlePrice >= model.currentPrice ? "Above" : "Below"} today's $${model.currentPrice.toFixed(2)}`,
      color: M.hurdlePrice >= model.currentPrice ? "var(--green)" : "var(--amber)" },
    { label: "SOTP Equity Value", value: fUsdB(M.equity),
      sub: `vs market cap ${fUsdB(M.marketCap)} · ${model.sharesOut}B diluted shares`, color: scColors.color },
    { label: "AWS Enterprise Value", value: fUsdB(M.aws.ev),
      sub: `${f0((M.aws.ev / M.equity) * 100)}% of equity · ${f1(M.aws.evToIC)}× end-2026 capital`, color: accent },
    { label: "Market-Implied AWS EV", value: fUsdB(M.impliedAwsEV),
      sub: "today's price, less the other pieces at model value", color: M.impliedAwsEV < M.aws.ev ? "var(--green)" : "var(--amber)" },
  ]

  const bridge = [
    { label: "AWS",                v: M.aws.ev,      col: C.orange,
      note: "Rate base: blended ROIC × capital in service; revenue from last year's net capex" },
    { label: "Advertising",        v: M.ads.ev,      col: C.purple,
      note: `${fPct(adsM)} margin on all "Advertising services" · growth ${fPct(model.ads.growthStart)} → ${fPct(model.ads.growthEnd)} · ${fPct(model.ads.reinvestRate)} reinvested` },
    { label: "Commerce",           v: M.commerce.ev, col: C.green,
      note: `Margin ${fPct2(M.commerce.baseMargin)} → ${fPct2(M.commerce.rows[9].margin)} (automation + leverage) · ${s2c.toFixed(1)}× sales-to-capital` },
    { label: "Anthropic stake",    v: M.stake.value, col: "#d97757",
      note: `${STAKE_LABELS[basis]} · ANT ${M.stake.antScenario} case ${fUsd2(M.stake.antPerShare)}/sh, equity ${fUsdB(M.stake.antEquity)} · no tax haircut` },
    { label: "Other bets",         v: M.otherBets,   col: C.red,
      note: obMode === "fade" ? `−PV of after-tax Leo + Zoox spend: $${model.otherBets.annualCost}B/yr to ${model.otherBets.flatThrough}, fading to 0 by ${model.otherBets.zeroBy}`
                              : `Perpetual: −$${model.otherBets.annualCost}B × (1 − tax) ÷ WACC` },
    { label: "Net debt",           v: -M.netDebt,    col: C.red,
      note: `$${model.debt.toFixed(1)}B total debt face value − $${model.cash.toFixed(1)}B cash & securities (9/30/26) · leases excluded` },
  ]
  const maxAbs = Math.max(...bridge.map(b => Math.abs(b.v)))

  return (
    <div>
      {/* header */}
      <div className="model-header">
        <div className="model-header-row">
          <div className="model-ticker-badge" style={{ background: accent, color: "#111" }}>{model.ticker}</div>
          <div className="model-header-label">{model.name} · {model.exchange} · Sum-of-the-Parts DCF</div>
        </div>
        <div className="model-subline">
          AWS + Advertising + Commerce + Anthropic stake − Other bets − Net debt · valued as of end-{model.baseYear} ·{" "}
          {model.sharesOut}B diluted shares · Price ${model.currentPrice.toFixed(2)}{" "}
          {priceSource && (
            <span style={{ color: priceSource.startsWith("Live") ? "var(--green)" : "var(--text-3)", fontWeight: 500 }}>
              ({priceSource})
            </span>
          )}
        </div>
        <div className="model-subline">
          One WACC {fPct(wacc)} for every segment · {fPct(termG)} terminal growth, terminal new capital earns WACC (TV = NOPAT₂₀₃₇ ÷ WACC) ·{" "}
          {fPct(model.taxRate)} tax
        </div>
        <div className="model-subline">{cap(sc)} case = {A.label}</div>
      </div>

      {/* controls */}
      <div className="controls-row">
        <div className="control-group">
          <div className="section-label">Scenario</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["bear", "base", "bull"] as AmazonScenario[]).map(s => (
              <button key={s} onClick={() => pickScenario(s)} className={`sc-btn ${sc === s ? `active-${s}` : ""}`}>{cap(s)}</button>
            ))}
          </div>
        </div>
        <Slider label={`WACC: ${fPct(wacc)}`}                         min={8}  max={12} step={0.5} value={wacc}   set={setWacc}   color={scColors.color} />
        <Slider label={`Ad margin: ${fPct(adsM)}`}                    min={30} max={55} step={1}   value={adsM}   set={setAdsM}   color={scColors.color} />
        <Slider label={`Commerce savings kept: ${f0(kept * 100)}%`}   min={0}  max={100} step={5}  value={kept}   set={setKept}   color={scColors.color} />
        <Slider label={`Commerce sales-to-capital: ${s2c.toFixed(1)}×`} min={2} max={5} step={0.1} value={s2c} set={setS2c} color={scColors.color} unit="×" scale={1} />
        <Slider label={`Warehouse automated by 2036: ${f0(whAuto * 100)}%`} min={0} max={100} step={5} value={whAuto} set={setWhAuto} color={scColors.color} />

        <div className="control-group">
          <div className="section-label">Anthropic share basis</div>
          <select value={basis} onChange={e => setBasis(e.target.value as StakeBasis)}
            style={{ background: "var(--surface)", color: "var(--text-1)", border: "1px solid var(--border)", borderRadius: 6, padding: "5px 8px", fontSize: 12 }}>
            {(Object.keys(STAKE_LABELS) as StakeBasis[]).map(b => (
              <option key={b} value={b}>{STAKE_LABELS[b]} · {fUsdB(M.stake.options[b])}</option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <div className="section-label">Other bets</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["fade", "perpetual"] as OtherBetsMode[]).map(o => (
              <button key={o} onClick={() => setObMode(o)} className={`tab-btn ${obMode === o ? "active" : ""}`}>{o}</button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <div className="section-label">View</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(Object.keys(TAB_LABEL) as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)} className={`tab-btn ${tab === t ? "active" : ""}`}>{TAB_LABEL[t]}</button>
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

      {/* ── SOTP ── */}
      {tab === "sotp" && (
        <div>
          <div className="section-label">Sum of the Parts — {cap(sc)} Case</div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Piece</th>
                  <th style={{ textAlign: "left", width: "30%" }}></th>
                  <th>Value</th><th>$ / share</th><th>% of equity</th>
                  <th style={{ textAlign: "left" }}>How</th>
                </tr>
              </thead>
              <tbody>
                {bridge.map(b => (
                  <tr key={b.label}>
                    <td style={{ textAlign: "left", color: b.v < 0 ? "var(--red)" : b.col, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {b.v < 0 ? "(−) " : ""}{b.label}
                    </td>
                    <td style={{ textAlign: "left" }}>
                      <div style={{ height: 10, width: `${(Math.abs(b.v) / maxAbs) * 100}%`, background: b.col, opacity: b.v < 0 ? 0.55 : 0.8, borderRadius: 2 }} />
                    </td>
                    <td>{fUsdB(b.v)}</td>
                    <td>{fUsd2(b.v / model.sharesOut)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fPct(b.v / M.equity)}</td>
                    <td style={{ textAlign: "left", color: "var(--text-3)", fontSize: 11 }}>{b.note}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="ev-row">
                  <td style={{ textAlign: "left", color: scColors.color, fontWeight: 700 }}>Equity value</td>
                  <td />
                  <td style={{ color: scColors.color, fontWeight: 700 }}>{fUsdB(M.equity)}</td>
                  <td style={{ color: scColors.color, fontWeight: 700, fontSize: 14 }}>{fUsd2(M.perShare)}</td>
                  <td>100%</td>
                  <td style={{ textAlign: "left", color: "var(--text-3)", fontSize: 11 }}>÷ {model.sharesOut}B diluted shares (Q3 2026) · book value not added</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bridge-card">
            <div className="section-label">Verdict</div>
            {[
              ["Intrinsic value / share",          fUsd2(M.perShare),                          scColors.color],
              ["Current price",                    `$${model.currentPrice.toFixed(2)}`,       "var(--text-3)"],
              ["Implied upside / (downside)",      `${sgn(M.updown)}${f1(M.updown)}%`,        upCol],
              ["10-yr implied CAGR",               `${sgn(M.impliedCAGR)}${fPct2(M.impliedCAGR)} · ${passes ? "PASS" : "FAIL"}`, hurdleCol],
              [`Buy price for a ${f0(model.hurdle * 100)}% CAGR`, fUsd2(M.hurdlePrice),       "var(--text-2)"],
            ].map(([k, v, col]) => (
              <div key={k} className="bridge-row">
                <span className="bridge-label">{k}</span>
                <span className="bridge-value" style={{ color: col }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="section-label" style={{ marginTop: 24 }}>
            All Three Cases at {fPct(wacc)} WACC · scenario defaults · {STAKE_LABELS[basis]} · other bets {obMode}
          </div>
          <div className="sc-compare">
            {(["bear", "base", "bull"] as AmazonScenario[]).map(s => {
              const m2 = runAmazonSotp(model, s, wacc, termG, { stakeBasis: basis, otherBetsMode: obMode })
              const mt = SC_COLORS[s]
              return (
                <div key={s} className="sc-card" style={{ background: mt.dim + "88", border: `1px solid ${mt.color}44` }}>
                  <div className="sc-card-label" style={{ color: mt.color }}>{cap(s)} Case</div>
                  <div className="sc-card-value" style={{ color: mt.color }}>{fUsd2(m2.perShare)}</div>
                  <div className="sc-card-updown" style={{ color: "var(--text-2)" }}>
                    {sgn(m2.updown)}{f1(m2.updown)}% vs ${model.currentPrice.toFixed(2)} · CAGR {fPct2(m2.impliedCAGR)}
                  </div>
                  <div className="sc-card-stat">{model.scenarios[s].label}</div>
                  <div className="sc-card-stat">AWS {fUsdB(m2.aws.ev)} · Ads {fUsdB(m2.ads.ev)} · Commerce {fUsdB(m2.commerce.ev)}</div>
                  <div className="sc-card-stat">Anthropic {fUsdB(m2.stake.value)} · Other bets {fUsdB(m2.otherBets)}</div>
                  <div className="sc-card-stat">{f0(model.hurdle * 100)}%-hurdle buy price: {fUsd2(m2.hurdlePrice)}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── AWS ── */}
      {tab === "aws" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12, marginBottom: 18 }}>
            <SegmentChart title="Revenue by bucket ($B)" years={years} unit="$B" stacked series={[
              { label: "Core",      data: M.aws.rows.map(r => r.core),      color: C.orange },
              { label: "Inference", data: M.aws.rows.map(r => r.inference), color: C.accent },
              { label: "Training",  data: M.aws.rows.map(r => r.training),  color: C.purple },
            ]} />
            <SegmentChart title="Capex vs D&A vs FCF ($B)" years={years} unit="$B" series={[
              { label: "Capex", data: M.aws.rows.map(r => r.capex), color: C.amber },
              { label: "D&A",   data: M.aws.rows.map(r => r.da),    color: C.grey },
              { label: "FCF",   data: M.aws.rows.map(r => r.fcf),   color: C.green, type: "line" },
            ]} />
            <SegmentChart title="Operating margin (%)" years={years} unit="%" series={[
              { label: "Operating margin", data: M.aws.rows.map(r => r.opMargin * 100), color: C.orange, type: "line" },
            ]} height={180} />
            <SegmentChart title="ROIC on average capital (%)" years={years} unit="%" series={[
              { label: "ROIC", data: M.aws.rows.map(r => r.roicAvg * 100), color: C.amber, type: "line" },
            ]} height={180} />
          </div>

          <div className="section-label">AWS Rate-Base Model — {cap(sc)} Case ($B)</div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Year</th><th>Revenue</th><th>Growth</th><th>AI share</th><th>Training % of AI</th><th>Rev / net capex $</th>
                  <th>Capex</th><th>D&amp;A</th><th>Capital (end)</th><th>ROIC (avg)</th><th>Op income</th><th>Op margin</th><th>FCF</th><th>PV</th>
                </tr>
              </thead>
              <tbody>
                {M.aws.rows.map(r => (
                  <tr key={r.year}>
                    <td>{r.year}</td>
                    <td>{fUsdB(r.rev)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fPct(r.revGrowth)}</td>
                    <td style={{ color: "var(--purple)" }}>{fPct(r.aiShare)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fPct(r.trainingShareOfAi)}</td>
                    <td style={{ color: "var(--text-3)" }}>${r.revPerNetCapex.toFixed(3)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fUsdB(r.capex)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fUsdB(r.da)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fUsdB(r.icEnd)}</td>
                    <td style={{ color: "var(--amber)" }}>{fPct(r.roicAvg)}</td>
                    <td style={{ color: scColors.color }}>{fUsdB(r.ebit)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fPct(r.opMargin)}</td>
                    <td style={{ color: r.fcf >= 0 ? "var(--green)" : "var(--red)" }}>{fUsdB(r.fcf)}</td>
                    <td style={{ color: "var(--accent)" }}>{fUsdB(r.pvFcf)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={13} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
                    Terminal: NOPAT₂₀₃₇ = ROIC₂₀₃₆ × capital₂₀₃₆ = {fUsdB(M.aws.rows[9].blendedRoic * M.aws.rows[9].icEnd)}, ÷ WACC → TV {fUsdB(M.aws.tv)} ·{" "}
                    {f0(M.aws.tvWeight * 100)}% of AWS EV · cumulative 2027–36 FCF {fUsdB(M.aws.cumFcf)}
                  </td>
                  <td style={{ color: "var(--accent)", fontWeight: 600 }}>{fUsdB(M.aws.pvTv)}</td>
                </tr>
                <tr className="ev-row">
                  <td colSpan={13} style={{ color: "var(--accent)", fontWeight: 600, textAlign: "left" }}>AWS enterprise value (PV FCF {fUsdB(M.aws.sumPvFcf)} + PV TV)</td>
                  <td style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14 }}>{fUsdB(M.aws.ev)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <Notes items={[
            `ROIC buckets: core ${fPct(A.aws.coreRoic)} · enterprise inference ${fPct(A.aws.inferenceRoic)} · AI-lab training ${fPct(A.aws.trainingRoic)}. Core grows ${fPct(A.aws.coreGrowth)}/yr; training ${fPct(model.aws.trainingShareBuildout)} of AI through ${model.aws.buildoutEnd}, then → ${fPct(A.aws.trainingShareEnd)} by ${model.lastYear}.`,
            `Revenue per $ of net capex: $${A.aws.revPerNetCapexStart.toFixed(2)} through ${model.aws.buildoutEnd}, ramping to $${A.aws.revPerNetCapexEnd.toFixed(2)} by ${model.aws.rampEndYear}, flat after.`,
            "Simplifications: capital is split across core / inference / training by revenue share, which understates training's capital intensity. D&A dips in 2032 when the legacy server stock finishes depreciating. Trainium external chip sales are excluded.",
            "Estimates: Q4 2026 revenue, capex and D&A; AI share of 2026 revenue (15%).",
          ]} />
        </div>
      )}

      {/* ── ADS ── */}
      {tab === "ads" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12, marginBottom: 18 }}>
            <SegmentChart title="Advertising revenue and EBIT ($B)" years={years} unit="$B" series={[
              { label: "Revenue", data: M.ads.rows.map(r => r.rev),  color: C.purple },
              { label: "EBIT",    data: M.ads.rows.map(r => r.ebit), color: C.green },
            ]} />
          </div>
          <div className="section-label">Advertising — {cap(sc)} Case ($B · {fPct(adsM)} operating margin · FCF = NOPAT × {f0((1 - model.ads.reinvestRate) * 100)}%)</div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>Year</th><th>Revenue</th><th>Growth</th><th>EBIT</th><th>NOPAT</th><th>Reinvestment</th><th>FCF</th><th>PV</th></tr></thead>
              <tbody>
                {M.ads.rows.map(r => (
                  <tr key={r.year}>
                    <td>{r.year}</td><td>{fUsdB(r.rev)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fPct(r.growth)}</td>
                    <td style={{ color: "var(--purple)" }}>{fUsdB(r.ebit)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fUsdB(r.nopat)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fUsdB(-r.reinvest)}</td>
                    <td style={{ color: "var(--green)" }}>{fUsdB(r.fcf)}</td>
                    <td style={{ color: "var(--accent)" }}>{fUsdB(r.pvFcf)}</td>
                  </tr>
                ))}
              </tbody>
              <SegFoot cols={7} tv={M.ads.tv} pvTv={M.ads.pvTv} sumPv={M.ads.sumPvFcf} ev={M.ads.ev} color="var(--purple)" label="Advertising value" />
            </table>
          </div>
          <Notes items={[
            "Covers everything in Amazon's \"Advertising services\" line (sponsored ads, display, video incl. Prime Video) at one margin, backed out of the NA + International segments.",
            `Justin: 40% base (50% is Meta-level; Amazon isn't assumed to be as efficient) · bear 35% · bull 50%. A higher ad margin moves profit out of Commerce's base year, so Ads + Commerce always tie to reported profit.`,
            `2026E revenue ${fUsdB(model.ads.baseRevenue)} = 9M $56.7B + Q4-25 $21.3B × 1.18 (Q4 estimate). The 10% reinvestment rate is a placeholder.`,
          ]} />
        </div>
      )}

      {/* ── COMMERCE ── */}
      {tab === "commerce" && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 12, marginBottom: 18 }}>
            <SegmentChart title="Commerce revenue ($B)" years={years} unit="$B" series={[
              { label: "Revenue", data: M.commerce.rows.map(r => r.rev), color: C.green },
            ]} />
            <SegmentChart title="Margin build (%)" years={years} unit="%" stacked series={[
              { label: "Base (2026E)",       data: M.commerce.rows.map(r => r.baseMargin * 100), color: C.grey },
              { label: "Automation savings", data: M.commerce.rows.map(r => r.automation * 100), color: C.green },
              { label: "Fixed-cost leverage", data: M.commerce.rows.map(r => r.leverage * 100),  color: C.accent },
            ]} />
            <SegmentChart title="Reinvestment and FCF ($B)" years={years} unit="$B" series={[
              { label: "Reinvestment", data: M.commerce.rows.map(r => r.reinvest), color: C.amber },
              { label: "FCF",          data: M.commerce.rows.map(r => r.fcf),      color: C.green, type: "line" },
            ]} />
          </div>
          <div className="section-label">
            Commerce ex-ads, ex-other bets — {cap(sc)} Case ($B · keeps {f0(kept * 100)}% of savings · {f0(whAuto * 100)}% of warehouse labor automated by 2036 · {s2c.toFixed(1)}× sales-to-capital)
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>Year</th><th>Revenue</th><th>Growth</th><th>Warehouse auto.</th><th>Driver auto.</th>
                  <th>Base margin</th><th>+ Automation</th><th>+ Leverage</th><th>= Margin</th><th>EBIT</th><th>Reinvestment</th><th>FCF</th><th>PV</th></tr>
              </thead>
              <tbody>
                {M.commerce.rows.map(r => (
                  <tr key={r.year}>
                    <td>{r.year}</td><td>{fUsdB(r.rev)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fPct(r.growth)}</td>
                    <td style={{ color: "var(--text-3)" }}>{fPct(r.warehouseShare)}</td>
                    <td style={{ color: "var(--text-3)" }}>{fPct(r.driverShare)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fPct2(r.baseMargin)}</td>
                    <td style={{ color: "var(--green)" }}>{fPct2(r.automation)}</td>
                    <td style={{ color: "var(--accent)" }}>{fPct2(r.leverage)}</td>
                    <td style={{ color: "var(--amber)", fontWeight: 600 }}>{fPct2(r.margin)}</td>
                    <td style={{ color: "var(--green)" }}>{fUsdB(r.ebit)}</td>
                    <td style={{ color: "var(--text-2)" }}>{fUsdB(-r.reinvest)}</td>
                    <td style={{ color: r.fcf >= 0 ? "var(--green)" : "var(--red)" }}>{fUsdB(r.fcf)}</td>
                    <td style={{ color: "var(--accent)" }}>{fUsdB(r.pvFcf)}</td>
                  </tr>
                ))}
              </tbody>
              <SegFoot cols={12} tv={M.commerce.tv} pvTv={M.commerce.pvTv} sumPv={M.commerce.sumPvFcf} ev={M.commerce.ev} color="var(--green)" label="Commerce value" />
            </table>
          </div>
          <Notes items={[
            `2026E base: NA + Intl operating income ${fUsdB(model.commerce.naIntlOpIncome)} − ads ${fPct(adsM)} × ${fUsdB(model.ads.baseRevenue)} + other-bets add-back ${fUsdB(model.commerce.otherBetsAddBack)} = ${fUsdB(M.commerce.baseOI)} on ${fUsdB(M.commerce.baseRev)} revenue (${fPct2(M.commerce.baseMargin)}).`,
            `Automation = (warehouse labor ${fPct2(model.commerce.warehouseLaborPct)} × share automated + driver labor ${fPct2(model.commerce.driverLaborPct)} × share automated) × ${f0(model.commerce.netCapture * 100)}% net capture × share kept. Warehouse ramps to ${f0(whAuto * 100)}% by 2036 (Amazon's internal 75% goal); drivers ramp from 2032 to ${f0(model.commerce.driverAutoEnd * 100)}%. Fixed-cost leverage adds ${f1(model.commerce.leverageEnd * 100)} pt by 2036.`,
            `Growth ${fPct(model.commerce.growthStart)} → ${fPct(model.commerce.growthEnd)}. Robots are already inside the historical sales-to-capital ratio, so there's no separate robot capex; this slightly undercounts capital if the automation pace accelerates.`,
            "Estimates: labor pools (~$60B warehouse, ~$17.5B drivers), the $7B other-bets add-back, Q4 2026 revenue and operating income. Leo cost capitalization from Q1 2027 will lift reported NA margins; the model is unaffected because Leo sits in Other bets.",
          ]} />
        </div>
      )}

      {/* ── SENSITIVITY ── */}
      {tab === "sensitivity" && (
        <div>
          <div className="section-label">Intrinsic Value / Share ($) — {cap(sc)} Case · ad margin {fPct(adsM)} · {s2c.toFixed(1)}× · {f0(whAuto * 100)}% warehouse automation</div>
          <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 14 }}>
            Rows = share of Commerce automation savings kept · Columns = WACC (all segments; ANT stays at its own 10%) · Highlighted = current settings
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="sens-table">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Savings kept ↓ / WACC →</th>
                  {SENS.waccs.map(w => (
                    <th key={w} style={{ color: Math.abs(w - wacc) < 0.001 ? scColors.color : "var(--text-3)", fontWeight: Math.abs(w - wacc) < 0.001 ? 700 : 400 }}>{fPct(w)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SENS.kept.map((k, ri) => (
                  <tr key={k}>
                    <td style={{ color: Math.abs(k - kept) < 0.001 ? scColors.color : "var(--text-2)", fontWeight: Math.abs(k - kept) < 0.001 ? 700 : 400 }}>{f0(k * 100)}%</td>
                    {SENS.waccs.map((w, ci) => {
                      const val = SENS.grid[ri][ci]
                      const sel = Math.abs(w - wacc) < 0.001 && Math.abs(k - kept) < 0.001
                      const ratio = val / model.currentPrice
                      const cls = ratio >= 1.3 ? "sens-cell-green" : ratio >= 1.0 ? "sens-cell-accent" : ratio >= 0.7 ? "sens-cell-amber" : "sens-cell-red"
                      return (
                        <td key={w} className={`${cls} ${sel ? "sens-cell-selected" : ""}`} style={sel ? { borderColor: scColors.color, color: scColors.color } : {}}>
                          ${val.toFixed(2)}
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
                <span className="sens-legend-swatch" style={{ background: bg, border: `1px solid ${col}66` }} />{lbl}
              </div>
            ))}
          </div>

          <div className="section-label" style={{ marginTop: 24 }}>Anthropic Stake — Share Basis ({M.stake.antScenario} ANT case)</div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ maxWidth: 780 }}>
              <thead><tr><th style={{ textAlign: "left" }}>Basis</th><th>Stake value</th><th>$ / AMZN share</th><th>SOTP $ / share</th><th style={{ textAlign: "left" }}>How</th></tr></thead>
              <tbody>
                {([
                  ["pct15",       `${f0(model.anthropic.stakePct * 100)}% × ANT equity ${fUsdB(M.stake.antEquity)} (default)`],
                  ["classN",      `${model.anthropic.classNShares}B Class N shares × ${fUsd2(M.stake.antPerShare)}`],
                  ["classNNotes", `${(model.anthropic.classNShares + model.anthropic.noteShares).toFixed(2)}B (Class N + rollover notes) × ${fUsd2(M.stake.antPerShare)} · notes convert only while the stake is ≤12%`],
                  ["market",      `${model.anthropic.classNShares}B × ANT market price $${model.anthropic.antPrice.toFixed(2)}`],
                ] as [StakeBasis, string][]).map(([b, how]) => {
                  const r = runAmazonSotp(model, sc, wacc, termG, { ...ov, stakeBasis: b })
                  return (
                    <tr key={b}>
                      <td style={{ textAlign: "left", color: b === basis ? scColors.color : "var(--text-1)", fontWeight: b === basis ? 700 : 400 }}>{STAKE_LABELS[b]}</td>
                      <td>{fUsdB(M.stake.options[b])}</td>
                      <td style={{ color: "var(--text-2)" }}>{fUsd2(M.stake.options[b] / model.sharesOut)}</td>
                      <td>{fUsd2(r.perShare)}</td>
                      <td style={{ textAlign: "left", color: "var(--text-3)", fontSize: 11 }}>{how}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── ASSUMPTIONS ── */}
      {tab === "assumptions" && (
        <div className="assumptions-grid">
          {[
            { title: "Structure & Conventions", color: "var(--accent)", rows: [
              ["Pieces", "AWS + Advertising + Commerce (ex-ads, ex-other bets) + Other bets + Anthropic stake − net debt. Book value is not added (mostly operating assets already valued through segment FCF)."],
              ["Discounting", `End-of-year 2027–36 at one WACC (${fPct(model.waccDefault)} default) · ${fPct(model.termGrowth)} terminal · terminal new capital earns WACC in every segment → TV = NOPAT₂₀₃₇ ÷ WACC · ${fPct(model.taxRate)} tax`],
              ["Hurdle", `${f0(model.hurdle * 100)}% · CAGR = (value × (1+WACC)^10 ÷ price)^(1/10) − 1 · buy price = value × ((1+WACC)/1.2)^10`],
              ["Price", `Live quote; fallback $251.50 (Nov 24, 2026)`],
            ]},
            { title: "Balance Sheet & Anthropic", color: "var(--amber)", rows: [
              ["Net debt", `${fUsdB(model.debt)} total debt face value incl. $6.8B current portion − ${fUsdB(model.cash)} cash & marketable securities (9/30/26) = ${fUsdB(M.netDebt)}. Leases excluded (their cost is in segment results).`],
              ["Other LT liabilities", "Rose $36B → $100B in 2026, most likely deferred tax on the Anthropic gains. Not financial debt, and not deducted: the stake is held and compounds tax-free."],
              ["Anthropic stake", "15% × dcf-site ANT equity in the matching scenario (bear/base/bull), at ANT's own 10% WACC. No tax haircut. The share-basis question stays open; the alternatives are on the Sensitivity tab."],
              ["Correlation", "Anthropic is also one of AWS's two biggest backlog customers (>$100B over 10 years), so a bad Anthropic outcome hits two lines."],
              ["Shares", `${model.sharesOut}B diluted weighted-average (Q3 2026); SBC is a real cost inside segment margins`],
            ]},
            { title: "Other Bets", color: "var(--red)", rows: [
              ["Treatment", "Its own negative segment: −PV of after-tax Leo/Kuiper + Zoox spend. No revenue, no terminal value. The same losses are added back to Commerce's base profit."],
              ["Spend", `$${model.otherBets.annualCost}B/yr${""} (estimate: Leo ~$4–6B + Zoox ~$1.5–3B; Amazon discloses neither), flat to ${model.otherBets.flatThrough}, fading to 0 by ${model.otherBets.zeroBy}. Perpetual toggle: −$${model.otherBets.annualCost}B × 0.79 ÷ WACC.`],
            ]},
            { title: "Estimates to Replace with Q4 2026 Actuals", color: "var(--purple)", rows: [
              ["AWS", "Q4E revenue ~$49.9B, capex ~$60B, D&A ~$10.5B; AI share of 2026 revenue 15%"],
              ["Ads", "Q4E = Q4-25 $21.3B × 1.18"],
              ["NA + International", "Q4E revenue = Q4-25 $177.8B × 1.09; Q4E operating income $13.0B"],
              ["Undisclosed", "Labor pools (~$60B warehouse, ~$17.5B DSP drivers), other-bets spend ($7B)"],
              ["When", "Q4 2026 reports late January / early February 2027"],
              ["Model last updated", model.lastUpdated],
            ]},
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
        Figures marked {EST} or "estimate" are Claude's estimates, not company disclosures ·
        Value/share = (AWS + Advertising + Commerce + Anthropic stake + Other bets − net debt) ÷ diluted shares ·
        Updated {model.lastUpdated}
      </div>
    </div>
  )
}

function Slider({ label, min, max, step, value, set, color, unit = "%", scale = 100 }: {
  label: string; min: number; max: number; step: number; value: number; set: (v: number) => void
  color: string; unit?: string; scale?: number
}) {
  return (
    <div className="control-group">
      <div className="section-label">{label}</div>
      <input type="range" min={min} max={max} step={step} value={value * scale}
        onChange={e => set(Number(e.target.value) / scale)} style={{ width: 150, accentColor: color }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-3)", width: 150 }}>
        <span>{min}{unit}</span><span>{max}{unit}</span>
      </div>
    </div>
  )
}

function SegFoot({ cols, tv, pvTv, sumPv, ev, color, label }: {
  cols: number; tv: number; pvTv: number; sumPv: number; ev: number; color: string; label: string
}) {
  return (
    <tfoot>
      <tr>
        <td colSpan={cols} style={{ color: "var(--text-3)", fontSize: 11, textAlign: "left" }}>
          Terminal: NOPAT₂₀₃₆ × 1.03 ÷ WACC (terminal new capital earns WACC) · TV {fUsdB(tv)}
        </td>
        <td style={{ color: "var(--accent)", fontWeight: 600 }}>{fUsdB(pvTv)}</td>
      </tr>
      <tr className="ev-row">
        <td colSpan={cols} style={{ color, fontWeight: 600, textAlign: "left" }}>{label} (PV FCF {fUsdB(sumPv)} + PV TV)</td>
        <td style={{ color, fontWeight: 700, fontSize: 14 }}>{fUsdB(ev)}</td>
      </tr>
    </tfoot>
  )
}

function Notes({ items }: { items: string[] }) {
  return (
    <div className="phase-legend" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
      {items.map(t => <span key={t} style={{ fontSize: 11, color: "var(--text-3)" }}>{t}</span>)}
    </div>
  )
}
