/** Shown while a management page's server data loads. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading" className="animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-3 w-24 rounded bg-forest/10" />
        <div className="h-7 w-72 max-w-full rounded bg-forest/10" />
        <div className="h-3 w-96 max-w-full rounded bg-forest/5" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-20 rounded-2xl border border-forest/10 bg-white" />)}
      </div>
      <div className="overflow-hidden rounded-2xl border border-forest/10 bg-white">
        <div className="h-9 bg-ivory/70" />
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex gap-4 border-t border-forest/5 px-4 py-3">
            <div className="h-3 w-24 rounded bg-forest/10" />
            <div className="h-3 flex-1 rounded bg-forest/5" />
            <div className="h-3 w-20 rounded bg-forest/10" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
