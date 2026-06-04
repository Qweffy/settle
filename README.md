# Settle — Accounts Payable for waste haulers

[![CI](https://github.com/Qweffy/settle/actions/workflows/ci.yml/badge.svg)](https://github.com/Qweffy/settle/actions/workflows/ci.yml)

Settle is a modern **Accounts Payable / Bill Pay** product — where a finance team manages the full life of a vendor bill: **intake → code → approve → schedule → pay**, plus AP aging and an **AI bill review**. It's built in the spirit of Ramp Bill Pay × Stripe Dashboard, and the demo data is themed for a waste‑hauling company (**Summit Waste Services**) paying the vendors a hauler actually pays: landfill tipping fees, fleet fuel, truck maintenance, leasing, insurance.

> **Why a hauler?** This take‑home is for Trashlab, "the operating system for waste haulers." Trashlab owns the hauler's **money‑in** (billing their customers). Settle is the **other half of the ledger — the money‑out** (paying their vendors). Same domain, opposite side.

---

## What it does

A finance team lives in four workflows, and Settle is organized around them:

1. **Intake → Draft.** Bills arrive (upload a PDF, forward to a dedicated AP inbox, or create manually). On the **Capture** screen, an AI pass reads the invoice, pre‑fills a coded draft, and **flags anomalies**; **saving the draft persists a real bill** (line items + flags) straight into the approval queue and opens its cockpit. Manual entry is a full **New bill** form (vendor + line-item GL coding + dates + tax) reachable from the topbar, the bills table, the command palette, or Cmd-N — and the same form **edits** an existing bill from its cockpit (logging an audit event onto the timeline).
2. **Code → Approve.** The **Bill cockpit** is a 3‑panel workspace — invoice viewer + line‑item GL coding + a unified, auditable **timeline with comments and @‑mentions**. The **AI Bill Review** surfaces issues (surcharge spikes, new fees, missing POs, possible duplicates, vendor bank changes). Approvers sign off from the **Approvals queue**, grouped by urgency.
3. **Schedule → Pay.** Approved bills get a payment scheduled and then marked paid (simulated rail), with consolidation hints for vendors you pay often.
4. **Monitor.** The **Dashboard** (scorecards, needs‑review, expected‑but‑missing bills, cash‑out by week, activity feed) and the **AP Aging** report keep the whole thing under control.

### The differentiators

- **AI Bill Review** — the invoice isn't just OCR'd, it's *scrutinized against the vendor's history*. Each flag carries a plain‑English reason + severity. This directly attacks the #1 hauler AP pain: hidden markups in tipping/fuel invoices.
- **Invoice‑centric cockpit** — image + coding + a shared, timestamped, auditable comment thread on one screen (the Stampli pattern), so the "why is this surcharge higher?" conversation lives on the bill instead of in scattered email.
- **AP controls** — code-side **duplicate detection** (warns when the same vendor + invoice # arrives twice) and an **approval-rules engine** that routes large bills to a senior role (over $10k → Approver, over $50k → Controller), enforced server-side and surfaced as a gate in the cockpit.

Beyond the core, the build also ships **recurring schedules** (draft the next bill on a cadence), **line-item splits** (one line across multiple GL accounts), a **Settings** page (chart of accounts + approval rules), **bulk** submit/approve/schedule/pay over a table selection, real CSV export, and a ⌘K palette + keyboard shortcuts (`c` for a new bill, `g`-then-key to navigate).

---

## Workflows I prioritized (and why)

| Priority | Workflow | Why |
|---|---|---|
| 1 | **Approve / reject** with a real state machine + audit log | This is where the business logic and the controls live — the heart of AP. |
| 2 | **AI bill review** (flags from vendor history) | The headline differentiator; turns intake into anomaly detection. |
| 3 | **Invoice cockpit + collaboration** | The highest‑value UX pattern from the competitor benchmark (Ramp/Brex/Bill.com/Tipalti/Melio/Stampli). |
| 4 | **Schedule / mark paid** | Closes the loop; simulated (not a real banking rail). |
| 5 | **Dashboard + AP aging** | The "is everything under control?" surface. |

---

## Architecture & key decisions

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Drizzle ORM · **Neon Postgres** · `next-themes` (light + dark). One full‑stack repo, deploys to Vercel.

- **Money is integer cents, everywhere.** No floats in financial math; formatted in `lib/format.ts`.
- **One lifecycle state machine** (`lib/status.ts`). A single allowed‑transitions map guards every status change (`assertTransition`), and `deriveDisplayStatus()` computes the UI pill from `status + reviewStatus + dueDate + payment` (overdue/due‑soon/needs‑review are *derived*, not stored). This keeps the model honest and the pills consistent.
- **Server Components read, Server Actions write.** Pages are `force-dynamic` server components that query Drizzle (`lib/queries/*`) and pass typed data to `'use client'` views. Mutations are Server Actions (`lib/actions/*`) that validate the transition, write the change, append an **append‑only audit row**, and `revalidatePath`. The client uses `useTransition` + `router.refresh()` for optimistic UX backed by the real result.
- **Demo auth = a role switcher, on purpose.** No login. The topbar "viewing as" (AP Clerk / Approver / Controller) sets a cookie that becomes the **actor** for every action, so an evaluator experiences the multi‑role approval flow **instantly — no signup, no email verification.** Users/roles are still modeled in the DB, so swapping in real auth (Clerk) later is a thin integration, not a rewrite. Real auth adds friction and no visible product value here.
- **AI Bill Review = reasoning, not just OCR.** The Capture flow sends the invoice to Claude (vision + structured output) and feeds the **vendor's prior bills** in as context, so Claude can reason about what's anomalous. Deterministic checks (duplicate, vendor‑bank‑change, missing‑recurring) stay in code — cheaper and exact. **Falls back to a deterministic mock** when no `ANTHROPIC_API_KEY` is set, so the hosted demo never breaks.
- **Stable demo clock.** `lib/demo.ts` pins "today" to the seed's reference date so overdue / aging / time‑ago are stable regardless of when the demo runs.

**Data model** (`db/schema.ts`, 11 tables): `organizations`, `users`, `vendors`, `glAccounts`, `bills`, `billLineItems`, `billFlags` (AI review), `approvalEvents`, `payments`, `billComments` (collaboration), `activityLog` (audit). FKs + Drizzle relations throughout.

---

## What I left out (and why)

- **Real auth / multi‑tenant** — replaced by the demo role switcher (above). The org/user model is there to enable it.
- **A real payment rail / bank integration** — payments are simulated; not where the product judgment is, and out of scope for a take‑home.
- **2‑way accounting sync (QuickBooks/NetSuite)** — realistic in Ramp but not meaningfully mockable in the timebox; the activity feed shows a representative "synced from QuickBooks" event.
- **Global/FX mass payments + a tax engine (1099/W‑8/VAT)** — deliberately dropped after the competitor benchmark: overkill for a US‑domestic hauler.
- **Historical series for scorecard deltas/sparklines** — the scorecard *values* are real (live DB aggregates); the small delta % and sparkline are illustrative, since there's no time‑series table yet.
- **CSV import is a stub** — the bills *Import* button parses and counts a file's rows but doesn't create bills yet, and *Saved views* is a placeholder. Everything else from the plan shipped — recurring schedules, line-item splits, a Settings page, bulk actions, duplicate detection, the approval-rules engine, and keyboard shortcuts.

---

## Setup

Requirements: Node 20.9+, a Neon Postgres database (free at [neon.tech](https://neon.tech)).

```bash
npm install
cp .env.example .env.local          # then fill in DATABASE_URL (and optionally ANTHROPIC_API_KEY)
npm run db:push                     # create tables in your Neon DB
npm run db:seed                     # load the Summit Waste demo data
npm run dev                         # http://localhost:3000
```

`.env.local`:

```
DATABASE_URL="postgresql://...neon.tech/...?sslmode=require"
ANTHROPIC_API_KEY=""                # optional — Capture falls back to a mock parse without it
```

Scripts: `dev` · `build` · `start` · `lint` · `typecheck` · `test` · `test:e2e` · `db:push` · `db:seed` · `db:generate` · `db:migrate` · `db:studio`.

### Deploy (Vercel + Neon)

1. Push this repo to GitHub and **Import** it in Vercel.
2. Set env vars in Vercel: `DATABASE_URL` (your Neon string) and optionally `ANTHROPIC_API_KEY`.
3. Deploy. Run `npm run db:push && npm run db:seed` once against the same database to populate it.

---

## Testing

Three layers, weighted toward end-to-end coverage of the real workflows:

| Layer | Tool | What it covers |
| --- | --- | --- |
| **Unit** | Vitest | Pure domain logic, no DB or network — the lifecycle state machine (`lib/status.ts`), the approval-rules engine (`lib/approval-rules.ts`), money/date formatting, and the AI invoice parser's deterministic fallback. ~33 tests, <2s. |
| **Integration** | _(folded into e2e)_ | The e2e layer drives the real Server Actions and database through the UI, so it *is* the integration layer. A separate mock-DB suite would be brittle against Drizzle and low-signal, so it's deliberately omitted. |
| **E2E** | Playwright | Key user flows against a production build with a real, seeded database: OCR capture → persisted bill, manual bill creation, the **$50k approval gate** (role-gated, evaluated server-side), bulk mark-paid, duplicate detection, the vendor directory, and navigation + 404s. |

```bash
npm run test            # unit (Vitest)
npm run test:e2e        # e2e (Playwright) — needs a database (below)
```

**The e2e database.** The app uses Neon's HTTP driver, which speaks HTTP rather than the Postgres wire protocol — so e2e runs against a self-contained **Neon HTTP proxy** (a Postgres container + [`local-neon-http-proxy`](https://github.com/TimoWilhelm/local-neon-http-proxy)) rather than a plain local Postgres. No external database or secrets needed:

```bash
docker compose -f docker-compose.test.yml up -d --wait
export DATABASE_URL=postgres://postgres:postgres@db.localtest.me:5432/main
npm run db:push && npm run db:seed
npm run test:e2e
```

**CI.** Every push runs three parallel jobs — `verify` (typecheck · lint · build), `unit`, and `e2e`. The e2e job spins up the Neon proxy, seeds a fresh database, builds, and runs Playwright, uploading the HTML report as an artifact. Keeping e2e in its own job means an infra hiccup never reds the core gates. _(The e2e suite already earned its keep: it caught a real `/dashboard` 500 — an activity type the icon map didn't cover — before it could ship.)_

---

## Project layout

```
app/(app)/            route group with the shared shell (sidebar + topbar + ⌘K) as the layout
  dashboard|bills|bills/cockpit|approvals|payments|vendors|reports|capture/
    page.tsx          server component: queries the DB, renders the view
    *-view.tsx        'use client' view: receives typed data by props
    *.css             screen-scoped styles (under .screen-<name>)
components/           app-shell, icon, theme-provider
db/                   schema.ts, index.ts (Neon client), seed.ts
lib/
  queries/            read-side data access (Server Components)
  actions/            write-side Server Actions (lifecycle, comments, session)
  status.ts           state machine + display-status derivation
  format.ts dates.ts demo.ts
app/styles/           tokens.css (design system) + shell.css
```

Built design‑first: the design system and all nine screens were designed in Claude Design, then ported pixel‑faithfully into the app (tokens + screen‑scoped CSS), and finally wired to the live database.
