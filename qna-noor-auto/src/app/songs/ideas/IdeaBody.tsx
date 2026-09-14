"use client";

import { useState } from "react";

export function IdeaBody({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = body.length > 360;
  return (
    <div>
      <p
        className={`whitespace-pre-wrap text-sm text-zinc-700 ${
          !expanded && isLong ? "line-clamp-6" : ""
        }`}
      >
        {body}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-1 text-xs font-medium text-zinc-600 underline"
        >
          {expanded ? "Less" : "More"}
        </button>
      )}
    </div>
  );
}
