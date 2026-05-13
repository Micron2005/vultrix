"use client";

import { useState, useTransition } from "react";
import { saveLandingTheme } from "./actions";
import type { LandingTheme } from "./theme";

const PATTERNS = [
  { value: "none", label: "None" },
  { value: "dots", label: "Dots" },
  { value: "grid", label: "Grid" },
  { value: "diagonal", label: "Diagonal Lines" },
  { value: "cross", label: "Crosshatch" },
  { value: "waves", label: "Waves" },
  { value: "chevron", label: "Chevron" },
] as const;

const PRESETS: { name: string; theme: Partial<LandingTheme> }[] = [
  {
    name: "Default",
    theme: {
      pageBg: "#fafaf9",
      headerBg: "#ffffff",
      headerText: "#18181b",
      heroBg: "#18181b",
      heroText: "#ffffff",
      heroSubtext: "#d4d4d8",
      buttonBg: "#18181b",
      buttonText: "#ffffff",
      footerBg: "#ffffff",
      footerText: "#71717a",
      footerBorder: "#e4e4e7",
      bgPattern: "none",
    },
  },
  {
    name: "Ocean Blue",
    theme: {
      pageBg: "#eff6ff",
      headerBg: "#ffffff",
      headerText: "#1e3a5f",
      heroBg: "#1e3a8a",
      heroText: "#ffffff",
      heroSubtext: "#bfdbfe",
      buttonBg: "#2563eb",
      buttonText: "#ffffff",
      footerBg: "#1e3a8a",
      footerText: "#bfdbfe",
      footerBorder: "#1e40af",
      bgPattern: "waves",
    },
  },
  {
    name: "Forest Green",
    theme: {
      pageBg: "#f0fdf4",
      headerBg: "#ffffff",
      headerText: "#14532d",
      heroBg: "#14532d",
      heroText: "#ffffff",
      heroSubtext: "#bbf7d0",
      buttonBg: "#15803d",
      buttonText: "#ffffff",
      footerBg: "#14532d",
      footerText: "#bbf7d0",
      footerBorder: "#166534",
      bgPattern: "none",
    },
  },
  {
    name: "Warm Red",
    theme: {
      pageBg: "#fef2f2",
      headerBg: "#ffffff",
      headerText: "#7f1d1d",
      heroBg: "#7f1d1d",
      heroText: "#ffffff",
      heroSubtext: "#fecaca",
      buttonBg: "#dc2626",
      buttonText: "#ffffff",
      footerBg: "#7f1d1d",
      footerText: "#fecaca",
      footerBorder: "#991b1b",
      bgPattern: "none",
    },
  },
  {
    name: "Purple Night",
    theme: {
      pageBg: "#faf5ff",
      headerBg: "#ffffff",
      headerText: "#581c87",
      heroBg: "#581c87",
      heroText: "#ffffff",
      heroSubtext: "#e9d5ff",
      buttonBg: "#7c3aed",
      buttonText: "#ffffff",
      footerBg: "#581c87",
      footerText: "#e9d5ff",
      footerBorder: "#6b21a8",
      bgPattern: "dots",
    },
  },
  {
    name: "Sunset Orange",
    theme: {
      pageBg: "#fff7ed",
      headerBg: "#ffffff",
      headerText: "#7c2d12",
      heroBg: "#9a3412",
      heroText: "#ffffff",
      heroSubtext: "#fed7aa",
      buttonBg: "#ea580c",
      buttonText: "#ffffff",
      footerBg: "#9a3412",
      footerText: "#fed7aa",
      footerBorder: "#c2410c",
      bgPattern: "chevron",
    },
  },
];

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

function ColorField({ label, value, onChange }: ColorFieldProps) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-8 cursor-pointer rounded border border-zinc-300 p-0.5"
      />
      <span className="text-sm text-zinc-700">{label}</span>
    </label>
  );
}

export function ThemeCustomizer({
  initialTheme,
}: {
  initialTheme: LandingTheme;
}) {
  const [theme, setTheme] = useState<LandingTheme>(initialTheme);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [open, setOpen] = useState(false);

  function update(field: keyof LandingTheme, value: string) {
    setTheme((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function applyPreset(preset: Partial<LandingTheme>) {
    setTheme((prev) => ({ ...prev, ...preset }));
    setSaved(false);
  }

  function handleSave() {
    startTransition(async () => {
      await saveLandingTheme(theme);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="mb-6">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
          />
        </svg>
        {open ? "Hide Theme Settings" : "Customize Colors & Patterns"}
      </button>

      {open && (
        <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          {/* Presets */}
          <div className="mb-6">
            <div className="mb-2 text-sm font-semibold text-zinc-800">
              Quick Presets
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => applyPreset(p.theme)}
                  className="flex items-center gap-1.5 rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full border border-zinc-300"
                    style={{ backgroundColor: p.theme.heroBg }}
                  />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {/* Header */}
            <fieldset className="rounded-md border border-zinc-200 p-4">
              <legend className="px-1 text-xs font-semibold text-zinc-600">
                Header
              </legend>
              <div className="space-y-2">
                <ColorField
                  label="Background"
                  value={theme.headerBg}
                  onChange={(v) => update("headerBg", v)}
                />
                <ColorField
                  label="Text"
                  value={theme.headerText}
                  onChange={(v) => update("headerText", v)}
                />
              </div>
            </fieldset>

            {/* Hero */}
            <fieldset className="rounded-md border border-zinc-200 p-4">
              <legend className="px-1 text-xs font-semibold text-zinc-600">
                Hero Banner
              </legend>
              <div className="space-y-2">
                <ColorField
                  label="Background"
                  value={theme.heroBg}
                  onChange={(v) => update("heroBg", v)}
                />
                <ColorField
                  label="Title text"
                  value={theme.heroText}
                  onChange={(v) => update("heroText", v)}
                />
                <ColorField
                  label="Subtitle text"
                  value={theme.heroSubtext}
                  onChange={(v) => update("heroSubtext", v)}
                />
              </div>
            </fieldset>

            {/* Buttons */}
            <fieldset className="rounded-md border border-zinc-200 p-4">
              <legend className="px-1 text-xs font-semibold text-zinc-600">
                Buttons
              </legend>
              <div className="space-y-2">
                <ColorField
                  label="Background"
                  value={theme.buttonBg}
                  onChange={(v) => update("buttonBg", v)}
                />
                <ColorField
                  label="Text"
                  value={theme.buttonText}
                  onChange={(v) => update("buttonText", v)}
                />
              </div>
            </fieldset>

            {/* Page background */}
            <fieldset className="rounded-md border border-zinc-200 p-4">
              <legend className="px-1 text-xs font-semibold text-zinc-600">
                Page Background
              </legend>
              <div className="space-y-2">
                <ColorField
                  label="Background color"
                  value={theme.pageBg}
                  onChange={(v) => update("pageBg", v)}
                />
                <label className="flex items-center gap-2">
                  <span className="text-sm text-zinc-700">Pattern</span>
                  <select
                    value={theme.bgPattern}
                    onChange={(e) => update("bgPattern", e.target.value)}
                    className="rounded border border-zinc-300 px-2 py-1 text-sm"
                  >
                    {PATTERNS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </fieldset>

            {/* Footer */}
            <fieldset className="rounded-md border border-zinc-200 p-4">
              <legend className="px-1 text-xs font-semibold text-zinc-600">
                Footer
              </legend>
              <div className="space-y-2">
                <ColorField
                  label="Background"
                  value={theme.footerBg}
                  onChange={(v) => update("footerBg", v)}
                />
                <ColorField
                  label="Text"
                  value={theme.footerText}
                  onChange={(v) => update("footerText", v)}
                />
                <ColorField
                  label="Border"
                  value={theme.footerBorder}
                  onChange={(v) => update("footerBorder", v)}
                />
              </div>
            </fieldset>
          </div>

          {/* Save */}
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="rounded-md bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save Theme"}
            </button>
            {saved && (
              <span className="text-sm font-medium text-green-600">Saved</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
