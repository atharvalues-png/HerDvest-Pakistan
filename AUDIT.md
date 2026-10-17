# Audit against the brief — 17 October 2026 (updated after gap fixes)

Status key: ✅ done · 🟡 partial · ❌ not done. "Tested" means exercised by `npm test` or in the browser (see TEST_REPORT.md).

## Summary

| Part | ✅ | 🟡 | ❌ |
| --- | --- | --- | --- |
| A — Public website | 7 | 2 | 0 |
| B — Architecture & roles | 7 | 2 | 0 |
| C — Records (§7–16) | 8 | 2 | 0 |
| D — Files | 4 | 2 | 0 |
| E — Dashboard & reports | 5 | 1 | 0 |
| F — Audit & integrity | 4 | 0 | 0 |
| G — Email/WhatsApp intake | 4 | 1 | 1 |
| H — Website ↔ system | 4 | 0 | 0 |
| I — UX | 5 | 1 | 0 |
| J — Required tests | 6 | 1 | 0 |

Nothing is committed to git yet. Not production-ready (no deployment, no live integrations, no security review).

---

## Part A — Public website

| Item | Status | Notes |
| --- | --- | --- |
| A Fixed 20 % fee, not editable, once per sale | ✅ tested | Fee input removed; "Fixed model terms" panel; fee identical for 1/2/3/7.5 years (test). |
| B Price categories 100k/150k/250k, labelled "Initial Purchase Price Per Animal", caveat | ✅ | |
| C "Number of Animals", any positive whole number, total investment shown | ✅ tested | No arbitrary cap; exactness guard only for totals beyond ~PKR 90 trillion. |
| D "Estimated Future Sale Price Per Animal", default 600,000, editable, hypothetical label | ✅ | |
| E Holding period 1/2/3/custom; annualised updates without re-applying fee | ✅ tested | |
| F 13-line breakdown, capital-first assumption, loss shows shortfall, instant updates | ✅ tested | 50/50 split shown as a fixed term (not editable). |
| 2 Buffalo photography replaces cattle | 🟡 | All cattle/goat photos replaced with Pakistani/Indian buffalo images (3 Wikimedia + 8 Unsplash), credits at `/credits`. **Missing: a licence-clear photo of a vet inspecting buffaloes, and a farmer *feeding* buffaloes** (farmer-care photos show milking). Commission own photography. |
| 3 Preserve existing pages, risk section, FAQ, enquiry form, nav, layouts | ✅ | Public pages moved into a `(site)` route group; URLs unchanged; production build checked. |
| 3 Enquiry delivery to company email/backend; no false success | 🟡 | Stored in the database and shown with a reference number (tested). Optional email alert (Resend) and CRM webhook are **implemented but untested**. "Not connected" message shows when nothing is configured. |

## Part B — Architecture, roles, permissions

| Item | Status | Notes |
| --- | --- | --- |
| Reuse existing Next.js app | ✅ | |
| Real database | ✅ | PostgreSQL 17 locally; any Postgres 15+ in production. |
| Supabase / Supabase Auth / object storage | 🟡 | **Not used** (no Docker/Supabase in this environment). Own scrypt + session auth; local-disk private storage behind an authorised route. Runs on Supabase *Postgres* as-is; Auth/Storage would be a later swap. |
| Migrations + reproducible setup | ✅ | 7 SQL migrations, `scripts/migrate.mjs`, `scripts/create-admin.mjs`, README. |
| No secrets in frontend | ✅ | All DB/secret env vars server-only; `.env.local` git-ignored. |
| Database-level access control (RLS) tested | ✅ tested | FORCE RLS on every table; app role is not owner, NOBYPASSRLS. |
| Can't self-escalate to Super Admin | ✅ tested | DB trigger + RLS + UI. |
| Five roles + extensible roles | ✅ | Roles/permissions table-driven; Super Admin edits the matrix in the UI; new roles creatable. |
| Finance "reconciliation" | 🟡 | Ledger verification/rejection/reversal and dual control exist; **no bank-statement import or matching module**. |

## Part C — Business records

| § | Status | Notes |
| --- | --- | --- |
| 7 Investors | ✅ | All profile fields, accounts, animals, farmers, settlements, documents. Totals now include purchases, gross sale proceeds, buyer money received, Herdvest fees (calculated / approved), settlement payments received and **outstanding settlement amounts**; links to the statement and a PDF statement. Sensitive ID docs restricted (tested). |
| 8 Funding ledger | ✅ tested | Txn ID, amount, currency, date/time, method, reference, proof upload, recorder, verification; 6 balances separated; 500k/400k/100k decision prompt; multiple deposits; balances from verified rows only. *Note:* "verification" and "approval" are one status, not two. |
| 9 Livestock | ✅ | All fields, permanent HV-IDs, multiple photos incl. phone camera, 10 statuses, full status history, nothing deleted. Animal page shows the purchase **and its funding transaction (TXN) with status**, linked to the account (Finance only). |
| 10 Farmers & verification workflow | ✅ tested | 7 statuses, cannot be created verified, approval needs `farmers.verify` + notes, event history, sensitive docs restricted. |
| 11 Allocation & transfers | ✅ | Links investor/account/animal/farmer/location/date/agreement/responsibilities/review date/status; one active primary assignment (DB constraint); shared care; transfers keep history with date, reason, condition and responsible user; **a photo or report can be attached at allocation/transfer and is listed on that history row** (checked in browser). |
| 12 Veterinary & inspections | 🟡 | All fields, scheduled + completed, multiple expense lines, phone entry with camera. **Reminders are dashboard counts and filters only — no push/email/WhatsApp notifications.** |
| 13 Expenses | 🟡 | All fields, multi-animal split (must sum, no double charge), 5 charge types, approval → paid, charged to investor once, operating costs never deducted (tested). **"Configurable allocation rules" are a choice made at approval, not an automatic rule engine.** |
| 14 Employees & tasks | ✅ | Employee records, access role, assigned areas (free text), 8 task types, task fields, attachments, mobile completion (tested). |
| 15 Sales & settlement | ✅ tested | 8-step calculation in SQL, review holds (loss, unpaid buyer, disputes, unapproved expenses, open incident), calculated ≠ approved ≠ paid, partial payments, outstanding. |
| 16 Mortality & incidents | ✅ tested | All fields, investigation workflow, decision needs approval, no auto-compensation, history kept. |

## Part D — Files

| Item | Status | Notes |
| --- | --- | --- |
| Attachments on every relevant record | ✅ | 16 entity types; 15 categories. |
| Images, PDFs, video; type + size validation | ✅ | Validated by file signature (JPG/PNG/WebP/HEIC/PDF/MP4/MOV/WebM). |
| Private storage, authorised access | ✅ tested | Outside web root; RLS-checked route; signed-out → sign-in redirect; unauthorised user → 404; sensitive views audited. |
| Short-lived signed URLs | 🟡 | Not used — every file request is checked against the session instead (equivalent protection). Needed if moving to a bucket. |
| Upload progress / errors; view/download only when authorised | ✅ | |
| Production-grade object storage | 🟡 | Local disk only; needs a persistent volume or a private-bucket adapter. |

## Part E — Dashboard & reports

| Item | Status | Notes |
| --- | --- | --- |
| Live dashboard figures, each linked to source | ✅ | Funds, allocation, unallocated, animals by status, farmers, inspections, vaccinations due, expense approvals, tasks, recent purchases/sales, settlements, cash in/out, receivables/payables. |
| Deposits never shown as revenue; projected ≠ received | ✅ | |
| "Estimated livestock value" | 🟡 | Shown **at purchase cost** with "market value is not estimated" — no valuation feature. |
| 15 reports | ✅ | All 15 present with totals. |
| Filters | ✅ tested | Date, investor, animal, farmer, employee, category and status filters per report; **investment-status filter** (open/closed/suspended account) on funding, purchase, sales and investor-settlement reports; status filters on purchase and sales registers. All 15 reports run with and without filters (test). |
| CSV / PDF export, protected | ✅ tested | CSV and **server-generated PDF for every report** (A4 landscape, filters shown, repeated headers, totals, page numbers, confidentiality footer); both permission-checked, run under RLS and audited. Investor-statement totals count verified/paid rows only. |

## Part F — Audit & financial integrity

| Item | Status |
| --- | --- |
| Audit log of creates, changes (old/new), approvals, status changes, uploads/removals, logins, exports | ✅ |
| Users cannot erase audit history | ✅ tested |
| Reversal/void instead of deletion; no deletion of financial records | ✅ tested |
| Transactions, row locks, idempotency, unique refs, estimated vs approved vs actual vs calculated vs paid | ✅ tested |

## Part G — Email & WhatsApp intake

| Item | Status | Notes |
| --- | --- | --- |
| Pipeline steps 1–9 (receive → detect → extract → match → flag → review → correct → write → record) | ✅ tested | Manual intake and simulated email webhook tested. |
| Unmatched queue, duplicate detection | ✅ tested | |
| No financial posting from unverified extraction | ✅ | Intake creates expense *claims* only. |
| Brief's HV-001 example | ✅ tested | |
| Email / WhatsApp live channels | 🟡 | Email webhook tested with a **simulated** payload only; WhatsApp handler written to Meta's format, **never tested**. Neither connected. |
| OCR / AI extraction of receipts and photos | ❌ | Rule-based text parsing only. |

## Part H — Website ↔ management system

| Item | Status |
| --- | --- |
| Enquiries create internal records (source, contact, date, status, assignee, notes, conversion) | ✅ tested |
| Convert to investor/farmer without retyping; not treated as investor/deposit | ✅ tested |
| Nothing internal publicly readable | ✅ tested |
| `/management` protected; public site needs no login | ✅ tested |

## Part I — UX

| Item | Status | Notes |
| --- | --- | --- |
| Sidebar, dashboard, search, filters, sortable tables, pagination, detail pages, create/edit forms, confirm dialogs, badges, uploads, history, empty states, validation, error handling | ✅ | |
| Loading indicators | ✅ | Button/upload pending states plus a page-level loading skeleton for all management pages. |
| Mobile for field staff | ✅ tested | |
| Tablet | 🟡 | Responsive layout, but not specifically tested at tablet width. |
| Global search, permission-filtered | ✅ tested | |
| PKR, fixed-precision money, configurable timezone | ✅ | |

## Part J — Required tests

| Scenario | Status |
| --- | --- |
| Funding 500k / 2×200k / 100k not profit / linked | ✅ |
| Purchase & allocation | 🟡 — investor/farmer/cost links tested automatically; document linkage checked in the browser (deposit proof, allocation photo), not in the automated suite. |
| Expense 2,500 claim vs approved vs paid | ✅ |
| Sale 250k → 600k, fee once | ✅ |
| Loss + mortality | ✅ |
| Permissions (6 checks) | ✅ |
| Enquiry queue; integrations labelled tested vs mock | ✅ |

---

## Remaining gaps (need external services, content or larger features)

1. Vet-inspection and feeding photos of buffaloes (commission or source licence-clear images).
2. Supabase Auth/Storage (optional swap); production object storage with signed URLs; hosting; security review.
3. Bank-statement reconciliation module.
4. Reminder notifications (email/WhatsApp) — needs a configured channel.
5. Live email/WhatsApp intake and enquiry email alerts — need accounts and testing.
6. Expense-allocation rules engine.
7. OCR/AI receipt extraction feeding the existing review queue.
8. Estimated livestock market value (needs a valuation method).
9. Tablet-width test pass.
