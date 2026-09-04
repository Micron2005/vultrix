"use client";

import { useEffect, useRef, useState } from "react";

type TimerItem = {
  id: string;
  label: string;
  sets: number | null;
  restSeconds: number | null;
};

type SetTimerProps = {
  item: TimerItem;
  day: string;
  done: boolean;
  onComplete: () => void | Promise<void>;
};

type StoredTimer = {
  currentSet: number;
  restStartedAt: number | null;
};

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function readStored(key: string): StoredTimer {
  if (typeof window === "undefined") return { currentSet: 1, restStartedAt: null };
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return { currentSet: 1, restStartedAt: null };
    const stored = JSON.parse(raw) as Partial<StoredTimer>;
    return {
      currentSet:
        typeof stored.currentSet === "number" && stored.currentSet >= 1
          ? Math.floor(stored.currentSet)
          : 1,
      restStartedAt:
        typeof stored.restStartedAt === "number" ? stored.restStartedAt : null,
    };
  } catch {
    return { currentSet: 1, restStartedAt: null };
  }
}

function signalRestOver() {
  try {
    const AudioContextConstructor =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (AudioContextConstructor) {
      const context = new AudioContextConstructor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = 880;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.25);
    }
  } catch {
    // Audio is best effort.
  }
  try {
    navigator.vibrate?.([200, 100, 200]);
  } catch {
    // Vibration is best effort.
  }
}

export function SetTimer({ item, day, done, onComplete }: SetTimerProps) {
  const key = `vx-settimer:${item.id}:${day}`;
  const [currentSet, setCurrentSet] = useState(1);
  const [restStartedAt, setRestStartedAt] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [completed, setCompleted] = useState(done);
  const signaledRef = useRef(false);
  const phase = restStartedAt === null ? "idle" : "resting";

  useEffect(() => {
    const stored = readStored(key);
    const restore = window.setTimeout(() => {
      setCurrentSet(stored.currentSet);
      setRestStartedAt(stored.restStartedAt);
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(restore);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(
        key,
        JSON.stringify({ currentSet, restStartedAt }),
      );
    } catch {
      // Storage is best effort.
    }
  }, [currentSet, hydrated, key, restStartedAt]);

  useEffect(() => {
    if (restStartedAt === null) {
      signaledRef.current = false;
      return;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [restStartedAt]);

  const restEnd =
    restStartedAt !== null && item.restSeconds !== null
      ? restStartedAt + item.restSeconds * 1000
      : null;
  const over = restEnd !== null && now >= restEnd;
  const remaining =
    restEnd === null ? 0 : Math.max(0, Math.ceil((restEnd - now) / 1000));
  const overtime =
    restEnd === null ? 0 : Math.max(0, Math.floor((now - restEnd) / 1000));

  useEffect(() => {
    if (restEnd !== null && now >= restEnd && !signaledRef.current) {
      signaledRef.current = true;
      signalRestOver();
    }
  }, [now, restEnd]);

  if (done || completed) {
    return (
      <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
        {item.sets !== null ? "All sets done" : "Done"}
      </p>
    );
  }

  const finish = async () => {
    setCompleted(true);
    try {
      await onComplete();
    } catch {
      setCompleted(false);
    }
  };

  const doneSet = () => {
    const lastSet = item.sets !== null && currentSet >= item.sets;
    if (lastSet || (item.sets === null && item.restSeconds === null)) {
      void finish();
      return;
    }
    if (item.restSeconds !== null) {
      setRestStartedAt(Date.now());
      return;
    }
    if (item.sets !== null) {
      setCurrentSet((value) => Math.min(value + 1, item.sets ?? value));
    }
  };

  const advanceSet = () => {
    setRestStartedAt(null);
    if (item.sets !== null) {
      setCurrentSet((value) => Math.min(value + 1, item.sets ?? value));
    }
  };

  const skipRest = () => {
    setRestStartedAt(null);
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      {phase === "resting" ? (
        <>
          <span
            className={`font-mono text-lg font-semibold ${
              over
                ? "text-red-600 dark:text-red-400"
                : "text-zinc-800 dark:text-zinc-200"
            }`}
          >
            {over
              ? `Rest over · +${formatDuration(overtime)}`
              : formatDuration(remaining)}
          </span>
          <button
            type="button"
            onClick={advanceSet}
            className="rounded-md border border-zinc-300 px-2 py-1 font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
          >
            Next set
          </button>
          <button
            type="button"
            onClick={skipRest}
            className="text-zinc-500 underline dark:text-zinc-400"
          >
            Skip rest
          </button>
        </>
      ) : (
        <>
          {item.sets !== null && (
            <span className="text-zinc-600 dark:text-zinc-400">
              Set {currentSet} of {item.sets}
            </span>
          )}
          <button
            type="button"
            onClick={doneSet}
            className="rounded-md border border-zinc-300 px-2 py-1 font-medium text-zinc-700 dark:border-zinc-600 dark:text-zinc-300"
          >
            {item.sets === null && item.restSeconds !== null
              ? `Start rest ${formatDuration(item.restSeconds)}`
              : item.restSeconds !== null
                ? `Done set — rest ${formatDuration(item.restSeconds)}`
                : "Done set"}
          </button>
          {currentSet > 1 && (
            <button
              type="button"
              onClick={() => {
                setCurrentSet(1);
                setRestStartedAt(null);
              }}
              className="text-xs text-zinc-500 underline dark:text-zinc-400"
            >
              Reset
            </button>
          )}
        </>
      )}
    </div>
  );
}
