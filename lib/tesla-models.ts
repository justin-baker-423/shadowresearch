// ─────────────────────────────────────────────────────────────────
//  tesla-models.ts  —  Multi-segment bull-case DCF for Tesla.
//
//  Engine: "tesla-multi-segment"
//  Six revenue segments: Core Auto, Energy & Services, Cybercab
//  (robotaxi fleet), FSD OEM licensing, FSD Tesla Owners, PVN.
//
//  Revenue and FCF schedules are pre-computed from the Excel model
//  (Tesla_BullCase_DCF.xlsx). The engine discounts those FCFs at the
//  user's chosen WACC and derives the terminal value from the final
//  year FCF at the chosen terminal growth rate.
//
//  Equity bridge mirrors the Excel exactly:
//    Equity = EV  +  terminalNetCash
//  where terminalNetCash is the projected accumulated net cash balance
//  at the end of FY2035 (~$4.26 T) — this is the Excel model's
//  convention, not a standard DCF net-cash-today adjustment.
// ─────────────────────────────────────────────────────────────────

export interface TeslaSegmentRevenue {
  // All values in $B, indexed 0–9 for FY2026–FY2035
  coreAuto:       number[]
  energy:         number[]
  cybercab:       number[]   // robotaxi fleet
  fsdOem:         number[]   // FSD licensing to other OEMs
  fsdTeslaOwners: number[]   // FSD subscription on Tesla fleet
  pvn:            number[]   // Personal Vehicle Network take-rate
}

export interface TeslaModelConfig {
  slug:        string
  ticker:      string
  exchange:    string
  name:        string
  sector:      string
  description: string
  lastUpdated: string

  // ── engine tag ────────────────────────────────────────────────
  engine: "tesla-multi-segment"

  // ── base / anchor ─────────────────────────────────────────────
  baseYear:     number       // FY2025E (last actuals year)
  currency:     "USD"
  currentPrice: number       // fallback; replaced at runtime by Yahoo Finance
  sharesOut:    number       // diluted shares ($B) — constant throughout model
  terminalNetCash: number    // projected accumulated net cash at FY2035 ($B)

  // ── DCF assumptions ───────────────────────────────────────────
  taxRate:      number
  termGrowth:   number       // default terminal FCF growth rate
  waccDefault:  number

  // ── Segment EBIT margins (constant throughout model horizon) ──
  // Used to display consolidated EBIT in the model table.
  // FCF is pre-computed from Excel; EBIT is for informational display.
  ebitMargins: {
    coreAuto:       number   // 8 %
    energy:         number   // 10 %
    cybercab:       number   // ~84 % (revenue − opex − D&A per mile)
    fsdOem:         number   // 82 %
    fsdTeslaOwners: number   // 88 %
    pvn:            number   // 85 % (est.)
  }

  // ── Pre-computed schedules from Excel (10 values, FY2026–2035) ──
  segmentRevenue: TeslaSegmentRevenue
  totalRevenue:   number[]   // consolidated ($B)
  fcfSchedule:    number[]   // free cash flow ($B) — undiscounted

  accentColor?: string
}

// ─────────────────────────────────────────────────────────────────
//  TESLA_MODELS  ← add entries here
// ─────────────────────────────────────────────────────────────────
export const TESLA_MODELS: TeslaModelConfig[] = [
  {
    slug:        "tsla-bull",
    ticker:      "TSLA",
    exchange:    "NASDAQ",
    name:        "Tesla, Inc. — Bull Case",
    sector:      "EV / Autonomy / Energy",
    description: "Cybercab robotaxi ramp · FSD monetisation · PVN · Core Auto steady-state",
    lastUpdated: "March 2026",
    engine:      "tesla-multi-segment",

    baseYear:        2025,
    currency:        "USD",
    currentPrice:    287,    // fallback; replaced at runtime
    sharesOut:       3.200,  // 3.2 B diluted (held constant in model)
    terminalNetCash: 4255,   // $4,255 B accumulated net cash at FY2035 (Excel bridge)

    taxRate:      0.25,
    termGrowth:   0.03,
    waccDefault:  0.10,

    // Source: Tesla_BullCase_DCF.xlsx — Assumptions sheet
    ebitMargins: {
      coreAuto:       0.08,    // Core Automotive EBIT margin
      energy:         0.10,    // Energy & Services EBIT margin
      cybercab:       0.843,   // (1.75 − 0.20 − 0.075) / 1.75 per-mile economics
      fsdOem:         0.82,    // FSD OEM licensing EBIT margin
      fsdTeslaOwners: 0.88,    // FSD Tesla owners subscription EBIT margin
      pvn:            0.85,    // PVN platform take-rate EBIT margin (est.)
    },

    // Source: Tesla_BullCase_DCF.xlsx — Segment P&L and Consolidated DCF sheets
    segmentRevenue: {
      //                        2026    2027    2028    2029    2030
      coreAuto:       [103.79, 111.06, 118.83, 127.15, 136.05,
      //                        2031    2032    2033    2034    2035
                       145.57, 155.76, 166.66, 178.33, 190.81],

      energy:         [ 11.50,  13.23,  15.21,  17.49,  20.11,
                        23.13,  26.60,  30.59,  35.18,  40.46],

      cybercab:       [  0.00,   0.00,  52.50, 183.75, 446.25,
                       787.50,1050.00,1181.25,1181.25,1181.25],

      fsdOem:         [  0.00,   2.25,   6.75,  13.50,  22.50,
                        33.75,  47.25,  63.00,  78.75,  94.50],

      fsdTeslaOwners: [  0.00,   0.96,   2.06,   3.30,   4.71,
                         6.30,   8.09,  10.10,  12.35,  14.87],

      pvn:            [  0.00,   0.00,   0.00,   0.00,   1.56,
                         4.03,   7.52,  12.14,  17.99,  25.20],
    },

    totalRevenue: [115.29, 127.49, 195.35, 345.19, 631.18,
                   1000.29,1295.23,1463.74,1503.85,1547.09],

    // Undiscounted FCF — sourced directly from Excel Consolidated DCF sheet
    fcfSchedule:  [  0.09,  -2.47,  28.42, 107.99, 278.88,
                   519.87, 709.85, 813.67, 830.07, 847.76],

    accentColor: "#cc0000",  // Tesla red
  },
]

export function getTeslaModel(slug: string): TeslaModelConfig | undefined {
  return TESLA_MODELS.find(m => m.slug === slug)
}
