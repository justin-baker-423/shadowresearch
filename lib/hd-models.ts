// ─────────────────────────────────────────────────────────────────
//  hd-models.ts  —  Model config for The Home Depot, Inc. (HD)
//
//  Engine architecture:
//    • Two primary sliders: uniform rev growth (2–8%) + adj op margin (11–16%)
//    • Bear/Base/Bull scenario buttons pre-set those two sliders
//    • UFCF-based DCF → EV → equity bridge (subtract $49.9B net debt)
//    • Capital waterfall: FCF → dividends → debt paydown → buybacks (after
//      net debt / EBITDA drops below trigger)
//    • Dividend growth tied to EPS growth each year (floored — no cuts)
//
//  Base year: FY2025 ended February 1, 2026  ($164.7B revenue)
//  Fiscal year: ends early February each year
// ─────────────────────────────────────────────────────────────────

export type Scenario = "bear" | "base" | "bull"

export interface HDScenario {
  label:       string
  revGrowth:   number   // uniform annual revenue growth (fraction)
  opMargin:    number   // uniform adj operating margin (fraction)
  description: string
}

export interface HDModelConfig {
  slug:         string
  ticker:       string
  name:         string
  exchange:     string
  sector:       string
  description:  string
  lastUpdated:  string

  currentPrice:    number   // fallback; overridden at runtime by live fetch
  sharesOut:       number   // billions diluted (~995M)
  netDebt:         number   // $B net debt end FY2025A
  avgIntRate:      number   // effective rate on net debt (~$2.3B / $49.9B)
  taxRate:         number   // fraction — FY2026 guidance 24.3%
  baseRevenue:     number   // $B — FY2025A net sales
  basePrevEps:     number   // FY2025A adj diluted EPS (seeds DPS growth calc)
  dnaRate:         number   // D&A as % of revenue (~2.0%)
  capexRate:       number   // Capex as % of revenue (~2.5% guidance)
  dps0:            number   // current annual dividend ($ per share; $2.33 × 4)
  buybackTrigger:  number   // net debt / EBITDA below which buybacks resume
  buybackPE:       number   // assumed P/E for share retirement price

  waccDefault:  number
  termGrowth:   number
  accentColor:  string

  scenarios: Record<Scenario, HDScenario>
}

const HD: HDModelConfig = {
  slug:         "hd",
  ticker:       "HD",
  name:         "The Home Depot, Inc.",
  exchange:     "NYSE",
  sector:       "Home Improvement Retail · Pro Distribution",
  description:  "SRS/GMS integration · Pro distribution buildout · housing recovery · dividend compounder",
  lastUpdated:  "May 2026",

  currentPrice:    370.00,   // fallback; replaced at runtime
  sharesOut:       0.995,    // ~995M diluted shares (FY2025A)
  netDebt:         49.9,     // $49.9B net debt end FY2025A
  avgIntRate:      0.046,    // ~4.6% effective ($2.3B interest / $49.9B)
  taxRate:         0.243,    // FY2026 guidance effective tax rate
  baseRevenue:     164.7,    // FY2025A net sales ($B)
  basePrevEps:     14.69,    // FY2025A adj diluted EPS
  dnaRate:         0.020,    // D&A ≈ 2.0% of sales ($3.3B / $164.7B)
  capexRate:       0.025,    // Capex ≈ 2.5% of sales (management target)
  dps0:            9.32,     // $2.33/quarter × 4 — current annual rate
  buybackTrigger:  1.5,      // resume buybacks when net debt/EBITDA < 1.5×
  buybackPE:       20,       // assumed P/E multiple for share retirement

  waccDefault: 0.085,
  termGrowth:  0.025,
  accentColor: "#f96302",    // Home Depot orange

  scenarios: {
    bear: {
      label:       "Bear",
      revGrowth:   0.030,
      opMargin:    0.125,
      description: "Prolonged housing freeze · SRS margin pressure · tariff headwinds · core retail flat",
    },
    base: {
      label:       "Base",
      revGrowth:   0.050,
      opMargin:    0.135,
      description: "Gradual housing recovery · SRS integration delivering · Pro mix scaling · ticket inflection",
    },
    bull: {
      label:       "Bull",
      revGrowth:   0.070,
      opMargin:    0.145,
      description: "Strong housing rebound · full Pro distribution synergies · comp acceleration · margin recovery",
    },
  },
}

export const HD_MODELS: HDModelConfig[] = [HD]

export function getHDModel(slug: string): HDModelConfig | undefined {
  return HD_MODELS.find(m => m.slug === slug)
}
