import type { Metadata } from "next"
import "./globals.css"
import Sidebar from "@/components/Sidebar"
import { MODELS } from "@/lib/models"

export const metadata: Metadata = {
  title: "Shadow Research",
  description: "Private equity research — discounted cash flow models",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <Sidebar models={MODELS} />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
