# Make Herdvest live on Render

This repository contains a Render **Blueprint** (`render.yaml`). It creates everything the system needs:

| Resource | What it is | Plan in the blueprint |
| --- | --- | --- |
| `herdvest-db` | Managed PostgreSQL 17, Singapore, not reachable from the internet | `basic-256mb` (paid) |
| `herdvest-web` | The website, investor portal and management system (Node.js) | `starter` (paid) |
| `herdvest-files` | 5 GB private disk for uploaded photos, receipts and documents | billed per GB |

Paid plans are required: Render's free web plan has no persistent disk and no pre-deploy step, and free databases are
deleted after a trial period. Check current prices on render.com before you start. Singapore is the closest Render
region to Pakistan.

## What has and hasn't been tested

- **Tested locally:** the blueprint's setup on a fresh PostgreSQL where the database owner is *not* a superuser (as on
  Render). This covered migrations, a second "redeploy" migration run, creating the first admin, the production build,
  public pages, and a staff sign-in.
- **Not tested:** an actual Render deployment, Render's network, disk and Shell, a custom domain, and email. These need
  your Render account. If a step below fails, the deploy log says why; the most likely point is the first migration
  (see *Troubleshooting*).

---

## Step by step

### 1. Create a Render account
1. Go to **https://render.com** → **Get Started**. Sign up with **GitHub** (account `atharvalues-png`).
2. Add a payment method: **Account settings → Billing**.

### 2. Create the services from the blueprint
1. In the Render dashboard click **New +** → **Blueprint**.
2. Choose **Connect GitHub** if asked, and give Render access to the repository **atharvalues-png/HerDvest-Pakistan**.
3. Select the repository. Render reads `render.yaml` and shows `herdvest-db` and `herdvest-web`.
4. Enter a **Blueprint name**, for example `herdvest`.
5. Render asks for the variables marked `sync: false`. For now:
   - `NEXT_PUBLIC_SITE_URL` and `PORTAL_BASE_URL` → leave **empty** (you will fill them in step 4).
   - `RESEND_API_KEY`, `PORTAL_FROM_EMAIL`, `ENQUIRY_NOTIFY_EMAIL`, `ENQUIRY_FROM_EMAIL` → leave **empty**.
6. Click **Apply** (or **Deploy Blueprint**). Render creates the database first, then builds the web service.
   The first build takes about 5–10 minutes.

### 3. Watch the first deploy
1. Open **herdvest-web → Events / Logs**.
2. You should see `npm ci`, `next build`, then the pre-deploy step printing `applying 001_foundation.sql … ok` up to
   `008_investor_portal.sql … ok`, then `migrations up to date`.
3. When the status says **Live**, click the URL at the top (like `https://herdvest-web.onrender.com`). The public
   website should open.

### 4. Tell the app its address
1. Copy the live URL.
2. **herdvest-web → Environment** → set:
   - `NEXT_PUBLIC_SITE_URL` = the URL (e.g. `https://herdvest-web.onrender.com`)
   - `PORTAL_BASE_URL` = the same URL
3. **Save Changes**. Render redeploys automatically (a few minutes).
   These are used for links in investor invitations, for the sitemap and for social previews.

### 5. Create the first Super Admin (owner account)
This is the only way to create the first staff login. It is never possible from the website.
1. **herdvest-web → Shell** (left menu).
2. Run (with your own email and name):
   ```bash
   node scripts/create-admin.mjs --email owner@yourcompany.pk --name "Owner Full Name"
   ```
3. When asked, type a temporary password (12+ characters). It is visible while you type, but it is not passed on the
   command line or kept in shell history, and you must replace it at first sign-in.
4. Open `https://<your-url>/management/login`, sign in, and choose your permanent password when asked.

### 6. Check it works
- Public site: `/`, `/calculator`, and an enquiry from `/investors#enquiry` (it appears under Management → Enquiries).
- **Management → Settings**: Database and File storage should both show as configured.
- Upload a test photo on any record and open it again. That confirms the private disk works.
- **Investor portal:** create a test investor, then **Investor portal access → Invite to portal**. Open the link in a
  private window, set a password and sign in at `/portal/login`.

### 7. Optional: your own domain
1. Buy or choose a domain (for example `herdvest.pk`).
2. **herdvest-web → Settings → Custom Domains → Add**. Enter `www.yourdomain` and follow Render's DNS instructions at
   your domain registrar. Render issues the HTTPS certificate automatically.
3. Update `NEXT_PUBLIC_SITE_URL` and `PORTAL_BASE_URL` to `https://www.yourdomain` and save.
4. Subdomains such as `invest.yourdomain` also work. Point them at the same service; README → "URLs and optional
   subdomains" explains the small extra change needed.

### 8. Optional: email (invitations, reset links, notifications, enquiry alerts)
Until this is done, invitation and reset links are shown to staff on screen to pass on, and notifications appear only
inside the portal. Nothing pretends an email was sent.
1. Create an account at **https://resend.com**, add and verify your domain, and create an API key.
2. **herdvest-web → Environment**: set `RESEND_API_KEY`, `PORTAL_FROM_EMAIL` (e.g. `Herdvest <no-reply@yourdomain>`),
   `ENQUIRY_FROM_EMAIL` (same sender) and `ENQUIRY_NOTIFY_EMAIL` (your company inbox). Save.
3. Test: invite yourself as an investor and submit a website enquiry. Confirm both emails arrive.

### 9. Backups
- **herdvest-db → Recovery**: confirm point-in-time recovery or backups are enabled for your plan.
- **herdvest-web → Disks**: Render takes daily disk snapshots. Uploaded files live only on this disk, so do not delete
  the service.

---

## Updating the live site
Push to the `main` branch on GitHub. Render rebuilds, runs any new migrations, and switches over automatically.

## Security notes
- The web app connects as `herdvest_app`, which cannot bypass row-level security. Its password is generated by Render
  (`HERDVEST_APP_DB_PASSWORD`) and is never in the code.
- `DATABASE_ADMIN_URL` is also on the web service, because Render runs migrations in the service's pre-deploy step.
  The application code never uses it. To remove it later, run migrations from a separate Render job or from a trusted
  machine instead.
- The database has an empty IP allow-list, so it is reachable only by your Render services.
- Before taking real investor money: review the legal pages and placeholders (README → Before launch), and get an
  independent security review.

## Troubleshooting
| Symptom | Fix |
| --- | --- |
| Pre-deploy fails with `permission denied to create role` | The database user cannot create roles. In **herdvest-db → Info**, use **psql** with the External/Internal URL and run `create role herdvest_app login nobypassrls password '<value of HERDVEST_APP_DB_PASSWORD>';`, then redeploy. |
| Site works but uploads fail | Check `FILE_STORAGE_DIR=/var/data/storage` and that the disk is mounted at `/var/data`. |
| Login says the database is not configured | `DB_HOST`, `DB_NAME` and `HERDVEST_APP_DB_PASSWORD` must be set (the blueprint does this). Redeploy. |
| Invitation links point to the wrong address | Set `PORTAL_BASE_URL` to the live URL. |
