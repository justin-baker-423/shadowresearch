// ─────────────────────────────────────────────────────────────────
//  amazon-models.ts  —  Sum-of-the-parts DCF for Amazon.com (AMZN).
//  Spec v1.1 (AMZN_dcf-site_spec.md + amazon-sotp-reference.ts), from
//  Justin's Stock Analysis project, AMZN.md §8–13 (Nov 23–24, 2026).
//  Inputs from Amazon's Q3 2026 release / 10-Q (filed Oct 30, 2026).
//
//  Structure (Justin's decisions):
//    AWS + Advertising + Commerce (ex-ads, ex-other bets) + Other bets
//    + Anthropic stake − net debt.   Book value is not added.
//
//  Conventions: valuation as of end-2026 · end-of-year discounting
//  2027–36 · one WACC for every segment · 3% terminal growth ·
//  terminal new capital earns WACC in every segment, so
//  TV = NOPAT_2037 ÷ WACC · 21% tax · 20% hurdle.
//
//  Engine mechanics: see amazon-engine.ts. Figures marked "estimate"
//  are Claude's (Amazon does not disclose them; Q4 2026 is not yet
//  reported) — replace with actuals when Q4 2026 reports.
// ─────────────────────────────────────────────────────────────────

export type AmazonScenario = "bear" | "base" | "bull"
export type StakeBasis = "pct15" | "classN" | "classNNotes" | "market"
export type OtherBetsMode = "fade" | "perpetual"

export interface AmazonScenarioAssumptions {
  label: string
  aws: {
    coreGrowth:          number   // core (non-AI) revenue growth to 2036
    revPerNetCapexStart: number   // revenue per $ of net capex, through 2028
    revPerNetCapexEnd:   number   // … ramps linearly to this by 2032, flat after
    coreRoic:            number
    inferenceRoic:       number
    trainingRoic:        number
    trainingShareEnd:    number   // training share of AI revenue in 2036
  }
  adsMargin:     number           // one operating margin for all of "Advertising services"
  commerceKept:  number           // share of net automation savings kept as margin
  commerceS2C:   number           // Commerce sales-to-capital (robots included)
  ant:           "bear" | "base" | "bull"   // matching dcf-site ANT scenario
}

export interface AmazonModelConfig {
  slug:        string
  ticker:      string
  exchange:    string
  name:        string
  sector:      string
  description: string
  lastUpdated: string

  baseYear:    number
  lastYear:    number
  taxRate:     number
  termGrowth:  number
  waccDefault: number
  hurdle:      number
  sharesOut:   number   // billions, diluted
  currentPrice: number  // $ fallback — replaced by live quote at runtime
  cash:        number   // cash + marketable securities, 9/30/26
  debt:        number   // total face value of debt incl. current portion, 9/30/26

  aws: {
    baseRevenue: number; baseCapex: number; baseDA: number; baseIC: number; baseAiShare: number
    legacyShortLived: number; legacyShortLife: number
    legacyLongLived:  number; legacyLongLife:  number
    shortLivedShare:  number; shortLife: number; longLife: number
    capexGrowth: number[]     // 2027, 2028
    capexFlatUntil: number    // flat through this year, then glide to D&A + g × IC by 2036
    rampEndYear: number       // revenue-per-capex ramp ends
    buildoutEnd: number       // last build-out year (ratio and training share held)
    trainingShareBuildout: number
  }

  ads: {
    baseRevenue: number
    growthStart: number; growthEnd: number
    reinvestRate: number      // FCF = NOPAT × (1 − reinvestRate)  (placeholder)
  }

  commerce: {
    naIntlRevenue:    number  // 2026E NA + International revenue
    naIntlOpIncome:   number  // 2026E NA + International operating income
    otherBetsAddBack: number  // Leo + Zoox losses inside NA/Intl (estimate)
    growthStart: number; growthEnd: number
    warehouseLaborPct: number // warehouse labor ÷ NA + Intl revenue
    driverLaborPct:    number // DSP driver labor ÷ NA + Intl revenue
    warehouseAutoEnd:  number // share of warehouse labor automated by 2036
    driverAutoEnd:     number
    driverAutoStart:   number // linear from 0 after this year
    netCapture:        number // labor saving net of robot D&A + maintenance
    leverageEnd:       number // fixed-cost leverage by 2036 (margin)
  }

  otherBets: { annualCost: number; flatThrough: number; zeroBy: number }

  anthropic: {
    stakePct:     number      // 15% × dcf-site ANT equity (default basis)
    classNShares: number      // billions
    noteShares:   number      // billions (rollover notes, in ANT's 18.14B)
    antPrice:     number      // $ — replaced by live quote at runtime
  }

  scenarios:   Record<AmazonScenario, AmazonScenarioAssumptions>
  accentColor?: string
}

const AMAZON_MODEL: AmazonModelConfig = {
  slug:        "amazon",
  ticker:      "AMZN",
  exchange:    "NASDAQ",
  name:        "Amazon.com, Inc.",
  sector:      "Cloud / Advertising / E-commerce",
  description: "Sum of the parts · AWS capacity-driven rate base (lagged net capex → revenue, ROIC × capital in service) + 40%-margin ads + automation-driven commerce + 15% of Anthropic − other bets − net debt",
  lastUpdated: "November 2026",

  baseYear:     2026,
  lastYear:     2036,
  taxRate:      0.21,
  termGrowth:   0.03,
  waccDefault:  0.10,
  hurdle:       0.20,
  sharesOut:    10.929,             // Q3-26 diluted weighted-average
  currentPrice: 251.50,             // Nov 24, 2026 fallback
  cash:         55.783 + 58.443,    // cash + marketable securities, 9/30/26
  debt:         180.887,            // total face value incl. $6.827B current portion; leases excluded

  aws: {
    baseRevenue: 175.7,             // 9M $125.803B + Q4E ~$49.9B (estimate)
    baseCapex:   207.0,             // 9M $147.236B + Q4E ~$60B (estimate)
    baseDA:      35.1,              // 9M $24.583B + Q4E ~$10.5B (estimate)
    baseIC:      470.0,             // segment assets $419.594B (9/30/26) + Q4 net capex
    baseAiShare: 0.15,              // estimate (Q1-26 AI run rate >$15B, ramped since)
    legacyShortLived: 217, legacyShortLife: 5,
    legacyLongLived:  145, legacyLongLife:  28,
    shortLivedShare: 0.60, shortLife: 5.5, longLife: 30,
    capexGrowth: [0.25, 0.10], capexFlatUntil: 2030, rampEndYear: 2032, buildoutEnd: 2028,
    trainingShareBuildout: 0.40,
  },

  ads: {
    baseRevenue: 56.689 + 21.317 * 1.18,   // 9M + Q4-25 × 1.18 (Q4E estimate)
    growthStart: 0.17, growthEnd: 0.05,
    reinvestRate: 0.10,
  },

  commerce: {
    naIntlRevenue:    458.266 + 177.808 * 1.09, // 9M + Q4-25 × 1.09 (Q4E estimate)
    naIntlOpIncome:   30.834 + 13.0,            // 9M + Q4E $13.0B (estimate)
    otherBetsAddBack: 7.0,                      // Leo ~$4–6B + Zoox ~$1.5–3B (estimate)
    growthStart: 0.09, growthEnd: 0.06,
    warehouseLaborPct: 60 / 588.2,              // ~$60B F&T labor ÷ 2025 NA + Intl revenue (estimate)
    driverLaborPct:    17.5 / 588.2,            // ~$17.5B DSP driver labor (estimate)
    warehouseAutoEnd:  0.75,                    // Amazon's internal 75% goal
    driverAutoEnd: 0.10, driverAutoStart: 2031,
    netCapture:  0.59,                          // $150k/robot-worker, 13-yr life, 10% maint. vs $64k wage
    leverageEnd: 0.01,
  },

  otherBets: { annualCost: 7.0, flatThrough: 2030, zeroBy: 2035 },

  anthropic: {
    stakePct:     0.15,
    classNShares: 1.94,
    noteShares:   1.55,
    antPrice:     88.91,
  },

  accentColor: "#ff9900",

  scenarios: {
    bear: {
      label: "Core 5% · ROIC 18/15/8% · ads 35% · keeps 25% of automation savings · ANT bear",
      aws: { coreGrowth: 0.05, revPerNetCapexStart: 0.50, revPerNetCapexEnd: 0.65,
             coreRoic: 0.18, inferenceRoic: 0.15, trainingRoic: 0.08, trainingShareEnd: 0.25 },
      adsMargin: 0.35, commerceKept: 0.25, commerceS2C: 3.0, ant: "bear",
    },
    base: {
      label: "Core 7% · ROIC 20/20/10% · ads 40% · keeps 50% of automation savings · ANT base",
      aws: { coreGrowth: 0.07, revPerNetCapexStart: 0.58, revPerNetCapexEnd: 0.78,
             coreRoic: 0.20, inferenceRoic: 0.20, trainingRoic: 0.10, trainingShareEnd: 0.10 },
      adsMargin: 0.40, commerceKept: 0.50, commerceS2C: 3.0, ant: "base",
    },
    bull: {
      label: "Core 9% · ROIC 22/22/12% · ads 50% · keeps 100% of automation savings · ANT bull",
      aws: { coreGrowth: 0.09, revPerNetCapexStart: 0.62, revPerNetCapexEnd: 0.90,
             coreRoic: 0.22, inferenceRoic: 0.22, trainingRoic: 0.12, trainingShareEnd: 0.05 },
      adsMargin: 0.50, commerceKept: 1.00, commerceS2C: 4.5, ant: "bull",
    },
  },
}

export const AMAZON_MODELS: AmazonModelConfig[] = [AMAZON_MODEL]

export function getAmazonModel(slug: string): AmazonModelConfig | undefined {
  return AMAZON_MODELS.find(m => m.slug === slug)
}
