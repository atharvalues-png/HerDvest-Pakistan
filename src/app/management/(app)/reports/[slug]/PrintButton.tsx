"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded-lg border border-forest/15 bg-white px-3.5 py-2 text-sm font-semibold text-forest hover:border-forest/40">
      Print / save as PDF
    </button>
  );
}
