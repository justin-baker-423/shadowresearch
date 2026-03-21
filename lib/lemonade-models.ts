// ─────────────────────────────────────────────────────────────────
//  lemonade-models.ts  —  IFP-driven DCF for Lemonade, Inc.
//
//  Engine: "lemonade-ifp"
//  This is an insurance-specific model driven by In-Force Premium
//  (IFP) growth rather than traditional revenue.  Key metrics:
//    · IFP (annualised premiums across active policies)
//    · Net Earned Premium (NEP) = IFP × (1 − cession) × 0.92
//    · Gross Loss Ratio step-down 68 % → 63.5 % over 10 years
//    · Cession rate step-down 20 % → 0 % over 10 years
//    · OpEx growth 5 %/yr years 1–5, 1.5 % years 6–10
//    · GC synthetic commission on financed IFP
//    · NOPAT = EBIT × (1−tax) for profitable years; full loss when negative
//    · Dilution schedule: +1.5 %/yr yrs 1–3, +0.5 % yrs 4–5, flat yrs 6–10
//
//  All schedules are pre-computed from Lemonade_DCF_Model.xlsx.
//  The engine discounts stored FCFs at the user's chosen WACC and
//  derives terminal value from the final year FCF.  The GC quasi-debt
//  obligation (gcObligationB) is subtracted from equity in the bridge.
//
//  All monetary values in $B for consistency with the rest of the site.
// ─────────────────────────────────────────────────────────────────

export interface LemonadeModelConfig {
  slug:        string
  ticker:      string
  exchange:    string
  name:        string
  sector:      string
  description: string
  lastUpdated: string

  // ── engine tag ────────────────────────────────────────────────
  engine: "lemonade-ifp"

  // ── base year ─────────────────────────────────────────────────
  baseYear:    number        // FY2025E
  baseIfp:     number        // FY2025 IFP ($B)
  currency:    "USD"
  currentPrice: number       // fallback; replaced at runtime
  sharesOut:   number        // base diluted shares ($B)
  netCash:     number        // net cash at FY2025 ($B)

  // ── DCF assumptions ───────────────────────────────────────────
  taxRate:          number
  termGrowth:       number   // default terminal IFP / FCF growth rate
  waccDefault:      number

  // ── Loss ratio slider ─────────────────────────────────────────
  lossRatioDefault:  number  // starting gross loss ratio (e.g. 0.68)
  lossRatioStepDown: number  // annual improvement in loss ratio (e.g. 0.005 = 0.5pp/yr)
  daAddback:         number  // D&A add-back to convert NOPAT → FCF ($B, e.g. 0.010)

  // ── General Catalyst quasi-debt obligation ────────────────────
  // PV of GC obligations not already captured in the EBIT schedules
  // (e.g. committed facility balance, profit-share buyout, termination fee).
  // The GC synthetic commissions are already in ebitSchedule; this field
  // captures any additional balance-sheet liability to be deducted from equity.
  // Set to 0 until verified against current Lemonade filings.
  gcObligationB: number

  // ── Pre-computed P&L schedules (10 values, FY2026–FY2035, $B) ─
  ifpSchedule:              number[]  // In-Force Premium
  nepSchedule:              number[]  // Net Earned Premium
  lossAndLaeSchedule:       number[]  // Net Loss & LAE = NEP × loss ratio
  gcCommissionSchedule:     number[]  // GC synthetic commission on financed IFP
  opexSchedule:             number[]  // Operating expenses (SG&A + tech)
  investmentIncomeSchedule: number[]  // Investment income on cash / float (residual)
  ebitSchedule:             number[]  // EBIT (ties to sum of above)
  nopatSchedule:            number[]  // NOPAT — no DTA benefit on yr-1 loss
  fcfSchedule:              number[]  // FCF (NOPAT + ~$10 mm D&A add-back)
  sharesSchedule:           number[]  // Diluted shares ($B)

  // ── Balance sheet ─────────────────────────────────────────────
  // Stockholders' equity at FY base year-end ($B).
  // Book equity builds year-over-year as: prior equity + NOPAT (net income proxy).
  // Excludes SBC add-back and share-issuance proceeds for simplicity.
  // Verify against Lemonade's most recent 10-K balance sheet.
  baseBookEquity: number

  accentColor?: string
}

// ─────────────────────────────────────────────────────────────────
//  LEMONADE_MODELS  ← add entries here
// ─────────────────────────────────────────────────────────────────
export const LEMONADE_MODELS: LemonadeModelConfig[] = [
  {
    slug:        "lmnd",
    ticker:      "LMND",
    exchange:    "NYSE",
    name:        "Lemonade, Inc.",
    sector:      "InsureTech",
    description: "IFP growth · cession step-down · loss ratio improvement · path to underwriting profitability",
    lastUpdated: "March 2026",
    engine:      "lemonade-ifp",

    baseYear:    2025,
    baseIfp:     1.210,       // FY2025E IFP $1,210 mm = $1.21 B
    currency:    "USD",
    currentPrice: 38.00,      // fallback; replaced at runtime
    sharesOut:   0.0740,      // 74 mm = 0.074 B
    netCash:     1.050,       // $1,050 mm = $1.05 B net cash at FY2025

    taxRate:           0.25,
    termGrowth:        0.030,  // terminal IFP / FCF growth rate
    waccDefault:       0.10,

    lossRatioDefault:  0.680,  // 68.0% starting gross loss ratio (FY2026)
    lossRatioStepDown: 0.005,  // 0.5pp/yr improvement over 10 years
    daAddback:         0.010,  // ~$10mm D&A add-back (software intangibles)

    // General Catalyst quasi-debt: set from current Lemonade filings.
    // GC synthetic commissions are already reflected in ebitSchedule below;
    // this field captures any additional balance-sheet obligation (e.g.
    // committed facility balance, profit-participation buyout, etc.).
    gcObligationB: 0.000,

    // ── P&L schedules sourced from Lemonade_DCF_Model.xlsx ───────
    //                                2026      2027      2028      2029      2030
    ifpSchedule:              [1.54275, 1.96701, 2.50793, 3.19761, 4.07696,
    //                                2031      2032      2033      2034      2035
                               4.79043, 5.62875, 6.61378, 7.77119, 9.13115],

    nepSchedule:              [1.16385, 1.52010, 1.98428, 2.58879, 3.37572,
                               4.05462, 4.86774, 5.84129, 7.00651, 8.40066],

    // Net Loss & LAE = NEP × loss ratio (68.0 % → 63.5 %, –0.5 pp/yr)
    // In quota-share reinsurance, net loss ratio = gross loss ratio
    lossAndLaeSchedule:       [0.79142, 1.02607, 1.32947, 1.72154, 2.22798,
                               2.65577, 3.16403, 3.76763, 4.48417, 5.33442],

    // GC synthetic commission: 16 % on financed IFP
    //   yrs 1–3: 50 % of new IFP financed → yrs 4–6: 25 % → yrs 7–10: 0 %
    gcCommissionSchedule:     [0.02662, 0.03394, 0.04327, 0.02759, 0.03517,
                               0.02854, 0.00000, 0.00000, 0.00000, 0.00000],

    // Operating expenses (SG&A + tech): base $415 mm, +5 %/yr yrs 1–5, +1.5 %/yr yrs 6–10
    opexSchedule:             [0.43575, 0.45754, 0.48041, 0.50443, 0.52966,
                               0.53760, 0.54567, 0.55385, 0.56216, 0.57059],

    // Investment income on cash / float — residual to reconcile to EBIT.
    // Grows from ~$23 mm (FY2026) to ~$199 mm (FY2035) as the cash balance
    // compounds; consistent with ~2–3 % yield on accumulated float.
    investmentIncomeSchedule: [0.02282, 0.03355, 0.04715, 0.06439, 0.08616,
                               0.10278, 0.12202, 0.14420, 0.16975, 0.19912],

    // EBIT = NEP − L&LAE − GC Commission − OpEx + Investment Income
    // Negative in FY2026 (underwriting loss + opex drag)
    ebitSchedule:             [-0.06712,  0.03610, 0.17828, 0.39962, 0.66907,
                                0.93549,  1.28006, 1.66401, 2.12993, 2.69477],

    // NOPAT — full loss recognised in FY2026 (no deferred tax asset);
    // positive years = EBIT × (1 − 25 % tax)
    nopatSchedule:            [-0.06712,  0.02708, 0.13371, 0.29971, 0.50180,
                                0.70162,  0.96005, 1.24800, 1.59745, 2.02108],

    // FCF — NOPAT + ~$10 mm D&A add-back (software intangibles)
    fcfSchedule:              [-0.05702,  0.03727, 0.14399, 0.31007, 0.51223,
                                0.71210,  0.97057, 1.25856, 1.60803, 2.03167],

    // Diluted shares ($B): +1.5 %/yr yrs 1–3, +0.5 %/yr yrs 4–5, flat yrs 6–10
    sharesSchedule:           [0.07511, 0.07624, 0.07738, 0.07777, 0.07816,
                               0.07816, 0.07816, 0.07816, 0.07816, 0.07816],

    // FY2025 stockholders' equity from Q4 2025 balance sheet: $533 mm.
    baseBookEquity: 0.533,

    accentColor: "#ff6b35",   // Lemonade pink-orange
  },
]

export function getLemonadeModel(slug: string): LemonadeModelConfig | undefined {
  return LEMONADE_MODELS.find(m => m.slug === slug)
}
