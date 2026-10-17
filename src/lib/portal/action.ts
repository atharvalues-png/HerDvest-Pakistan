import "server-only";
import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPortalSession, type PortalUser } from "@/lib/auth/portal-session";
import { friendlyDbError, withInvestor, type Db } from "@/lib/server/db";
import { FieldErrors, type ActionState } from "@/lib/erp/action";

/** Server-action wrapper for the investor portal: session required, runs in the investor's database context. */
export async function runPortalAction(
  prev: ActionState | undefined,
  work: (db: Db, user: PortalUser) => Promise<string | void>,
  revalidate: string[] = [],
): Promise<ActionState> {
  const seq = (prev?.seq ?? 0) + 1;
  const user = await getPortalSession();
  if (!user || !user.mfaPassed) return { ok: false, message: "Your session has expired. Please sign in again.", seq };
  try {
    const message = await withInvestor(user.sessionHash, (db) => work(db, user));
    for (const p of revalidate) revalidatePath(p);
    return { ok: true, message: message ?? "Saved.", seq };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof FieldErrors) return { ok: false, errors: err.errors, message: "Please correct the highlighted fields.", seq };
    return { ok: false, message: friendlyDbError(err), seq };
  }
}
