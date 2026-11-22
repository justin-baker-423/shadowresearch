// ─────────────────────────────────────────────────────────────────
//  anthropic-models.ts  —  Compute-driven "underlying economics" DCF
//  for Anthropic, PBC (ANT). Built from the Stock Analysis project's
//  ANT.md (IPO-week analysis, Nov 2026) and the final prospectus
//  (424B4, filed Nov 19, 2026).
//
//  Thesis in one line: Anthropic reinvests ~70% of revenue in training
//  to build an insurmountable lead, but the business underneath could
//  earn a 30% margin if it optimized for profit — and that is what the
//  stock buys.
//
//  ── The P&L identity (every year, % of revenue) ───────────────────
//    Serving compute (cost of revenue) .... 15.0%   (≈85% gross margin)
//    People, other R&D & SG&A ............. 15.3%
//    Training / R&D compute ............... plug   (sets the margin)
//    Operating profit ..................... target
//
//  Breakeven → training = 69.7% of revenue (ANT.md §5 breakeven
//  identity). A 30% NET margin (≈38.0% operating at 21% tax) → training
//  falls to ≈31.7% of revenue. The gap between the two is the
//  "price of the moat".
//
//  ── Revenue path (ANT.md §6, the supply-feasible base) ────────────
//  $150B in 2027 → $1T in 2036 at an even ~23.5%/yr. Justin's guardrail
//  caps 2036 at ~$1T. Revenue capacity is not modeled as constrained
//  below ~$500B (his second guardrail).
//
//  ── Scenarios = ANT.md §10 valuation cases (net-margin version) ───
//    Bear (A): breakeven 2027–35 (training absorbs everything), 30% net
//              margin in 2036, then 3% growth forever.      ≈ $113 @10%
//    Base (B): 30% net margin every year 2027–36, then 3%.  ≈ $147 @10%
//    Bull (C): 30% net margin every year, +15%/yr revenue in 2037–46,
//              then 3% from 2047 (Justin's 20-yr case).     ≈ $281 @10%
//
//  ── Balance sheet & shares (424B4) ────────────────────────────────
//    9/30/26 cash + ST investments ........ $131.9B
//    + net IPO & private placement ........ $104.8B
//    − RSU tax withholding ................ −$4.3B
//    → Post-IPO net cash .................. ≈ $232B (counted in full —
//                                              no-equity-draw thesis)
//    Fully diluted shares ................. 18.14B (prospectus pro forma:
//      13.22B outstanding incl. 846.8M Initial Public Benefit Issuance;
//      options 1.71B treasury method; RSUs 1.07B; Amazon rollover notes
//      1.55B; Vested Matching Obligation 0.55B; post-9/30 matching 0.03B)
//
//  FCF ≈ net income: compute is contracted and runs through the P&L
//  (9M 2026 capex < $1B). SBC, donation matching and public-benefit
//  spending are treated as real costs inside the opex ratios. The
//  non-cash SAFE/convertible fair-value loss ($94.3B in 9M 2026) is
//  excluded — its dilution already sits in the 18.14B share count.
// ─────────────────────────────────────────────────────────────────

export type AnthropicScenario = "bear" | "base" | "bull"

export interface AnthropicScenarioAssumptions {
  label:           string   // short case name (ANT.md §10 letter)
  breakevenUntil:  number   // last year run at breakeven (0 = never) — margin target applies after
  extGrowth:       number   // revenue growth in the extension stage (decimal)
  extYears:        number   // years of extension growth after 2036 before the terminal (0 = none)
}

export interface AnthropicModelConfig {
  slug:        string
  ticker:      string
  exchange:    string
  name:        string
  sector:      string
  description: string
  lastUpdated: string

  // ── base year & revenue path ($B) ─────────────────────────────
  baseYear:       number   // 2026E (valuation as of Nov 2026)
  baseRevenue:    number   // 2026E revenue
  firstRevenue:   number   // 2027E revenue
  capRevenue:     number   // 2036E revenue (Justin's ~$1T cap)

  // ── P&L ratios (% of revenue) ─────────────────────────────────
  servingRate:    number   // serving compute = cost of revenue
  peopleRate:     number   // people, other R&D, SG&A (incl. SBC)
  netMarginDefault: number // underlying net-margin target
  taxRate:        number
  usdPerGwYear:   number   // $B of compute per GW-year (display conversion)

  // ── balance sheet & valuation ─────────────────────────────────
  netDebt:      number     // $B, negative = net cash
  sharesOut:    number     // billions, fully diluted
  termGrowth:   number
  waccDefault:  number
  hurdle:       number     // Justin's required return
  currentPrice: number     // $ fallback — replaced by live quote at runtime

  scenarios:   Record<AnthropicScenario, AnthropicScenarioAssumptions>
  accentColor?: string
}

const ANTHROPIC_MODEL: AnthropicModelConfig = {
  slug:        "anthropic",
  ticker:      "ANT",
  exchange:    "NASDAQ",
  name:        "Anthropic, PBC",
  sector:      "Frontier AI / Foundation Models",
  description: "Compute-driven \"underlying economics\" DCF · $150B (2027) → $1T (2036) revenue · training is the plug: ~70% of revenue at breakeven vs ~32% at a 30% net margin · $232B net cash · 18.14B fully diluted shares",
  lastUpdated: "November 2026",

  baseYear:     2026,
  baseRevenue:  55,        // 2026E (ANT.md §3: ~$55B)
  firstRevenue: 150,       // 2027E
  capRevenue:   1000,      // 2036E

  servingRate:      0.15,  // 85% gross margin (9M 2026: 85.5%)
  peopleRate:       0.153, // people & SG&A (ANT.md §5 breakeven identity)
  netMarginDefault: 0.30,
  taxRate:          0.21,
  usdPerGwYear:     17.5,  // midpoint of ~$15–20B per GW-year

  netDebt:      -232,      // post-IPO net cash
  sharesOut:    18.14,
  termGrowth:   0.03,
  waccDefault:  0.10,
  hurdle:       0.20,
  currentPrice: 88.91,     // Nov 20, 2026 close

  accentColor:  "#d97757", // Anthropic clay

  scenarios: {
    bear: { label: "A · Breakeven → 30% in 2036", breakevenUntil: 2035, extGrowth: 0,    extYears: 0  },
    base: { label: "B · 30% margin every year",   breakevenUntil: 0,    extGrowth: 0,    extYears: 0  },
    bull: { label: "C · 30% + 15% growth decade", breakevenUntil: 0,    extGrowth: 0.15, extYears: 10 },
  },
}

export const ANTHROPIC_MODELS: AnthropicModelConfig[] = [ANTHROPIC_MODEL]

export function getAnthropicModel(slug: string): AnthropicModelConfig | undefined {
  return ANTHROPIC_MODELS.find(m => m.slug === slug)
}
