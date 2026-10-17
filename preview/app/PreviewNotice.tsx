import Link from "next/link";
import { LogoMark } from "@/components/layout/Logo";

/** Shown on the static GitHub Pages preview in place of the sign-in pages, which need a server and database. */
export function PreviewNotice({ area }: { area: string }) {
  return (
    <div className="grain flex min-h-dvh items-center justify-center bg-forest-950 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        <LogoMark className="mx-auto h-12 w-12" />
        <h1 className="mt-4 text-xl font-semibold text-forest">{area} — not available in this preview</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-600">
          This is a static preview of the public website. The {area.toLowerCase()} needs a secure server and database,
          so sign-in is switched off here. No accounts or records exist on this preview.
        </p>
        <Link href="/" className="mt-6 inline-flex rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-ivory hover:bg-forest-700">
          Back to the website
        </Link>
      </div>
    </div>
  );
}
