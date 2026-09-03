"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Button, LinkButton } from "@/components/ui";
import {
  type DashboardBlockId,
  type DashboardBlockDefinition,
  type DashboardLayout,
} from "@/lib/dashboard";
import { saveDashboardLayout, resetDashboardLayout } from "./dashboard-actions";

type DashboardBlock = {
  id: DashboardBlockId;
  label: string;
  hint: string;
  node: ReactNode;
  size: "normal" | "wide";
  title: string | null;
  settings: DashboardBlockDefinition["settings"];
  collapsed: boolean;
};

function SegmentedControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-medium text-zinc-600">{label}</span>
      <div className="flex overflow-hidden rounded-md border border-zinc-300 bg-white">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={
              value === option.value
                ? "bg-[var(--vx-accent-600)] px-3 py-1.5 text-xs font-medium text-[var(--vx-accent-fg)]"
                : "px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100"
            }
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DashboardGrid({
  layout,
  resetLayout,
  blocks,
  editing,
  defaultGreeting,
}: {
  layout: DashboardLayout;
  resetLayout: DashboardLayout;
  blocks: DashboardBlock[];
  editing: boolean;
  defaultGreeting: string;
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
  const updateBlock = (
    id: DashboardBlockId,
    update: Partial<DashboardLayout["blocks"][number]>,
  ) => {
    setCurrent({
      ...current,
      blocks: current.blocks.map((entry) =>
        entry.id === id ? { ...entry, ...update } : entry,
      ),
    });
  };
  const updateOption = (id: DashboardBlockId, key: string, value: string) => {
    const entry = current.blocks.find((candidate) => candidate.id === id);
    if (!entry) return;
    updateBlock(id, { options: { ...entry.options, [key]: value } });
  };
  const reset = async () => {
    await resetDashboardLayout();
    setCurrent({
      columns: resetLayout.columns,
      density: resetLayout.density,
      greeting: { ...resetLayout.greeting },
      blocks: resetLayout.blocks.map((block) => ({ ...block })),
    });
  };
  const gridClass =
    current.columns === 1
      ? "grid grid-cols-1 gap-0"
      : current.columns === 2
        ? "grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-x-6"
        : "grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-3";

  return (
    <>
      {editing && (
        <div className="mb-6 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-900">Customize dashboard</p>
              <p className="mt-1 text-xs text-zinc-500">
                Choose which cards you see and arrange them in the order you prefer.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <SegmentedControl
                label="Columns"
                value={String(current.columns)}
                options={[
                  { value: "1", label: "1" },
                  { value: "2", label: "2" },
                  { value: "3", label: "3" },
                ]}
                onChange={(value) =>
                  setCurrent({
                    ...current,
                    columns: Number(value) as DashboardLayout["columns"],
                  })
                }
              />
              <SegmentedControl
                label="Density"
                value={current.density}
                options={[
                  { value: "comfortable", label: "Comfortable" },
                  { value: "compact", label: "Compact" },
                ]}
                onChange={(density) =>
                  setCurrent({
                    ...current,
                    density: density as DashboardLayout["density"],
                  })
                }
              />
              <label className="flex items-center gap-2 text-xs font-medium text-zinc-700">
                <input
                  type="checkbox"
                  checked={current.greeting.show}
                  onChange={(event) =>
                    setCurrent({
                      ...current,
                      greeting: {
                        ...current.greeting,
                        show: event.target.checked,
                      },
                    })
                  }
                />
                Show greeting
              </label>
              <input
                value={current.greeting.text ?? ""}
                onChange={(event) =>
                  setCurrent({
                    ...current,
                    greeting: {
                      ...current.greeting,
                      text: event.target.value,
                    },
                  })
                }
                placeholder={defaultGreeting}
                className="w-64 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400"
                aria-label="Greeting text"
              />
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
      <div className={`${gridClass} ${current.density === "compact" ? "dashboard-density-compact" : ""}`} data-density={current.density}>
        {orderedBlocks.map(({ entry, block }) => {
          if (!editing) {
            const blockTitle = entry.title ?? block.label;
            if (entry.collapsed) {
              return (
                <div
                  key={entry.id}
                  className={`dash-block ${
                    entry.size === "wide" && current.columns > 1
                      ? "sm:col-span-full"
                      : ""
                  }`}
                >
                  <CollapsedBlock
                    title={blockTitle}
                    node={block.node}
                  />
                </div>
              );
            }
            return (
              <div
                key={entry.id}
                className={`dash-block ${
                  entry.size === "wide" && current.columns > 1
                    ? "sm:col-span-full"
                    : ""
                }`}
              >
                {block.node}
              </div>
            );
          }
          const renderedIndex = orderedBlocks.findIndex(
            (item) => item.entry.id === entry.id,
          );
          return (
            <div
              key={entry.id}
              className={
                [
                  "dash-block",
                  entry.visible
                    ? "mb-6 rounded-lg border border-transparent"
                    : "mb-6 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 opacity-60",
                  entry.size === "wide" && current.columns > 1
                    ? "sm:col-span-full"
                    : "",
                ].join(" ")
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2">
                <div>
                  <span className="text-xs font-semibold text-zinc-800">
                    {entry.title ?? block.label}
                  </span>
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
                  {current.columns > 1 && (
                    <>
                      <Button
                        type="button"
                        variant={entry.size === "normal" ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => updateBlock(entry.id, { size: "normal" })}
                      >
                        Normal
                      </Button>
                      <Button
                        type="button"
                        variant={entry.size === "wide" ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => updateBlock(entry.id, { size: "wide" })}
                      >
                        Wide
                      </Button>
                    </>
                  )}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      updateBlock(entry.id, { collapsed: !entry.collapsed })
                    }
                  >
                    {entry.collapsed ? "Expanded" : "Collapsed"}
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-2">
                <label className="flex items-center gap-1 text-xs text-zinc-600">
                  Rename
                  <input
                    value={entry.title ?? ""}
                    maxLength={40}
                    onChange={(event) =>
                      updateBlock(entry.id, { title: event.target.value })
                    }
                    placeholder={block.label}
                    className="w-40 rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 placeholder:text-zinc-400"
                  />
                </label>
                {block.settings?.map((setting) => (
                  <label
                    key={setting.key}
                    className="flex items-center gap-1 text-xs text-zinc-600"
                  >
                    {setting.label}
                    <select
                      value={entry.options[setting.key] ?? setting.default}
                      onChange={(event) =>
                        updateOption(entry.id, setting.key, event.target.value)
                      }
                      className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900"
                    >
                      {setting.choices.map((choice) => (
                        <option key={choice.value} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              {block.node}
            </div>
          );
        })}
      </div>
    </>
  );
}

function CollapsedBlock({ title, node }: { title: string; node: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mb-6 rounded-lg border border-zinc-200 bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-zinc-900"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        {title}
        <span aria-hidden="true">{open ? "⌃" : "⌄"}</span>
      </button>
      </div>
      {open && node}
    </>
  );
}
