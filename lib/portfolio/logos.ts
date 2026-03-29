// Client-safe logo utility — no server-only imports.
// Returns a same-origin proxy URL (/api/logo/[ticker]) so logos work in
// both <img> tags and canvas drawImage() without CORS tainting.

const KNOWN_TICKERS = new Set([
  'TSM', 'META', 'TSLA', 'SNOW', 'DE', 'CELH', 'CVX', 'CMG',
  'LMND', 'COIN', 'TEAM', 'PLTR', 'RIVN', 'QQQ', 'GOOGL',
  'AAPL', 'MSFT', 'AMZN', 'NVDA',
])

export function getLogoUrl(ticker: string): string {
  return KNOWN_TICKERS.has(ticker) ? `/api/logo/${ticker}` : ''
}
