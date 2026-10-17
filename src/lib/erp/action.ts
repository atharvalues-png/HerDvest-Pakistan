import "server-only";
import { unstable_rethrow } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { friendlyDbError, withUser, type Db } from "@/lib/server/db";

export type ActionState = {
  ok?: boolean;
  message?: string;
  errors?: Record<string, string>;
  /** increments on every completed submission so forms can reset */
  seq?: number;
};

export class FieldErrors extends Error {
  constructor(public errors: Record<string, string>) {
    super("validation");
  }
}

/**
 * Wraps a server action: requires a session, runs the work in a single
 * database transaction as that user, and converts errors into form state.
 * Anything thrown by redirect()/notFound() is re-thrown.
 */
export async function runAction(
  prev: ActionState | undefined,
  work: (db: Db, user: SessionUser) => Promise<string | void>,
  revalidate: string[] = [],
): Promise<ActionState> {
  const seq = (prev?.seq ?? 0) + 1;
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Your session has expired. Please sign in again.", seq };
  try {
    const message = await withUser(user.id, (db) => work(db, user));
    for (const p of revalidate) revalidatePath(p);
    return { ok: true, message: message ?? "Saved.", seq };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof FieldErrors) return { ok: false, errors: err.errors, message: "Please correct the highlighted fields.", seq };
    return { ok: false, message: friendlyDbError(err), seq };
  }
}

/* ------------------------------------------------------------ parsing -- */

export class Form {
  errors: Record<string, string> = {};
  constructor(private fd: FormData) {}

  raw(name: string) {
    const v = this.fd.get(name);
    return typeof v === "string" ? v.trim() : "";
  }

  text(name: string, o: { required?: boolean; max?: number; label?: string } = {}) {
    const v = this.raw(name);
    if (!v) {
      if (o.required) this.errors[name] = `${o.label ?? "This field"} is required.`;
      return null;
    }
    if (v.length > (o.max ?? 2000)) this.errors[name] = `Keep this under ${o.max ?? 2000} characters.`;
    return v;
  }

  /** Exact decimal string for numeric columns (never a float). */
  money(name: string, o: { required?: boolean; allowZero?: boolean } = {}) {
    const v = this.raw(name).replace(/,/g, "");
    if (!v) {
      if (o.required) this.errors[name] = "Enter an amount.";
      return null;
    }
    if (!/^\d{1,12}(\.\d{1,2})?$/.test(v)) {
      this.errors[name] = "Enter an amount in PKR, e.g. 250000 or 2500.50.";
      return null;
    }
    if (!o.allowZero && /^0+(\.0+)?$/.test(v)) this.errors[name] = "Amount must be greater than zero.";
    return v;
  }

  number(name: string, o: { required?: boolean; min?: number; max?: number; integer?: boolean } = {}) {
    const v = this.raw(name);
    if (!v) {
      if (o.required) this.errors[name] = "Required.";
      return null;
    }
    const n = Number(v);
    if (!Number.isFinite(n) || (o.integer && !Number.isInteger(n)) || (o.min !== undefined && n < o.min) || (o.max !== undefined && n > o.max)) {
      this.errors[name] = "Enter a valid number.";
      return null;
    }
    return n;
  }

  date(name: string, o: { required?: boolean } = {}) {
    const v = this.raw(name);
    if (!v) {
      if (o.required) this.errors[name] = "Choose a date.";
      return null;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
      this.errors[name] = "Enter a valid date.";
      return null;
    }
    return v;
  }

  datetime(name: string, o: { required?: boolean } = {}) {
    const v = this.raw(name);
    if (!v) {
      if (o.required) this.errors[name] = "Choose a date and time.";
      return null;
    }
    if (Number.isNaN(Date.parse(v))) {
      this.errors[name] = "Enter a valid date and time.";
      return null;
    }
    return v;
  }

  id(name: string, o: { required?: boolean; label?: string } = {}) {
    const v = this.raw(name);
    if (!v) {
      if (o.required) this.errors[name] = `Select ${o.label ?? "an option"}.`;
      return null;
    }
    if (!/^[0-9a-f-]{36}$/i.test(v)) {
      this.errors[name] = "Invalid selection.";
      return null;
    }
    return v;
  }

  choice<T extends string>(name: string, allowed: readonly T[], o: { required?: boolean } = {}): T | null {
    const v = this.raw(name);
    if (!v) {
      if (o.required) this.errors[name] = "Choose an option.";
      return null;
    }
    if (!allowed.includes(v as T)) {
      this.errors[name] = "Invalid option.";
      return null;
    }
    return v as T;
  }

  bool(name: string) {
    const v = this.raw(name);
    return v === "on" || v === "true" || v === "yes";
  }

  list(name: string) {
    return this.fd.getAll(name).map(String).filter(Boolean);
  }

  /** Throw collected errors (call after parsing). */
  check() {
    if (Object.keys(this.errors).length) throw new FieldErrors(this.errors);
  }
}
