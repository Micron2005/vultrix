import {
  BEAT_TRACKS,
  KIT_CONFIG,
  type BeatData,
  type BeatKit,
  type BeatPattern,
  type BeatTrack,
} from "./kits";

export type BeatDocument = {
  title: string;
  bpm: number;
  swing: number;
  kit: BeatKit;
  data: BeatData;
};

export type BeatPlaybackMode = "pattern" | "chain";

type AudioContextLike = BaseAudioContext;

function midiFrequency(note: number) {
  return 440 * 2 ** ((note - 69) / 12);
}

function patternSequence(
  data: BeatData,
  mode: BeatPlaybackMode,
  patternId: string,
): BeatPattern[] {
  const byId = new Map(data.patterns.map((pattern) => [pattern.id, pattern]));
  if (mode === "chain" && data.chain.length) {
    const chain = data.chain
      .map((id) => byId.get(id))
      .filter((pattern): pattern is BeatPattern => Boolean(pattern));
    if (chain.length) return chain;
  }
  const selected = byId.get(patternId) ?? data.patterns[0];
  return selected ? [selected] : [];
}

export class BeatEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private masterConnected = false;
  private timer: number | null = null;
  private nextNoteTime = 0;
  private sequenceIndex = 0;
  private step = 0;
  private mutedTracks = new Set<BeatTrack>();
  private playback: {
    beat: BeatDocument;
    mode: BeatPlaybackMode;
    patternId: string;
    onStep?: (patternIndex: number, step: number) => void;
  } | null = null;

  async play(
    beat: BeatDocument,
    mode: BeatPlaybackMode,
    patternId: string,
    onStep?: (patternIndex: number, step: number) => void,
  ) {
    this.stop();
    const context = this.context ?? new AudioContext();
    this.context = context;
    this.master = this.master ?? context.createGain();
    this.master.gain.value = 0.8;
    if (!this.masterConnected) {
      this.master.connect(context.destination);
      this.masterConnected = true;
    }
    await context.resume();
    this.playback = { beat, mode, patternId, onStep };
    this.sequenceIndex = 0;
    this.step = 0;
    this.nextNoteTime = context.currentTime + 0.05;
    this.schedule();
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.playback = null;
  }

  setTrackMuted(track: BeatTrack, muted: boolean) {
    if (muted) this.mutedTracks.add(track);
    else this.mutedTracks.delete(track);
  }

  async preview(beat: BeatDocument, track: BeatTrack, accent = false) {
    const context = this.context ?? new AudioContext();
    this.context = context;
    this.master = this.master ?? context.createGain();
    if (!this.masterConnected) {
      this.master.connect(context.destination);
      this.masterConnected = true;
    }
    await context.resume();
    this.scheduleTrackVoice(context, this.master, track, accent ? 1.5 : 1, context.currentTime + 0.01, beat.kit);
  }

  private schedule() {
    const context = this.context;
    const playback = this.playback;
    if (!context || !playback) return;
    const patterns = patternSequence(playback.beat.data, playback.mode, playback.patternId);
    if (!patterns.length) return;
    const stepDuration = 60 / playback.beat.bpm / 4;
    while (this.nextNoteTime < context.currentTime + 0.1) {
      const pattern = patterns[this.sequenceIndex % patterns.length];
      const delay = this.step % 2 === 1
        ? (playback.beat.swing / 100) * stepDuration * 0.5
        : 0;
      this.scheduleStep(
        context,
        this.master!,
        playback.beat,
        pattern,
        this.sequenceIndex,
        this.step,
        this.nextNoteTime + delay,
      );
      this.nextNoteTime += stepDuration;
      this.step += 1;
      if (this.step >= 16) {
        this.step = 0;
        this.sequenceIndex += 1;
      }
    }
  }

  private scheduleStep(
    context: AudioContextLike,
    destination: AudioNode,
    beat: BeatDocument,
    pattern: BeatPattern,
    patternIndex: number,
    step: number,
    time: number,
  ) {
    for (const track of BEAT_TRACKS) {
      const value = pattern.steps[track][step];
      if (value && !this.mutedTracks.has(track)) {
        this.scheduleTrackVoice(context, destination, track, value === 2 ? 1.5 : 1, time, beat.kit);
      }
    }
    for (const note of beat.data.bass.notes) {
      if (note.step === step) {
        this.scheduleBass(context, destination, note.note, note.len, beat, time);
      }
    }
    if (this.playback?.onStep) {
      window.setTimeout(() => {
        if (this.playback) window.requestAnimationFrame(() => this.playback?.onStep?.(patternIndex, step));
      }, Math.max(0, (time - context.currentTime) * 1000));
    }
  }

  private scheduleTrackVoice(
    context: AudioContextLike,
    destination: AudioNode,
    track: BeatTrack,
    level: number,
    time: number,
    kit: BeatKit,
  ) {
    const config = KIT_CONFIG[kit];
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(config.lowpass, time);
    gain.gain.setValueAtTime(0.0001, time);
    const peak = Math.min(0.9, level * 0.32);
    const decay =
      track === "kick"
        ? config.kickDecay
        : track === "snare"
          ? config.snareDecay
          : config.hatDecay;
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    filter.connect(gain);
    gain.connect(destination);

    if (track === "kick" || track === "tom" || track === "rim") {
      const oscillator = context.createOscillator();
      oscillator.type = track === "rim" ? "square" : "sine";
      oscillator.detune.value = config.detune;
      oscillator.frequency.setValueAtTime(track === "kick" ? 150 : track === "tom" ? 180 : 420, time);
      oscillator.frequency.exponentialRampToValueAtTime(track === "kick" ? 48 : 110, time + decay);
      oscillator.connect(filter);
      oscillator.start(time);
      oscillator.stop(time + decay + 0.02);
      return;
    }

    const noise = context.createBufferSource();
    noise.buffer = this.noiseBuffer(context);
    filter.frequency.setValueAtTime(
      track === "snare" ? (kit === "Acoustic" ? 2800 : 1800) : track === "ohh" ? 9000 : 6500,
      time,
    );
    noise.connect(filter);
    noise.start(time);
    noise.stop(time + decay + 0.02);
    if (track === "snare" || track === "clap") {
      const tone = context.createOscillator();
      tone.type = "triangle";
      tone.frequency.value = track === "clap" ? 900 : 180;
      tone.connect(filter);
      tone.start(time);
      tone.stop(time + decay);
    }
  }

  private scheduleBass(
    context: AudioContextLike,
    destination: AudioNode,
    note: number,
    length: number,
    beat: BeatDocument,
    time: number,
  ) {
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = beat.kit === "Lo-fi" ? 900 : 1800;
    const duration = Math.min(16, length) * (60 / beat.bpm / 4);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.25, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    filter.connect(gain);
    gain.connect(destination);
    for (const type of ["triangle", "sawtooth"] as const) {
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.detune.value = type === "sawtooth" ? -4 : 4;
      oscillator.frequency.value = midiFrequency(note);
      oscillator.connect(filter);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.02);
    }
  }

  private noiseBuffer(context: AudioContextLike) {
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  async renderWav(beat: BeatDocument) {
    const patterns = patternSequence(
      beat.data,
      beat.data.chain.length ? "chain" : "pattern",
      beat.data.patterns[0]?.id ?? "",
    );
    const renderPatterns = beat.data.chain.length ? patterns : [...patterns, ...patterns];
    const stepDuration = 60 / beat.bpm / 4;
    const seconds = renderPatterns.length * 16 * stepDuration + 1;
    const context = new OfflineAudioContext(2, Math.ceil(seconds * 44100), 44100);
    const destination = context.createGain();
    destination.gain.value = 0.8;
    destination.connect(context.destination);
    renderPatterns.forEach((pattern, patternIndex) => {
      for (let step = 0; step < 16; step += 1) {
        const baseTime = (patternIndex * 16 + step) * stepDuration;
        const time = baseTime + (step % 2 === 1 ? (beat.swing / 100) * stepDuration * 0.5 : 0);
        for (const track of BEAT_TRACKS) {
          const value = pattern.steps[track][step];
          if (value) this.scheduleTrackVoice(context, destination, track, value === 2 ? 1.5 : 1, time, beat.kit);
        }
        for (const note of beat.data.bass.notes) {
          if (note.step === step) this.scheduleBass(context, destination, note.note, note.len, beat, time);
        }
      }
    });
    const rendered = await context.startRendering();
    return this.encodeWav(rendered);
  }

  private encodeWav(buffer: AudioBuffer) {
    const channels = Math.min(2, buffer.numberOfChannels);
    const frames = buffer.length;
    const bytes = 44 + frames * channels * 2;
    const view = new DataView(new ArrayBuffer(bytes));
    const write = (offset: number, value: string) => {
      for (let index = 0; index < value.length; index += 1) {
        view.setUint8(offset + index, value.charCodeAt(index));
      }
    };
    write(0, "RIFF");
    view.setUint32(4, 36 + frames * channels * 2, true);
    write(8, "WAVE");
    write(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, buffer.sampleRate, true);
    view.setUint32(28, buffer.sampleRate * channels * 2, true);
    view.setUint16(32, channels * 2, true);
    view.setUint16(34, 16, true);
    write(36, "data");
    view.setUint32(40, frames * channels * 2, true);
    const channelData = Array.from({ length: channels }, (_, index) => buffer.getChannelData(index));
    let offset = 44;
    for (let frame = 0; frame < frames; frame += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        const sample = Math.max(-1, Math.min(1, channelData[channel][frame]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }
    return new Blob([view], { type: "audio/wav" });
  }
}
