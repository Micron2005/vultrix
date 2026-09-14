"use client";

import { useState } from "react";
import { Button, Card, Input } from "@/components/ui";
import type { listMemories } from "@/lib/assistant/memory";
import { deleteMemory, updateMemory } from "./actions";

type Memory = Awaited<ReturnType<typeof listMemories>>[number];

const labels: Record<string, string> = {
  preference: "Preferences",
  fact: "Facts",
  project: "Projects",
  other: "Other",
};

export function MemoryList({ memories }: { memories: Memory[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const groups = ["preference", "fact", "project", "other"];
  return (
    <div className="space-y-6">
      {groups.map((category) => {
        const items = memories.filter((memory) => memory.category === category);
        if (items.length === 0) return null;
        return (
          <section key={category}>
            <h2 className="mb-2 text-sm font-semibold text-zinc-900">
              {labels[category]}
            </h2>
            <div className="space-y-2">
              {items.map((memory) => (
                <Card key={memory.id} className="p-4">
                  <form
                    action={updateMemory.bind(null, memory.id)}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center"
                  >
                    {editingId === memory.id ? (
                      <Input
                        name="content"
                        defaultValue={memory.content}
                        maxLength={400}
                        className="min-w-0 flex-1"
                        autoFocus
                      />
                    ) : (
                      <p className="min-w-0 flex-1 text-sm text-zinc-800">
                        {memory.content}
                      </p>
                    )}
                    <div className="flex shrink-0 items-center gap-2">
                      {editingId === memory.id ? (
                        <>
                          <Button type="submit" size="sm">Save</Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(memory.id)}
                        >
                          Edit
                        </Button>
                      )}
                      <Button
                        type="submit"
                        formAction={deleteMemory.bind(null, memory.id)}
                        size="sm"
                        variant="danger"
                        onClick={(event) => {
                          if (!window.confirm("Forget this memory?")) {
                            event.preventDefault();
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </form>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
