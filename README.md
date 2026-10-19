# XPLORIX — Drilling Intelligence Platform (MVP v2)

> This repository is the **MVP / demo**. Deploy it with **no database** (no `DATABASE_URL`): it runs as the demo company, with the 15-day trial login and **Login As** to pick a role. The live pilot site with real customer logins is a separate repository and is not affected by anything here.

One record of the drilling, for both sides of the contract. XPLORIX is built for exploration drilling contractors and the mine owners they drill for: the supervisor logs each shift once at the rig, and cost per metre, profit per hole, contractor checks, the client's approvals and invoices, and the forecast are all worked out from that record.

## Four logins

| Login | Sees |
| --- | --- |
| Company admin | Everything in the company |
| Supervisor | His projects' rigs and logs. No rates, no costs, no invoices |
| Contractor (sub-contractor) | His own work orders, shifts, logs and bills |
| Client (mine owner) | The shift record without fuel, parts or crew cost; his rates, holes and invoices |

The rules are enforced on the server (`lib/server/policy.ts`), not only on the screens.

## What is in it

- **Drill log** with checks as the shift is typed: figures that cannot be right are stopped, unusual ones are saved only with a reason (`lib/log-checks.ts`)
- **Dashboard** with what needs the owner today
- **Finance and costing**: cost per metre by day, profit per hole, standby billed
- **Contractors**: shifts checked before they count, bills checked against the record
- **Client portal**: hole approvals, invoices checked line by line
- **Analytics**: six dashboards, each with XPLORIX insights
- **XPLORIX Intelligence**: Today (one list of findings across every department, with owner, deadline and money), Drill log check, Money checks (standby that reached no invoice, holes blocked by their logs, fuel against the engine), Price a tender (rates per metre by ground, size and depth from the company's own costed metres), Contractor comparison, Hole finish prediction, This month and next, Risk analysis (`lib/findings.ts`, `lib/money-checks.ts`, `lib/own-rates.ts`, `lib/intelligence.ts`, `lib/forecast.ts`)
- **Supervisor Today**: his rigs, shifts not logged, and his logs the checks want put right
- **Contractor and client**: sub-contractor reports run through the same checks before they are accepted; the client sees "Checked by XPLORIX" on holes and invoices whose every shift passed
- **Parts and inventory**: what runs out before an order can arrive, late orders, idle stock; a new order is checked against every other store first, and part life is measured by ground (`lib/stock-checks.ts`)

Every insight and forecast is a rule or a projection applied to the company's own record. It is not a trained model. An AI layer that explains causes and drafts actions is planned, and will read the same findings.

Sample screens, not connected to real data yet: Bid Intelligence, Marketplace, Crew & jobs, Performance reports, Billing.

## Run it

```bash
npm install
npm run dev
```

To connect a database, set `DATABASE_URL` (see `.env.example`). With no database the app runs as a demo company (Apex Drilling Solutions), kept in the browser and frozen on 13 Sep 2026 so the figures stay the same. On the login page, any email and password work and **Login As** picks the role.

## Tech

Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts, Lucide icons, Postgres when a database is connected.
