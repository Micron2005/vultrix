import {
  type BeatData,
  type MelodicInstrument,
} from "./kits";

export const SAMPLED_INSTRUMENTS = [
  "piano",
  "eguitar",
  "aguitar",
  "bass",
] as const satisfies readonly MelodicInstrument[];

export type SampledInstrument = (typeof SAMPLED_INSTRUMENTS)[number];

const SOUND_FONT_NAMES: Record<SampledInstrument, string> = {
  piano: "acoustic_grand_piano",
  eguitar: "electric_guitar_clean",
  aguitar: "acoustic_guitar_steel",
  bass: "electric_bass_finger",
};

const NOTE_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
export const MIN_SAMPLED_NOTE = 22;
export const MAX_SAMPLED_NOTE = 98;

const arrayBuffers = new Map<string, Promise<ArrayBuffer>>();
const loggedFailures = new Set<string>();

function sampledNote(note: number) {
  return Math.max(MIN_SAMPLED_NOTE, Math.min(MAX_SAMPLED_NOTE, Math.round(note)));
}

function noteName(note: number) {
  return `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
}

export function isSampled(instrument: MelodicInstrument): instrument is SampledInstrument {
  return SAMPLED_INSTRUMENTS.includes(instrument as SampledInstrument);
}

export function sampleUrl(instrument: SampledInstrument, note: number) {
  const soundFontName = SOUND_FONT_NAMES[instrument];
  return `/soundfonts/FluidR3_GM/${soundFontName}-mp3/${noteName(sampledNote(note))}.mp3`;
}

export function sampledPlayback(note: number) {
  const sourceNote = sampledNote(note);
  return {
    sourceNote,
    playbackRate: 2 ** ((note - sourceNote) / 12),
  };
}

export class Sampler {
  private decoded = new WeakMap<BaseAudioContext, Map<string, AudioBuffer>>();
  private pending = new WeakMap<BaseAudioContext, Map<string, Promise<AudioBuffer | null>>>();

  get(
    context: BaseAudioContext,
    instrument: SampledInstrument,
    note: number,
  ): AudioBuffer | null {
    const key = `${instrument}:${sampledNote(note)}`;
    const buffer = this.decoded.get(context)?.get(key);
    if (buffer) return buffer;
    void this.load(context, instrument, note);
    return null;
  }

  async load(
    context: BaseAudioContext,
    instrument: SampledInstrument,
    note: number,
  ): Promise<AudioBuffer | null> {
    const sourceNote = sampledNote(note);
    const key = `${instrument}:${sourceNote}`;
    const cached = this.decoded.get(context)?.get(key);
    if (cached) return cached;

    let pendingForContext = this.pending.get(context);
    if (!pendingForContext) {
      pendingForContext = new Map();
      this.pending.set(context, pendingForContext);
    }
    const pending = pendingForContext.get(key);
    if (pending) return pending;

    const promise = this.decode(context, instrument, sourceNote);
    pendingForContext.set(key, promise);
    const buffer = await promise;
    pendingForContext.delete(key);
    if (buffer) {
      let decodedForContext = this.decoded.get(context);
      if (!decodedForContext) {
        decodedForContext = new Map();
        this.decoded.set(context, decodedForContext);
      }
      decodedForContext.set(key, buffer);
    }
    return buffer;
  }

  async preload(
    context: BaseAudioContext,
    notes: Iterable<{ instrument: SampledInstrument; note: number }>,
  ) {
    await Promise.all(
      [...notes].map(({ instrument, note }) => this.load(context, instrument, note)),
    );
  }

  private async decode(
    context: BaseAudioContext,
    instrument: SampledInstrument,
    note: number,
  ): Promise<AudioBuffer | null> {
    const url = sampleUrl(instrument, note);
    let arrayBufferPromise = arrayBuffers.get(url);
    if (!arrayBufferPromise) {
      arrayBufferPromise = fetch(url).then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.arrayBuffer();
      });
      arrayBuffers.set(url, arrayBufferPromise);
    }

    try {
      const bytes = await arrayBufferPromise;
      return await context.decodeAudioData(bytes.slice(0));
    } catch (error) {
      if (!loggedFailures.has(url)) {
        loggedFailures.add(url);
        console.error(`Could not load instrument sample ${url}`, error);
      }
      return null;
    }
  }
}

export function sampledNotesIn(data: BeatData) {
  const notes = new Map<string, { instrument: SampledInstrument; note: number }>();
  for (const pattern of data.patterns) {
    for (const track of data.tracks) {
      if (track.kind === "drums" || !isSampled(track.kind)) continue;
      for (const note of pattern.notes[track.id] ?? []) {
        const key = `${track.kind}:${note.note}`;
        if (!notes.has(key)) notes.set(key, { instrument: track.kind, note: note.note });
      }
    }
  }
  return [...notes.values()];
}
