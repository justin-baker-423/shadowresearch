"use client"
import Link from "next/link"
import { useState } from "react"
import { usePathname } from "next/navigation"
import type { ModelConfig } from "@/lib/models"

export default function Sidebar({ models }: { models: ModelConfig[] }) {
  const pathname = usePathname()
  const [modelsOpen, setModelsOpen] = useState(false)

  const perfActive = pathname.startsWith('/performance') && !pathname.startsWith('/performance/login')

  return (
    <nav className="sidebar">
      <Link href="/" className="sidebar-logo">
        Shadow <span>Research</span>
      </Link>

      <Link
        href="/performance"
        className={`sidebar-section-link ${perfActive ? 'sidebar-section-active' : ''}`}
      >
        Performance
      </Link>

      <button
        className="sidebar-section-toggle"
        onClick={() => setModelsOpen(o => !o)}
      >
        <span>Models</span>
        <span className="sidebar-toggle-icon">{modelsOpen ? '▾' : '▸'}</span>
      </button>

      {modelsOpen && models.map(m => {
        const href = `/models/${m.slug}`
        const active = pathname === href || pathname.startsWith(href + "/")
        return (
          <Link
            key={m.slug}
            href={href}
            className={`sidebar-item ${active ? "active" : ""}`}
            style={active ? { borderLeftColor: m.accentColor ?? "var(--accent)" } : {}}
          >
            <span
              className="sidebar-item-ticker"
              style={active ? { color: m.accentColor ?? "var(--accent)" } : {}}
            >
              {m.ticker}
            </span>
            <span className="sidebar-item-name">{m.name}</span>
            <span className="sidebar-item-sector">{m.sector}</span>
          </Link>
        )
      })}

      <div className="sidebar-footer">
        For informational purposes only.<br />
        Not investment advice.
      </div>
    </nav>
  )
}
