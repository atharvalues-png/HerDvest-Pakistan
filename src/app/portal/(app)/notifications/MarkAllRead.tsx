"use client";

import { ActionForm, Submit } from "@/components/erp/form";
import { markNotificationsRead } from "../../auth-actions";

export function MarkAllRead() {
  return (
    <ActionForm action={markNotificationsRead} successMessage={false} className="space-y-0">
      <Submit variant="secondary" pendingLabel="Updating…">Mark all as read</Submit>
    </ActionForm>
  );
}
