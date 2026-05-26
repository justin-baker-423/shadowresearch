// ─────────────────────────────────────────────────────────────────
//  meta-models.ts  —  Capex-Adjusted NOPAT engine config.
//
//  Separate from models.ts because this engine is fundamentally
//  different: FCF = NOPAT + D&A − Capex (capital-intensive framework).
//  Revenue growth is ROIC-driven from FY2027 onward; FY2026 is
//  anchored to management guidance. Reality Labs is fully excluded.
// ─────────────────────────────────────────────────────────────────

import type { Scenario } from "./models"
export type { Scenario }

export interface MetaScenarioAssumptions {
  // 10 values — FY2026–2035 operating margin (Family of Apps only)
  foaOpMargin: number[]
  // 9 values  — FY2027–2035 capex as % of that year's FoA revenue
  // (FY2026 capex is absolute, anchored to guidance at $125B)
  // 2027–2028 elevated (~0.47–0.50) to absorb FCF; steps down from 2029
  capexPct: number[]
  // 9 values — FY2027–2035 AI competitive advantage premium (decimal)
  // Represents compound monetization (Advantage+, Llama, WhatsApp, Reels) that
  // predates and is distinct from the infrastructure capex cycle.
  // Starts large, decays to zero as the advantage normalises vs competitors.
  shareGainSchedule: number[]
}

export interface MetaModelConfig {
  slug:        string
  ticker:      string
  exchange:    string
  name:        string
  sector:      string
  description: string
  lastUpdated: string

  // ── engine tag — used to route to this shell ─────────────────
  engine: "capex-adjusted-nopat"

  // ── base / anchor year ────────────────────────────────────────
  baseYear:        number    // most recent completed FY (2025)
  foaBaseRevenue:  number    // FoA revenue in baseYear ($B) — for display / growth calc
  foaYear1Revenue: number    // FY2026E guidance anchor ($B)

  currency:     "USD"
  currentPrice: number       // $/share
  sharesOut:    number       // diluted shares outstanding ($B)
  netCash:      number       // net cash (+) / net debt (−) ($B)

  // ── DCF assumptions ───────────────────────────────────────────
  taxRate:      number       // effective tax rate (decimal)
  roicDefault:  number       // default ROIC slider (decimal)
  // Per-year share reduction; 10 values (2026–2035)
  buybackSchedule: number[]

  termGrowth:   number       // default terminal growth rate
  waccDefault:  number       // default WACC

  // ── D&A model (PP&E-derived) ──────────────────────────────────
  assetLife:    number       // useful life in years (drives daRate = 1/assetLife)
  basePPE:      number       // gross PP&E at start of FY2026 ($B)
  capexYear1:   number       // FY2026 absolute capex guidance ($B)

  // ── Two-driver revenue growth model ──────────────────────────
  // RevGrowth(t) = adMarketGrowth + ROIC × max(0, NetCapex(t−2)) / Rev(t−1)
  adMarketGrowth: number     // annual growth rate of total global ad TAM (decimal)
  adMarketGrowthDefault: number  // default slider value
  adTam2025:      number     // total global advertising market in 2025 ($B)
  // FY2025 actual net capex (Capex − D&A): seeds the 2-yr lag for FY2027 growth
  // Derived: PPE_start_2025 = (basePPE − capex2025 × 0.95) / 0.90; D&A = PPE_start × 0.10 + capex2025 × 0.05
  netCapexSeed:   number     // FY2025 net capex ($B)

  scenarios: Record<Scenario, MetaScenarioAssumptions>

  accentColor?: string
}

// ─────────────────────────────────────────────────────────────────
//  META_MODELS  ← add new Capex-Adjusted NOPAT entries here
// ─────────────────────────────────────────────────────────────────
export const META_MODELS: MetaModelConfig[] = [
  {
    slug:        "meta",
    ticker:      "META",
    exchange:    "NASDAQ",
    name:        "Meta Platforms, Inc.",
    sector:      "Social Media / AI",
    description: "FoA moat · AI-driven ad efficiency · $65B+ capex cycle absorbed · Reality Labs excluded",
    lastUpdated: "March 2026",
    engine:      "capex-adjusted-nopat",

    baseYear:        2025,
    foaBaseRevenue:  198.8,  // FY2025A FoA revenue
    foaYear1Revenue: 248.0,  // FY2026E management guidance anchor
    currency:        "USD",
    currentPrice:    620,    // replaced at runtime by Yahoo Finance
    sharesOut:       2.52,   // diluted shares (B)
    netCash:         22.9,   // net cash at FY2025A ($B)

    taxRate:      0.14,
    roicDefault:  0.20,
    // 0% buyback in 2026 (capex absorption), then ramp up
    buybackSchedule: [0, 0.015, 0.015, 0.015, 0.020, 0.020, 0.025, 0.025, 0.025, 0.025],

    termGrowth:  0.035,
    waccDefault: 0.10,

    assetLife:   10,         // 10-yr average useful life → daRate = 10%
    basePPE:     176.4,      // gross PP&E at 1-Jan-2026 ($B)
    capexYear1:  125.0,      // FY2026 capex guidance ($B, absolute)

    // Two-driver revenue growth
    adMarketGrowth:        0.07,   // 7% annual global ad TAM growth (base)
    adMarketGrowthDefault: 0.07,
    adTam2025:             1000,   // $1T total global advertising in 2025 ($B)
    // FY2025: capex $38.8B; PPE_start = (176.4 − 38.8×0.95)/0.90 = $154.9B; D&A = $15.5+$1.9 = $17.4B
    netCapexSeed:          21.4,   // FY2025 net capex ($B)

    accentColor: "#0082fb",  // Meta blue

    scenarios: {
      bear: {
        // Margins: slower ramp, plateau at 46%
        foaOpMargin: [0.41, 0.40, 0.40, 0.42, 0.44, 0.45, 0.46, 0.46, 0.46, 0.46],
        // 2027–2028 elevated for near-zero FCF; step-down from 2029
        capexPct:    [0.44, 0.43, 0.32, 0.28, 0.25, 0.22, 0.21, 0.20, 0.20],
        // AI advantage erodes quickly — cheap ad solutions from Google/TikTok close the gap
        shareGainSchedule: [0.07, 0.05, 0.03, 0.01, 0, 0, 0, 0, 0],
      },
      base: {
        // Margins: steady expansion to 52% by 2031
        foaOpMargin: [0.41, 0.41, 0.42, 0.44, 0.47, 0.50, 0.52, 0.52, 0.52, 0.52],
        // 2027–2028 elevated for near-zero FCF; normalises toward 20% by 2032
        capexPct:    [0.47, 0.48, 0.30, 0.26, 0.23, 0.20, 0.20, 0.20, 0.20],
        // AI advantage (Advantage+, Llama, WhatsApp, Reels) normalises by 2032
        shareGainSchedule: [0.11, 0.09, 0.06, 0.04, 0.02, 0, 0, 0, 0],
      },
      bull: {
        // Margins: faster ramp to 55% by 2033
        foaOpMargin: [0.41, 0.42, 0.44, 0.47, 0.50, 0.52, 0.54, 0.55, 0.55, 0.55],
        // Aggressive capex through 2028; Meta locks in infrastructure lead
        capexPct:    [0.50, 0.50, 0.34, 0.28, 0.24, 0.21, 0.20, 0.20, 0.20],
        // Advantage persists longer — AI moat proves durable through 2033
        shareGainSchedule: [0.13, 0.11, 0.08, 0.06, 0.04, 0.02, 0, 0, 0],
      },
    },
  },
]

export function getMetaModel(slug: string): MetaModelConfig | undefined {
  return META_MODELS.find(m => m.slug === slug)
}
