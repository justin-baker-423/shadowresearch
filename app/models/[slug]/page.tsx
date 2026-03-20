import { notFound } from "next/navigation"
import { getModel } from "@/lib/models"
import ModelShell from "@/components/ModelShell"

export const revalidate = 300 // refresh prices every 5 minutes

interface Props {
  params: { slug: string }
}

async function yahooPrice(ticker: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        next: { revalidate: 300 },
      }
    )
    if (!res.ok) return null
    const json = await res.json()
    const price = json?.chart?.result?.[0]?.meta?.regularMarketPrice
    return typeof price === "number" ? price : null
  } catch {
    return null
  }
}

export async function generateStaticParams() {
  const { MODELS } = await import("@/lib/models")
  return MODELS.map(m => ({ slug: m.slug }))
}

export async function generateMetadata({ params }: Props) {
  const model = getModel(params.slug)
  if (!model) return {}
  return {
    title: `${model.ticker} DCF — ${model.name}`,
    description: model.description,
  }
}

export default async function ModelPage({ params }: Props) {
  const model = getModel(params.slug)
  if (!model) notFound()

  // Fetch live NYSE price in USD
  const livePrice = await yahooPrice(model.ticker)

  // If model financials are in EUR, fetch EUR→USD FX rate and convert everything
  let adjustedModel = { ...model }
  let priceSource = "Hardcoded"

  if (model.currency === "EUR") {
    const eurUsd = await yahooPrice("EURUSD=X")
    const fx = eurUsd ?? 1.08 // fallback rate if fetch fails
    adjustedModel = {
      ...model,
      currency:     "USD",
      currentPrice: livePrice ?? parseFloat((model.currentPrice * fx).toFixed(2)),
      baseRevenue:  parseFloat((model.baseRevenue * fx).toFixed(1)),
      netCash:      parseFloat((model.netCash * fx).toFixed(2)),
    }
    priceSource = livePrice ? "Live · NYSE" : `Estimated (EUR×${fx.toFixed(2)})`
  } else {
    if (livePrice) {
      adjustedModel = { ...model, currentPrice: livePrice }
    }
    priceSource = livePrice ? "Live · NYSE" : "Hardcoded"
  }

  return <ModelShell model={adjustedModel} priceSource={priceSource} />
}
