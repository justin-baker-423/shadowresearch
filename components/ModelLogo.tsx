"use client"
import { useState } from "react"

interface Props {
  ticker: string
  accentColor?: string
  size?: number
}

export default function ModelLogo({ ticker, accentColor, size = 24 }: Props) {
  const [failed, setFailed] = useState(false)
  const radius = Math.round(size * 0.2)

  if (!failed) {
    return (
      <img
        src={`/api/logo/${ticker}`}
        alt={ticker}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        style={{ borderRadius: radius, objectFit: "contain", flexShrink: 0 }}
      />
    )
  }
  return (
    <span
      style={{
        width: size, height: size, borderRadius: radius, flexShrink: 0,
        background: accentColor ?? "var(--accent)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: Math.round(size * 0.35), fontWeight: 700, color: "#fff",
      }}
    >
      {ticker.slice(0, 2)}
    </span>
  )
}
