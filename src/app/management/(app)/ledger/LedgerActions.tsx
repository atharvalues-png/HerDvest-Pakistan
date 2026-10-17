"use client";

import { ConfirmAction, Input } from "@/components/erp/form";
import { reverseEntry, verifyEntry } from "./actions";

/** Verify / reject / reverse buttons for one ledger row. */
export function LedgerActions({ id, status, entryType, canApprove }: { id: string; status: string; entryType: string; canApprove: boolean }) {
  if (!canApprove) return null;
  if (status === "pending") {
    return (
      <span className="inline-flex gap-1">
        <ConfirmAction action={verifyEntry.bind(null, id, true)} trigger="Verify" triggerVariant="primary" title="Verify this entry?"
          description="Confirm the money movement matches the bank statement or receipt. Verified entries can only be reversed, never edited.">
          <Input name="note" label="Verification note" placeholder="e.g. Matched to bank statement 12 Oct" />
        </ConfirmAction>
        {entryType !== "purchase_allocation" && (
          <ConfirmAction action={verifyEntry.bind(null, id, false)} trigger="Reject" triggerVariant="danger" title="Reject this entry?" variant="danger" confirmLabel="Reject">
            <Input name="note" label="Reason" required />
          </ConfirmAction>
        )}
      </span>
    );
  }
  if (status === "verified" && entryType !== "reversal" && entryType !== "purchase_allocation") {
    return (
      <ConfirmAction action={reverseEntry.bind(null, id)} trigger="Reverse" triggerVariant="ghost" title="Reverse this entry?" variant="danger" confirmLabel="Reverse"
        description="A reversal entry is recorded and the original is marked reversed. Nothing is deleted.">
        <Input name="reason" label="Reason" required />
      </ConfirmAction>
    );
  }
  return null;
}
