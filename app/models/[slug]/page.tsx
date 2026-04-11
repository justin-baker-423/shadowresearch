import { notFound } from "next/navigation"
import { getModel } from "@/lib/models"
import { getMetaModel, META_MODELS } from "@/lib/meta-models"
import { getTeslaModel, TESLA_MODELS } from "@/lib/tesla-models"
import { getLemonadeModel, LEMONADE_MODELS } from "@/lib/lemonade-models"
import { getDeereModel, DEERE_MODELS } from "@/lib/deere-models"
import { getCelsiusModel, CELSIUS_MODELS } from "@/lib/celsius-models"
import { getAtlassianModel, ATLASSIAN_MODELS } from "@/lib/atlassian-models"
import { getSnowflakeModel, SNOWFLAKE_MODELS } from "@/lib/snowflake-models"
import { getNikeModel, NIKE_MODELS } from "@/lib/nike-models"
import ModelShell from "@/components/ModelShell"
import MetaModelShell from "@/components/MetaModelShell"
import TeslaModelShell from "@/components/TeslaModelShell"
import LemonadeModelShell from "@/components/LemonadeModelShell"
import DeereModelShell from "@/components/DeereModelShell"
import CelsiusModelShell from "@/components/CelsiusModelShell"
import AtlassianModelShell from "@/components/AtlassianModelShell"
import SnowflakeModelShell from "@/components/SnowflakeModelShell"
import NikeModelShell from "@/components/NikeModelShell"

export const revalidate = 300 // refresh prices every 5 minutes

interface Props {
  params: Promise<{ slug: string }>
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
  return [
    ...MODELS.map(m => ({ slug: m.slug })),
    ...META_MODELS.map(m => ({ slug: m.slug })),
    ...TESLA_MODELS.map(m => ({ slug: m.slug })),
    ...LEMONADE_MODELS.map(m => ({ slug: m.slug })),
    ...DEERE_MODELS.map(m => ({ slug: m.slug })),
    ...CELSIUS_MODELS.map(m => ({ slug: m.slug })),
    ...ATLASSIAN_MODELS.map(m => ({ slug: m.slug })),
    ...SNOWFLAKE_MODELS.map(m => ({ slug: m.slug })),
    ...NIKE_MODELS.map(m => ({ slug: m.slug })),
  ]
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params
  const model  = getModel(slug) ?? getMetaModel(slug) ?? getTeslaModel(slug) ?? getLemonadeModel(slug) ?? getDeereModel(slug) ?? getCelsiusModel(slug) ?? getAtlassianModel(slug) ?? getSnowflakeModel(slug) ?? getNikeModel(slug)
  if (!model) return {}
  return {
    title: `${model.ticker} DCF — ${model.name}`,
    description: model.description,
  }
}

export default async function ModelPage({ params }: Props) {
  const { slug } = await params

  // ── Tesla multi-segment models ────────────────────────────────
  const teslaModel = getTeslaModel(slug)
  if (teslaModel) {
    const livePrice = await yahooPrice(teslaModel.ticker)
    const adjusted  = livePrice ? { ...teslaModel, currentPrice: livePrice } : teslaModel
    const priceSource = livePrice ? "Live · NASDAQ" : "Hardcoded"
    return <TeslaModelShell model={adjusted} priceSource={priceSource} />
  }

  // ── Deere Ag Cycle + Mix-Shift models ────────────────────────
  const deereModel = getDeereModel(slug)
  if (deereModel) {
    const livePrice = await yahooPrice(deereModel.ticker)
    const adjusted  = livePrice ? { ...deereModel, currentPrice: livePrice } : deereModel
    const priceSource = livePrice ? "Live · NYSE" : "Hardcoded"
    return <DeereModelShell model={adjusted} priceSource={priceSource} />
  }

  // ── Lemonade IFP-driven models ────────────────────────────────
  const lemonadeModel = getLemonadeModel(slug)
  if (lemonadeModel) {
    const livePrice = await yahooPrice(lemonadeModel.ticker)
    const adjusted  = livePrice ? { ...lemonadeModel, currentPrice: livePrice } : lemonadeModel
    const priceSource = livePrice ? "Live · NYSE" : "Hardcoded"
    return <LemonadeModelShell model={adjusted} priceSource={priceSource} />
  }

  // ── Capex-Adjusted NOPAT models (Meta engine) ─────────────────
  const metaModel = getMetaModel(slug)
  if (metaModel) {
    const livePrice = await yahooPrice(metaModel.ticker)
    const adjusted  = livePrice ? { ...metaModel, currentPrice: livePrice } : metaModel
    const priceSource = livePrice ? "Live · NASDAQ" : "Hardcoded"
    return <MetaModelShell model={adjusted} priceSource={priceSource} />
  }

  // ── Celsius Holdings (standard engine, custom shell) ──────────
  const celsiusModel = getCelsiusModel(slug)
  if (celsiusModel) {
    const livePrice = await yahooPrice(celsiusModel.ticker)
    const adjusted  = livePrice ? { ...celsiusModel, currentPrice: livePrice } : celsiusModel
    const priceSource = livePrice ? "Live · NASDAQ" : "Hardcoded"
    return <CelsiusModelShell model={adjusted} priceSource={priceSource} />
  }

  // ── Atlassian R&D Capitalisation models ──────────────────────
  const atlassianModel = getAtlassianModel(slug)
  if (atlassianModel) {
    const livePrice = await yahooPrice(atlassianModel.ticker)
    const adjusted  = livePrice ? { ...atlassianModel, currentPrice: livePrice } : atlassianModel
    const priceSource = livePrice ? "Live · NASDAQ" : "Hardcoded"
    return <AtlassianModelShell model={adjusted} priceSource={priceSource} />
  }

  // ── Snowflake Consumption-model FCF DCF ───────────────────────
  const snowflakeModel = getSnowflakeModel(slug)
  if (snowflakeModel) {
    const livePrice = await yahooPrice(snowflakeModel.ticker)
    const adjusted  = livePrice ? { ...snowflakeModel, currentPrice: livePrice } : snowflakeModel
    const priceSource = livePrice ? "Live · NYSE" : "Hardcoded"
    return <SnowflakeModelShell model={adjusted} priceSource={priceSource} />
  }

  // ── Nike Two-Segment DCF ──────────────────────────────────────
  const nikeModel = getNikeModel(slug)
  if (nikeModel) {
    const livePrice = await yahooPrice(nikeModel.ticker)
    const adjusted  = livePrice ? { ...nikeModel, currentPrice: livePrice } : nikeModel
    const priceSource = livePrice ? "Live · NYSE" : "Hardcoded"
    return <NikeModelShell model={adjusted} priceSource={priceSource} />
  }

  // ── Standard earnings-based models (SAP / Chipotle engine) ────
  const model = getModel(slug)
  if (!model) notFound()

  const livePrice = await yahooPrice(model.ticker)
  let adjustedModel = { ...model }
  let priceSource = "Hardcoded"

  if (model.currency === "EUR") {
    const eurUsd = await yahooPrice("EURUSD=X")
    const fx = eurUsd ?? 1.08
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
