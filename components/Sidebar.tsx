"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ModelConfig } from "@/lib/models"

export default function Sidebar({ models }: { models: ModelConfig[] }) {
  const pathname = usePathname()

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        DCF <span>Research</span>
      </div>

      <div className="sidebar-section-label">Models</div>

      {models.map(m => {
        const href   = `/models/${m.slug}`
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
