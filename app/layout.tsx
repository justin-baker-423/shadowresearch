import type { Metadata } from "next"
import "./globals.css"
import Sidebar from "@/components/Sidebar"
import { MODELS } from "@/lib/models"
import { META_MODELS } from "@/lib/meta-models"
import { TESLA_MODELS } from "@/lib/tesla-models"
import { LEMONADE_MODELS } from "@/lib/lemonade-models"
import { DEERE_MODELS } from "@/lib/deere-models"
import { CELSIUS_MODELS } from "@/lib/celsius-models"

export const metadata: Metadata = {
  title: "Shadow Research",
  description: "Private equity research — discounted cash flow models",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <Sidebar models={[...MODELS, ...META_MODELS, ...TESLA_MODELS, ...LEMONADE_MODELS, ...DEERE_MODELS, ...CELSIUS_MODELS]} />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
