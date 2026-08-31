"use client";

import { useEffect, useState } from "react";

export type ThemeMode = "light" | "dark" | "system";

const choices: Array<{ value: ThemeMode; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Match my device" },
];

export function ThemeToggle({
  initialTheme = "system",
}: {
  initialTheme?: ThemeMode;
}) {
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applySystemTheme = () => {
      document.documentElement.classList.toggle(
        "dark",
        theme === "dark" || (theme === "system" && media.matches),
      );
    };
    applySystemTheme();
    if (theme !== "system") return;
    media.addEventListener("change", applySystemTheme);
    return () => media.removeEventListener("change", applySystemTheme);
  }, [theme]);

  function chooseTheme(nextTheme: ThemeMode) {
    const systemDark =
      nextTheme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `vx-theme=${nextTheme}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.classList.toggle(
      "dark",
      nextTheme === "dark" || systemDark,
    );
    setTheme(nextTheme);
  }

  return (
    <div
      className="inline-flex rounded-md border border-zinc-300 bg-white p-0.5 shadow-sm"
      role="group"
      aria-label="Appearance"
    >
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          onClick={() => chooseTheme(choice.value)}
          aria-pressed={theme === choice.value}
          className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
            theme === choice.value
              ? "bg-zinc-900 text-white"
              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
          }`}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}
