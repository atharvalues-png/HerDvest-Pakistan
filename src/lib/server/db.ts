import "server-only";
import pg from "pg";

/**
 * Database access for the management system.
 *
 * The pool connects as the non-privileged `herdvest_app` role (DATABASE_URL),
 * so PostgreSQL row-level security applies to every query. `withUser` opens a
 * transaction and sets the signed-in user's id for that transaction only;
 * policies resolve permissions from the database, never from the browser.
 */

// numeric → string (exact money values; never parsed into floats here)
pg.types.setTypeParser(1700, (v) => v);
// date → "YYYY-MM-DD" string (no timezone shifting)
pg.types.setTypeParser(1082, (v) => v);
// bigint counts → number
pg.types.setTypeParser(20, (v) => Number(v));

declare global {
  var __hvPool: pg.Pool | undefined;
}

/**
 * The app-role connection string: DATABASE_URL, or — on hosts that provide the
 * database host separately (e.g. the Render blueprint) — built from DB_HOST,
 * DB_PORT, DB_NAME and HERDVEST_APP_DB_PASSWORD. Always the herdvest_app role.
 */
export function appDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const { DB_HOST, DB_PORT, DB_NAME, HERDVEST_APP_DB_PASSWORD } = process.env;
  if (!DB_HOST || !DB_NAME || !HERDVEST_APP_DB_PASSWORD) return undefined;
  return `postgres://herdvest_app:${encodeURIComponent(HERDVEST_APP_DB_PASSWORD)}@${DB_HOST}:${DB_PORT || 5432}/${DB_NAME}`;
}

export function isDatabaseConfigured() {
  return Boolean(appDatabaseUrl());
}

function pool() {
  const url = appDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!globalThis.__hvPool) {
    globalThis.__hvPool = new pg.Pool({
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
    });
  }
  return globalThis.__hvPool;
}

export type Db = pg.PoolClient;

/** Run queries as a specific signed-in user (or anonymously with null). */
export async function withUser<T>(userId: string | null, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('hv.user_id', $1, true)", [userId ?? ""]);
    // Interpret dates/times in the configured business timezone for this transaction.
    await client.query("select set_config('TimeZone', coalesce(hv.setting('timezone') #>> '{}', 'Asia/Karachi'), true)");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Investor-portal context. Only the SHA-256 of the investor's session token is
 * passed to PostgreSQL; the hv.portal_* functions resolve the investor from it,
 * so no investor id from the browser is ever trusted. hv.user_id stays empty,
 * so every staff policy returns nothing.
 */
export async function withInvestor<T>(sessionHash: string, fn: (db: Db) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    await client.query("select set_config('hv.user_id', '', true), set_config('hv.portal_session', $1, true)", [sessionHash]);
    await client.query("select set_config('TimeZone', coalesce(hv.setting('timezone') #>> '{}', 'Asia/Karachi'), true)");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    await client.query("rollback").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Anonymous context: only SECURITY DEFINER helpers (login, public enquiry) return data. */
export const anonymous = <T>(fn: (db: Db) => Promise<T>) => withUser(null, fn);

export type DbError = Error & { code?: string; detail?: string; constraint?: string };

/** Turns a PostgreSQL error into a message that is safe to show to staff. */
export function friendlyDbError(err: unknown): string {
  const e = err as DbError;
  switch (e?.code) {
    case "42501":
      return e.message?.startsWith("Permission denied") || e.message?.includes("cannot") || e.message?.includes("Only")
        ? e.message
        : "You don't have permission to do that.";
    case "P0001":
      return e.message;
    case "23505":
      return `That value is already in use${e.constraint ? ` (${e.constraint.replace(/_/g, " ")})` : ""}. Check for a duplicate record or reference.`;
    case "23503":
      return "A linked record could not be found. Please check your selections.";
    case "23514":
      return "One of the values is outside the allowed range.";
    case "22P02":
    case "22007":
    case "22008":
      return "One of the values has an invalid format.";
    default:
      console.error("[db]", e);
      return "Something went wrong while saving. Nothing was changed.";
  }
}
