import Link from "next/link";

export default function PortalNotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold-600">Not found</p>
      <h1 className="mt-2 text-2xl font-semibold text-forest">This record isn&apos;t available</h1>
      <p className="mt-2 text-sm text-ink-500">It may not exist, or it isn&apos;t part of your account.</p>
      <Link href="/portal" className="mt-6 inline-flex rounded-lg bg-forest px-4 py-2 text-sm font-semibold text-ivory hover:bg-forest-700">Back to dashboard</Link>
    </div>
  );
}
