"use client";

import { useEffect, useState } from "react";

type BrowserVoice = {
  name: string;
  voiceURI: string;
  lang: string;
};

export function VoicePicker({ defaultValue = "" }: { defaultValue?: string }) {
  const [voices, setVoices] = useState<BrowserVoice[]>([]);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const loadVoices = () => {
      setVoices(
        window.speechSynthesis.getVoices().map((voice) => ({
          name: voice.name,
          voiceURI: voice.voiceURI,
          lang: voice.lang,
        })),
      );
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  return (
    <select
      name="voice"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
    >
      <option value="">Browser default voice</option>
      {value && !voices.some((voice) => voice.voiceURI === value) && (
        <option value={value}>Saved voice</option>
      )}
      {voices.map((voice) => (
        <option key={voice.voiceURI} value={voice.voiceURI}>
          {voice.name} ({voice.lang})
        </option>
      ))}
    </select>
  );
}
