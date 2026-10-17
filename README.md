# Herdvest Pakistan — website & Herdvest Management System

One Next.js application containing:

1. **The public website** (`/`, `/how-it-works`, `/investors`, `/calculator`, `/farmers`, …) — open to everyone.
   The header has an **Investor Login** link; the footer also has **Staff Login**.
2. **The Investor Portal** (`/portal`) — each investor signs in and sees only their own animals, inspections, weights,
   forecasts, transactions, statements, documents and notifications.
3. **The Herdvest Management System** (`/management`) — a private, staff-only operations system (ERP) for investors,
   funding, livestock, farmers, veterinary care, expenses, tasks, sales, settlements, incidents, documents, reports and audit.

Stack: Next.js 15 (App Router, server actions) · React 19 · TypeScript · Tailwind CSS v4 · PostgreSQL 15+ (row-level
security) · `pg` · Vitest.

> **Status: not yet production-ready.** The system runs and its core workflows, calculations and access controls are
> tested (see [TEST_REPORT.md](TEST_REPORT.md)), but it has not been deployed, security-reviewed by a third party,
> or connected to live email/WhatsApp. See [Before launch](#before-launch).

---

## Architecture & security model

```
Browser ──► Next.js server (pages, server actions, route handlers)
               │  every request: session cookie → hv.auth_session() → user + permissions
               │  every query: BEGIN; set_config('hv.user_id', <user>) ; … ; COMMIT
               ▼
           PostgreSQL  ── connects as role herdvest_app (NOT owner, NOBYPASSRLS)
               • Row-level security on every table (FORCE RLS)
               • Permissions resolved in the DB from roles/role_permissions (hv.has_perm)
               • Money moves only through SECURITY DEFINER workflow functions
                 (record_deposit, create_purchase, decide_expense, record_sale, …)
               • Guard triggers block direct edits of money, status and links
               • Append-only audit_log written by triggers
```

* **Authentication** — email + password (scrypt, N=32768), random 256-bit session token in an `httpOnly`,
  `SameSite=Lax`, `Secure` (in production) cookie; only its SHA-256 hash is stored. Failed-login throttling per IP and
  per account (15-minute lock after 5 failures). Temporary passwords must be changed at first sign-in.
* **Authorisation** — three layers: middleware (no cookie → sign-in), server checks on every page/action/route
  (`requireUser(permission)`), and PostgreSQL RLS. A value sent from the browser can never grant a permission.
  Nobody can change their own role; only a Super Admin can grant Super Admin.
* **Financial integrity** — `numeric(14,2)` money (no floats; the UI sums money with exact integer paisa arithmetic);
  multi-record operations in single transactions with row locks; idempotency keys on deposits, purchases, sales and
  payments; unique constraints (one sale and one settlement — therefore one fee — per animal; an expense can be charged
  to an investor once); no deletion of financial records (void / reject / reverse instead).
* **Files** — stored outside the web root; type validated by file signature (not the browser's claim); size limits;
  served only via `/management/files/[id]` after an RLS check; identity/verification documents flagged sensitive and
  visible only with `files.sensitive`; sensitive views are audited. There are no public file URLs.
* **Public website ↔ management system** — the public enquiry form calls `hv.submit_enquiry()` (insert-only, rate
  limited). Public visitors cannot read any internal table.

### Investor portal — how isolation works

```
Investor browser ── cookie hv_portal (random 256-bit token, httpOnly) ──► Next.js /portal
     │  the server passes ONLY sha256(token) to PostgreSQL: set_config('hv.portal_session', …)
     ▼
PostgreSQL  hv.portal_investor() = the investor of that live, unrevoked, MFA-passed session
            hv.portal_* functions return rows WHERE investor = hv.portal_investor(), investor-safe columns only,
            published content only. Base tables return 0 rows (no staff user, no permissions).
```

* **Separate identities.** Investors are `hv.portal_accounts`, not staff `hv.users`. Different cookie, session table and
  database functions. A staff session never opens the portal; an investor session never opens `/management`
  (no staff user id → every staff policy is false). Tested in both directions.
* **No client-supplied investor id.** Portal pages, the statement PDF and file downloads take no investor id at all. An
  animal or file id in a URL is checked by the database against the session's investor; another investor's id returns
  404 (tested).
* **Publication workflow.** Veterinary/inspection reports, photos/documents, weights and forecasts are invisible to
  investors until someone with `portal.publish` publishes them. Editing a published vet report withdraws it until
  republished. Publication flags can only change through the publish functions (direct `UPDATE` is rejected). Identity
  and verification documents can never be shared; files on farmer, staff, incident, task, enquiry and intake records
  can never be shared.
* **What investors never see:** internal notes, costs on vet records, farmer identity (only "Partner farmer FRM-…" and
  district, unless Settings → `portal_show_farmer_name` is turned on), exact addresses, CNIC images, unapproved
  settlement figures, draft forecasts, draft payment requests.
* **Accounts.** Created only by staff with `portal.manage` via **Investors → [investor] → Investor portal access →
  Invite to portal**: a one-time activation link (stored hashed, 7-day expiry); the investor chooses their own password.
  No shared or default passwords exist. Staff can issue a 24-hour reset link, suspend, restore, revoke, or remove
  two-step verification (after verifying identity). Suspension/revocation ends all sessions immediately.
* **Sign-in security.** scrypt hashes, 5-failure lockout, IP throttling, 8-hour sessions (`PORTAL_SESSION_HOURS`),
  optional **two-step verification** (TOTP authenticator apps) set up by the investor under Profile.
* **Investor self-service.** Change password, set up two-step verification, request profile corrections (staff verify
  and apply them — investors cannot edit their record or their link to it), mark notifications read.
* **Figures.** "Received", "allocated", "unallocated", "returned", "pending" and realised results come from verified
  ledger/settlement records. Purchase allocations awaiting final reconciliation are counted as allocated and labelled.
  Forecasts are shown only in the Outlook (dashed/“Estimate” styling + risk notice) and never in the ledger or
  statement. Payment requests need a signed agreement reference, a supporting clause and issue by a finance approver;
  they are shown as "outstanding", never as money received.

### Roles (editable under Users & roles → Role permissions)

| Role | Summary |
| --- | --- |
| Super Admin / Business Owner | Everything, incl. users, role permissions, settings, audit log |
| Operations Manager | Purchases, livestock, allocation, farmers & verification, veterinary, tasks, sales, incidents, enquiries, intake |
| Finance Officer | Investors, deposits & ledger verification, expense approval, settlements & payments, financial reports, sensitive files |
| Field Employee / Inspector | Only animals/farmers on their **open** tasks; submit inspections, vet visits, photos, expense claims, incidents |
| Read-Only Auditor | Read access to records, reports and audit log; cannot change anything |

New roles can be created and given any combination of the 43 permissions. Portal permissions: `portal.manage`
(Super Admin, Finance — invite/suspend/revoke investor logins, resolve corrections), `portal.publish` (Super Admin,
Operations — publish reports, photos, weights, forecasts, updates), `forecasts.write` (Super Admin, Operations, Finance —
draft forecasts).

---

## Local setup

```bash
# 1. PostgreSQL 15+ (macOS example; any Postgres works)
brew install postgresql@17
initdb -D .pgdata -U postgres --auth=trust -E UTF8      # local dev only
LC_ALL=en_US.UTF-8 pg_ctl -D .pgdata -o "-p 54329" -l .pgdata/server.log start
createdb -h localhost -p 54329 -U postgres herdvest

# 2. Configuration
cp .env.example .env.local      # then set DATABASE_URL / DATABASE_ADMIN_URL / FILE_STORAGE_DIR
npm install

# 3. Database schema (creates the herdvest_app role, applies db/migrations/*.sql once each)
node scripts/migrate.mjs

# 4. First Super Admin (password read from HERDVEST_ADMIN_PASSWORD or prompted; must be changed at first sign-in)
node scripts/create-admin.mjs --email owner@yourcompany.pk --name "Owner Name"
#    This is the ONLY way the first staff account is created: run it once, from a trusted machine, with the admin
#    database URL. It is never exposed through the website. All further staff accounts are created in
#    Management → Users & roles; investor logins are created by invitation (below).

# 5. Run
npm run dev          # http://localhost:3000  ·  management: /management
npm test             # calculator, intake parser and database scenario tests (creates <db>_test)
```

### Provisioning investors

1. The investor record exists in Management → Investors (created directly or by converting a website enquiry).
2. A user with `portal.manage` opens the investor → **Investor portal access → Invite to portal**, enters the
   investor's email, and gets a one-time activation link (also emailed when email is configured).
3. The investor opens the link, chooses a password (12+ characters, letters and numbers) and signs in at `/portal/login`.
4. Publish content as it is verified: vet record → **Review & publish**; animal page → weights / forecasts / updates;
   file lists → **Share with investor**. Anything not published stays internal.

If no investor accounts exist, Management → **Investor portal** explains these steps and lists investors without access.

### URLs and optional subdomains

The portal and staff system are routes in the same app: `/portal` and `/management`, each with its own sign-in page and
cookie. To serve them on subdomains (e.g. `invest.example.com`, `management.example.com`), point the hostnames at the
same deployment and add a host-based rewrite in `src/middleware.ts` (e.g. `invest.*/` → `/portal`); set
`PORTAL_BASE_URL` so invitation links use the right host. This is **not** configured — no domains are assumed.

## Deployment

**Render (recommended, one blueprint):** see [DEPLOY_RENDER.md](DEPLOY_RENDER.md) for click-by-click steps using `render.yaml`.

**Database** — any managed PostgreSQL 15+ (Supabase, Neon, AWS RDS, DigitalOcean …). Run `scripts/migrate.mjs` with
`DATABASE_ADMIN_URL` (owner/admin) from a trusted machine or CI; give the web app **only** `DATABASE_URL` for
`herdvest_app`. Enable `DATABASE_SSL=true` where TLS is required. Configure automated backups and point-in-time recovery.
On Supabase, use the Postgres connection string (not the REST API); Supabase Auth/Storage are not used by this design.

**Application** — a long-running Node.js host with a persistent disk (VPS, Docker container, Render, Railway, Fly.io):
`npm run build && npm start`, behind HTTPS. Set all variables from `.env.example`.

**File storage** — the bundled driver (`src/lib/server/storage.ts`) writes to `FILE_STORAGE_DIR` and needs a persistent,
backed-up volume. Serverless platforms (e.g. Vercel) have no persistent disk: before deploying there, implement the
three functions in that file (`putObject`, `getObject`, `deleteObject`) against a **private** S3 / Cloudflare R2 /
Supabase Storage bucket. Files must never be made public.

**Security headers** — `/management` responses are `no-store`, `X-Frame-Options: DENY`, `nosniff`. Add a site-wide CSP
and HSTS at the proxy/CDN.

---

## Integrations — status

| Integration | Status | What is required |
| --- | --- | --- |
| PostgreSQL database | **Working locally & tested** | Production database + `DATABASE_URL`, `DATABASE_ADMIN_URL` |
| Staff authentication | **Working & tested** | — (create the first admin with `scripts/create-admin.mjs`) |
| Private file storage | **Working locally (disk)** | Persistent volume, or a private-bucket adapter for serverless hosting |
| Website enquiries → management queue | **Working & tested** | `DATABASE_URL` on the website host |
| Enquiry email notification | **Implemented, not tested** | `RESEND_API_KEY`, `ENQUIRY_NOTIFY_EMAIL`, verified `ENQUIRY_FROM_EMAIL` domain |
| Enquiry webhook forward (CRM) | **Implemented, not tested** | `FORM_WEBHOOK_URL` (+ optional secret) |
| Email intake (`/api/intake/email`) | **Tested locally with a simulated Postmark-format payload. Not connected to any mailbox.** | Inbound-email provider + `INTAKE_WEBHOOK_SECRET` |
| WhatsApp intake (`/api/intake/whatsapp`) | **Implemented to Meta's documented format; not tested with WhatsApp** | WhatsApp Business Platform app, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_ACCESS_TOKEN` (for media) |
| AI/OCR extraction from receipts | **Not implemented** — rule-based text parsing only | Optional future work; output must still go through the review queue |
| Investor portal sign-in, isolation, publishing | **Working locally & tested** (automated + browser) | — |
| Investor two-step verification (TOTP) | **Working locally & tested in the browser** | — |
| Investor emails (invitations, reset links, notifications) | **Implemented, not tested** — without email, links are shown to staff to share and notifications appear in the portal only | `RESEND_API_KEY`, verified `PORTAL_FROM_EMAIL`, `PORTAL_BASE_URL` |

No intake channel posts records by itself: every message becomes a draft in **Intake queue**, unmatched items are
flagged, duplicates are detected, and an authorised reviewer verifies before records are written. Expenses created from
intake are still only *claims* until approved.

---

## Business rules implemented

* **Public calculator** — price categories PKR 100k/150k/250k per animal, any whole number of animals, editable sale
  price per animal (default PKR 600,000, hypothetical), holding period 1/2/3/custom years. Fixed terms: 50/50 split,
  Herdvest fee 20 % of investor gross share **once per completed sale**. Losses show a capital shortfall with no profit
  split. Holding-period and annualised returns are shown with assumptions.
* **Funding ledger** — deposits are *pending* until verified; balances use verified entries only; outflows committed
  but not yet verified reduce available funds; unallocated cash after a purchase triggers a recorded decision (retain /
  approved expense / return / hold) and is never treated as profit.
* **Purchases** — blocked if verified unallocated funds are insufficient; create animals, purchase lines and the funding
  allocation atomically.
* **Farmers** — cannot be created as verified; verification only through the workflow (with notes and approver);
  only verified farmers can receive animals; transfers close (never overwrite) the previous allocation.
* **Expenses** — submitted → approved/rejected → paid (or disputed/voided); approver decides who bears the cost
  (Herdvest operating, chargeable to the investment, covered by the service fee, paid by farmer, reimbursement);
  only "chargeable to the investment" touches investor funds, exactly once; animal splits must add up.
* **Sales & settlements** — capital returned first; profit pool split 50/50 (configurable per account); fee 20 % of the
  investor share; settlement held for review on loss/shortfall, unpaid buyer, disputes, disputed or unapproved
  expenses, or open incidents; calculated ≠ approved ≠ paid; partial payments and outstanding balances tracked.
* **Incidents** — death marks the animal deceased and ends its allocation; decisions need `incidents.approve`; no
  automatic compensation; all history kept.

---

## Before launch

1. Provision production PostgreSQL, run migrations, create the first admin, configure backups.
2. Choose hosting; configure persistent or bucket-based private file storage.
3. Configure and **test** enquiry notification email, and any intake channels you want live.
4. Replace every `[placeholder]` in `src/config/site.ts` and `src/content/legal.ts` with verified details; have the
   legal pages, investment agreement, fee terms, tax and regulatory position, and any Shariah claim reviewed by
   qualified professionals in Pakistan.
5. Review role permissions; turn on **dual control** (Settings) if two people should handle each deposit.
6. Independent security review / penetration test, and a data-protection review of what personal data is collected.
7. Replace illustrative photographs with Herdvest's own farm photography where possible (credits at `/credits`).
8. Investor portal: configure and test email (`RESEND_API_KEY`, `PORTAL_FROM_EMAIL`, `PORTAL_BASE_URL`); agree the
   privacy policy for farmer details shown to investors; decide who holds `portal.publish`; test on real phones.

## Project layout

```
db/migrations/           001 foundation · 002 business tables · 003 workflows & guards · 004 RLS & seed
                         005 auth · 006 admin grants · 007 intake · 008 investor portal
scripts/                 migrate.mjs · create-admin.mjs
src/app/(site)/          public website pages
src/app/portal/          investor sign-in/activation/reset/verify, (app)/ portal pages, files & statement routes
src/app/management/      login, auth actions, (app)/ module pages (incl. portal/ admin + publish actions), files & export routes
src/app/api/             enquiry, intake/email, intake/whatsapp
src/components/erp/      Shell, DataTable, forms, Attachments/Uploader, History, UI kit
src/lib/server/          db (RLS context), storage, attachments
src/lib/auth/            password hashing, staff sessions, investor sessions, TOTP
src/lib/portal/          portal data access, actions wrapper, statement layout
src/lib/erp/             actions/validation, list params, reports, PDF rendering, formatting, options, nav
src/lib/intake/          message parser and intake pipeline
src/lib/calculator.ts    public illustrative calculator (exact paisa arithmetic)
tests/                   calculator, intake parser, reports/PDF, database scenarios, investor portal isolation
```

## Image credits

Photographs are from Wikimedia Commons (CC BY / CC BY-SA — attribution on `/credits`) and Unsplash (Unsplash License).
