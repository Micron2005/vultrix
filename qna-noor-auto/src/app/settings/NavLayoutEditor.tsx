"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import {
  NAV_ITEMS,
  type NavCatalogItem,
  type NavLayout,
} from "@/lib/navLayout";
import { resetNavLayout, saveNavLayout } from "./nav-actions";

export function NavLayoutEditor({
  initialLayout,
  items,
}: {
  initialLayout: NavLayout;
  items: NavCatalogItem[];
}) {
  const [current, setCurrent] = useState(initialLayout);
  const itemByHref = new Map(items.map((item) => [item.href, item]));
  const orderedItems = current.items
    .map((entry) => ({ entry, item: itemByHref.get(entry.href) }))
    .filter(
      (
        value,
      ): value is {
        entry: NavLayout["items"][number];
        item: NavCatalogItem;
      } => Boolean(value.item),
    );

  const move = (href: string, direction: -1 | 1) => {
    const renderedIndex = orderedItems.findIndex(
      ({ entry }) => entry.href === href,
    );
    const target = orderedItems[renderedIndex + direction];
    if (!target) return;
    const index = current.items.findIndex((entry) => entry.href === href);
    const targetIndex = current.items.findIndex(
      (entry) => entry.href === target.entry.href,
    );
    if (index < 0 || targetIndex < 0) return;
    const nextItems = [...current.items];
    [nextItems[index], nextItems[targetIndex]] = [
      nextItems[targetIndex],
      nextItems[index],
    ];
    setCurrent({ items: nextItems });
  };

  const toggle = (item: NavCatalogItem) => {
    if (item.required) return;
    setCurrent({
      items: current.items.map((entry) =>
        entry.href === item.href
          ? { ...entry, visible: !entry.visible }
          : entry,
      ),
    });
  };

  const reset = async () => {
    await resetNavLayout();
    setCurrent({
      items: NAV_ITEMS.map((item) => ({ href: item.href, visible: true })),
    });
  };

  return (
    <div className="space-y-4 p-6">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Choose which sidebar items you see and arrange them in the order you
        prefer.
      </p>
      <div className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
        {orderedItems.map(({ entry, item }, index) => (
          <div
            key={entry.href}
            className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {item.label}
              </span>
              {!entry.visible && (
                <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                  Hidden
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="dark:text-zinc-300 dark:hover:bg-zinc-800"
                onClick={() => move(entry.href, -1)}
                disabled={index === 0}
                aria-label={`Move ${item.label} up`}
              >
                ↑
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="dark:text-zinc-300 dark:hover:bg-zinc-800"
                onClick={() => move(entry.href, 1)}
                disabled={index === orderedItems.length - 1}
                aria-label={`Move ${item.label} down`}
              >
                ↓
              </Button>
              {!item.required && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => toggle(item)}
                >
                  {entry.visible ? "Hide" : "Show"}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <form action={saveNavLayout}>
          <input
            type="hidden"
            name="layout"
            value={JSON.stringify(current)}
            readOnly
          />
          <Button type="submit" size="sm">
            Save
          </Button>
        </form>
        <form action={reset}>
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            className="dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Reset to default
          </Button>
        </form>
      </div>
    </div>
  );
}
