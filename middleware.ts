import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const token = request.cookies.get('perf_auth')?.value
  const secret = process.env.PERF_SECRET

  if (!token || token !== secret) {
    const loginUrl = new URL('/performance/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/performance'],
}
