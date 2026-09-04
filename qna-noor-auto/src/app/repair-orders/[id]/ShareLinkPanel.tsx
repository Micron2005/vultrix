"use client";

import { useEffect, useState } from "react";

export function ShareLinkPanel({
  token,
  pathPrefix = "/e/",
}: {
  token: string;
  pathPrefix?: string;
}) {
  const [href, setHref] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nextHref = `${window.location.origin}${pathPrefix}${token}`;
    const frame = window.requestAnimationFrame(() => setHref(nextHref));
    return () => window.cancelAnimationFrame(frame);
  }, [token, pathPrefix]);

  async function copy() {
    if (!href) return;
    try {
      await navigator.clipboard.writeText(href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Older browsers / non-secure contexts: select + copy fallback.
      const el = document.createElement("textarea");
      el.value = href;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <input
        readOnly
        value={href}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 basis-full sm:basis-auto rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-mono text-zinc-700"
      />
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md bg-zinc-900 hover:bg-zinc-800 text-white px-3 py-2 text-sm font-medium"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
      {href && (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-md border border-zinc-300 bg-white hover:bg-zinc-50 text-zinc-700 px-3 py-2 text-sm font-medium"
        >
          Preview ↗
        </a>
      )}
    </div>
  );
}
