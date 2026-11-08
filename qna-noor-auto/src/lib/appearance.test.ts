import assert from "node:assert/strict";
import test from "node:test";
import { appearanceCss, DEFAULT_APPEARANCE } from "./appearance";

function ruleBody(css: string, selector: string): string {
  const rule = css.split("\n").find((line) => line.startsWith(`${selector}{`));
  assert.ok(rule, `Expected CSS rule for ${selector}`);
  return rule.slice(selector.length + 1, -1);
}

test("appearance CSS keeps accent tints out of the shared rule", () => {
  const css = appearanceCss({ ...DEFAULT_APPEARANCE, palette: "midnight" });
  const shared = ruleBody(css, "html[data-vx-theme]");
  const light = ruleBody(css, "html[data-vx-theme]:not(.dark)");
  const dark = ruleBody(css, "html[data-vx-theme].dark");

  assert.doesNotMatch(shared, /--vx-accent-(50|100):/);
  assert.match(light, /--vx-accent-50:#f5f3ff/);
  assert.match(dark, /--vx-accent-50:#1a102d/);
});

test("appearance CSS computes dark accent tints for custom hex accents", () => {
  const css = appearanceCss({
    ...DEFAULT_APPEARANCE,
    palette: "midnight",
    accent: "#0d9488",
  });
  const dark = ruleBody(css, "html[data-vx-theme].dark");
  const accent50 = dark.match(/--vx-accent-50:(#[0-9a-f]{6})/)?.[1];

  assert.ok(accent50);
  const channels = [1, 3, 5].map((offset) =>
    Number.parseInt(accent50.slice(offset, offset + 2), 16),
  );
  assert.ok(channels.every((channel) => channel < 0x40), accent50);
});
