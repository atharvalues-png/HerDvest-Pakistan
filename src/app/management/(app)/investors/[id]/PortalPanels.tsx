import Link from "next/link";
import { can, type SessionUser } from "@/lib/auth/session";
import { withUser } from "@/lib/server/db";
import { formatDate, label } from "@/lib/erp/format";
import { isEmailConfigured } from "@/lib/server/email";
import { ConfirmAction, Input, MoneyInput, Select, Textarea } from "@/components/erp/form";
import { Alert, Badge, Card, DL, Money, StatusBadge } from "@/components/erp/ui";
import {
  closePaymentRequest, createPaymentRequest, inviteInvestor, issuePaymentRequest, issuePortalReset, resetPortalMfa,
  resolveChangeRequest, setAgreedBudget, setIdentityNumber, setPortalStatus,
} from "../../portal/actions";

/** Investor portal access, profile corrections, identity number, budgets and payment requests for one investor. */
export async function PortalPanels({ user, investorId, investorEmail, timeZone, accounts }: {
  user: SessionUser;
  investorId: string;
  investorEmail: string | null;
  timeZone: string;
  accounts: Array<{ id: string; code: string; agreement_ref: string | null; agreed_budget: string | null }>;
}) {
  const fin = can(user, "finance.read");
  const d = await withUser(user.id, async (db) => ({
    acc: (await db.query(
      "select id, email, status, status_reason, mfa_enabled, invited_at, activated_at, last_login_at, locked_until from hv.portal_accounts where investor_id = $1",
      [investorId])).rows[0],
    requests: (await db.query(
      "select * from hv.portal_change_requests where investor_id = $1 order by status = 'open' desc, created_at desc limit 20", [investorId])).rows,
    identity: (await db.query("select hv.investor_identity_masked($1) v", [investorId])).rows[0].v as string | null,
    payReqs: fin ? (await db.query(
      `select r.*, a.code account_code, l.code ledger_code from hv.payment_requests r join hv.investment_accounts a on a.id = r.account_id
         left join hv.ledger_entries l on l.id = r.ledger_entry_id where r.investor_id = $1 order by r.created_at desc`, [investorId])).rows : [],
    deposits: fin ? (await db.query(
      "select id, code, amount, account_id from hv.ledger_entries where investor_id = $1 and entry_type = 'deposit' and status = 'verified' order by occurred_at desc limit 50",
      [investorId])).rows : [],
  }));
  const manage = can(user, "portal.manage");
  const a = d.acc;
  const email = isEmailConfigured();

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Investor portal access"
        actions={manage && (!a || a.status === "invited" || a.status === "revoked") && (
          <ConfirmAction action={inviteInvestor.bind(null, investorId)} keepOpen trigger={a ? "New invitation" : "Invite to portal"} triggerVariant="primary"
            title="Invite this investor to the portal" confirmLabel="Create invitation"
            description={<>Creates a one-time activation link (valid 7 days) linked only to this investor record. {email ? "It is emailed to the address below and shown once here." : "Email is not configured, so share the link yourself through a trusted channel."} Previous unused links stop working.</>}>
            <Input name="email" label="Investor's sign-in email" type="email" required defaultValue={a?.email ?? investorEmail ?? ""} />
          </ConfirmAction>
        )}>
        {!a ? (
          <p className="text-sm text-ink-500">No portal account yet. {manage ? "Invite the investor once their agreement is signed." : "A user with portal management permission can invite them."}</p>
        ) : (
          <div className="space-y-4">
            <DL cols={2} items={[
              ["Sign-in email", a.email],
              ["Status", <span key="s" className="inline-flex items-center gap-2"><StatusBadge status={a.status} />{a.status === "invited" && <span className="text-xs text-ink-500">awaiting activation</span>}</span>],
              ["Invited", formatDate(a.invited_at, timeZone, true)], ["Activated", a.activated_at ? formatDate(a.activated_at, timeZone, true) : "Not yet"],
              ["Last sign-in", a.last_login_at ? formatDate(a.last_login_at, timeZone, true) : "Never"],
              ["Two-step verification", a.mfa_enabled ? <Badge key="m" tone="green">On</Badge> : "Off"],
              ...(a.status_reason ? [["Reason", a.status_reason]] as Array<[string, string]> : []),
              ...(a.locked_until && new Date(a.locked_until) > new Date() ? [["Locked until", formatDate(a.locked_until, timeZone, true)]] as Array<[string, string]> : []),
            ]} />
            {manage && (
              <div className="flex flex-wrap gap-2 border-t border-forest/10 pt-4">
                {a.status === "active" && (
                  <>
                    <ConfirmAction action={issuePortalReset.bind(null, a.id, investorId)} keepOpen trigger="Password reset link" title="Create a password reset link?"
                      description="Confirm the investor's identity first. The link is shown once and expires in 24 hours." confirmLabel="Create link" />
                    {a.mfa_enabled && (
                      <ConfirmAction action={resetPortalMfa.bind(null, a.id, investorId)} trigger="Reset two-step" title="Remove two-step verification?" variant="danger"
                        description="Only do this after verifying the investor's identity (e.g. lost phone). Their sessions end." confirmLabel="Remove" />
                    )}
                    <ConfirmAction action={setPortalStatus.bind(null, a.id, investorId, "suspended")} trigger="Suspend" triggerVariant="danger" variant="danger"
                      title="Suspend portal access?" description="The investor is signed out everywhere and cannot sign in until access is restored. Their records are unchanged." confirmLabel="Suspend">
                      <Textarea name="reason" label="Reason" required rows={2} />
                    </ConfirmAction>
                  </>
                )}
                {a.status === "suspended" && (
                  <ConfirmAction action={setPortalStatus.bind(null, a.id, investorId, "active")} trigger="Restore access" title="Restore portal access?" confirmLabel="Restore" />
                )}
                {(a.status === "active" || a.status === "suspended" || a.status === "invited") && (
                  <ConfirmAction action={setPortalStatus.bind(null, a.id, investorId, "revoked")} trigger="Revoke" triggerVariant="danger" variant="danger"
                    title="Revoke portal access?" description="Permanently disables this login and any pending links. A new invitation can be issued later if needed." confirmLabel="Revoke">
                    <Textarea name="reason" label="Reason" required rows={2} />
                  </ConfirmAction>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card title={`Profile correction requests (${d.requests.filter((r) => r.status === "open").length} open)`}>
        <DL cols={2} items={[
          ["National identity number", d.identity ?? "Not recorded"],
          ["Shown to the investor as", d.identity ?? "—"],
        ]} />
        {can(user, "investors.write") && can(user, "files.sensitive") && (
          <div className="mt-3">
            <ConfirmAction action={setIdentityNumber.bind(null, investorId)} trigger="Set identity number" title="Identity number (CNIC)"
              description="Stored separately and readable only by staff with sensitive-document access. Shown masked everywhere else, including the investor portal.">
              <Input name="national_id" label="CNIC / national ID" placeholder="35202-1234567-1" />
            </ConfirmAction>
          </div>
        )}
        {d.requests.length === 0 ? <p className="mt-4 text-sm text-ink-500">No correction requests from the investor.</p> : (
          <ul className="mt-4 divide-y divide-forest/5 border-t border-forest/10">
            {d.requests.map((r) => (
              <li key={r.id} className="py-2.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span><span className="font-semibold text-forest">{label(r.field)}</span>{r.requested_value ? `: ${r.requested_value}` : ""}</span>
                  <StatusBadge status={r.status === "open" ? "pending" : r.status} />
                </div>
                {r.message && <p className="text-ink-600">{r.message}</p>}
                <p className="text-xs text-ink-500">{formatDate(r.created_at, timeZone, true)}{r.resolution_note ? ` · ${r.resolution_note}` : ""}</p>
                {r.status === "open" && (can(user, "portal.manage") || can(user, "investors.write")) && (
                  <div className="mt-2 flex gap-2">
                    <ConfirmAction action={resolveChangeRequest.bind(null, r.id, investorId, "resolved")} trigger="Mark resolved" triggerVariant="ghost" title="Resolve request"
                      description={<>Update the investor record yourself (Edit), after verifying the change. <Link href={`/management/investors/${investorId}/edit`} className="text-emerald underline">Open edit form</Link></>}>
                      <Textarea name="note" label="Note to the investor" required rows={2} />
                    </ConfirmAction>
                    <ConfirmAction action={resolveChangeRequest.bind(null, r.id, investorId, "declined")} trigger="Decline" triggerVariant="ghost" title="Decline request" variant="danger" confirmLabel="Decline">
                      <Textarea name="note" label="Reason (shown to the investor)" required rows={2} />
                    </ConfirmAction>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {fin && (
        <Card title="Payment requests and investment budget" className="lg:col-span-2">
          <Alert tone="info">
            A payment request must be supported by the signed agreement, reviewed, and issued by a finance approver. Recording an expense never creates a request automatically.
          </Alert>
          <div className="mt-4 flex flex-wrap gap-2">
            {accounts.map((acc) => (
              <span key={acc.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-forest/10 px-3 py-1.5 text-sm">
                <span className="font-semibold text-forest">{acc.code}</span>
                budget {acc.agreed_budget ? <Money value={acc.agreed_budget} /> : <span className="text-ink-500">not recorded</span>}
                {can(user, "investors.write") && (
                  <ConfirmAction action={setAgreedBudget.bind(null, acc.id, investorId)} trigger="Edit" triggerVariant="ghost" title={`Original investment budget · ${acc.code}`}
                    description="The amount the investor agreed to invest, as written in the agreement. This is not money received.">
                    <MoneyInput name="agreed_budget" label="Budget (PKR)" defaultValue={acc.agreed_budget} />
                  </ConfirmAction>
                )}
                {can(user, "finance.write") && (
                  <ConfirmAction action={createPaymentRequest.bind(null, acc.id, investorId)} trigger="New payment request" triggerVariant="ghost" title={`Payment request · ${acc.code}`}
                    description={acc.agreement_ref ? `Under agreement ${acc.agreement_ref}. Saved as a draft for review.` : "Record the signed agreement reference on this account first."}>
                    <MoneyInput name="amount" label="Amount (PKR)" required />
                    <Input name="agreement_clause" label="Agreement clause that supports this request" required placeholder="e.g. Clause 7.2 — additional feed costs" />
                    <Textarea name="reason" label="Reason" required rows={2} />
                    <Input name="due_date" label="Due date" type="date" />
                  </ConfirmAction>
                )}
              </span>
            ))}
          </div>
          {d.payReqs.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="text-left text-xs text-ink-500"><tr><th className="py-1.5 pr-3">Request</th><th className="pr-3">Reason / clause</th><th className="pr-3 text-right">Amount</th><th className="pr-3">Status</th><th /></tr></thead>
                <tbody className="divide-y divide-forest/5">
                  {d.payReqs.map((r) => (
                    <tr key={r.id} className="align-top">
                      <td className="py-2 pr-3"><span className="font-semibold text-forest">{r.code}</span><span className="block text-xs text-ink-500">{r.account_code} · {formatDate(r.created_at, timeZone)}</span></td>
                      <td className="pr-3">{r.reason}<span className="block text-xs text-ink-500">{r.agreement_clause}{r.due_date ? ` · due ${formatDate(r.due_date, timeZone)}` : ""}{r.ledger_code ? ` · paid by ${r.ledger_code}` : ""}{r.closed_note ? ` · ${r.closed_note}` : ""}</span></td>
                      <td className="pr-3 text-right"><Money value={r.amount} /></td>
                      <td className="pr-3"><StatusBadge status={r.status === "issued" ? "pending" : r.status} /> {r.status === "issued" && <span className="text-xs text-ink-500">visible to investor</span>}</td>
                      <td className="space-x-1 whitespace-nowrap text-right">
                        {r.status === "draft" && can(user, "finance.approve") && (
                          <ConfirmAction action={issuePaymentRequest.bind(null, r.id, investorId)} trigger="Review & issue" triggerVariant="ghost" title="Issue this payment request?"
                            description="The investor will see it in their portal as an amount due under their agreement." confirmLabel="Issue" />
                        )}
                        {r.status === "issued" && can(user, "finance.write") && (
                          <ConfirmAction action={closePaymentRequest.bind(null, r.id, investorId, "paid")} trigger="Mark paid" triggerVariant="ghost" title="Mark as paid">
                            <Select name="ledger_entry_id" label="Verified deposit that paid this request" required
                              options={d.deposits.filter((x) => x.account_id === r.account_id).map((x) => [x.id, `${x.code} · PKR ${x.amount}`])} />
                          </ConfirmAction>
                        )}
                        {(r.status === "draft" || r.status === "issued") && can(user, "finance.write") && (
                          <ConfirmAction action={closePaymentRequest.bind(null, r.id, investorId, "cancelled")} trigger="Cancel" triggerVariant="ghost" title="Cancel this request?" variant="danger" confirmLabel="Cancel request">
                            <Textarea name="note" label="Reason" required rows={2} />
                          </ConfirmAction>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
