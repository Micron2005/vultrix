"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Card, LinkButton } from "@/components/ui";
import { SONG_STAGES } from "@/lib/songStages";

type BoardSong = {
  id: string;
  title: string;
  stage: string;
  musicalKey: string | null;
  bpm: number | null;
  tasks: Array<{ done: boolean }>;
};

export function SongsBoard({
  songs,
  moveSongAction,
}: {
  songs: BoardSong[];
  moveSongAction: (id: string, stage: string) => Promise<void>;
}) {
  return (
    <div>
      {!songs.length ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-zinc-500">No songs yet — start with an idea.</p>
          <LinkButton href="/songs/new" className="mt-4">New song</LinkButton>
        </Card>
      ) : (
        <div className="flex snap-x gap-3 overflow-x-auto pb-2">
          {SONG_STAGES.map((stage) => (
            <section
              key={stage.id}
              className="w-[15rem] shrink-0 snap-start md:min-w-0 md:flex-1"
            >
              {(() => {
                const stageSongs = songs.filter((song) => song.stage === stage.id);
                return (
                  <>
                    <h2 className="mb-2 text-sm font-semibold text-zinc-800">{stage.label} · {stageSongs.length}</h2>
                    <div className="min-h-32 rounded-xl border border-zinc-200 bg-zinc-50 p-2">
                      {stageSongs.length === 0 ? (
                        <p className="px-2 py-4 text-xs text-zinc-400">Drop-in</p>
                      ) : (
                        <div className="space-y-2">
                          {stageSongs.map((song) => {
                  const songIndex = SONG_STAGES.findIndex((item) => item.id === song.stage);
                  const complete = song.tasks.filter((task) => task.done).length;
                  const progress = song.tasks.length ? (complete / song.tasks.length) * 100 : 0;
                  return (
                    <Card key={song.id} className="p-3">
                      <Link href={`/songs/${song.id}`} className="block">
                        <p className="font-medium text-zinc-900">{song.title}</p>
                        {(song.musicalKey || song.bpm) && (
                          <p className="mt-1 text-xs text-zinc-500">
                            {[song.musicalKey, song.bpm ? `${song.bpm} BPM` : null].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-zinc-500">{complete}/{song.tasks.length} tasks</p>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-200">
                          <div className="h-full rounded-full bg-[var(--vx-accent-600)]" style={{ width: `${progress}%` }} />
                        </div>
                      </Link>
                      <div className="mt-2 flex justify-between">
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          disabled={songIndex === 0}
                          onClick={() => void moveSongAction(song.id, SONG_STAGES[songIndex - 1].id)}
                          aria-label="Move song left"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          disabled={songIndex === SONG_STAGES.length - 1}
                          onClick={() => void moveSongAction(song.id, SONG_STAGES[songIndex + 1].id)}
                          aria-label="Move song right"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
