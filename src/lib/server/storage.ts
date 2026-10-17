import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Private file storage. Files live OUTSIDE the public web root and are only
 * served through /management/files/[id] after an authorisation check.
 *
 * The default driver writes to FILE_STORAGE_DIR on the server's disk, which is
 * suitable for a VPS / container with a persistent volume. Serverless hosts
 * (e.g. Vercel) have no persistent disk: implement the same three functions
 * against a private S3 / R2 / Supabase Storage bucket before deploying there.
 */

const root = () => path.resolve(process.env.FILE_STORAGE_DIR ?? "./storage");

export function isStorageConfigured() {
  return Boolean(process.env.FILE_STORAGE_DIR);
}

export async function putObject(data: Buffer) {
  const now = new Date();
  const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}`;
  const full = path.join(root(), key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data, { mode: 0o600 });
  return { key, sha256: createHash("sha256").update(data).digest("hex") };
}

export async function getObject(key: string) {
  if (!/^\d{4}\/\d{2}\/[0-9a-f-]{36}$/.test(key)) throw new Error("Invalid storage key");
  return readFile(path.join(root(), key));
}

export async function deleteObject(key: string) {
  if (!/^\d{4}\/\d{2}\/[0-9a-f-]{36}$/.test(key)) return;
  await rm(path.join(root(), key), { force: true });
}

/* ------------------------------------------------- type validation ---- */

const MB = 1024 * 1024;
export const fileRules = {
  "image/jpeg": { max: 15 * MB, kind: "image" },
  "image/png": { max: 15 * MB, kind: "image" },
  "image/webp": { max: 15 * MB, kind: "image" },
  "image/heic": { max: 20 * MB, kind: "image" },
  "application/pdf": { max: 20 * MB, kind: "document" },
  "video/mp4": { max: 200 * MB, kind: "video" },
  "video/quicktime": { max: 200 * MB, kind: "video" },
  "video/webm": { max: 200 * MB, kind: "video" },
} as const;
export type AllowedMime = keyof typeof fileRules;

/** Detects the real type from the file's first bytes (ignores the browser's claim). */
export function sniffMime(buf: Buffer): AllowedMime | null {
  const hex = buf.subarray(0, 16).toString("hex");
  const ascii = buf.subarray(0, 16).toString("latin1");
  if (hex.startsWith("ffd8ff")) return "image/jpeg";
  if (hex.startsWith("89504e470d0a1a0a")) return "image/png";
  if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "image/webp";
  if (ascii.startsWith("%PDF-")) return "application/pdf";
  if (hex.startsWith("1a45dfa3")) return "video/webm";
  if (ascii.slice(4, 8) === "ftyp") {
    const brand = ascii.slice(8, 12);
    if (/heic|heix|mif1|msf1/.test(brand)) return "image/heic";
    if (brand === "qt  ") return "video/quicktime";
    return "video/mp4";
  }
  return null;
}

export const entityTypes = [
  "investor", "account", "ledger_entry", "animal", "purchase", "farmer", "allocation", "vet_record", "expense", "task",
  "sale", "settlement", "incident", "employee", "enquiry", "intake_item", "animal_weight", "payment_request",
] as const;

export const attachmentCategories = [
  ["animal_photo", "Animal photo"], ["farm_photo", "Farm photo"], ["inspection_video", "Inspection video"],
  ["purchase_receipt", "Purchase receipt"], ["payment_proof", "Proof of payment"], ["expense_receipt", "Expense receipt"],
  ["veterinary_report", "Veterinary report"], ["vaccination_record", "Vaccination record"], ["agreement", "Agreement"],
  ["sale_agreement", "Sale agreement"], ["sale_receipt", "Sale receipt"], ["incident_document", "Incident document"],
  ["identity_document", "Identity document (sensitive)"], ["verification_document", "Verification document (sensitive)"], ["other", "Other"],
] as const;
