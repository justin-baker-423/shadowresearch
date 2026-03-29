// ─────────────────────────────────────────────────────────────────
//  celsius-models.ts  —  Celsius Holdings DCF config.
//
//  Uses the standard ModelConfig / dcf-engine (no custom engine).
//  Capital-light beverage company: D&A ($29.5M) ≈ Capex ($36.1M)
//  → net capex ~$0 → FCF ≈ NOPAT. niMargin field = operating margin.
//
//  Alani Nu acquisition (closed Q1 2025) fully baked into FY2025A:
//  - $1.8B cash + $150M earnout financed with $700M term loan +
//    $852M Series A preferred + $908M Series B preferred.
//  - Both preferred series convert to common (most likely settlement,
//    per Note 14 of FY2025 10-K). Included in fully diluted count.
// ─────────────────────────────────────────────────────────────────

import type { ModelConfig } from "./models"

export const CELSIUS_MODELS: ModelConfig[] = [
  {
    slug:         "celh",
    ticker:       "CELH",
    exchange:     "NASDAQ",
    name:         "Celsius Holdings, Inc.",
    sector:       "Energy Drinks / Functional Beverages",
    description:  "Alani Nu integration · Pepsi distribution · op margin expansion to 30% · preferred converts to common",
    lastUpdated:  "March 2026",

    baseYear:     2025,
    baseRevenue:  2.515,    // FY2025A net revenue ($B)
    currency:     "USD",
    currentPrice: 30.00,    // replaced at runtime by Yahoo Finance
    // Fully diluted: 256.9M common + 22.0M Ser A conv + 11.3M Ser B conv + 4.4M options/RSUs
    sharesOut:    0.2946,   // 294.6M shares (billions)

    // Net cash: $399M cash − $700M term loan − $25M contingent consideration = −$326M
    // Note: $141M restricted cash excluded (contractually unavailable for operations)
    netCash:     -0.326,

    taxRate:      0.22,     // normalized (FY23: 22.3%, FY24: 25.6%; FY25 13.6% was atypical DTA)
    sbcHaircut:   0.01,     // ~$28M FY2025 SBC / $2,515M revenue ≈ 1.1%
    buybackRate:  0.008,    // fallback (unused when buybackPE is set)
    buybackPE:    20,       // 100% of FCF repurchased at 20× owner earnings/share
    termGrowth:   0.03,
    waccDefault:  0.10,

    accentColor:  "#2BD9A5",  // Celsius teal/green

    scenarios: {
      bear: {
        // Slower Alani Nu ramp; Pepsi channel friction; margin recovery delayed
        revGrowth: [0.20, 0.14, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12],
        niMargin:  [0.18, 0.19, 0.20, 0.22, 0.24, 0.25, 0.25, 0.25, 0.25, 0.25],
      },
      base: {
        // User assumptions: 30/20/17/15/15% growth; op margin 20%→30% by 2030
        revGrowth: [0.30, 0.20, 0.17, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15, 0.15],
        niMargin:  [0.20, 0.22, 0.24, 0.27, 0.30, 0.30, 0.30, 0.30, 0.30, 0.30],
      },
      bull: {
        // Alani Nu outperforms; international expansion; margin leverage faster
        revGrowth: [0.35, 0.26, 0.22, 0.18, 0.17, 0.17, 0.16, 0.16, 0.16, 0.15],
        niMargin:  [0.22, 0.25, 0.28, 0.31, 0.33, 0.33, 0.33, 0.33, 0.33, 0.33],
      },
    },
  },
]

export function getCelsiusModel(slug: string): ModelConfig | undefined {
  return CELSIUS_MODELS.find(m => m.slug === slug)
}
