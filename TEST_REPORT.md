# Test report — Herdvest website & Management System

Date: 16 October 2026 · Environment: macOS, Node 24, PostgreSQL 17.11 (local), Next.js 15.5 dev + production build.

This report lists only what was actually executed. "Not tested" items are called out explicitly.

## 1. Automated tests (`npm test`) — 29 / 29 passing

Run against a freshly created `herdvest_test` database with all migrations applied, connecting as the
non-privileged `herdvest_app` role so row-level security is in force.

| Area | Scenario | Result |
| --- | --- | --- |
| Investor funding | Deposit PKR 500,000 (verified); buy 2 animals at PKR 200,000 → purchases 400,000, **unallocated 100,000**, decision required, both animals linked to the investor and account, no settlement/profit created; decision recorded clears the prompt; later purchase links to the same investor/account | ✅ |
| Funding safeguards | Purchase exceeding verified funds is blocked (pending deposits don't count); duplicate deposit reference rejected; idempotency key returns the same entry; ledger rows cannot be edited or deleted, only reversed | ✅ |
| Purchase & allocation | Unverified farmer cannot receive an animal; verification cannot be forced by direct update; allocation + transfer keep full history; animal's purchase cost, investor and farmer linked; farmer cannot be changed by direct update | ✅ |
| Expenses | PKR 2,500 vaccination claim by a field employee is `submitted` even if they try to mark it paid; field employee cannot approve; finance approval as "chargeable to the investment" reduces unallocated funds by exactly 2,500 once; re-approval and amount edits blocked; marked paid separately | ✅ |
| Expenses | Herdvest operating expense does not touch investor funds | ✅ |
| Sale | PKR 250,000 → 600,000: pool 350,000; investor gross 175,000; farmer 175,000; **fee 35,000**; investor net 140,000; held for review until buyer pays; calculation ≠ payment; payments only after approval; partial payment & outstanding tracked; overpayment blocked; second sale/settlement for the same animal impossible (fee charged once) | ✅ |
| Loss | Sale at 180,000 for a 250,000 animal → no positive split, fee 0, shortfall 70,000, review note required, payables cannot exceed money received | ✅ |
| Mortality | Death → animal deceased, allocation ended, no refunds/adjustments created, cannot be sold or deleted, decision requires `incidents.approve`, status history and audit trail preserved | ✅ |
| Permissions | Field employee sees no investors, ledger, balances, purchases or settlements; sees only animals on their open tasks | ✅ |
| Permissions | Nobody can change their own role; non-admins' role edits affect 0 rows; a user manager who is not Super Admin cannot grant Super Admin; password hashes unreadable by the app role; role permissions not editable by Finance | ✅ |
| Permissions | Signed-out/public context reads 0 rows from 13 private tables; sessions table not accessible | ✅ |
| Files & audit | Identity documents invisible to Operations and Auditor; audit log cannot be updated or deleted; auditor can read it; auditor cannot write | ✅ |
| Enquiries | Public enquiry stored via insert-only function, unreadable publicly, visible to staff, converted to a prospective investor with no deposit | ✅ |
| Calculator | 100k→600k example; 250k→600k; fee identical for 1/2/3/7.5-year holds; 37 animals; 5,000 animals (no cap); loss case; exact split of odd amounts | ✅ |
| Reports | All 15 report queries run with no filters and with every filter set; sale status and investment-status filters narrow results correctly; investor statement renders a valid PDF | ✅ |
| Intake parser | Brief's example message → inspection + vaccination + PKR 2,500 expense for HV-001 with charge-type decision flagged; no-ID message flagged; multiple IDs and possible death flagged | ✅ |

## 2. Manual end-to-end checks in the browser (dev server)

* Public **investor enquiry** submitted → success with reference ENQ-0001 → appeared in Management → Enquiries → converted
  to investor INV-0001 with account ACC-0001.
* **Deposit** of PKR 500,000 recorded with a proof-of-payment image → shown as *awaiting reconciliation*, not received →
  verified → received 500,000 / unallocated 500,000.
* **Purchase** form with two Nili-Ravi buffaloes at 200,000 → HV-001, HV-002 created; account shows received 500,000,
  unallocated **100,000 ("Not profit")**, decision banner → decision recorded → banner cleared.
* **Manual intake** of the brief's WhatsApp-style message with a receipt image → matched HV-001 (investor and farmer
  resolved) → reviewer added vaccine name → created VET-00001 (completed) and EXP-00001 (**submitted**, awaiting approval).
* **Email intake webhook** with a simulated Postmark-format payload and correct secret → queued, HV-002 matched, receipt
  stored privately; identical replay detected as duplicate. Wrong/missing secret → 401.
* **Field employee** (created via Users & roles, forced password change on first login): sees only Tasks, Animals,
  Veterinary, Incidents, Expenses; only HV-001 while their task is open; investor/ledger/purchase/sale/user/audit/report
  pages redirect to *forbidden*; search returns no investor records; another record's private file → 404; report CSV
  export → 403. Completing a task without findings shows a validation error and keeps typed input.
* Wrong password → generic error. Signed-out access to `/management/*` → redirect to sign-in.
* All 46 management pages and a CSV export rendered without server errors as Super Admin.
* Production build succeeded; production server smoke test: public pages 200, management redirects to sign-in,
  intake webhooks reject unauthenticated calls, enquiry API validates server-side.

### Added 17 October 2026
* Investor page shows the new totals (purchases, gross proceeds, buyer receipts, fees calculated/approved, outstanding settlements) and statement/PDF links.
* PDF download returns `application/pdf` for the investor statement and for a filtered sales register; the statement layout was checked visually.
* Animal page shows the funding transaction (TXN-00002, pending) for HV-002.
* HV-002 allocated to a verified farmer with a handover photo; the allocation history row lists the photo and the responsible user.
* Investor-statement totals were changed to count verified/paid rows only, so pending entries are never added to confirmed figures.

## 3. Defects found and fixed during testing

* Settlement review reasons used an invalid array-append expression (fixed).
* `citext` not on the search path of definer functions (fixed).
* React 19 reset forms after a failed server-action submission, losing input (fixed: forms submit via transition).
* One-time temporary passwords disappeared when the dialog auto-closed (fixed).
* Converting an enquiry didn't open an investment account (fixed).
* Responsibility table caused horizontal scroll on phones (fixed earlier).

## 4. Not tested / not verified

* Live **WhatsApp** webhook (no WhatsApp Business account connected) and media download.
* A real **inbound email** provider (only a simulated payload was tested).
* **Resend** enquiry notification emails and **FORM_WEBHOOK_URL** forwarding.
* Deployment to any hosting provider; TLS database connections; backups.
* File storage on anything other than local disk; very large uploads (only small images were uploaded).
* Load/performance, concurrent-user stress tests (row locks are in place but not load-tested).
* Every individual form path in the UI — workflows were covered at the database level and a representative subset
  through the browser.
* Accessibility audit with a screen reader; cross-browser testing beyond Chromium.
* Independent security review / penetration test.
