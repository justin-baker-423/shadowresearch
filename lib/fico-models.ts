// ─────────────────────────────────────────────────────────────────
//  fico-models.ts  —  Two-segment SOTP model for Fair Isaac (FICO)
//
//  Segments:
//    Scores   — near-monopoly royalty stream; pricing drives revenue;
//               costs are essentially fixed → margin expands every year
//    Software — cloud platform SaaS; intentionally-depressed margin
//               today expanding to SaaS benchmarks over model period
//
//  Integrated FCF (per-year):
//    EBIT         = ScoresOpIncome + SoftwareOpIncome − CorpG&A
//    PreTaxIncome = EBIT − InterestExpense
//    NetIncome    = PreTaxIncome × (1 − taxRate)
//    FCF          = NetIncome + D&A + SBC − Capex
//
//  Net buybacks (net of SBC dilution):
//    BuybackCapacity = FCF − SBC   [SBC add-back in FCF ≠ cash retained]
//    SharesRetiredNet = BuybackCapacity / buybackPrice
//
//  SOTP valuations:
//    Scores standalone EV   = Σ PV(ScoresOpIncome × (1−tax)) + PV(TV)
//    Software standalone EV = Σ PV(SoftwareOpIncome × (1−tax)) + PV(TV)
//    Corporate items        = Total Integrated EV − Scores EV − Software EV
//
//  Calibration (Year 0 → ~$889M ≈ $900M):
//    Scores:   ($1.08B − $0.10B) × 0.77 = $754M post-tax
//    Software: $0.78B × 27% × 0.77     = $162M post-tax
//    G&A+Int:  ($0.09B + $0.168B) × 0.77 = $198M drag
//    D&A+SBC−Capex: $0.063B + $0.175B − $0.067B = +$171M
//    Total: $754 + $162 − $198 + $171 = $889M ✓
// ─────────────────────────────────────────────────────────────────

export type FicoScenario = "bear" | "base" | "bull"

export interface FicoScenarioConfig {
  description:             string
  scoresPriceGrowth:       number   // annual Scores revenue CAGR (pricing-driven)
  softwareGrowth:          number   // annual Software revenue CAGR (ARR-driven)
  softwareMarginTarget:    number   // Software op margin at end of model period
}

export interface FicoModelConfig {
  slug:         string
  ticker:       string
  name:         string
  exchange:     string
  sector:       string
  description:  string
  lastUpdated:  string

  currentPrice: number   // fallback; overridden by live fetch
  sharesOut:    number   // billions diluted (0.0232 = 23.2M)
  netDebt:      number   // $B positive = net debt

  // ── Scores segment ─────────────────────────────────────────
  scoresBaseRev:        number   // $B FY2025A estimate
  scoresFixedCosts:     number   // $B starting — grows at scoresFixedCostGrowth
  scoresFixedCostGrowth: number  // 2%/yr — algorithm R&D, small headcount, legal

  // ── Software segment ───────────────────────────────────────
  softwareBaseRev:      number   // $B FY2025A estimate
  softwareMarginStart:  number   // operating margin today (~27%, intentionally depressed)

  // ── Corporate & financing (annual, growing/fixed) ──────────
  corpGandABase:     number   // $B starting G&A (grows at corpGrowthRate)
  corpGrowthRate:    number   // 3%/yr — GDP-like
  interestExpense:   number   // $B fixed (~$168M on $3.37B debt × ~5%)
  dnaAnnual:         number   // $B D&A add-back (fixed ~$63M)
  capexAnnual:       number   // $B capex (fixed ~$67M)
  sbcAnnual:         number   // $B SBC — added back in FCF but creates new shares
  sbcGrowthRate:     number   // 3%/yr — tracks headcount/compensation growth
  taxRate:           number   // 23% effective

  waccDefault:  number
  termGrowth:   number
  accentColor:  string

  scenarios: {
    bear: FicoScenarioConfig
    base: FicoScenarioConfig
    bull: FicoScenarioConfig
  }
}

const FICO_MODEL: FicoModelConfig = {
  slug:        "fico",
  ticker:      "FICO",
  name:        "Fair Isaac Corporation",
  exchange:    "NYSE",
  sector:      "Financial Technology · Credit Analytics",
  description: "Scores pricing moat · fixed-cost leverage → expanding margin · Software SaaS transition · buyback cannibal",
  lastUpdated: "May 2026",

  currentPrice: 1180.00,
  sharesOut:    0.0232,    // 23.2M diluted shares (Q2 FY2026)
  netDebt:      3.37,      // $3.37B net debt (Q2 FY2026)

  // Scores — FY2025A: ~$1.08B revenue, ~$831M segment op income → 84% margin
  scoresBaseRev:         1.080,
  scoresFixedCosts:      0.100,    // $100M: algorithm R&D + small headcount + legal
  scoresFixedCostGrowth: 0.02,     // fixed costs grow at 2%/yr

  // Software — FY2025A: ~$0.78B revenue, ~27% segment operating margin
  softwareBaseRev:      0.780,
  softwareMarginStart:  0.27,      // 27% today — intentional investment phase

  // Corporate & financing
  corpGandABase:    0.090,    // $90M unallocated G&A (grows 3%/yr)
  corpGrowthRate:   0.03,
  interestExpense:  0.168,    // $168M on $3.37B × ~5% — fixed
  dnaAnnual:        0.063,    // $63M D&A add-back — fixed
  capexAnnual:      0.067,    // $67M capex — fixed
  sbcAnnual:        0.175,    // $175M SBC — grows 3%/yr with headcount
  sbcGrowthRate:    0.03,
  taxRate:          0.23,

  waccDefault:  0.10,
  termGrowth:   0.03,
  accentColor:  "#0052cc",  // FICO blue

  scenarios: {
    bear: {
      description:          "VantageScore traction · mortgage volumes stay depressed · Software migration slows",
      scoresPriceGrowth:    0.08,
      softwareGrowth:       0.07,
      softwareMarginTarget: 0.32,  // recovery stalls at 32%
    },
    base: {
      description:          "Scores pricing ~12% · MDLP funding fees emerging · Falcon cross-sell scaling",
      scoresPriceGrowth:    0.12,
      softwareGrowth:       0.10,
      softwareMarginTarget: 0.40,  // converges to ~40% SaaS margin
    },
    bull: {
      description:          "Scores pricing 15%+ · MDLP ramp accelerates · Software hits SaaS benchmarks",
      scoresPriceGrowth:    0.15,
      softwareGrowth:       0.14,
      softwareMarginTarget: 0.45,  // SaaS industry benchmark
    },
  },
}

export const FICO_MODELS: FicoModelConfig[] = [FICO_MODEL]

export function getFicoModel(slug: string): FicoModelConfig | undefined {
  return FICO_MODELS.find(m => m.slug === slug)
}
