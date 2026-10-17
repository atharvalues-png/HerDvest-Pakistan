# Test report — Herdvest website & Management System

Date: 16 October 2026 (investor portal added 17 October 2026) · Environment: macOS, Node 24, PostgreSQL 17.11 (local), Next.js 15.5 dev + production build.

This report lists only what was actually executed. "Not tested" items are called out explicitly.

## 1. Automated tests (`npm test`) — 56 / 56 passing

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
| Investor portal (27 tests, `tests/portal.test.ts`) | Two investors with their own deposits, animals and sessions. See §5 for the acceptance criteria they cover. | ✅ |
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

## 5. Investor portal — acceptance criteria (added 17 October 2026)

"Automated" means executed by `tests/portal.test.ts` against PostgreSQL as the app role; "Browser" means done by hand on
the local dev server with test investors INV-0001 (two animals) and a second test investor INV-0002 (HV-003).

| # | Criterion | Automated | Browser |
| --- | --- | --- | --- |
| 1 | Investor A sees only A's animals | ✅ | ✅ INV-0001 sees HV-001, HV-002 only |
| 2 | Investor B sees only B's animals | ✅ | Not done in the browser (B was not given a login) |
| 3 | Changing an id in a URL / parameter reveals nothing | ✅ every per-animal function with B's id → 0 rows | ✅ `/portal/livestock/<HV-003 id>` → HTTP 404 |
| 4 | A cannot download B's documents | ✅ `portal_file(B's file)` → nothing | ✅ own unshared file and an internal intake file → 404; shared file → 200 |
| 5 | Investor cannot access the management system | ✅ investor session reads 0 rows from 15 base tables and cannot call staff workflows | ✅ with only the investor cookie: `/management/*`, staff files and staff PDF exports redirect to staff sign-in |
| 6 | Field employee cannot see all investor finances | ✅ 0 portal accounts, ledger rows, investors, payment requests; cannot invite or record weights on unassigned animals | — |
| 7 | Authorised admin can manage records | ✅ invite, reset, suspend, restore, revoke, publish, forecasts, payment requests (with role checks) | ✅ invited INV-0001, published VET-00001 with a summary, recorded and published a weight, drafted and published a forecast |
| 8 | Forecasts separate from actual transactions | ✅ forecasts never appear in transactions; draft forecasts not counted | ✅ draft not shown ("Forecast not yet available"); after publishing, shown only in Outlook with the risk notice |
| 9 | Actual weights distinct from estimates | ✅ unpublished/voided weights excluded; weights cannot be edited | ✅ chart: solid line = measurements, dashed = published estimate; growth text uses measurements only |
| 10 | Reports invisible before publication | ✅ unpublished completed report shows only "awaiting review" (no findings); editing a published report withdraws it | ✅ HV-001 showed "Awaiting review" until published |
| 11 | Account can be suspended / revoked | ✅ access ends immediately; old sessions are not revived by restoring | Not clicked in the browser |
| 12 | Password reset and logout | ✅ reset tokens single-use, end other sessions; logout revokes session | ✅ activation link → password set → sign-in; sign-out → files/statement redirect to sign-in; "forgot password" says email isn't switched on. Staff "reset link" button not clicked; reset email not tested (no email provider) |
| 13 | Usable on mobile | — | ✅ dashboard and transactions at 375 px: no horizontal scroll, nav scrolls. Not tested on real phones |
| 14 | Missing data shown honestly | ✅ summary returns null estimate when no forecast | ✅ "Not yet recorded", "No published assessment", "Forecast not yet available", "Not recorded" budget, "No photograph published yet" |

Also executed: two-step verification in the browser (setup with an independently computed TOTP code; next sign-in
required a code; a wrong code was rejected; before the code, pages redirected and the statement returned 401). Investor
statement PDF renders (automated) and downloads as `application/pdf` (browser); settlement figures and payment requests
never appear in its cash columns. Loss forecasts produce a shortfall, no fee (automated). Identity numbers are stored
separately, masked as `•••••-••••••7-1`, and only staff with sensitive-document access can set them (automated).

Defects found and fixed while testing the portal: a trigger referenced vet-record fields on other tables; purchase
allocations awaiting reconciliation showed as 0 allocated; the staff portal page selected restricted password columns
(caught in the browser, fixed by listing columns); the portal dashboard title used the site template.

Not tested: email delivery of invitations/resets/notifications (no provider configured); real mobile devices; screen
readers; subdomain hosting; load.
