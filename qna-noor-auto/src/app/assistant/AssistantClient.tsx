"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Input } from "@/components/ui";

type TranscriptEntry = {
  role: "user" | "assistant";
  content: string;
  steps?: Array<{ tool: string; confirmation: string }>;
};

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

export function AssistantClient({
  assistantName,
  voiceIdentifier,
}: {
  assistantName: string;
  voiceIdentifier: string | null;
}) {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [status, setStatus] = useState("");
  const recognitionRef = useRef<Recognition | null>(null);
  const listeningRef = useRef(false);
  const armedRef = useRef(false);
  const submitMessageRef = useRef<(message: string) => Promise<void>>(
    async () => {},
  );

  const speak = useCallback((reply: string) => {
    if (!("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(reply);
    const voice = window.speechSynthesis
      .getVoices()
      .find((candidate) => candidate.voiceURI === voiceIdentifier);
    if (voice) utterance.voice = voice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [voiceIdentifier]);

  const submitMessage = useCallback(async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setText("");
    setStatus("Thinking…");
    setEntries((current) => [...current, { role: "user", content: trimmed }]);
    try {
      const history = entries
        .slice(-10)
        .map(({ role, content }) => ({ role, content }));
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, history }),
      });
      const body = (await response.json()) as {
        reply?: string;
        steps?: Array<{ tool: string; confirmation: string }>;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "Assistant unavailable.");
      const reply = body.reply ?? "I’m ready.";
      setEntries((current) => [
        ...current,
        { role: "assistant", content: reply, steps: body.steps },
      ]);
      speak(reply);
      setStatus("");
    } catch (error) {
      const reply =
        error instanceof Error
          ? error.message
          : "The assistant is unavailable right now.";
      setEntries((current) => [...current, { role: "assistant", content: reply }]);
      setStatus("");
    }
  }, [entries, speak]);
  useEffect(() => {
    submitMessageRef.current = submitMessage;
  }, [submitMessage]);

  useEffect(() => {
    const speechWindow = window as SpeechWindow;
    const Constructor =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Constructor) return;
    const recognition = new Constructor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result.isFinal) continue;
        const transcript = result[0].transcript.trim();
        const lower = transcript.toLowerCase();
        const wake = assistantName.trim().toLowerCase();
        if (!armedRef.current) {
          const wakeIndex = lower.indexOf(wake);
          if (wakeIndex < 0) continue;
          const command = transcript.slice(wakeIndex + wake.length).trim();
          if (command) {
            void submitMessageRef.current(command);
          } else {
            armedRef.current = true;
            setStatus(`Listening for your request after “${assistantName}”…`);
          }
        } else {
          armedRef.current = false;
          void submitMessageRef.current(transcript);
        }
      }
    };
    recognition.onerror = () => {
      setStatus("Voice input stopped. You can still type a request.");
    };
    recognition.onend = () => {
      if (listeningRef.current) {
        try {
          recognition.start();
        } catch {
          setListening(false);
          listeningRef.current = false;
        }
      }
    };
    recognitionRef.current = recognition;
    return () => {
      listeningRef.current = false;
      try {
        recognition.stop();
      } catch {
        // Recognition was never started.
      }
      recognitionRef.current = null;
    };
  }, [assistantName]);

  const toggleListening = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setStatus("Voice input is unavailable here. Chrome usually works best.");
      return;
    }
    if (listening) {
      listeningRef.current = false;
      recognition.stop();
      setListening(false);
      armedRef.current = false;
      setStatus("");
      return;
    }
    listeningRef.current = true;
    setListening(true);
    armedRef.current = false;
    setStatus(`Say “${assistantName}” to wake me.`);
    try {
      recognition.start();
    } catch {
      listeningRef.current = false;
      setListening(false);
      setStatus("Voice input could not start. Try the text box instead.");
    }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 min-h-48 space-y-3">
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Try “{assistantName}, add an event tomorrow at 9 AM” or type below.
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
                    <li key={`${step.tool}-${stepIndex}`}>{step.confirmation}</li>
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
  );
}
