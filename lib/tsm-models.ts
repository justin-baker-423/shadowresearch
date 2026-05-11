// ─────────────────────────────────────────────────────────────────
//  tsm-models.ts  —  Taiwan Semiconductor Manufacturing (TSM) DCF
//
//  Earnings-based approach: each niMargin value is the post-tax net
//  income margin. CapEx is treated as value-creating investment in
//  durable fab assets (not subtracted from the earnings stream).
//  taxRate and sbcHaircut are both 0 since margins are already
//  post-tax (effective ~15% embedded). No buyback program; dividends
//  paid from earnings ($3.80/ADR annually).
//
//  NI margin derivation: OM × (1 − ~15% tax) + interest income
//    e.g. Q1 2026A OM 58.0% → NI margin ~50% at peak
//  NI ≈ FCF + 13pp  (D&A 17% − CapEx 30% = −13pp drag reversed)
// ─────────────────────────────────────────────────────────────────

import type { ModelConfig } from "./models"

export const TSM_MODELS: ModelConfig[] = [
  {
    slug:         "tsm",
    ticker:       "TSM",
    exchange:     "NYSE",
    name:         "Taiwan Semiconductor Mfg.",
    sector:       "Semiconductor Foundry",
    description:  "Pure-play foundry dominance · AI/HPC advanced-node supercycle · 2nm ramp",
    lastUpdated:  "May 2026",

    baseYear:     2025,
    baseRevenue:  121.35,   // FY2025A ($B USD)
    currency:     "USD",
    currentPrice: 416.41,   // per ADR (live-replaced at runtime)
    sharesOut:    5.19,     // diluted ADRs, billions (1 ADR = 5 ordinary shares; 25.93B ordinary total)
    netCash:      71.1,     // $71.1B net cash: $99.7B cash − $28.5B debt (FY2025A)

    taxRate:      0,        // embedded in FCF margins (~15% effective, incl. R&D incentives)
    sbcHaircut:   0,        // net capex drag already embedded; TSMC SBC is negligible
    buybackRate:  0,        // no buyback program — capital returned via dividends only
    termGrowth:   0.03,
    waccDefault:  0.10,

    accentColor:  "#e31837",  // TSMC red

    scenarios: {
      // ── Bear ───────────────────────────────────────────────────────
      // Slower peak growth, deeper cycle trough; NI margins trough low-40s
      // Implied GM: peak ~64%, trough ~52%, recovery ~58%
      bear: {
        revGrowth: [ 0.28,  0.20, -0.05, -0.04,  0.17,  0.17,  0.17,  0.17,  0.17,  0.17],
        niMargin:  [ 0.48,  0.44,  0.37,  0.36,  0.39,  0.41,  0.43,  0.44,  0.45,  0.45],
      },

      // ── Base ───────────────────────────────────────────────────────
      // 30%/27% peak, two down years (−3%/−2%), 17% steady recovery
      // Implied GM: peak ~66%, trough ~54%, recovery to mid-60s
      base: {
        revGrowth: [ 0.30,  0.27, -0.03, -0.02,  0.17,  0.17,  0.17,  0.17,  0.17,  0.17],
        niMargin:  [ 0.50,  0.47,  0.41,  0.40,  0.43,  0.45,  0.47,  0.49,  0.50,  0.50],
      },

      // ── Bull ───────────────────────────────────────────────────────
      // 33%/30% peak, shallower correction (−1%/+2%), 17% steady state
      // Implied GM: peak ~68%, trough ~57%, recovery to high-60s
      bull: {
        revGrowth: [ 0.33,  0.30, -0.01,  0.02,  0.17,  0.17,  0.17,  0.17,  0.17,  0.17],
        niMargin:  [ 0.52,  0.50,  0.44,  0.43,  0.46,  0.48,  0.49,  0.50,  0.51,  0.52],
      },
    },
  },
]

export function getTsmModel(slug: string): ModelConfig | undefined {
  return TSM_MODELS.find(m => m.slug === slug)
}
