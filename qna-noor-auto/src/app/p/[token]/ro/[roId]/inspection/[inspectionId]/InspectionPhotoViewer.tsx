"use client";

import { useState } from "react";

export function InspectionPhotoViewer({
  dataUrl,
}: {
  dataUrl: string;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
        className="block w-full text-left"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt="" className="h-20 w-full rounded object-cover" />
      </button>
      {expanded && (
        <div className="mt-2 overflow-hidden rounded-md bg-zinc-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={dataUrl} alt="" className="max-h-[32rem] w-full object-contain" />
        </div>
      )}
    </div>
  );
}
