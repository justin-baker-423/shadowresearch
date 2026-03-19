# DCF Research Site

A personal investment research site for hosting interactive DCF models.
Built with Next.js 14, TypeScript, and zero external UI dependencies.

---

## Deploy in ~10 minutes

### Step 1 — Push to GitHub

1. Create a new repository on [github.com](https://github.com/new) (name it anything, e.g. `dcf-research`)
2. In your terminal:

```bash
cd dcf-site
git init
git add .
git commit -m "initial"
git remote add origin https://github.com/YOUR_USERNAME/dcf-research.git
git push -u origin main
```

### Step 2 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New → Project**
3. Import your `dcf-research` repository
4. Leave all settings as defaults — Vercel auto-detects Next.js
5. Click **Deploy**

You'll get a free URL like `dcf-research-abc123.vercel.app` in about 60 seconds.

### Step 3 — Connect your custom domain

1. Buy a domain (recommended: [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) — ~$10/yr, no markup)
2. In Vercel: go to your project → **Settings → Domains → Add**
3. Type your domain (e.g. `jresearch.com`) and click Add
4. Vercel shows you two DNS records to add. Copy them.
5. In Cloudflare (or wherever you bought the domain): go to **DNS** and add those two records
6. Wait 2–5 minutes. Done — your site is live at your own domain.

---

## Adding a new DCF model

Open `lib/models.ts`. That is the **only file you need to edit.**

Copy the commented-out template at the bottom and fill in your assumptions:

```ts
{
  slug:         "msft",          // → yourdomain.com/models/msft
  ticker:       "MSFT",
  exchange:     "NASDAQ",
  name:         "Microsoft Corporation",
  sector:       "Cloud / AI",
  description:  "Azure growth · Copilot monetisation · Office 365 upsell",
  lastUpdated:  "March 2026",

  baseYear:     2025,
  baseRevenue:  245.1,           // in billions
  currency:     "USD",
  currentPrice: 415,             // per share, local currency
  sharesOut:    7.43,            // diluted shares, billions
  netCash:      -12.0,           // negative = net debt

  taxRate:      0.18,
  sbcHaircut:   0.025,
  buybackRate:  0.01,
  termGrowth:   0.04,
  waccDefault:  0.09,

  accentColor:  "#00a4ef",       // optional — colours the sidebar item

  scenarios: {
    bear: {
      revGrowth: [0.12,0.13,0.13,0.12,0.11, 0.09,0.09,0.08,0.08,0.07],
      niMargin:  [0.44,0.45,0.45,0.45,0.45, 0.45,0.45,0.45,0.45,0.45],
    },
    base: {
      revGrowth: [0.14,0.15,0.15,0.14,0.13, 0.11,0.10,0.10,0.09,0.09],
      niMargin:  [0.44,0.45,0.46,0.47,0.47, 0.47,0.47,0.47,0.47,0.47],
    },
    bull: {
      revGrowth: [0.16,0.17,0.17,0.16,0.15, 0.13,0.12,0.11,0.10,0.10],
      niMargin:  [0.45,0.46,0.47,0.48,0.49, 0.49,0.49,0.49,0.49,0.49],
    },
  },
},
```

Then `git add . && git commit -m "add MSFT model" && git push`.
Vercel redeploys automatically in ~30 seconds. The new model appears in the sidebar instantly.

---

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project structure

```
dcf-site/
├── app/
│   ├── layout.tsx              ← sidebar shell wrapping every page
│   ├── globals.css             ← full design system, dark theme
│   ├── page.tsx                ← homepage — model card grid
│   └── models/[slug]/
│       ├── page.tsx            ← dynamic route (one per model)
│       └── not-found.tsx       ← 404 for unknown slugs
├── components/
│   ├── Sidebar.tsx             ← persistent left nav
│   └── ModelShell.tsx          ← interactive DCF UI (all three tabs)
├── lib/
│   ├── models.ts               ← ← ← EDIT THIS to add models
│   └── dcf-engine.ts           ← pure calculation logic
└── README.md
```

The calculation engine (`dcf-engine.ts`) and the UI shell (`ModelShell.tsx`) are fully
generic — they work with any `ModelConfig`. You never need to touch them to add a model.
