import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VultrixMark } from "@/components/VultrixMark";
import { APP_NAME } from "@/lib/branding";
import { db } from "@/lib/db";
import { BeatPlayer } from "@/app/songs/beats/BeatPlayer";
import { BeatDataSchema, KITS, type BeatKit } from "@/app/songs/beats/kits";

export const dynamic = "force-dynamic";

type Params = Promise<{ token: string }>;

async function getSharedBeat(token: string) {
  return db.beat.findUnique({
    where: { shareToken: token },
    include: { organization: { select: { name: true } } },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { token } = await params;
  const beat = await getSharedBeat(token);
  return {
    title: beat ? `${beat.title} · Vultrix Beats` : "Vultrix Beats",
    description: "Listen to this beat made in Vultrix",
  };
}

export default async function SharedBeatPage({ params }: { params: Params }) {
  const { token } = await params;
  const beat = await getSharedBeat(token);
  if (!beat) notFound();

  const data = BeatDataSchema.parse(JSON.parse(beat.data));
  const kit = KITS.includes(beat.kit as BeatKit)
    ? (beat.kit as BeatKit)
    : "808";
  const document = {
    title: beat.title,
    bpm: beat.bpm,
    swing: beat.swing,
    kit,
    data,
  };

  return (
    <main className="dark min-h-screen bg-black text-zinc-100">
      <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
        <header className="flex items-center gap-2">
          <VultrixMark tile className="h-8 w-8" />
          <span className="text-sm font-semibold">{APP_NAME} Beats</span>
        </header>
        <section className="mt-10">
          <h1 className="text-3xl font-semibold tracking-tight">{beat.title}</h1>
          <p className="mt-2 text-sm text-zinc-400">
            by {beat.organization.name}
          </p>
          <p className="mt-4 text-xs text-zinc-500">
            {beat.bpm} BPM · {kit} kit · {data.patterns.length} patterns ·{" "}
            {data.sections.length} sections
          </p>
          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl sm:p-6">
            <BeatPlayer beat={document} />
          </div>
        </section>
        <footer className="mt-8 border-t border-zinc-900 pt-4 text-center text-xs text-zinc-500">
          Made with{" "}
          <Link href="/" className="text-zinc-300 hover:text-white">
            Vultrix Beats
          </Link>
        </footer>
      </div>
    </main>
  );
}
