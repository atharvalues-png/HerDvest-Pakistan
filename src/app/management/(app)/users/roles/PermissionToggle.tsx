"use client";

import { useActionState } from "react";
import { togglePermission } from "../actions";
import type { ActionState } from "@/lib/erp/action";

export function PermissionToggle({ roleId, permission, granted, disabled }: { roleId: string; permission: string; granted: boolean; disabled: boolean }) {
  const [state, action, pending] = useActionState(
    (prev: ActionState) => togglePermission(roleId, permission, !granted, prev),
    {} as ActionState,
  );
  return (
    <form action={action}>
      <button
        type="submit"
        disabled={disabled || pending}
        aria-pressed={granted}
        aria-label={`${granted ? "Remove" : "Grant"} ${permission} for ${roleId}`}
        title={state.ok === false ? state.message : undefined}
        className={`h-5 w-5 rounded border text-[0.7rem] font-bold leading-none ${granted ? "border-emerald bg-emerald text-ivory" : "border-forest/20 bg-white"} ${disabled ? "cursor-not-allowed opacity-60" : "hover:border-emerald"} ${state.ok === false ? "ring-2 ring-alert" : ""}`}
      >
        {granted ? "✓" : ""}
      </button>
    </form>
  );
}
