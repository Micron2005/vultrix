"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button, Input } from "@/components/ui";

type TranscriptEntry = {
  role: "user" | "assistant";
  content: string;
  steps?: Array<{ tool: string; confirmation: string }>;
};

type VoiceState = "ASLEEP" | "ACTIVE" | "THINKING" | "FOLLOW_UP";

type RecognitionResult = {
  isFinal: boolean;
  0: { transcript: string };
};

type RecognitionEvent = {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
};

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

type RecognitionConstructor = new () => Recognition;

type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

const FOLLOW_UP_TIMEOUT_MS = 6000;
const SPEECH_PAUSE_MS = 3000;
const DUPLICATE_TRANSCRIPT_WINDOW_MS = 1200;
const ASSISTANT_POSITION_KEY = "vultrix-assistant-position";
const POSITION_MARGIN = 8;

type FloatingPosition = {
  x: number;
  y: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

function normalizeSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"'.!?]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isNegativeFollowUp(text: string): boolean {
  return /^(no|nope|nah|nothing|nothing else|thats all|that is all|all done|done|goodbye|bye|not now)$/.test(
    normalizeSpeech(text),
  );
}

function isAffirmativeFollowUp(text: string): boolean {
  return /^(yes|yeah|yep|yup|sure|okay|ok|alright|all right)$/.test(
    normalizeSpeech(text),
  );
}

export function AssistantClient({
  assistantName,
  voiceIdentifier,
  floating = false,
}: {
  assistantName: string;
  voiceIdentifier: string | null;
  floating?: boolean;
}) {
  const pathname = usePathname();
  const voiceEnabled = !floating || pathname !== "/assistant";
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [floatingPosition, setFloatingPosition] = useState<FloatingPosition>({
    x: POSITION_MARGIN,
    y: POSITION_MARGIN,
  });
  const [voiceState, setVoiceStateValue] = useState<VoiceState>("ASLEEP");
  const [status, setStatus] = useState("");
  const floatingRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const dragMovedRef = useRef(false);
  const positionReadyRef = useRef(!floating);
  const recognitionRef = useRef<Recognition | null>(null);
  const recognitionStartedRef = useRef(false);
  const shouldListenRef = useRef(false);
  const recognitionPausedRef = useRef(true);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const followUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceStateRef = useRef<VoiceState>("ASLEEP");
  const commandBusyRef = useRef(false);
  const lastTranscriptRef = useRef({ text: "", at: 0 });
  const speechBufferRef = useRef("");
  const interimSpeechRef = useRef("");
  const commandDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processTranscriptRef = useRef<
    (transcript: string, isFinal: boolean) => void
  >(() => {});
  const submitMessageRef = useRef<(message: string) => Promise<void>>(
    async () => {},
  );

  const clampFloatingPosition = useCallback((position: FloatingPosition) => {
    if (typeof window === "undefined") return position;
    const element = floatingRef.current;
    const width = element?.offsetWidth ?? 56;
    const height = element?.offsetHeight ?? 56;
    return {
      x: Math.min(
        Math.max(POSITION_MARGIN, position.x),
        Math.max(POSITION_MARGIN, window.innerWidth - width - POSITION_MARGIN),
      ),
      y: Math.min(
        Math.max(POSITION_MARGIN, position.y),
        Math.max(POSITION_MARGIN, window.innerHeight - height - POSITION_MARGIN),
      ),
    };
  }, []);

  useEffect(() => {
    if (!floating) return;
    const loadTimer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(ASSISTANT_POSITION_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<FloatingPosition>;
          if (typeof parsed.x === "number" && typeof parsed.y === "number") {
            setFloatingPosition(
              clampFloatingPosition({ x: parsed.x, y: parsed.y }),
            );
          }
        }
      } catch {
        // Ignore unavailable or malformed local storage.
      } finally {
        positionReadyRef.current = true;
      }
    }, 0);
    return () => window.clearTimeout(loadTimer);
  }, [clampFloatingPosition, floating]);

  useEffect(() => {
    if (!floating || !positionReadyRef.current) return;
    try {
      window.localStorage.setItem(
        ASSISTANT_POSITION_KEY,
        JSON.stringify(floatingPosition),
      );
    } catch {
      // Ignore unavailable local storage.
    }
  }, [floating, floatingPosition]);

  useEffect(() => {
    if (!floating) return;
    const clampPosition = () => {
      setFloatingPosition((current) => clampFloatingPosition(current));
    };
    clampPosition();
    window.addEventListener("resize", clampPosition);
    return () => window.removeEventListener("resize", clampPosition);
  }, [clampFloatingPosition, floating]);

  const handleDragStart = (event: React.PointerEvent<HTMLElement>) => {
    if (!floating || event.button !== 0) return;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: floatingPosition.x,
      originY: floatingPosition.y,
      moved: false,
    };
    dragMovedRef.current = false;
  };

  const handleDragMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 4) return;
    drag.moved = true;
    dragMovedRef.current = true;
    setFloatingPosition(
      clampFloatingPosition({
        x: drag.originX + deltaX,
        y: drag.originY + deltaY,
      }),
    );
  };

  const handleDragEnd = (event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const setVoiceState = useCallback((next: VoiceState) => {
    voiceStateRef.current = next;
    setVoiceStateValue(next);
  }, []);

  const clearFollowUpTimer = useCallback(() => {
    if (followUpTimerRef.current) {
      clearTimeout(followUpTimerRef.current);
      followUpTimerRef.current = null;
    }
  }, []);

  const clearCommandDebounce = useCallback(() => {
    if (commandDebounceRef.current) {
      clearTimeout(commandDebounceRef.current);
      commandDebounceRef.current = null;
    }
  }, []);

  const clearSpeechBuffer = useCallback(() => {
    clearCommandDebounce();
    speechBufferRef.current = "";
    interimSpeechRef.current = "";
  }, [clearCommandDebounce]);

  const queueCommand = useCallback(
    (command: string) => {
      const trimmed = command.trim();
      if (!trimmed) return;
      clearCommandDebounce();
      commandDebounceRef.current = setTimeout(() => {
        commandDebounceRef.current = null;
        clearSpeechBuffer();
        void submitMessageRef.current(trimmed);
      }, SPEECH_PAUSE_MS);
    },
    [clearCommandDebounce, clearSpeechBuffer],
  );

  const speakSequence = useCallback(
    (phrases: string[]): Promise<void> => {
      if (!("speechSynthesis" in window) || phrases.length === 0) {
        return Promise.resolve();
      }
      window.speechSynthesis.cancel();
      return new Promise((resolve) => {
        let index = 0;
        const speakNext = () => {
          const phrase = phrases[index];
          if (!phrase) {
            resolve();
            return;
          }
          const utterance = new SpeechSynthesisUtterance(phrase);
          const voice = window.speechSynthesis
            .getVoices()
            .find((candidate) => candidate.voiceURI === voiceIdentifier);
          if (voice) utterance.voice = voice;
          utterance.onend = () => {
            index += 1;
            speakNext();
          };
          utterance.onerror = () => resolve();
          try {
            window.speechSynthesis.speak(utterance);
          } catch {
            resolve();
          }
        };
        speakNext();
      });
    },
    [voiceIdentifier],
  );

  const stopRecognition = useCallback(() => {
    recognitionPausedRef.current = true;
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    const recognition = recognitionRef.current;
    if (!recognition || !recognitionStartedRef.current) return;
    try {
      recognition.stop();
      recognitionStartedRef.current = false;
    } catch {
      recognitionStartedRef.current = false;
    }
  }, []);

  const startRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (
      !recognition ||
      !shouldListenRef.current ||
      !recognitionPausedRef.current ||
      recognitionStartedRef.current
    ) {
      return;
    }
    recognitionPausedRef.current = false;
    try {
      recognition.start();
      recognitionStartedRef.current = true;
    } catch {
      recognitionStartedRef.current = false;
      setStatus("Voice input could not start. Try the text box instead.");
    }
  }, []);

  const returnToAsleep = useCallback(
    async (saySignOff: boolean) => {
      clearFollowUpTimer();
      setVoiceState("ASLEEP");
      if (saySignOff && shouldListenRef.current) {
        stopRecognition();
        await speakSequence([
          `Okay — just say Hey ${assistantName} when you need me.`,
        ]);
      }
      if (shouldListenRef.current) {
        setStatus(`Asleep — say “Hey ${assistantName}” to wake me.`);
        startRecognition();
      }
    },
    [
      assistantName,
      clearFollowUpTimer,
      setVoiceState,
      speakSequence,
      startRecognition,
      stopRecognition,
    ],
  );

  const beginFollowUp = useCallback(() => {
    if (!shouldListenRef.current) return;
    setVoiceState("FOLLOW_UP");
    setStatus("Listening for your next request…");
    clearFollowUpTimer();
    followUpTimerRef.current = setTimeout(() => {
      if (commandBusyRef.current) return;
      void returnToAsleep(true);
    }, FOLLOW_UP_TIMEOUT_MS);
    startRecognition();
  }, [clearFollowUpTimer, returnToAsleep, setVoiceState, startRecognition]);

  const submitMessage = useCallback(
    async (message: string) => {
      const trimmed = message.trim();
      if (!trimmed || commandBusyRef.current) return;
      commandBusyRef.current = true;
      clearFollowUpTimer();
      clearSpeechBuffer();
      stopRecognition();
      setVoiceState("THINKING");
      setStatus("Thinking…");
      setText("");
      setEntries((current) => [...current, { role: "user", content: trimmed }]);
      try {
        const history = entries
          .slice(-10)
          .map(({ role, content }) => ({ role, content }));
        const response = await fetch("/api/assistant/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            history,
            timezone:
              Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          }),
        });
        const body = (await response.json()) as {
          reply?: string;
          steps?: Array<{ tool: string; confirmation: string }>;
          error?: string;
        };
        if (!response.ok) {
          throw new Error(body.error ?? "Assistant unavailable.");
        }
        const reply = body.reply ?? "I’m ready.";
        setEntries((current) => [
          ...current,
          { role: "assistant", content: reply, steps: body.steps },
        ]);
        setStatus("");
        await speakSequence([reply, "Anything else?"]);
        if (shouldListenRef.current) {
          beginFollowUp();
        } else {
          setVoiceState("ASLEEP");
        }
      } catch (error) {
        const reply =
          error instanceof Error
            ? error.message
            : "The assistant is unavailable right now.";
        setEntries((current) => [
          ...current,
          { role: "assistant", content: reply },
        ]);
        setStatus("");
        await speakSequence([reply, "Anything else?"]);
        if (shouldListenRef.current) {
          beginFollowUp();
        } else {
          setVoiceState("ASLEEP");
        }
      } finally {
        commandBusyRef.current = false;
      }
    },
    [
      beginFollowUp,
      clearFollowUpTimer,
      clearSpeechBuffer,
      entries,
      setVoiceState,
      speakSequence,
      stopRecognition,
    ],
  );

  const processTranscript = useCallback(
    (transcript: string, isFinal: boolean) => {
      const trimmed = transcript.trim();
      if (!trimmed || commandBusyRef.current) return;
      if (!isFinal) {
        clearCommandDebounce();
        return;
      }
      const now = Date.now();
      if (
        lastTranscriptRef.current.text === normalizeSpeech(trimmed) &&
        now - lastTranscriptRef.current.at < DUPLICATE_TRANSCRIPT_WINDOW_MS
      ) {
        return;
      }
      lastTranscriptRef.current = { text: normalizeSpeech(trimmed), at: now };
      const state = voiceStateRef.current;
      const normalized = normalizeSpeech(trimmed);
      if (state === "ASLEEP") {
        const name = normalizeSpeech(assistantName);
        const heyWake = `hey ${name}`;
        let wakeIndex = normalized.indexOf(heyWake);
        let wakeLength = heyWake.length;
        if (wakeIndex < 0) {
          wakeIndex = normalized.indexOf(name);
          wakeLength = name.length;
        }
        if (wakeIndex < 0) {
          clearSpeechBuffer();
          return;
        }
        const command = trimmed
          .slice(Math.min(trimmed.length, wakeIndex + wakeLength))
          .replace(/^[\s,:-]+/, "");
        if (command) {
          queueCommand(command);
        } else {
          clearSpeechBuffer();
          setVoiceState("ACTIVE");
          setStatus("Listening…");
          stopRecognition();
          void speakSequence(["I’m listening."]).then(startRecognition);
        }
        return;
      }
      if (state === "FOLLOW_UP") {
        clearFollowUpTimer();
        if (isNegativeFollowUp(trimmed)) {
          clearSpeechBuffer();
          void returnToAsleep(true);
          return;
        }
        if (isAffirmativeFollowUp(trimmed)) {
          clearSpeechBuffer();
          setVoiceState("ACTIVE");
          setStatus("Go ahead — I’m listening.");
          stopRecognition();
          void speakSequence(["Go ahead."]).then(startRecognition);
          return;
        }
      }
      if (state === "ACTIVE" || state === "FOLLOW_UP") {
        queueCommand(trimmed);
      }
    },
    [
      assistantName,
      clearFollowUpTimer,
      clearCommandDebounce,
      clearSpeechBuffer,
      queueCommand,
      returnToAsleep,
      setVoiceState,
      speakSequence,
      startRecognition,
      stopRecognition,
    ],
  );

  useEffect(() => {
    processTranscriptRef.current = processTranscript;
    submitMessageRef.current = submitMessage;
  }, [processTranscript, submitMessage]);

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    const Constructor =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Constructor || !voiceEnabled) return;
    const recognition = new Constructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let hasFinalResult = false;
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        if (result.isFinal) {
          hasFinalResult = true;
          speechBufferRef.current = [
            speechBufferRef.current,
            result[0].transcript,
          ]
            .filter(Boolean)
            .join(" ");
          interimSpeechRef.current = "";
        } else {
          interimSpeechRef.current = result[0].transcript;
        }
      }
      const transcript = [
        speechBufferRef.current,
        interimSpeechRef.current,
      ]
        .filter(Boolean)
        .join(" ");
      processTranscriptRef.current(transcript, hasFinalResult);
    };
    recognition.onerror = () => {
      recognitionStartedRef.current = false;
      setStatus("Voice input stopped. You can still type a request.");
    };
    recognition.onend = () => {
      recognitionStartedRef.current = false;
      if (
        shouldListenRef.current &&
        !recognitionPausedRef.current &&
        !restartTimerRef.current
      ) {
        restartTimerRef.current = setTimeout(() => {
          restartTimerRef.current = null;
          startRecognition();
        }, 150);
      }
    };
    recognitionRef.current = recognition;
    if (shouldListenRef.current) {
      startRecognition();
    }
    return () => {
      shouldListenRef.current = false;
      recognitionPausedRef.current = true;
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
      clearCommandDebounce();
      clearSpeechBuffer();
      try {
        recognition.stop();
      } catch {
        // Recognition was never started.
      }
      recognitionRef.current = null;
    };
  }, [clearCommandDebounce, clearSpeechBuffer, startRecognition, voiceEnabled]);

  const toggleListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setStatus("Voice input is unavailable here. Chrome usually works best.");
      return;
    }
    if (shouldListenRef.current) {
      shouldListenRef.current = false;
      clearFollowUpTimer();
      clearSpeechBuffer();
      stopRecognition();
      setListening(false);
      setVoiceState("ASLEEP");
      setStatus("");
      return;
    }
    shouldListenRef.current = true;
    setListening(true);
    setVoiceState("ASLEEP");
    setStatus(`Asleep — say “Hey ${assistantName}” to wake me.`);
    startRecognition();
  };

  const stateLabel: Record<VoiceState, string> = {
    ASLEEP: `Asleep — say “Hey ${assistantName}”`,
    ACTIVE: "Listening",
    THINKING: "Thinking",
    FOLLOW_UP: "Listening for your next request",
  };

  if (floating && !voiceEnabled) return null;

  return (
    <div
      ref={floatingRef}
      className={
        floating
          ? "fixed z-50"
          : "p-4 sm:p-6"
      }
      style={
        floating
          ? { left: floatingPosition.x, top: floatingPosition.y }
          : undefined
      }
    >
      {floating ? (
        <Button
          type="button"
          className="h-14 w-14 rounded-full p-0 shadow-lg"
          variant={
            voiceState === "THINKING"
              ? "primary"
              : listening
                ? "danger"
                : "secondary"
          }
          aria-label={
            listening
              ? `Stop ${assistantName} microphone`
              : `Start ${assistantName} microphone`
          }
          style={{ touchAction: "none", cursor: "move" }}
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
          onClick={() => {
            if (dragMovedRef.current) {
              dragMovedRef.current = false;
              return;
            }
            toggleListening();
          }}
        >
          <span className="text-xs font-semibold" aria-hidden="true">
            {voiceState === "THINKING"
              ? "…"
              : listening
                ? voiceState === "ASLEEP"
                  ? "WAKE"
                  : "MIC"
                : "◉"}
          </span>
        </Button>
      ) : (
        <div>
          <div
            className={
              floating ? "max-h-[min(70vh,36rem)] overflow-y-auto" : ""
            }
          >
            <div className="mb-4 flex items-center justify-between gap-3">
        <div className="text-sm font-medium text-zinc-700">
          {stateLabel[voiceState]}
        </div>
        <div className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600">
          {voiceState.toLowerCase().replace("_", " ")}
        </div>
            </div>
            <div className="mb-4 min-h-48 space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Try “Hey {assistantName}, add an event tomorrow at 9 AM” or type
            below.
          </p>
        ) : (
          entries.map((entry, index) => (
            <div
              key={`${entry.role}-${index}`}
              className={
                entry.role === "user"
                  ? "rounded-md bg-zinc-100 p-3 text-sm text-zinc-800"
                  : "rounded-md border border-zinc-200 p-3 text-sm text-zinc-900"
              }
            >
              <div className="mb-1 text-xs font-medium uppercase text-zinc-500">
                {entry.role === "user" ? "You" : assistantName}
              </div>
              <p>{entry.content}</p>
              {entry.steps && entry.steps.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-zinc-500">
                  {entry.steps.map((step, stepIndex) => (
                    <li key={`${step.tool}-${stepIndex}`}>
                      {step.confirmation}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        )}
            </div>
            {status && <p className="mb-3 text-sm text-zinc-500">{status}</p>}
            <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void submitMessage(text);
        }}
      >
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type a request…"
          aria-label="Assistant request"
        />
        <Button type="submit">Send</Button>
            </form>
            <div className="mt-3 flex items-center gap-3">
              <Button
          type="button"
          variant={listening ? "danger" : "secondary"}
          onClick={toggleListening}
        >
          {listening ? "Stop mic" : "Start mic"}
              </Button>
              <span className="text-xs text-zinc-500">
                Voice works best in Chrome; text input works everywhere.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
