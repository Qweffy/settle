# Settle — feature walkthroughs (manual E2E)

Step-by-step flows to exercise every feature by hand, plus the automated Playwright
spec that covers each one. Use it to demo the app or to verify a deploy.

- **Live demo:** https://settle-qweffys-projects.vercel.app
- **Roles:** top-right **"viewing as"** switches actor — **AP Clerk** (Dana) · **Approver** (Marcus) · **Controller** (Lena). The actor is enforced server-side, so it changes what you can do.
- **Entities:** top-left **org switcher** — **Summit Waste Services**, **Summit Transfer Stations**, **Cascade Recycling Co.** Each is a real org with its own vendors, bills and people; switching scopes every screen — the bills, dashboard totals, approvals, payments, aging and tabs all change (persisted in a cookie).
- **Demo clock** is pinned, so "overdue / due-soon / aging" are stable.
- Automated equivalents live in `tests/e2e/*.spec.ts` (14 specs / 19 cases); run them with `npm run test:e2e`.

> **Heads-up on the star feature:** the **AI Bill Review** lives on the **Capture** screen (sidebar → **Capture**, ⌘K → "Capture a bill", or `g c`). "+ New bill" is the *manual* form on purpose — it's a different intake path.

---

## 1. AI Bill Review (Capture) ★
**Where:** sidebar → **Capture** · or `/capture` · or ⌘K → "Capture a bill"
1. Click **"Process sample invoice"** — the demo runs a built-in sample invoice (no file upload needed). Real PDF/image intake + the forwarding inbox are wired for production, where an `ANTHROPIC_API_KEY` lets Claude read the actual file; the hosted demo always uses the sample so it works with zero setup.
2. Watch **Processing**: detected vendor → read line items → coded to GL → 6 risk checks.
3. Scroll to **Extracted draft**: fields are pre-filled with `AI` badges + a confidence score, and the **AI Bill Review** panel lists anomalies (e.g. *"Fuel surcharge 32% above 6-month average"*) with severity + **Accept / Dismiss / Verify**.
4. Triage the flags: **Accept** marks a flag accepted, **Dismiss** marks it dismissed; once **all** flags are resolved the bill is saved as **reviewed**.
5. **Save draft** → persists a real bill (line items + flags **with their triage state**) and opens its cockpit. *"Save as draft for approval" and **Discard** stay disabled until you Process or upload an invoice — an amber **"Can't save yet — process or upload an invoice first"** message plus the greyed-out buttons make the reason explicit.*

*Expected:* a real draft bill is created and reachable in **Bills → Drafts**. The triage persists onto the saved bill — the cockpit reflects it durably (reloading does **not** reset the flags back to all-open).
*Reasoning vs OCR:* with `ANTHROPIC_API_KEY` set it calls Claude with the vendor's history; without it, a deterministic mock runs (badge: "Demo parse (no API key)").
*Spec:* `tests/e2e/capture.spec.ts` (asserts a resolved flag shows "3 open" on the saved bill's cockpit).

## 2. AP forwarding inbox
**Where:** Capture screen → **"Simulate inbound"** (next to the forwarding address `bills@…`)
1. Click **Simulate inbound** — simulates an invoice arriving by email.
2. Settle OCRs + drafts it and drops you on the new bill.

*Expected:* lands on a freshly created `/bills/<id>` draft.
*Spec:* `tests/e2e/ap-inbox.spec.ts`

## 3. New bill (manual)
**Where:** "+ New bill" (top-right) · ⌘N · or `c`
1. Pick a vendor, enter an invoice #, add a line with an amount + GL account.
2. **Create & submit for approval**.

*Expected:* the bill lands in the approval queue. (For an AI-assisted draft instead, use the "Have a PDF? Capture it with AI" link on this form.)
*Spec:* `tests/e2e/new-bill.spec.ts`

## 4. Bill cockpit + collaboration
**Where:** Bills → click any bill (e.g. **WEX Fleet Fuel**, `/bills/b-wex-0529`)
1. Three panels: **invoice viewer** · **coding & review** (line items + GL) · **activity & comments**.
2. In the timeline, add a comment and **@mention** a teammate.

*Expected:* the comment appears in the timeline; the @mention highlights.

## 5. AI flags inside the cockpit
**Where:** any flagged bill's cockpit (WEX has 3)
1. Scroll the centre panel to **AI Bill Review** → flags with severity.
2. **Accept** / **Dismiss** a flag.

*Expected:* the open-flag count updates and **persists** — reloading keeps the triage (it does not reset to all-open). (The AI review is visible here too, not only on Capture.)

## 6. Approval gate (approval-rules engine)
**Where:** the WEX bill (`/bills/b-wex-0529`, $52,180 > $50k)
1. As **AP Clerk**, the cockpit shows a **"Requires Controller"** chip and **Approve** is disabled.
2. Switch role (top-right) → **Controller** → reload → **Approve** is enabled.
3. As **Controller**, click **Approve** (or **Reject**) → the bill transitions and you're returned to the **Approvals queue** (the bill has left it).
4. Alt path: in **Approvals**, as AP Clerk, click Approve on the WEX row → toast *"This bill needs Controller approval"*.

*Expected:* large bills can't be approved below the required role; the message reaches the user; approving/rejecting from a cockpit redirects back to the queue rather than sitting on the now-resolved bill.
*Spec:* `tests/e2e/approval-gate.spec.ts`

## 7. Bulk actions
**Where:** Bills → tick row checkboxes
1. Select a few bills → the bulk bar appears → **Mark as paid** (or Submit / Approve / Schedule).

*Expected:* toast like *"Paid N bills · M not eligible"*; ineligible rows are skipped, not failed.
*Spec:* `tests/e2e/bulk.spec.ts`

## 8. CSV import
**Where:** Bills → **Import**
1. Download **Template** (optional), fill it, then upload the CSV.
2. Review the validating **preview** (resolves vendors by name, flags bad rows).
3. Confirm → drafts are created.

*Expected:* toast *"Imported N bills as draft"*; unknown-vendor/blank rows are skipped.
*Spec:* `tests/e2e/import.spec.ts`

## 9. Table filters
**Where:** Bills (`/bills`) → the filter chips above the table (**Status · Vendor · GL account · Due date · Amount**)
1. Click a chip (e.g. **Vendor**) → a **multi-select dropdown** of values opens.
2. Tick one or more values → the table narrows and the chip shows a **count badge**.
3. Combine filters across chips; use the **Clear** entry in a dropdown to reset that one filter.

*Expected:* each chip filters the table live, the badge reflects the number of active selections, and the current selection feeds **Saved views** (save/restore the exact filter state).
*Spec:* filter state is covered by `tests/e2e/saved-views.spec.ts`.

## 10. Saved views
**Where:** Bills → set filters (status / vendor / GL / due / amount), search, sort
1. **Saved views → Save**, name it.
2. Reload / switch tabs → re-apply it.

*Expected:* the exact filter/sort/column state is restored.
*Spec:* `tests/e2e/saved-views.spec.ts`

## 11. Duplicate detection
**Where:** "+ New bill"
1. Pick a vendor and type an **invoice # that already exists** for that vendor → blur the field.

*Expected:* a duplicate warning appears before you can submit.
*Spec:* `tests/e2e/duplicate.spec.ts`

## 12. Expense vs. item line coding
**Where:** a bill cockpit with an item line
1. A line marked as an **item** shows an **Item** chip (vs a plain expense line).

*Spec:* `tests/e2e/line-kind.spec.ts`

## 13. Line-item splits + allocation templates
**Where:** a bill cockpit → a line's split control
1. Split one line across multiple GL accounts.
2. **Save as template** → re-apply that allocation to another line.

*Spec:* `tests/e2e/allocation-templates.spec.ts`

## 14. Post-approval edit guard
**Where:** an approved/paid bill cockpit
1. Try **Edit**.

*Expected:* blocked with *"This bill can't be edited once it's …"* — the state machine enforces it server-side.
*Spec:* `tests/e2e/edit-guard.spec.ts`

## 15. Payments (schedule / mark paid)
**Where:** Payments, or a bill cockpit → **Schedule payment**
1. Schedule a payment on an approved bill; later mark it paid (simulated rail).

*Expected:* status moves scheduled → paid; the timeline logs it.
*Robustness:* mutate actions (**mark paid**, **approve / reject**) are guarded against double-submit — the button is disabled while a transition is in flight, so a fast double-click can't fire it twice.

## 16. Payment-failed recovery card
**Where:** the Samsara bill (`/bills/b-sam-09980`, payment failed)
1. The cockpit header shows a red **"Payment failed — card declined"** card with the amount/vendor/account.
2. **Retry payment** (same method) or **Change account** (re-route via ACH).

*Expected:* re-scheduling clears the failed state. *No dead ends.*
*Spec:* `tests/e2e/error-states.spec.ts`

## 17. QuickBooks sync banner
**Where:** Dashboard (top)
1. The amber **"Couldn't sync with QuickBooks"** banner is non-blocking — the page works behind it.
2. **Retry** (shows a syncing spinner) or **Dismiss**.

*Expected:* Dismiss hides it; the dashboard never blocks on the integration.
*Spec:* `tests/e2e/error-states.spec.ts`

## 18. Error / not-found states
**Where:** any unknown route, e.g. `/bills/zzz-nope`
1. A graceful "we couldn't find that page" state renders **inside the shell** (sidebar stays), HTTP 404.

*Expected:* never Next's white error page. (Render errors hit `app/(app)/error.tsx`.)
*Spec:* `tests/e2e/error-states.spec.ts` · `tests/e2e/nav.spec.ts`

## 19. Dashboard & AP Aging
**Where:** **Dashboard** and **Reports** (AP Aging)
1. Dashboard: scorecards, AI-flagged "needs review", expected-but-missing bills, cash-out by week, activity feed.
2. Reports → AP Aging buckets.

## 20. Vendors & Settings
**Where:** **Vendors** (directory + detail + form) · **Settings** (chart of accounts + recurring schedules + approval rules)
*Spec (vendors):* `tests/e2e/vendors.spec.ts`

## 21. Command palette, shortcuts & dark mode
- **⌘K** (or click the search box) → actions, recent, navigate.
- **Navigation:** `g d` dashboard · `g b` bills · `g c` capture · `g a` approvals · `g v` vendors · `g p` payments · `g r` reports. **`c`** = new bill · **⌘N** = new bill.
- **Dark mode:** the **sun/moon toggle** in the top bar (left of the avatar).
*Spec (nav):* `tests/e2e/nav.spec.ts`
