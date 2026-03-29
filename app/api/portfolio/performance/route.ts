import { NextRequest, NextResponse } from 'next/server'
import { computePortfolio }          from '@/lib/portfolio/compute'
import { computePerformanceSeries }  from '@/lib/portfolio/history'
import { loadTransactions }          from '@/lib/portfolio/parse'

// Dynamic because period/start/end come from query params.
// Individual fetch() calls inside computePerformanceSeries use their own revalidate TTLs.
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const period      = searchParams.get('period') ?? '1Y'
  const customStart = searchParams.get('start')
  const customEnd   = searchParams.get('end')

  try {
    const transactions = loadTransactions()

    // We need current holdings to handle the D (intraday) case
    const portfolio = await computePortfolio()
    const currentHoldings = portfolio.holdings.map(h => ({
      ticker:      h.ticker,
      accountFull: h.account === 'IRA' ? 'Schwab IRA' : 'Robinhood',
      shares:      h.shares,
    }))

    const data = await computePerformanceSeries(
      transactions,
      currentHoldings,
      period,
      customStart ? new Date(customStart + 'T00:00:00Z') : undefined,
      customEnd   ? new Date(customEnd   + 'T23:59:59Z') : undefined,
    )

    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/portfolio/performance] error:', err)
    return NextResponse.json(
      { error: 'Failed to compute performance data' },
      { status: 500 },
    )
  }
}
