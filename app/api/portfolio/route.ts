import { NextResponse } from 'next/server'
import { computePortfolio } from '@/lib/portfolio/compute'

// Recompute every 15 minutes so prices stay fresh.
// Next.js invalidates this automatically on every new deployment,
// so adding transactions + redeploying always returns fresh data immediately.
export const revalidate = 900

export async function GET() {
  try {
    const data = await computePortfolio()
    return NextResponse.json(data)
  } catch (err) {
    console.error('[/api/portfolio] computation error:', err)
    return NextResponse.json(
      { error: 'Failed to compute portfolio data' },
      { status: 500 },
    )
  }
}
