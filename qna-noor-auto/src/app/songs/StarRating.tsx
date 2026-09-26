"use client";

import { useState, useTransition } from "react";
import { setSongRating } from "./actions";

export function StarRating({
  songId,
  rating,
}: {
  songId: string;
  rating: number | null;
}) {
  const [value, setValue] = useState(rating);
  const [pending, startTransition] = useTransition();

  function choose(next: number) {
    const previous = value;
    const nextValue = value === next ? null : next;
    setValue(nextValue);
    startTransition(async () => {
      try {
        await setSongRating(songId, nextValue);
      } catch {
        setValue(previous);
      }
    });
  }

  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating: ${value ?? 0} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => {
        const star = index + 1;
        return (
          <button
            key={star}
            type="button"
            onClick={() => choose(star)}
            disabled={pending}
            aria-label={value === star ? `Clear ${star} star rating` : `Rate ${star} stars`}
            className={`text-lg leading-none transition-opacity disabled:opacity-50 ${
              value !== null && star <= value ? "text-amber-500" : "text-zinc-300 hover:text-amber-400"
            }`}
          >
            {value !== null && star <= value ? "★" : "☆"}
          </button>
        );
      })}
    </div>
  );
}
