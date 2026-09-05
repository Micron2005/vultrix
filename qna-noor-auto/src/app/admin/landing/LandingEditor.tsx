"use client";

import { useMemo, useState, useTransition } from "react";
import { Button, Card, CardHeader, Input, Textarea } from "@/components/ui";
import {
  DEFAULT_LANDING_CONFIG,
  LANDING_ICONS,
  normalizeLandingConfig,
  type LandingConfig,
  type LandingIcon,
} from "@/lib/landingConfig";
import { saveLanding } from "./actions";

type AnyRecord = Record<string, unknown>;
type EditorProps = {
  value: unknown;
  path: string[];
  onChange: (value: unknown) => void;
  customItemTemplate?: unknown;
};

const sectionLabels: Record<string, string> = {
  hero: "Hero",
  credibility: "Credibility",
  whatIs: "What is Vultrix?",
  audiences: "Audiences",
  founder: "Founder",
  features: "Features",
  deepDives: "Feature deep dives",
  stats: "Stats",
  import: "Import",
  shopRecommendation: "Shop recommendation",
  roadmap: "Roadmap",
  pricing: "Pricing",
  comparison: "Comparison",
  faq: "FAQ",
  contact: "Contact",
  finalCta: "Final CTA",
};

const palette = {
  Vultrix: { accent: "#7c3aed", accentSoft: "#a78bfa", dark: "#09090b" },
  Amber: { accent: "#f59e0b", accentSoft: "#fbbf24" },
  Blue: { accent: "#2563eb", accentSoft: "#60a5fa" },
  Green: { accent: "#16a34a", accentSoft: "#4ade80" },
  Rose: { accent: "#e11d48", accentSoft: "#fb7185" },
  Slate: { accent: "#475569", accentSoft: "#94a3b8" },
} as const;

function labelize(value: string): string {
  return value.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function blankShape(sample: unknown): unknown {
  if (typeof sample === "string") return "";
  if (typeof sample === "number") return 0;
  if (typeof sample === "boolean") return false;
  if (Array.isArray(sample)) return [];
  if (sample && typeof sample === "object") {
    return Object.fromEntries(
      Object.entries(sample).map(([key, value]) => [key, blankShape(value)]),
    );
  }
  return "";
}

function valueAtPath(root: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (Array.isArray(current)) return current[Number(key)];
    if (current && typeof current === "object") {
      return (current as AnyRecord)[key];
    }
    return undefined;
  }, root);
}

function itemTemplate(
  path: string[],
  current: unknown[],
  customItemTemplate?: unknown,
): unknown {
  if (customItemTemplate && path.at(-1) === "items") {
    return clone(customItemTemplate);
  }
  const defaultItems = valueAtPath(DEFAULT_LANDING_CONFIG, path);
  if (Array.isArray(defaultItems) && defaultItems.length > 0) {
    return clone(defaultItems[0]);
  }
  return blankShape(current[0]);
}

function isHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function moveItem(items: unknown[], from: number, to: number): unknown[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function ObjectEditor({ value, path, onChange, customItemTemplate }: EditorProps) {
  if (typeof value === "string") {
    const multiline = value.length > 90 || value.includes("\n") || path.at(-1)?.toLowerCase().includes("body");
    return multiline ? (
      <Textarea value={value} rows={3} onChange={(event) => onChange(event.target.value)} />
    ) : (
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    );
  }
  if (typeof value === "number") {
    return <Input type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />;
  }
  if (typeof value === "boolean") {
    return <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={value} onChange={(event) => onChange(event.target.checked)} /> Enabled</label>;
  }
  if (Array.isArray(value)) {
    return (
      <div className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3">
        {value.map((item, index) => (
          <div key={`${path.join(".")}-${index}`} className="rounded-md border border-zinc-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Item {index + 1}</span>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="ghost" disabled={index === 0} onClick={() => onChange(moveItem(value, index, index - 1))}>↑</Button>
                <Button type="button" size="sm" variant="ghost" disabled={index === value.length - 1} onClick={() => onChange(moveItem(value, index, index + 1))}>↓</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>
              </div>
            </div>
            <ObjectEditor value={item} path={[...path, String(index)]} onChange={(next) => onChange(value.map((current, itemIndex) => itemIndex === index ? next : current))} customItemTemplate={customItemTemplate} />
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...value, itemTemplate(path, value, customItemTemplate)])}>Add item</Button>
      </div>
    );
  }
  if (value && typeof value === "object") {
    const record = value as AnyRecord;
    return (
      <div className="space-y-4">
        {Object.entries(record).map(([key, child]) => (
          <div key={key}>
            <label className="mb-1 block text-sm font-medium text-zinc-700">{labelize(key)}</label>
            {key === "icon" && typeof child === "string" ? (
              <select className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm" value={child} onChange={(event) => onChange({ ...record, [key]: event.target.value })}>
                {LANDING_ICONS.map((icon) => <option key={icon} value={icon}>{icon}</option>)}
              </select>
            ) : (
              <ObjectEditor value={child} path={[...path, key]} onChange={(next) => onChange({ ...record, [key]: next })} customItemTemplate={customItemTemplate} />
            )}
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export default function LandingEditor({ initial }: { initial: LandingConfig }) {
  const [config, setConfig] = useState<LandingConfig>(() => normalizeLandingConfig(initial));
  const [selected, setSelected] = useState<string>("hero");
  const [tab, setTab] = useState<"sections" | "theme" | "site">("sections");
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const customById = useMemo(() => new Map(config.customSections.map((section) => [section.id, section])), [config.customSections]);

  const update = (next: LandingConfig) => {
    setConfig(next);
    setDirty(true);
    setMessage("");
  };
  const selectedValue = (config as unknown as AnyRecord)[selected] ?? customById.get(selected);

  const save = (nextConfig = config) => startTransition(async () => {
    const result = await saveLanding(JSON.stringify(nextConfig));
    setMessage(result.ok ? "Changes saved." : result.error || "Could not save changes.");
    if (result.ok) setDirty(false);
  });
  const addCustom = (kind: "text" | "cards" | "cta" | "faq") => {
    const usedIds = new Set(config.customSections.map((item) => item.id));
    let sequence = 1;
    while (usedIds.has(`custom-${sequence}`)) sequence += 1;
    const id = `custom-${sequence}`;
    const section = {
      id,
      kind,
      kicker: "New section",
      title: kind === "cta" ? "A clear next step" : "Your custom section",
      body: "Add your own landing-page copy here.",
      items: kind === "cards" ? [{ icon: "Star" as LandingIcon, title: "A useful card", desc: "Describe this card." }] : kind === "faq" ? [{ title: "A common question", desc: "Add the answer here." }] : [],
      ctaLabel: kind === "cta" ? "Get started" : "",
      ctaHref: kind === "cta" ? "/signup" : "",
      dark: kind === "cta",
    };
    update({ ...config, customSections: [...config.customSections, section], order: [...config.order, { id, enabled: true }] });
    setSelected(id);
  };
  const themeColorsValid = (["accent", "accentSoft", "dark", "light"] as const).every((key) => isHexColor(config.theme[key]));
  const moveSection = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= config.order.length) return;
    update({ ...config, order: moveItem(config.order, index, nextIndex) as LandingConfig["order"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-3">
        {(["sections", "theme", "site"] as const).map((item) => <Button key={item} type="button" size="sm" variant={tab === item ? "primary" : "secondary"} onClick={() => setTab(item)}>{labelize(item)}</Button>)}
      </div>
      {message && <div className={`rounded-md px-3 py-2 text-sm ${message.includes("saved") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{message}</div>}
      {tab === "theme" && (
        <Card>
          <CardHeader title="Theme" />
          <div className="space-y-5 p-4">
            <div className="flex flex-wrap gap-2">{Object.entries(palette).map(([name, colors]) => <Button key={name} type="button" size="sm" variant="secondary" onClick={() => update({ ...config, theme: { ...config.theme, ...colors } })}>{name}</Button>)}</div>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["accent", "accentSoft", "dark", "light"] as const).map((key) => (
                <div key={key}>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">{labelize(key)}</label>
                  <div className="flex gap-2">
                    <input type="color" value={isHexColor(config.theme[key]) ? config.theme[key] : "#000000"} onChange={(event) => update({ ...config, theme: { ...config.theme, [key]: event.target.value } })} className="h-10 w-12 rounded border border-zinc-300 p-1" />
                    <Input value={config.theme[key]} onChange={(event) => update({ ...config, theme: { ...config.theme, [key]: event.target.value } })} />
                  </div>
                  {!isHexColor(config.theme[key]) && <p className="mt-1 text-xs text-red-600">Use a 6-digit hex like #f59e0b</p>}
                </div>
              ))}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700">Background pattern</label>
              <select className="h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm" value={config.theme.pattern} onChange={(event) => update({ ...config, theme: { ...config.theme, pattern: event.target.value as LandingConfig["theme"]["pattern"] } })}>
                <option value="dots">Dots</option>
                <option value="grid">Grid</option>
                <option value="none">None</option>
              </select>
            </div>
            <p className="text-xs text-zinc-500">Use six-digit hex colors. The accent foreground is calculated automatically for readable contrast.</p>
          </div>
        </Card>
      )}
      {tab === "site" && (
        <Card>
          <CardHeader title="Site and navigation" />
          <div className="p-4"><ObjectEditor value={{ site: config.site, nav: config.nav, footer: config.footer }} path={["site"]} onChange={(next) => { const value = next as AnyRecord; update({ ...config, site: value.site as LandingConfig["site"], nav: value.nav as LandingConfig["nav"], footer: value.footer as LandingConfig["footer"] }); }} /></div>
        </Card>
      )}
      {tab === "sections" && (
        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <Card>
            <CardHeader title="Sections" />
            <div className="space-y-1 p-3">
              {config.order.map((entry, index) => (
                <div key={entry.id} className={`flex items-center gap-1 rounded-md p-1 ${selected === entry.id ? "bg-zinc-100" : ""}`}>
                  <input type="checkbox" checked={entry.enabled} onChange={(event) => update({ ...config, order: config.order.map((item) => item.id === entry.id ? { ...item, enabled: event.target.checked } : item) })} />
                  <button type="button" className="min-w-0 flex-1 truncate px-1 py-1 text-left text-sm" onClick={() => setSelected(entry.id)}>{sectionLabels[entry.id] || customById.get(entry.id)?.title || entry.id}</button>
                  <button type="button" disabled={index === 0} onClick={() => moveSection(index, -1)} aria-label="Move section up">↑</button>
                  <button type="button" disabled={index === config.order.length - 1} onClick={() => moveSection(index, 1)} aria-label="Move section down">↓</button>
                  {entry.id.startsWith("custom-") && <button type="button" className="text-red-600" onClick={() => { update({ ...config, order: config.order.filter((item) => item.id !== entry.id), customSections: config.customSections.filter((item) => item.id !== entry.id) }); setSelected("hero"); }}>×</button>}
                </div>
              ))}
              <div className="border-t border-zinc-200 pt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Add section</p>
                <div className="grid grid-cols-2 gap-2">{(["text", "cards", "cta", "faq"] as const).map((kind) => <Button key={kind} type="button" size="sm" variant="secondary" onClick={() => addCustom(kind)}>{labelize(kind)}</Button>)}</div>
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title={sectionLabels[selected] || customById.get(selected)?.title || "Section details"} />
            <div className="p-4">{selectedValue && <ObjectEditor value={selectedValue} path={[selected]} customItemTemplate={customById.get(selected)?.kind === "cards" ? { icon: "Star", title: "", desc: "" } : customById.get(selected)?.kind === "faq" ? { title: "", desc: "" } : undefined} onChange={(next) => { if (customById.has(selected)) update({ ...config, customSections: config.customSections.map((item) => item.id === selected ? next as LandingConfig["customSections"][number] : item) }); else update({ ...config, [selected]: next } as LandingConfig); }} />}</div>
          </Card>
        </div>
      )}
      <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur">
        <span className={`text-sm ${dirty ? "text-amber-700" : "text-zinc-500"}`}>{dirty ? "Unsaved changes" : "All changes saved"}</span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => { if (window.confirm("Reset all landing-page content to defaults?")) { const defaults = clone(DEFAULT_LANDING_CONFIG); update(defaults); save(defaults); } }}>Reset to defaults</Button>
          <Button type="button" disabled={!dirty || isPending || !themeColorsValid} onClick={() => save()}>{isPending ? "Saving…" : "Save changes"}</Button>
        </div>
      </div>
    </div>
  );
}
