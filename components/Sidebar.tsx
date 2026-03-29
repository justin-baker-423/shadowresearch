"use client"
import Link from "next/link"
import { useState } from "react"
import { usePathname } from "next/navigation"
type SidebarEntry = { slug: string; ticker: string; name: string; sector: string; accentColor?: string }

function TickerLogo({ ticker, accentColor }: { ticker: string; accentColor?: string }) {
  const [failed, setFailed] = useState(false)
  if (!failed) {
    return (
      <img
        src={`/api/logo/${ticker}`}
        alt={ticker}
        width={20}
        height={20}
        onError={() => setFailed(true)}
        style={{ borderRadius: 4, objectFit: 'contain', flexShrink: 0 }}
      />
    )
  }
  return (
    <span
      style={{
        width: 20, height: 20, borderRadius: 4, flexShrink: 0,
        background: accentColor ?? 'var(--accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 8, fontWeight: 700, color: '#fff',
      }}
    >
      {ticker.slice(0, 2)}
    </span>
  )
}

export default function Sidebar({ models }: { models: SidebarEntry[] }) {
  const pathname = usePathname()
  const [modelsOpen, setModelsOpen] = useState(false)

  const perfActive = pathname.startsWith('/performance') && !pathname.startsWith('/performance/login')

  return (
    <nav className="sidebar">
      <Link href="/performance" className="sidebar-logo">
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
              <TickerLogo ticker={m.ticker} accentColor={m.accentColor} />
              <span
                className="sidebar-item-ticker"
                style={active ? { color: m.accentColor ?? "var(--accent)" } : {}}
              >
                {m.ticker}
              </span>
            </div>
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
