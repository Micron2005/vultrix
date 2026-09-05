export type AppearancePrefs = {
  palette: string;
  accent: string;
  scale: string;
  radius: string;
  font: string;
};

export const DEFAULT_APPEARANCE: AppearancePrefs = {
  palette: "default",
  accent: "default",
  scale: "default",
  radius: "default",
  font: "default",
};

type Palette = {
  key: string;
  label: string;
  swatch: string;
  light: Record<string, string>;
  dark: Record<string, string>;
};

const zinc = (
  values: readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ],
  background: string,
  foreground: string,
  surface?: string,
) => ({
  "--color-zinc-50": values[0],
  "--color-zinc-100": values[1],
  "--color-zinc-200": values[2],
  "--color-zinc-300": values[3],
  "--color-zinc-400": values[4],
  "--color-zinc-500": values[5],
  "--color-zinc-600": values[6],
  "--color-zinc-700": values[7],
  "--color-zinc-800": values[8],
  "--color-zinc-900": values[9],
  "--color-zinc-950": values[10],
  "--background": background,
  "--foreground": foreground,
  ...(surface ? { "--color-white": surface } : {}),
});

const invert = (
  values: readonly [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ],
  background: string,
  foreground: string,
) =>
  zinc(
    [
      values[10],
      values[9],
      values[8],
      values[7],
      values[6],
      values[5],
      values[4],
      values[3],
      values[2],
      values[1],
      values[0],
    ] as const,
    background,
    foreground,
    values[9],
  );

const slate = [
  "#f8fafc",
  "#f1f5f9",
  "#e2e8f0",
  "#cbd5e1",
  "#94a3b8",
  "#64748b",
  "#475569",
  "#334155",
  "#1e293b",
  "#0f172a",
  "#020617",
] as const;
const sand = [
  "#fffcf5",
  "#fdf8ee",
  "#f5ead5",
  "#ead9bc",
  "#bba98d",
  "#806f56",
  "#665642",
  "#4d3f30",
  "#34291e",
  "#211912",
  "#140f0b",
] as const;
const forest = [
  "#f5faf7",
  "#e7f3eb",
  "#cde5d4",
  "#a4c9af",
  "#729b7e",
  "#4b7356",
  "#385c42",
  "#294933",
  "#1b3423",
  "#102418",
  "#07140c",
] as const;
const rose = [
  "#fff7f8",
  "#feecef",
  "#fbd7dd",
  "#f4b6c0",
  "#ca7a88",
  "#9d4b5b",
  "#7c3544",
  "#5c2633",
  "#401a25",
  "#2c1119",
  "#1a080e",
] as const;
const midnight = [
  "#f6f8fc",
  "#ebeff7",
  "#d8e0ef",
  "#bcc8dd",
  "#8b9ab6",
  "#5e6e8c",
  "#465673",
  "#313f5a",
  "#222d43",
  "#151e30",
  "#0a1020",
] as const;

export const UI_PALETTES: Palette[] = [
  {
    key: "default",
    label: "Zinc",
    swatch: "#71717a",
    light: {},
    dark: {},
  },
  {
    key: "slate",
    label: "Slate",
    swatch: "#64748b",
    light: zinc(slate, "#f8fafc", "#0f172a"),
    dark: invert(slate, "#020617", "#f8fafc"),
  },
  {
    key: "sand",
    label: "Sand",
    swatch: "#bba98d",
    light: zinc(sand, "#fffcf5", "#211912"),
    dark: invert(sand, "#140f0b", "#fffcf5"),
  },
  {
    key: "forest",
    label: "Forest",
    swatch: "#4b7356",
    light: zinc(forest, "#f5faf7", "#102418"),
    dark: invert(forest, "#07140c", "#f5faf7"),
  },
  {
    key: "rose",
    label: "Rose",
    swatch: "#9d4b5b",
    light: zinc(rose, "#fff7f8", "#2c1119"),
    dark: invert(rose, "#1a080e", "#fff7f8"),
  },
  {
    key: "midnight",
    label: "Midnight",
    swatch: "#5e6e8c",
    light: zinc(midnight, "#f6f8fc", "#151e30"),
    dark: invert(midnight, "#0a1020", "#f6f8fc"),
  },
];

type Accent = {
  key: string;
  label: string;
  swatch: string;
  vars: Record<string, string>;
};

const accent = (
  key: string,
  label: string,
  swatch: string,
  values?: [
    string,
    string,
    string,
    string,
    string,
  ],
): Accent => ({
  key,
  label,
  swatch,
  vars: values
    ? {
        "--vx-accent-600": values[0],
        "--vx-accent-700": values[1],
        "--vx-accent-50": values[2],
        "--vx-accent-100": values[3],
        "--vx-accent-fg": values[4],
      }
    : {},
});

export const UI_ACCENTS: Accent[] = [
  accent("default", "Vultrix purple", "#7c3aed", [
    "#7c3aed",
    "#6d28d9",
    "#f5f3ff",
    "#ede9fe",
    "#ffffff",
  ]),
  accent("zinc", "Neutral", "#18181b", [
    "var(--color-zinc-900)",
    "var(--color-zinc-800)",
    "var(--color-zinc-50)",
    "var(--color-zinc-100)",
    "var(--color-white)",
  ]),
  accent("blue", "Blue", "#2563eb", [
    "#2563eb",
    "#1d4ed8",
    "#eff6ff",
    "#dbeafe",
    "#ffffff",
  ]),
  accent("indigo", "Indigo", "#4f46e5", [
    "#4f46e5",
    "#4338ca",
    "#eef2ff",
    "#e0e7ff",
    "#ffffff",
  ]),
  accent("emerald", "Emerald", "#059669", [
    "#059669",
    "#047857",
    "#ecfdf5",
    "#d1fae5",
    "#ffffff",
  ]),
  accent("amber", "Amber", "#d97706", [
    "#d97706",
    "#b45309",
    "#fffbeb",
    "#fef3c7",
    "#ffffff",
  ]),
  accent("rose", "Rose", "#e11d48", [
    "#e11d48",
    "#be123c",
    "#fff1f2",
    "#ffe4e6",
    "#ffffff",
  ]),
];

type Preset = {
  key: string;
  label: string;
  value: string;
};

export const UI_SCALES: Preset[] = [
  { key: "default", label: "Default", value: "16px" },
  { key: "compact", label: "Compact", value: "14.5px" },
  { key: "large", label: "Large", value: "17.5px" },
];

export const UI_RADII: Preset[] = [
  { key: "default", label: "Default", value: "default" },
  { key: "square", label: "Square", value: "0" },
  { key: "rounded", label: "Rounded", value: "rounded" },
];

export const UI_FONTS: Array<Preset & { value: string }> = [
  {
    key: "default",
    label: "System",
    value:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  },
  {
    key: "inter",
    label: "Inter",
    value: '"Inter", ui-sans-serif, system-ui, sans-serif',
  },
  {
    key: "manrope",
    label: "Manrope",
    value: '"Manrope", ui-sans-serif, system-ui, sans-serif',
  },
  {
    key: "serif",
    label: "Serif",
    value: 'Georgia, Cambria, "Times New Roman", Times, serif',
  },
  {
    key: "mono",
    label: "Mono",
    value:
      '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  },
];

const lookup = <T extends { key: string }>(values: T[], key: unknown): T =>
  values.find((value) => value.key === key) ?? values[0];

export function normalizeAppearance(input: unknown): AppearancePrefs {
  const source =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  const rawAccent = source.accent;
  const accentValue =
    typeof rawAccent === "string" && /^#[0-9a-f]{6}$/i.test(rawAccent)
      ? rawAccent.toLowerCase()
      : lookup(UI_ACCENTS, rawAccent).key;
  return {
    palette: lookup(UI_PALETTES, source.palette).key,
    accent: accentValue,
    scale: lookup(UI_SCALES, source.scale).key,
    radius: lookup(UI_RADII, source.radius).key,
    font: lookup(UI_FONTS, source.font).key,
  };
}

function parseAppearanceRecord(raw: unknown): Record<string, unknown> {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object"
    ? (raw as Record<string, unknown>)
    : {};
}

function validAppearanceValue(
  key: keyof AppearancePrefs,
  value: unknown,
): string | null {
  if (typeof value !== "string") return null;
  if (key === "accent" && /^#[0-9a-f]{6}$/i.test(value)) {
    return value.toLowerCase();
  }
  const values = {
    palette: UI_PALETTES,
    accent: UI_ACCENTS,
    scale: UI_SCALES,
    radius: UI_RADII,
    font: UI_FONTS,
  }[key];
  return values.some((entry) => entry.key === value) ? value : null;
}

export function resolveAppearance(
  userPrefs: unknown,
  orgDefault: unknown,
): AppearancePrefs {
  const user = parseAppearanceRecord(userPrefs);
  const organization = parseAppearanceRecord(orgDefault);
  const resolved = {} as Record<keyof AppearancePrefs, string>;
  for (const key of Object.keys(DEFAULT_APPEARANCE) as Array<
    keyof AppearancePrefs
  >) {
    const storageKey = `ui${key[0].toUpperCase()}${key.slice(1)}`;
    resolved[key] =
      validAppearanceValue(key, user[key] ?? user[storageKey]) ??
      validAppearanceValue(key, organization[key] ?? organization[storageKey]) ??
      DEFAULT_APPEARANCE[key];
  }
  return normalizeAppearance(resolved);
}

export function accentVarsFromHex(hex: string): Record<string, string> {
  const normalized = hex.toLowerCase();
  const match = normalized.match(/^#([0-9a-f]{6})$/);
  if (!match) return {};

  const channels = [0, 2, 4].map((offset) =>
    Number.parseInt(match[1].slice(offset, offset + 2), 16),
  );
  const toHex = (value: number): string =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, "0");
  const mixed = (whiteRatio: number): string =>
    `#${channels.map((channel) => toHex(channel * (1 - whiteRatio) + 255 * whiteRatio)).join("")}`;
  const darkened = `#${channels.map((channel) => toHex(channel * 0.88)).join("")}`;
  const luminance = channels
    .map((channel) => channel / 255)
    .map((channel) =>
      channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4,
    );
  const relativeLuminance =
    0.2126 * luminance[0] + 0.7152 * luminance[1] + 0.0722 * luminance[2];

  return {
    "--vx-accent-600": normalized,
    "--vx-accent-700": darkened,
    "--vx-accent-50": mixed(0.95),
    "--vx-accent-100": mixed(0.88),
    "--vx-accent-fg":
      relativeLuminance > 0.179 ? "#18181b" : "#ffffff",
  };
}

function declarations(values: Record<string, string>): string {
  return Object.entries(values)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}

export function appearanceCss(prefs: AppearancePrefs): string {
  const normalized = normalizeAppearance(prefs);
  if (
    Object.entries(normalized).every(
      ([key, value]) => value === DEFAULT_APPEARANCE[key as keyof AppearancePrefs],
    )
  ) {
    return "";
  }

  const palette = lookup(UI_PALETTES, normalized.palette);
  const selectedAccent = lookup(UI_ACCENTS, normalized.accent);
  const accentVars = /^#[0-9a-f]{6}$/i.test(normalized.accent)
    ? accentVarsFromHex(normalized.accent)
    : selectedAccent.vars;
  const scale = lookup(UI_SCALES, normalized.scale);
  const radius = lookup(UI_RADII, normalized.radius);
  const font = lookup(UI_FONTS, normalized.font);
  const radiusVars =
    radius.key === "square"
      ? {
          "--radius-sm": "0",
          "--radius-md": "0",
          "--radius-lg": "0",
          "--radius-xl": "0",
        }
      : radius.key === "rounded"
        ? {
            "--radius-sm": "0.5rem",
            "--radius-md": "0.75rem",
            "--radius-lg": "1rem",
            "--radius-xl": "1.25rem",
          }
        : {
            "--radius-sm": "0.25rem",
            "--radius-md": "0.375rem",
            "--radius-lg": "0.5rem",
            "--radius-xl": "0.75rem",
          };
  const shared = {
    ...accentVars,
    "--vx-root-font": scale.value,
    ...radiusVars,
    "--vx-font": font.value,
  };

  return [
    `html[data-vx-theme]{${declarations(shared)}}`,
    `html[data-vx-theme]:not(.dark){${declarations(palette.light)}}`,
    `html[data-vx-theme].dark{${declarations(palette.dark)}}`,
  ].join("\n");
}
