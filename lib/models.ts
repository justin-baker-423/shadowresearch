// ─────────────────────────────────────────────────────────────────
//  models.ts  —  THE config file for all DCF models on the site.
//
//  To add a new model, copy one entry in the MODELS array below,
//  fill in your assumptions, and redeploy. No other files to touch.
// ─────────────────────────────────────────────────────────────────

export type Scenario = "bear" | "base" | "bull"

export interface ScenarioAssumptions {
  // 10 values — one per year 2026–2035
  revGrowth:  number[]   // decimal e.g. 0.10 = 10%
  niMargin:   number[]   // non-IFRS operating margin
}

export interface ModelConfig {
  slug:        string          // URL segment: yourdomain.com/models/[slug]
  ticker:      string          // e.g. "SAP"
  exchange:    string          // e.g. "NYSE"
  name:        string          // full company name
  sector:      string          // displayed in sidebar
  description: string          // one-line thesis shown on card
  lastUpdated: string          // "March 2026"

  // ── base year (most recent fiscal year actuals) ───────────────
  baseYear:    number          // e.g. 2025
  baseRevenue: number          // €B or $B
  currency:    "EUR" | "USD" | "GBP"
  currentPrice: number         // local currency per share
  sharesOut:   number          // diluted shares, billions
  netCash:     number          // positive = net cash, negative = net debt (€/$/£B)

  // ── shared assumptions ────────────────────────────────────────
  taxRate:     number          // decimal
  sbcHaircut:  number          // pp deducted from non-IFRS to get owner earnings
  buybackRate: number          // annual share count reduction, decimal (ignored when buybackPE is set)
  buybackPE?:  number          // if set: 100% FCF used for buybacks at this P/E multiple
                               // shares bought = FCF / (buybackPE × EPS) = shares / buybackPE per year
  termGrowth:  number          // default terminal growth rate
  waccDefault: number          // default WACC

  // ── scenario definitions ──────────────────────────────────────
  scenarios: Record<Scenario, ScenarioAssumptions>

  // ── optional colour accent for sidebar (defaults to blue) ─────
  accentColor?: string
}

// ─────────────────────────────────────────────────────────────────
//  MODELS  ← add new entries here
// ─────────────────────────────────────────────────────────────────
export const MODELS: ModelConfig[] = [
  // ── Chipotle Mexican Grill ─────────────────────────────────────
  // Source: Chipotle_DCF_Model.xlsx
  // Single scenario (bear/base/bull identical) — user to add alternates.
  // FCF margins interpolate linearly 15 % → 18 % over 10 years;
  // niMargin back-solved as fcfMargin / (1 − 25 % tax), no SBC haircut.
  {
    slug:         "cmg",
    ticker:       "CMG",
    exchange:     "NYSE",
    name:         "Chipotle Mexican Grill",
    sector:       "Fast Casual / QSR",
    description:  "Unit-count expansion · digital/loyalty flywheel · margin recovery thesis",
    lastUpdated:  "March 2026",

    baseYear:     2024,
    baseRevenue:  11.314,   // FY2024A ($B)
    currency:     "USD",
    currentPrice: 57.00,    // post 50:1 split fallback; replaced at runtime
    sharesOut:    1.350,    // 1,350 mm post-split diluted
    netCash:      2.300,    // $2.3 B net cash

    taxRate:      0.25,
    sbcHaircut:   0.00,     // FCF margins sourced directly; no separate SBC adj.
    buybackRate:  0.00,
    buybackPE:    25,       // 100% FCF used for buybacks at 25× owner earnings/share
    termGrowth:   0.025,
    waccDefault:  0.10,

    accentColor:  "#d2601a",  // Chipotle burnt-orange

    scenarios: {
      // All three identical — single scenario from Excel model
      bear: {
        revGrowth: [0.12,0.12,0.12,0.12,0.12, 0.12,0.12,0.12,0.12,0.12],
        niMargin:  [0.2000,0.2044,0.2089,0.2133,0.2178, 0.2222,0.2267,0.2311,0.2356,0.2400],
      },
      base: {
        revGrowth: [0.12,0.12,0.12,0.12,0.12, 0.12,0.12,0.12,0.12,0.12],
        niMargin:  [0.2000,0.2044,0.2089,0.2133,0.2178, 0.2222,0.2267,0.2311,0.2356,0.2400],
      },
      bull: {
        revGrowth: [0.12,0.12,0.12,0.12,0.12, 0.12,0.12,0.12,0.12,0.12],
        niMargin:  [0.2000,0.2044,0.2089,0.2133,0.2178, 0.2222,0.2267,0.2311,0.2356,0.2400],
      },
    },
  },

  {
    slug:         "sap",
    ticker:       "SAP",
    exchange:     "NYSE",
    name:         "SAP SE",
    sector:       "Enterprise Software",
    description:  "Cloud ERP transition · ECC/S4HANA migration · 2027 EOL catalyst",
    lastUpdated:  "March 2026",

    baseYear:     2025,
    baseRevenue:  36.8,
    currency:     "EUR",
    currentPrice: 175,
    sharesOut:    1.21,
    netCash:      3.38,

    taxRate:      0.28,
    sbcHaircut:   0.03,
    buybackRate:  0.015,
    termGrowth:   0.035,
    waccDefault:  0.10,

    accentColor:  "#4f8ef7",

    scenarios: {
      bear: {
        revGrowth: [0.08,0.09,0.09,0.09,0.08, 0.06,0.06,0.06,0.05,0.05],
        niMargin:  [0.285,0.292,0.298,0.302,0.305, 0.305,0.305,0.305,0.305,0.305],
      },
      base: {
        revGrowth: [0.10,0.11,0.12,0.11,0.10, 0.07,0.07,0.07,0.06,0.06],
        niMargin:  [0.290,0.300,0.310,0.316,0.320, 0.320,0.320,0.320,0.320,0.320],
      },
      bull: {
        revGrowth: [0.12,0.13,0.14,0.13,0.11, 0.08,0.07,0.07,0.07,0.06],
        niMargin:  [0.295,0.308,0.318,0.326,0.330, 0.332,0.332,0.332,0.332,0.332],
      },
    },
  },

  // ─────────────────────────────────────────────────────────────
  //  TEMPLATE — copy this block and fill in your assumptions
  // ─────────────────────────────────────────────────────────────
  // {
  //   slug:         "msft",
  //   ticker:       "MSFT",
  //   exchange:     "NASDAQ",
  //   name:         "Microsoft Corporation",
  //   sector:       "Cloud / AI",
  //   description:  "Azure growth · Copilot monetisation · Office 365 upsell",
  //   lastUpdated:  "March 2026",
  //
  //   baseYear:     2025,
  //   baseRevenue:  245.1,
  //   currency:     "USD",
  //   currentPrice: 415,
  //   sharesOut:    7.43,
  //   netCash:      -12.0,     // net debt
  //
  //   taxRate:      0.18,
  //   sbcHaircut:   0.025,
  //   buybackRate:  0.01,
  //   termGrowth:   0.04,
  //   waccDefault:  0.09,
  //
  //   accentColor:  "#00a4ef",
  //
  //   scenarios: {
  //     bear: {
  //       revGrowth: [0.12,0.13,0.13,0.12,0.11, 0.09,0.09,0.08,0.08,0.07],
  //       niMargin:  [0.44,0.45,0.45,0.45,0.45, 0.45,0.45,0.45,0.45,0.45],
  //     },
  //     base: {
  //       revGrowth: [0.14,0.15,0.15,0.14,0.13, 0.11,0.10,0.10,0.09,0.09],
  //       niMargin:  [0.44,0.45,0.46,0.47,0.47, 0.47,0.47,0.47,0.47,0.47],
  //     },
  //     bull: {
  //       revGrowth: [0.16,0.17,0.17,0.16,0.15, 0.13,0.12,0.11,0.10,0.10],
  //       niMargin:  [0.45,0.46,0.47,0.48,0.49, 0.49,0.49,0.49,0.49,0.49],
  //     },
  //   },
  // },
]

// Helper — look up a model by slug (used by the dynamic route)
export function getModel(slug: string): ModelConfig | undefined {
  return MODELS.find(m => m.slug === slug)
}
