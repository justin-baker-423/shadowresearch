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
    lastUpdated:  "June 2026",

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
      // Supercycle extends through 2028 (margins expand 2026→2028);
      // single-year cyclical correction in 2029, then 17%/yr recovery.

      // ── Bear ───────────────────────────────────────────────────────
      // Slower peak growth, deep 2029 trough; margins trough high-30s
      // Implied GM: peak ~64%, trough ~53%, recovery ~58%
      bear: {
        revGrowth: [ 0.28,  0.20,  0.15, -0.04,  0.17,  0.17,  0.17,  0.17,  0.17,  0.17],
        niMargin:  [ 0.48,  0.46,  0.47,  0.38,  0.40,  0.41,  0.43,  0.44,  0.45,  0.45],
      },

      // ── Base ───────────────────────────────────────────────────────
      // 30%/27%/25% supercycle, margins expand 50% → 51% → 52%,
      // single down year 2029 (−2%), 17% steady recovery
      // Implied GM: peak ~68%, trough ~56%, recovery to mid-60s
      base: {
        revGrowth: [ 0.30,  0.27,  0.25, -0.02,  0.17,  0.17,  0.17,  0.17,  0.17,  0.17],
        niMargin:  [ 0.50,  0.51,  0.52,  0.43,  0.45,  0.47,  0.49,  0.50,  0.50,  0.50],
      },

      // ── Bull ───────────────────────────────────────────────────────
      // 33%/30%/27% supercycle, shallow correction (−1% in 2029), 17% steady state
      // Implied GM: peak ~70%, trough ~59%, recovery to high-60s
      bull: {
        revGrowth: [ 0.33,  0.30,  0.27, -0.01,  0.17,  0.17,  0.17,  0.17,  0.17,  0.17],
        niMargin:  [ 0.52,  0.53,  0.54,  0.46,  0.47,  0.49,  0.51,  0.52,  0.52,  0.52],
      },
    },
  },
]

export function getTsmModel(slug: string): ModelConfig | undefined {
  return TSM_MODELS.find(m => m.slug === slug)
}
