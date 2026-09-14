"use client";

import { useState } from "react";
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
  const [activeStage, setActiveStage] = useState(0);
  return (
    <div>
      <div className="mb-3 flex gap-1 overflow-x-auto md:hidden">
        {SONG_STAGES.map((stage, index) => (
          <button
            key={stage.id}
            type="button"
            onClick={() => setActiveStage(index)}
            className={`shrink-0 rounded-md px-3 py-2 text-xs font-medium ${
              activeStage === index ? "bg-zinc-900 text-white" : "bg-zinc-100 text-zinc-600"
            }`}
          >
            {stage.label}
          </button>
        ))}
      </div>
      {!songs.length ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-zinc-500">No songs yet — start with an idea.</p>
          <LinkButton href="/songs/new" className="mt-4">New song</LinkButton>
        </Card>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {SONG_STAGES.map((stage, index) => (
            <section
              key={stage.id}
              className={`${index === activeStage ? "block" : "hidden"} min-w-[15rem] flex-1 md:block`}
            >
              <h2 className="mb-2 text-sm font-semibold text-zinc-800">{stage.label}</h2>
              <div className="space-y-2">
                {songs.filter((song) => song.stage === stage.id).map((song) => {
                  const songIndex = SONG_STAGES.findIndex((item) => item.id === song.stage);
                  return (
                    <Card key={song.id} className="p-3">
                      <Link href={`/songs/${song.id}`} className="block">
                        <p className="font-medium text-zinc-900">{song.title}</p>
                        {(song.musicalKey || song.bpm) && (
                          <p className="mt-1 text-xs text-zinc-500">
                            {[song.musicalKey, song.bpm ? `${song.bpm} BPM` : null].filter(Boolean).join(" · ")}
                          </p>
                        )}
                        <p className="mt-2 text-xs text-zinc-500">
                          {song.tasks.filter((task) => task.done).length}/{song.tasks.length} tasks
                        </p>
                      </Link>
                      <div className="mt-2 flex justify-between">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={songIndex === 0}
                          onClick={() => void moveSongAction(song.id, SONG_STAGES[songIndex - 1].id)}
                          aria-label="Move song left"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
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
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
