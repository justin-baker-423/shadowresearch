// ─────────────────────────────────────────────────────────────────
//  nike-models.ts  —  Model configurations for Nike Inc. (NKE)
//
//  All revenue and cost schedules are pre-computed for 10 years
//  (FY2026–FY2035). Fiscal year ends May 31.
//
//  Key structural assumptions embedded in ALL scenarios:
//    • Tariff headwind (~$1.5B) treated as permanent → structural GM impairment
//    • Wholesale mix shift back from DTC treated as permanent → ~-100bps GM
//    • Demand creation reinvestment treated as permanent → SG&A base elevated
//    • Restructuring/severance charges excluded from all forward years
//
//  Revenue segments:
//    • Ex-China: NA + EMEA + APLA + Converse
//    • China: Greater China geography only
//
//  Win Now actions (portfolio reset of AF1/AJ1/Dunk):
//    • Complete by end of CY2026 = Nike Q2 FY2027 (Nov 2026)
//    • 5-point revenue headwind reverses in H2 FY2027
//    • China cleanup separate — drags through all of FY2027
//
//  FCF bridge: NOPAT (EBIT × 81%) + D&A − CapEx ± Working Capital
//  Tax rate: 19% across all scenarios
//
//  Capital return:
//    • Dividends: 2%/yr growth through FY2028, then scenario-dependent
//    • Buybacks: residual FCF after dividends, at pre-set price path
//    • Buyback price path is illustrative — noted in assumptions
// ─────────────────────────────────────────────────────────────────

export interface NikeScenarioConfig {
  description: string

  // Revenue by segment ($B) — FY2026 through FY2035
  exChinaRev:   number[]   // 10 values: ex-China (NA + EMEA + APLA + Converse)
  chinaRev:     number[]   // 10 values: Greater China

  // Margins and costs
  grossMargin:  number[]   // 10 values: fraction
  sga:          number[]   // 10 values: $B (ex-restructuring)

  // FCF bridge components
  dna:          number[]   // 10 values: $B D&A
  capex:        number[]   // 10 values: $B capital expenditure
  wcDelta:      number[]   // 10 values: $B working capital change (+ = cash source)

  // Capital return
  dps:          number[]   // 10 values: annual dividend per share ($)
  buybackPrice: number[]   // 10 values: assumed price for share retirement ($)
}

export interface NikeModelConfig {
  slug:         string
  ticker:       string
  name:         string
  exchange:     string
  sector:       string
  description:  string
  lastUpdated:  string

  currentPrice: number    // fallback; overridden by live fetch
  sharesOut:    number    // billions (diluted, current)
  netCash:      number    // billions (negative = net debt)
  taxRate:      number    // fraction

  waccDefault:  number
  termGrowth:   number
  accentColor:  string

  scenarios: {
    bear: NikeScenarioConfig
    base: NikeScenarioConfig
    bull: NikeScenarioConfig
  }
}

// ── Helper ──────────────────────────────────────────────────────────
function yr(start: number, ...rest: number[]): number[] {
  // Returns exactly 10 values; fills trailing slots with last value if short
  const arr = [start, ...rest]
  while (arr.length < 10) arr.push(arr[arr.length - 1])
  return arr.slice(0, 10)
}

// ── Nike DCF Model ───────────────────────────────────────────────────
const NKE: NikeModelConfig = {
  slug:        "nke",
  ticker:      "NKE",
  name:        "Nike Inc.",
  exchange:    "NYSE",
  sector:      "Consumer Discretionary · Sportswear",
  description: "Win Now turnaround · portfolio reset · segment recovery · capital return",
  lastUpdated: "April 2026",

  currentPrice: 60.00,
  sharesOut:    1.480,    // ~1,480M diluted shares as of Q3 FY2026
  netCash:     -1.5,      // ~$1.5B net debt (cash $7.3B − debt $8.8B)
  taxRate:      0.19,

  waccDefault:  0.09,
  termGrowth:   0.025,
  accentColor:  "#111111",  // Nike black

  scenarios: {

    // ──────────────────────────────────────────────────────────────
    // BEAR: Tariff escalation, China structural impairment,
    //       ex-China organic growth only 3%/yr post-Win Now
    // ──────────────────────────────────────────────────────────────
    bear: {
      description: "Tariff escalation to ~$2B annual cost · China structural impairment · ex-China +3%/yr · GM stuck at 41%",

      // Ex-China: Win Now partially completes (limited 5pt benefit) →
      //   FY2027 only +1.5% (partial), FY2028+ organic 3%/yr
      exChinaRev: yr(40.4, 41.0, 42.2, 43.5, 44.8, 46.1, 47.5, 48.9, 50.4, 51.9),

      // China: Deeper cleanup, stabilizes mid-FY2028 at depressed base,
      //   slow ramp from 0% to 5% over 4 years
      chinaRev:   yr(5.8, 4.9, 4.8, 4.8, 5.0, 5.2, 5.5, 5.7, 6.0, 6.3),

      // GM: Tariff escalation adds ~100bps vs base; liquidation clears but
      //   structural tariff + mix keeps GM at 41%
      grossMargin: yr(0.400, 0.405, 0.410, 0.410, 0.410, 0.410, 0.410, 0.410, 0.410, 0.410),

      // SG&A: Cost discipline given weak top-line; 2%/yr growth
      sga: yr(16.0, 16.2, 16.5, 16.8, 17.1, 17.5, 17.8, 18.2, 18.5, 18.9),

      // D&A: Infrastructure-light; modest growth with capex
      dna: yr(0.60, 0.60, 0.61, 0.62, 0.63, 0.65, 0.66, 0.68, 0.70, 0.71),

      // CapEx: Stays lean — no expansion confidence
      capex: yr(0.65, 0.68, 0.72, 0.74, 0.77, 0.80, 0.83, 0.86, 0.89, 0.93),

      // Working capital: Inventory tailwind FY26-27 (still liquidating);
      //   modest drag after (smaller growth base)
      wcDelta: yr(0.35, 0.15, -0.10, -0.15, -0.15, -0.20, -0.20, -0.20, -0.20, -0.20),

      // Dividends: 2%/yr growth throughout (no acceleration; FCF tight)
      //   FY26: $1.64 → FY27: $1.67 → ... → FY35: $1.95
      dps: yr(1.64, 1.67, 1.70, 1.74, 1.77, 1.81, 1.84, 1.88, 1.92, 1.95),

      // Buyback price: Low price environment given weak results
      buybackPrice: yr(55, 58, 60, 62, 64, 66, 68, 70, 72, 74),
    },

    // ──────────────────────────────────────────────────────────────
    // BASE: Win Now complete CY2026 (5pt revenue recovery H2 FY2027),
    //       China stabilizes end FY2027, ex-China +5%/yr,
    //       structural GM settles at 42.5%
    // ──────────────────────────────────────────────────────────────
    base: {
      description: "Win Now complete end CY2026 · China stable by FY2027 end · ex-China +5%/yr · GM normalizes to 42.5%",

      // Ex-China: FY2026 still has Win Now drag; FY2027 gets 5pt recovery in H2
      //   (+5% blended FY2027 vs FY2026); then organic 5%/yr thereafter
      exChinaRev: yr(40.4, 42.4, 44.5, 46.7, 49.1, 51.6, 54.2, 56.9, 59.7, 62.7),

      // China: FY2026 down 15% (Q4 guided -20%), FY2027 down ~10% full year,
      //   stabilizes at end FY2027 (0% in FY2028), ramps 0→10% over 4 yrs
      chinaRev:   yr(5.8, 5.2, 5.2, 5.4, 5.7, 6.3, 6.9, 7.6, 8.4, 9.2),

      // GM path: FY2026 trough (liquidation + tariffs + China -20%),
      //   FY2027 improving (Win Now clearing H2), FY2028 first clean year,
      //   FY2029+ at structural ceiling 42.5% (tariff + mix permanent)
      grossMargin: yr(0.408, 0.415, 0.420, 0.425, 0.425, 0.425, 0.425, 0.425, 0.425, 0.425),

      // SG&A: $16.0B base growing 3%/yr (demand creation reinvestment)
      sga: yr(16.0, 16.5, 17.0, 17.5, 18.0, 18.5, 19.1, 19.7, 20.3, 20.9),

      dna: yr(0.60, 0.60, 0.62, 0.63, 0.65, 0.67, 0.68, 0.70, 0.72, 0.74),

      // CapEx: Lean through FY2027, normalizes to $800M in FY2028, +4%/yr
      capex: yr(0.65, 0.70, 0.80, 0.83, 0.86, 0.90, 0.94, 0.97, 1.01, 1.05),

      // WC: Inventory drawdown = cash source through China stabilization (FY2027);
      //   reverses in FY2028 as restock begins for growing revenue
      wcDelta: yr(0.40, 0.20, -0.20, -0.30, -0.30, -0.30, -0.35, -0.35, -0.35, -0.35),

      // Dividends: 2%/yr through FY2028, then 10%/yr (per model assumption)
      //   FY26: $1.64 → FY27: $1.67 → FY28: $1.70 → FY29: $1.87 → FY35: $3.31
      dps: yr(1.64, 1.67, 1.70, 1.87, 2.06, 2.26, 2.49, 2.74, 3.01, 3.31),

      // Buyback price: Modest recovery in line with fundamentals
      buybackPrice: yr(60, 63, 67, 72, 77, 83, 89, 96, 103, 111),
    },

    // ──────────────────────────────────────────────────────────────
    // BULL: Tariff partial relief (+100bps GM vs base), China surprise
    //       recovery, ex-China +7%/yr, GM expands to 43.5%
    // ──────────────────────────────────────────────────────────────
    bull: {
      description: "Tariff relief → GM 43.5% · China faster recovery (+10%/yr) · ex-China +7%/yr · DTC premium re-emerges",

      // Ex-China: Bigger Win Now rebound (+7.5% FY2027), then 7%/yr
      exChinaRev: yr(40.4, 43.4, 46.4, 49.7, 53.1, 56.8, 60.8, 65.1, 69.7, 74.6),

      // China: Less severe cleanup (macro/competitive improves);
      //   stabilizes in H1 FY2028 and ramps 10%/yr from FY2029
      chinaRev:   yr(5.8, 5.5, 5.8, 6.4, 7.0, 7.7, 8.5, 9.4, 10.3, 11.3),

      // GM: Tariff relief (+100bps), better DTC mix as NIKE Direct
      //   re-emerges as premium channel; settles at 43.5%
      grossMargin: yr(0.410, 0.420, 0.430, 0.435, 0.435, 0.435, 0.435, 0.435, 0.435, 0.435),

      // SG&A: Higher demand creation investment at 4.5%/yr growth
      sga: yr(16.0, 16.7, 17.5, 18.3, 19.1, 20.0, 20.9, 21.8, 22.8, 23.8),

      dna: yr(0.60, 0.61, 0.63, 0.65, 0.67, 0.69, 0.71, 0.73, 0.75, 0.77),

      // CapEx: Higher investment to support 7%+ growth — new stores, supply chain
      capex: yr(0.68, 0.75, 0.85, 0.90, 0.95, 1.00, 1.05, 1.10, 1.15, 1.20),

      // WC: Larger inventory restock needed to support faster growth
      wcDelta: yr(0.40, 0.25, -0.25, -0.40, -0.40, -0.40, -0.45, -0.45, -0.45, -0.45),

      // Dividends: Same 2% then 10% schedule — committed to streak
      dps: yr(1.64, 1.67, 1.70, 1.87, 2.06, 2.26, 2.49, 2.74, 3.01, 3.31),

      // Buyback price: Strong re-rating as turnaround plays out
      buybackPrice: yr(62, 68, 76, 85, 94, 104, 115, 127, 140, 154),
    },
  },
}

export const NIKE_MODELS: NikeModelConfig[] = [NKE]

export function getNikeModel(slug: string): NikeModelConfig | undefined {
  return NIKE_MODELS.find(m => m.slug === slug)
}
