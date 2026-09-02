"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Button, LinkButton } from "@/components/ui";
import {
  type DashboardBlockId,
  type DashboardLayout,
} from "@/lib/dashboard";
import { saveDashboardLayout, resetDashboardLayout } from "./dashboard-actions";

type DashboardBlock = {
  id: DashboardBlockId;
  label: string;
  hint: string;
  node: ReactNode;
};

export function DashboardGrid({
  layout,
  resetLayout,
  blocks,
  editing,
}: {
  layout: DashboardLayout;
  resetLayout: DashboardLayout;
  blocks: DashboardBlock[];
  editing: boolean;
}) {
  const [current, setCurrent] = useState(layout);
  const blockById = new Map(blocks.map((block) => [block.id, block]));
  const orderedBlocks = current.blocks
    .map((entry) => ({ entry, block: blockById.get(entry.id) }))
    .filter(
      (
        item,
      ): item is {
        entry: DashboardLayout["blocks"][number];
        block: DashboardBlock;
      } => Boolean(item.block) && (editing || item.entry.visible),
    );
  const move = (id: DashboardBlockId, direction: -1 | 1) => {
    const renderedIndex = orderedBlocks.findIndex(
      ({ entry }) => entry.id === id,
    );
    const target = orderedBlocks[renderedIndex + direction];
    if (!target) return;
    const index = current.blocks.findIndex((entry) => entry.id === id);
    const nextIndex = current.blocks.findIndex(
      (entry) => entry.id === target.entry.id,
    );
    if (index < 0 || nextIndex < 0) return;
    const nextBlocks = [...current.blocks];
    [nextBlocks[index], nextBlocks[nextIndex]] = [
      nextBlocks[nextIndex],
      nextBlocks[index],
    ];
    setCurrent({ ...current, blocks: nextBlocks });
  };
  const toggle = (id: DashboardBlockId) => {
    setCurrent({
      ...current,
      blocks: current.blocks.map((entry) =>
        entry.id === id ? { ...entry, visible: !entry.visible } : entry,
      ),
    });
  };
  const reset = async () => {
    await resetDashboardLayout();
    setCurrent({
      columns: resetLayout.columns,
      blocks: resetLayout.blocks.map((block) => ({ ...block })),
    });
  };
  const gridClass =
    current.columns === 2
      ? "grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-x-6"
      : "grid grid-cols-1 gap-0";

  return (
    <>
      {editing && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Customize dashboard</p>
              <p className="mt-1 text-xs text-zinc-500">
                Choose which cards you see and arrange them in the order you prefer.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-zinc-600">Columns</span>
              {[1, 2].map((columns) => (
                <Button
                  key={columns}
                  type="button"
                  size="sm"
                  variant={current.columns === columns ? "primary" : "secondary"}
                  onClick={() => setCurrent({ ...current, columns: columns as 1 | 2 })}
                  aria-pressed={current.columns === columns}
                >
                  {columns}
                </Button>
              ))}
              <form action={saveDashboardLayout}>
                <input
                  type="hidden"
                  name="layout"
                  value={JSON.stringify(current)}
                  readOnly
                />
                <Button type="submit" size="sm">Save</Button>
              </form>
              <LinkButton href="/" variant="secondary" size="sm">Cancel</LinkButton>
              <form action={reset}>
                <Button type="submit" variant="ghost" size="sm">Reset to default</Button>
              </form>
            </div>
          </div>
        </div>
      )}
      <div className={gridClass}>
        {orderedBlocks.map(({ entry, block }) => {
          if (!editing) return <div key={entry.id}>{block.node}</div>;
          const renderedIndex = orderedBlocks.findIndex(
            (item) => item.entry.id === entry.id,
          );
          return (
            <div
              key={entry.id}
              className={
                entry.visible
                  ? "mb-6 rounded-lg border border-transparent"
                  : "mb-6 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 opacity-60"
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2">
                <div>
                  <span className="text-xs font-semibold text-zinc-800">{block.label}</span>
                  <span className="ml-2 text-xs text-zinc-500">{block.hint}</span>
                  {!entry.visible && (
                    <span className="ml-2 rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600">
                      Hidden
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => move(entry.id, -1)}
                    disabled={renderedIndex === 0}
                    aria-label={`Move ${block.label} up`}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => move(entry.id, 1)}
                    disabled={renderedIndex === orderedBlocks.length - 1}
                    aria-label={`Move ${block.label} down`}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => toggle(entry.id)}
                  >
                    {entry.visible ? "Hide" : "Show"}
                  </Button>
                </div>
              </div>
              {block.node}
            </div>
          );
        })}
      </div>
    </>
  );
}
