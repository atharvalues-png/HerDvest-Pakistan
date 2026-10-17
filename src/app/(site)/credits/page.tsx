import type { Metadata } from "next";
import { Container, Section } from "@/components/ui/primitives";
import { PageHero } from "@/components/layout/PageHero";

export const metadata: Metadata = {
  title: "Photo credits",
  description: "Credits and licences for photographs used on the Herdvest Pakistan website.",
};

const credits: Array<{ file: string; subject: string; author: string; source: string; licence: string; licenceUrl: string; url: string }> = [
  { file: "farmer-milking.jpg", subject: "Life of a Villager", author: "Xpressive19", source: "Wikimedia Commons", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", url: "https://commons.wikimedia.org/wiki/File:Life_of_a_Villager.jpg" },
  { file: "farmer-care.jpg", subject: "Buffalo Milk", author: "AdeelChoudhary", source: "Wikimedia Commons", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0/", url: "https://commons.wikimedia.org/wiki/File:Buffalo_Milk.jpg" },
  { file: "buffalo-pond.jpg", subject: "Buffalo outside of pond", author: "Amrit Raisar", source: "Wikimedia Commons", licence: "CC BY 4.0", licenceUrl: "https://creativecommons.org/licenses/by/4.0/", url: "https://commons.wikimedia.org/wiki/File:Buffalo_out_side_of_Pond.jpg" },
  ...[
    ["buffalo-hero.jpg", "photo-1777804309195-bf674a33a773", "Water buffaloes resting near a rural home"],
    ["buffalo-herd.jpg", "photo-1741387863358-0421a7e5a085", "A herd of water buffalo resting"],
    ["buffalo-bathing.jpg", "photo-1767153761870-303fd44eef3a", "Water buffaloes bathing"],
    ["buffalo-calf.jpg", "photo-1607915236838-653cacfbdd42", "Young water buffalo"],
    ["buffalo-village.jpg", "photo-1610428826809-fd9dbcde8ee3", "Water buffaloes on a village road"],
    ["buffalo-young.jpg", "photo-1760835408407-2daa1ce53643", "Young buffaloes near a pond"],
    ["buffalo-portrait.jpg", "photo-1576146331944-1895cbb562f4", "Black water buffalo"],
    ["buffalo-farm.jpg", "photo-1747561464138-f9f69b6781a6", "Water buffalo on a farm"],
  ].map(([file, id, subject]) => ({
    file, subject, author: "Unsplash contributor", source: "Unsplash", licence: "Unsplash License",
    licenceUrl: "https://unsplash.com/license", url: `https://images.unsplash.com/${id}`,
  })),
];

export default function CreditsPage() {
  return (
    <>
      <PageHero eyebrow="Credits" title="Photo credits" lead="Photographs are illustrative. They do not show animals, farms or people associated with Herdvest unless stated." image="/images/buffalo-bathing.jpg" imageAlt="" />
      <Section tone="ivory">
        <Container className="max-w-4xl">
          <div className="overflow-x-auto rounded-2xl border border-forest/10 bg-white">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="bg-ivory/70 text-xs text-ink-600"><tr><th className="px-4 py-2">Image</th><th className="px-4 py-2">Author</th><th className="px-4 py-2">Source</th><th className="px-4 py-2">Licence</th></tr></thead>
              <tbody className="divide-y divide-forest/5">
                {credits.map((c) => (
                  <tr key={c.file}>
                    <td className="px-4 py-2"><a href={c.url} className="text-emerald underline" target="_blank" rel="noopener noreferrer">{c.subject}</a></td>
                    <td className="px-4 py-2">{c.author}</td>
                    <td className="px-4 py-2">{c.source}</td>
                    <td className="px-4 py-2"><a href={c.licenceUrl} className="underline" target="_blank" rel="noopener noreferrer">{c.licence}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-ink-500">Images may be resized or cropped for display. Replace with Herdvest&apos;s own farm photography when available.</p>
        </Container>
      </Section>
    </>
  );
}
