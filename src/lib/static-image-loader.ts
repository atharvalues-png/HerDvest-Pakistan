/** Image loader for the static GitHub Pages preview: serves the original file under the site's base path. */
export default function staticImageLoader({ src, width }: { src: string; width: number }) {
  if (/^https?:\/\//.test(src)) return src;
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}${src}?w=${width}`;
}
