"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_APPEARANCE,
  appearanceCss,
  UI_ACCENTS,
  UI_FONTS,
  UI_PALETTES,
  UI_RADII,
  UI_SCALES,
  type AppearancePrefs,
} from "@/lib/appearance";
import { resetAppearance, saveAppearance } from "./appearance-actions";

const labels: Record<keyof AppearancePrefs, string> = {
  palette: "Color scheme",
  accent: "Accent color",
  scale: "Text size",
  radius: "Corner roundness",
  font: "Font",
};

function PresetButton({
  name,
  value,
  selected,
  label,
  swatch,
  onSelect,
}: {
  name: string;
  value: string;
  selected: boolean;
  label: string;
  swatch: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      name={name}
      value={value}
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex min-w-24 flex-1 items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition ${
        selected
          ? "border-zinc-900 bg-zinc-50 font-medium text-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-100"
          : "border-zinc-200 text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800"
      }`}
    >
      <span
        className="h-5 w-5 shrink-0 rounded-full border border-black/10"
        style={{ backgroundColor: swatch }}
        aria-hidden="true"
      />
      {label}
    </button>
  );
}

function SegmentButton({
  value,
  selected,
  label,
  onSelect,
}: {
  value: string;
  selected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      value={value}
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex-1 rounded px-3 py-2 text-sm font-medium transition ${
        selected
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      {label}
    </button>
  );
}

export function AppearanceEditor({
  initialPrefs,
}: {
  initialPrefs: AppearancePrefs;
}) {
  const [prefs, setPrefs] = useState<AppearancePrefs>(initialPrefs);

  useEffect(() => {
    const styleId = "vx-appearance-preview";
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    const css = appearanceCss(prefs);
    if (!css) {
      style?.remove();
      return;
    }
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = css;
  }, [prefs]);

  function setPreference<K extends keyof AppearancePrefs>(
    key: K,
    value: AppearancePrefs[K],
  ) {
    setPrefs((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="space-y-6 p-6">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Personalize the workspace without changing your light or dark mode
        choice.
      </p>
      <form action={saveAppearance} className="space-y-6">
        <input type="hidden" name="palette" value={prefs.palette} />
        <input type="hidden" name="accent" value={prefs.accent} />
        <input type="hidden" name="scale" value={prefs.scale} />
        <input type="hidden" name="radius" value={prefs.radius} />
        <input type="hidden" name="font" value={prefs.font} />

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {labels.palette}
          </legend>
          <div className="flex flex-wrap gap-2">
            {UI_PALETTES.map((palette) => (
              <PresetButton
                key={palette.key}
                name="palette"
                value={palette.key}
                label={palette.label}
                swatch={palette.swatch}
                selected={prefs.palette === palette.key}
                onSelect={() => setPreference("palette", palette.key)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {labels.accent}
          </legend>
          <div className="flex flex-wrap gap-2">
            {UI_ACCENTS.map((accent) => (
              <PresetButton
                key={accent.key}
                name="accent"
                value={accent.key}
                label={accent.label}
                swatch={accent.swatch}
                selected={prefs.accent === accent.key}
                onSelect={() => setPreference("accent", accent.key)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {labels.scale}
          </legend>
          <div className="flex rounded-md border border-zinc-200 p-0.5 dark:border-zinc-700">
            {UI_SCALES.map((scale) => (
              <SegmentButton
                key={scale.key}
                value={scale.key}
                label={scale.label}
                selected={prefs.scale === scale.key}
                onSelect={() => setPreference("scale", scale.key)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {labels.radius}
          </legend>
          <div className="flex rounded-md border border-zinc-200 p-0.5 dark:border-zinc-700">
            {UI_RADII.map((radius) => (
              <SegmentButton
                key={radius.key}
                value={radius.key}
                label={radius.label}
                selected={prefs.radius === radius.key}
                onSelect={() => setPreference("radius", radius.key)}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {labels.font}
          </legend>
          <div className="flex flex-wrap rounded-md border border-zinc-200 p-0.5 dark:border-zinc-700">
            {UI_FONTS.map((font) => (
              <SegmentButton
                key={font.key}
                value={font.key}
                label={font.label}
                selected={prefs.font === font.key}
                onSelect={() => setPreference("font", font.key)}
              />
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <button
            type="submit"
            className="rounded-md bg-[var(--vx-accent-600)] px-4 py-2 text-sm font-medium text-[var(--vx-accent-fg)] hover:bg-[var(--vx-accent-700)]"
          >
            Save appearance
          </button>
          <button
            type="submit"
            formAction={resetAppearance}
            onClick={() => setPrefs({ ...DEFAULT_APPEARANCE })}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Reset to defaults
          </button>
          <span className="text-xs text-zinc-500">Preview updates instantly.</span>
        </div>
      </form>
    </div>
  );
}
