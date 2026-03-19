import { notFound } from "next/navigation"
import { getModel } from "@/lib/models"
import ModelShell from "@/components/ModelShell"

interface Props {
  params: { slug: string }
}

// Tell Next.js which slugs exist at build time
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

export default function ModelPage({ params }: Props) {
  const model = getModel(params.slug)
  if (!model) notFound()
  return <ModelShell model={model} />
}
