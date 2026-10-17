"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { cn } from "@/lib/format";

type Category = readonly [string, string];

/** File upload with progress, server-side validation messages and mobile camera support. */
export function Uploader({
  entityType,
  entityId,
  categories,
  defaultCategory = "other",
  allowSensitive = false,
}: {
  entityType: string;
  entityId: string;
  categories: readonly Category[];
  defaultCategory?: string;
  allowSensitive?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState(defaultCategory);
  const [caption, setCaption] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const cats = categories.filter(([c]) => allowSensitive || !["identity_document", "verification_document"].includes(c));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setMessage(null);
    let ok = 0;
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("entityType", entityType);
      fd.set("entityId", entityId);
      fd.set("category", category);
      fd.set("caption", caption);
      const res = await new Promise<{ status: number; body: { error?: string } }>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/management/files/upload");
        xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
        xhr.onload = () => {
          let body = {};
          try { body = JSON.parse(xhr.responseText); } catch {}
          resolve({ status: xhr.status, body });
        };
        xhr.onerror = () => resolve({ status: 0, body: { error: "Network error — the file was not uploaded." } });
        xhr.send(fd);
      });
      if (res.status === 200) ok++;
      else errors.push(`${file.name}: ${res.body.error ?? "upload failed"}`);
    }
    setProgress(null);
    if (input.current) input.current.value = "";
    setCaption("");
    setMessage(errors.length ? { ok: false, text: errors.join(" · ") } : { ok: true, text: `${ok} file${ok === 1 ? "" : "s"} uploaded.` });
    if (ok) router.refresh();
  }

  return (
    <div className="rounded-xl border border-dashed border-forest/20 bg-ivory/40 p-3">
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
        <label className="text-xs">
          <span className="sr-only">Category</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-lg border border-forest/15 bg-white px-2 py-2 text-sm">
            {cats.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label className="text-xs">
          <span className="sr-only">Caption</span>
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Caption (optional)" maxLength={300}
            className="w-full rounded-lg border border-forest/15 bg-white px-3 py-2 text-sm" />
        </label>
        <label className={cn("inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-sm font-semibold text-ivory hover:bg-forest-700",
          progress !== null && "pointer-events-none opacity-70")}>
          <Upload aria-hidden className="h-4 w-4" />
          {progress !== null ? `Uploading ${progress}%` : "Add files"}
          <input ref={input} type="file" multiple className="sr-only" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf,video/mp4,video/quicktime,video/webm"
            onChange={(e) => upload(e.target.files)} />
        </label>
      </div>
      {progress !== null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ivory-300" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-emerald transition-[width]" style={{ width: `${progress}%` }} />
        </div>
      )}
      {message && <p role={message.ok ? "status" : "alert"} className={cn("mt-2 text-xs", message.ok ? "text-emerald" : "text-alert")}>{message.text}</p>}
      <p className="mt-2 text-[0.7rem] text-ink-500">JPG, PNG, WebP, HEIC up to 15–20 MB · PDF up to 20 MB · MP4/MOV/WebM up to 200 MB. Files are private.</p>
    </div>
  );
}
