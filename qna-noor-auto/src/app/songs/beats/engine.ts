import { ensureRunning, unlockMediaRoute } from "../audioUnlock";
import { overdriveCurve, stringBuffer } from "./strings";
import { scheduleRealDrum } from "./realKit";
import {
  BEAT_TRACKS,
  KIT_CONFIG,
  stepsFor,
  type BeatData,
  type BeatKit,
  type BeatPattern,
  type BeatTrack,
  type BeatTrackInstance,
  type MelodicInstrument,
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
  private compressor: DynamicsCompressorNode | null = null;
  private masterConnected = false;
  private timer: number | null = null;
  private nextNoteTime = 0;
  private sequenceIndex = 0;
  private step = 0;
  private mutedTracks = new Set<string>();
  private mutedVoices = new Set<BeatTrack>();
  private noiseBuffers = new WeakMap<AudioContextLike, AudioBuffer>();
  private reverbBuffers = new WeakMap<AudioContextLike, AudioBuffer>();
  private trackRoutes = new WeakMap<
    AudioContextLike,
    Map<string, { gain: GainNode; panner: StereoPannerNode; reverbSend: GainNode }>
  >();
  private playback: {
    getDocument: () => BeatDocument;
    getPlayback: () => { mode: BeatPlaybackMode; patternId: string };
    onStep?: (patternIndex: number, step: number) => void;
  } | null = null;

  async play(
    getDocument: () => BeatDocument,
    getPlayback: () => { mode: BeatPlaybackMode; patternId: string },
    onStep?: (patternIndex: number, step: number) => void,
  ) {
    this.stop();
    unlockMediaRoute();
    const context = this.context ?? new AudioContext();
    this.context = context;
    this.master = this.master ?? context.createGain();
    this.master.gain.value = 0.8;
    this.ensureRealtimeMaster(context);
    await ensureRunning(context);
    this.playback = { getDocument, getPlayback, onStep };
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

  private ensureRealtimeMaster(context: AudioContext) {
    if (this.masterConnected || !this.master) return;
    this.compressor = context.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.005;
    this.compressor.release.value = 0.15;
    this.master.connect(this.compressor);
    this.compressor.connect(context.destination);
    this.masterConnected = true;
  }

  setTrackMuted(trackId: string, muted: boolean) {
    if (muted) this.mutedTracks.add(trackId);
    else this.mutedTracks.delete(trackId);
  }

  setVoiceMuted(voice: BeatTrack, muted: boolean) {
    if (muted) this.mutedVoices.add(voice);
    else this.mutedVoices.delete(voice);
  }

  async preview(beat: BeatDocument, track: BeatTrack, accent = false) {
    unlockMediaRoute();
    const context = this.context ?? new AudioContext();
    this.context = context;
    this.master = this.master ?? context.createGain();
    this.ensureRealtimeMaster(context);
    await ensureRunning(context);
    this.scheduleTrackVoice(context, this.master, track, accent ? 1.5 : 1, context.currentTime + 0.01, beat.kit);
  }

  async previewNote(
    beat: BeatDocument,
    instrument: MelodicInstrument,
    note: number,
  ) {
    unlockMediaRoute();
    const context = this.context ?? new AudioContext();
    this.context = context;
    this.master = this.master ?? context.createGain();
    this.ensureRealtimeMaster(context);
    await ensureRunning(context);
    this.scheduleInstrument(
      context,
      this.master,
      instrument,
      note,
      2,
      1,
      beat,
      context.currentTime + 0.01,
    );
  }

  private schedule() {
    const context = this.context;
    const playback = this.playback;
    if (!context || !playback) return;
    if (context.state !== "running") {
      void context.resume();
      return;
    }
    const document = playback.getDocument();
    const { mode, patternId } = playback.getPlayback();
    const patterns = patternSequence(document.data, mode, patternId);
    if (!patterns.length) return;
    const stepDuration = 60 / document.bpm / 4;
    if (this.nextNoteTime < context.currentTime - 0.2) {
      this.nextNoteTime = context.currentTime + 0.05;
    }
    while (this.nextNoteTime < context.currentTime + 0.1) {
      const pattern = patterns[this.sequenceIndex % patterns.length];
      const delay = this.step % 2 === 1
        ? (document.swing / 100) * stepDuration * 0.5
        : 0;
      this.scheduleStep(
        context,
        this.master!,
        document,
        pattern,
        this.sequenceIndex,
        this.step,
        this.nextNoteTime + delay,
      );
      this.nextNoteTime += stepDuration;
      this.step += 1;
      if (this.step >= stepsFor(pattern)) {
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
    for (const track of beat.data.tracks) {
      const route = this.trackRoute(context, destination, track, time);
      if (track.kind === "drums") {
        for (const voice of BEAT_TRACKS) {
          const value = pattern.drums[track.id]?.[voice]?.[step] ?? 0;
          if (value && !this.mutedVoices.has(voice)) {
            this.scheduleTrackVoice(
              context,
              route,
              voice,
              value === 2 ? 1.5 : 1,
              time,
              beat.kit,
            );
          }
        }
      } else {
        for (const note of pattern.notes[track.id] ?? []) {
          if (note.step === step) {
            this.scheduleInstrument(
              context,
              route,
              track.kind,
              note.note,
              note.len,
              note.vel,
              beat,
              time,
            );
          }
        }
      }
    }
    if (this.playback?.onStep) {
      window.setTimeout(() => {
        if (this.playback) window.requestAnimationFrame(() => this.playback?.onStep?.(patternIndex, step));
      }, Math.max(0, (time - context.currentTime) * 1000));
    }
  }

  private trackRoute(
    context: AudioContextLike,
    master: AudioNode,
    track: BeatTrackInstance,
    time: number,
  ) {
    let routes = this.trackRoutes.get(context);
    if (!routes) {
      routes = new Map();
      this.trackRoutes.set(context, routes);
    }
    let route = routes.get(track.id);
    if (!route) {
      const gain = context.createGain();
      const panner = context.createStereoPanner();
      const reverbSend = context.createGain();
      const convolver = context.createConvolver();
      convolver.buffer = this.reverbBuffer(context);
      gain.connect(panner);
      panner.connect(master);
      panner.connect(reverbSend);
      reverbSend.connect(convolver);
      convolver.connect(master);
      route = { gain, panner, reverbSend };
      routes.set(track.id, route);
    }
    route.gain.gain.setTargetAtTime(
      track.volume * (this.mutedTracks.has(track.id) ? 0 : 1),
      time,
      0.01,
    );
    route.panner.pan.setTargetAtTime(track.pan, time, 0.01);
    route.reverbSend.gain.setTargetAtTime(track.reverb, time, 0.01);
    return route.panner;
  }

  private scheduleTrackVoice(
    context: AudioContextLike,
    destination: AudioNode,
    track: BeatTrack,
    level: number,
    time: number,
    kit: BeatKit,
  ) {
    if (kit === "Drums") {
      scheduleRealDrum(context, destination, track, level, time, this.noiseBuffer(context));
      return;
    }
    const config = KIT_CONFIG[kit];
    if (track === "kick") {
      this.scheduleKick(context, destination, level, time, config.kickDecay, config.detune);
      return;
    }
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(config.lowpass, time);
    gain.gain.setValueAtTime(0.0001, time);
    const peak = Math.min(0.9, level * 0.32);
    const decay = track === "snare" ? config.snareDecay : config.hatDecay;
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    filter.connect(gain);
    gain.connect(destination);

    if (track === "tom" || track === "rim") {
      const oscillator = context.createOscillator();
      oscillator.type = track === "rim" ? "square" : "sine";
      oscillator.detune.value = config.detune;
      oscillator.frequency.setValueAtTime(track === "tom" ? 180 : 420, time);
      oscillator.frequency.exponentialRampToValueAtTime(110, time + decay);
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

  private scheduleInstrument(
    context: AudioContextLike,
    destination: AudioNode,
    instrument: MelodicInstrument,
    note: number,
    length: number,
    velocity: number,
    beat: BeatDocument,
    time: number,
  ) {
    const duration = Math.min(64, length) * (60 / beat.bpm / 4);
    if (instrument === "bass") {
      this.scheduleBass(context, destination, note, duration, velocity, beat, time);
      return;
    }
    if (instrument === "piano") {
      this.schedulePiano(context, destination, note, duration, velocity, time);
      return;
    }
    if (instrument === "eguitar") {
      this.scheduleElectricGuitar(context, destination, note, duration, velocity, time);
      return;
    }
    if (instrument === "aguitar") {
      this.scheduleAcousticGuitar(context, destination, note, duration, velocity, time);
      return;
    }
    if (instrument === "strings") {
      this.scheduleStrings(context, destination, note, duration, velocity, time);
      return;
    }
    if (instrument === "pad") {
      this.schedulePad(context, destination, note, duration, velocity, time);
      return;
    }
    if (instrument === "lead") {
      this.scheduleLead(context, destination, note, duration, velocity, time);
      return;
    }
    this.schedulePluck(context, destination, note, duration, velocity, time);
  }

  private scheduleBass(
    context: AudioContextLike,
    destination: AudioNode,
    note: number,
    duration: number,
    velocity: number,
    beat: BeatDocument,
    time: number,
  ) {
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = beat.kit === "Lo-fi" ? 900 : 1800;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.25 * velocity, time + 0.008);
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

  private schedulePiano(
    context: AudioContextLike,
    destination: AudioNode,
    note: number,
    duration: number,
    velocity: number,
    time: number,
  ) {
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 6000;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.3 * velocity, time + 0.005);
    const end = time + Math.max(duration, 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    filter.connect(gain);
    gain.connect(destination);
    const frequency = midiFrequency(note);
    for (const [multiplier, level] of [[1, 1], [2, 0.5], [3, 0.2]] as const) {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency * multiplier;
      oscillator.connect(filter);
      oscillator.start(time);
      oscillator.stop(end + 0.02);
      if (level < 1) {
        const partialGain = context.createGain();
        partialGain.gain.value = level;
        oscillator.disconnect();
        oscillator.connect(partialGain);
        partialGain.connect(filter);
      }
    }
    const attackGain = context.createGain();
    attackGain.gain.setValueAtTime(0.0001, time);
    attackGain.gain.exponentialRampToValueAtTime(0.12 * velocity, time + 0.001);
    attackGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);
    attackGain.connect(filter);
    const attack = context.createOscillator();
    attack.type = "triangle";
    attack.frequency.value = frequency;
    attack.connect(attackGain);
    attack.start(time);
    attack.stop(time + 0.05);
  }

  private scheduleStrings(
    context: AudioContextLike,
    destination: AudioNode,
    note: number,
    duration: number,
    velocity: number,
    time: number,
  ) {
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2200;
    const gain = context.createGain();
    const end = time + duration + 0.25;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.16 * velocity, time + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    filter.connect(gain);
    gain.connect(destination);
    const frequency = midiFrequency(note);
    for (const detune of [-7, 0, 7]) {
      const oscillator = context.createOscillator();
      oscillator.type = "sawtooth";
      oscillator.detune.value = detune;
      oscillator.frequency.value = frequency;
      oscillator.connect(filter);
      oscillator.start(time);
      oscillator.stop(end + 0.02);
    }
    const octaveGain = context.createGain();
    octaveGain.gain.value = 0.3;
    octaveGain.connect(filter);
    const octave = context.createOscillator();
    octave.type = "sawtooth";
    octave.frequency.value = frequency * 2;
    octave.connect(octaveGain);
    octave.start(time);
    octave.stop(end + 0.02);
  }

  private schedulePad(
    context: AudioContextLike,
    destination: AudioNode,
    note: number,
    duration: number,
    velocity: number,
    time: number,
  ) {
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(600, time);
    filter.frequency.linearRampToValueAtTime(1800, time + 0.4);
    const gain = context.createGain();
    const end = time + duration + 0.6;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.18 * velocity, time + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    filter.connect(gain);
    gain.connect(destination);
    const frequency = midiFrequency(note);
    for (const [type, detune] of [["triangle", -5], ["triangle", 5], ["sine", 0]] as const) {
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.detune.value = detune;
      oscillator.frequency.value = frequency;
      oscillator.connect(filter);
      oscillator.start(time);
      oscillator.stop(end + 0.02);
    }
  }

  private scheduleLead(
    context: AudioContextLike,
    destination: AudioNode,
    note: number,
    duration: number,
    velocity: number,
    time: number,
  ) {
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 3500;
    const gain = context.createGain();
    const peak = 0.14 * velocity;
    const release = time + duration + 0.08;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.7), time + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, release);
    filter.connect(gain);
    gain.connect(destination);
    const frequency = midiFrequency(note);
    for (const [type, detune] of [["square", -6], ["sawtooth", 6]] as const) {
      const oscillator = context.createOscillator();
      oscillator.type = type;
      oscillator.detune.value = detune;
      oscillator.frequency.value = frequency;
      oscillator.connect(filter);
      oscillator.start(time);
      oscillator.stop(release + 0.02);
    }
  }

  private schedulePluck(
    context: AudioContextLike,
    destination: AudioNode,
    note: number,
    duration: number,
    velocity: number,
    time: number,
  ) {
    const filter = context.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 300;
    const gain = context.createGain();
    const end = time + Math.min(duration, 0.8);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.35 * velocity, time + 0.001);
    gain.gain.setValueAtTime(0.35 * velocity, end);
    gain.gain.exponentialRampToValueAtTime(0.0001, end + 0.05);
    filter.connect(gain);
    gain.connect(destination);
    const source = context.createBufferSource();
    source.buffer = stringBuffer(context, "pluck", midiFrequency(note));
    source.connect(filter);
    source.start(time);
    source.stop(end + 0.07);
  }

  private scheduleElectricGuitar(
    context: AudioContextLike,
    destination: AudioNode,
    note: number,
    duration: number,
    velocity: number,
    time: number,
  ) {
    // Plucked string → pickup tone → tube-style overdrive → speaker cab.
    const string = context.createBufferSource();
    string.buffer = stringBuffer(context, "electric", midiFrequency(note));
    const pickup = context.createBiquadFilter();
    pickup.type = "peaking";
    pickup.frequency.value = 1400;
    pickup.Q.value = 1.1;
    pickup.gain.value = 5;
    const preamp = context.createGain();
    preamp.gain.value = 3.5 * Math.min(1.5, Math.max(0.4, velocity));
    const shaper = context.createWaveShaper();
    shaper.curve = overdriveCurve(2.6);
    shaper.oversample = "4x";
    const cab = context.createBiquadFilter();
    cab.type = "lowpass";
    cab.frequency.value = 3400;
    cab.Q.value = 0.9;
    const presence = context.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = 700;
    presence.Q.value = 0.8;
    presence.gain.value = 3;
    const gain = context.createGain();
    const hold = time + Math.max(duration, 0.25);
    const end = hold + 0.18;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(0.32, time + 0.003);
    gain.gain.setValueAtTime(0.32, hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    string.connect(pickup);
    pickup.connect(preamp);
    preamp.connect(shaper);
    shaper.connect(cab);
    cab.connect(presence);
    presence.connect(gain);
    gain.connect(destination);
    string.start(time);
    string.stop(end + 0.02);
  }

  private scheduleAcousticGuitar(
    context: AudioContextLike,
    destination: AudioNode,
    note: number,
    duration: number,
    velocity: number,
    time: number,
  ) {
    // Plucked string through a guitar-body resonance (air ~100 Hz, top ~220 Hz).
    const string = context.createBufferSource();
    string.buffer = stringBuffer(context, "acoustic", midiFrequency(note));
    const air = context.createBiquadFilter();
    air.type = "peaking";
    air.frequency.value = 105;
    air.Q.value = 2.5;
    air.gain.value = 6;
    const top = context.createBiquadFilter();
    top.type = "peaking";
    top.frequency.value = 230;
    top.Q.value = 1.8;
    top.gain.value = 4;
    const sparkle = context.createBiquadFilter();
    sparkle.type = "highshelf";
    sparkle.frequency.value = 5000;
    sparkle.gain.value = -4;
    const gain = context.createGain();
    const hold = time + Math.max(duration, 0.3);
    const end = hold + 0.15;
    const level = 0.42 * velocity;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(level, time + 0.002);
    gain.gain.setValueAtTime(level, hold);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    string.connect(air);
    air.connect(top);
    top.connect(sparkle);
    sparkle.connect(gain);
    gain.connect(destination);
    string.start(time);
    string.stop(end + 0.02);
  }

  // Sub sine alone disappears on phone/laptop speakers; layer a punchier
  // body (triangle, fast pitch drop) and a short noise click so the kick
  // reads on any speaker.
  private scheduleKick(
    context: AudioContextLike,
    destination: AudioNode,
    level: number,
    time: number,
    decay: number,
    detune: number,
  ) {
    const peak = Math.min(1, level * 0.6);

    const subGain = context.createGain();
    subGain.gain.setValueAtTime(0.0001, time);
    subGain.gain.exponentialRampToValueAtTime(peak, time + 0.004);
    subGain.gain.exponentialRampToValueAtTime(0.0001, time + decay);
    const sub = context.createOscillator();
    sub.type = "sine";
    sub.detune.value = detune;
    sub.frequency.setValueAtTime(140, time);
    sub.frequency.exponentialRampToValueAtTime(45, time + Math.min(0.12, decay));
    sub.connect(subGain);
    subGain.connect(destination);
    sub.start(time);
    sub.stop(time + decay + 0.02);

    const bodyDecay = Math.min(0.14, decay);
    const bodyGain = context.createGain();
    bodyGain.gain.setValueAtTime(0.0001, time);
    bodyGain.gain.exponentialRampToValueAtTime(peak * 0.7, time + 0.002);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + bodyDecay);
    const body = context.createOscillator();
    body.type = "triangle";
    body.detune.value = detune;
    body.frequency.setValueAtTime(320, time);
    body.frequency.exponentialRampToValueAtTime(70, time + 0.06);
    body.connect(bodyGain);
    bodyGain.connect(destination);
    body.start(time);
    body.stop(time + bodyDecay + 0.02);

    const clickGain = context.createGain();
    clickGain.gain.setValueAtTime(peak * 0.5, time);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.012);
    const clickFilter = context.createBiquadFilter();
    clickFilter.type = "bandpass";
    clickFilter.frequency.setValueAtTime(2500, time);
    clickFilter.Q.value = 0.8;
    const click = context.createBufferSource();
    click.buffer = this.noiseBuffer(context);
    click.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(destination);
    click.start(time);
    click.stop(time + 0.02);
  }

  private noiseBuffer(context: AudioContextLike) {
    const cached = this.noiseBuffers.get(context);
    if (cached) return cached;
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
    this.noiseBuffers.set(context, buffer);
    return buffer;
  }

  private reverbBuffer(context: AudioContextLike) {
    const cached = this.reverbBuffers.get(context);
    if (cached) return cached;
    const length = Math.floor(context.sampleRate * 1.8);
    const buffer = context.createBuffer(2, length, context.sampleRate);
    for (let channelIndex = 0; channelIndex < 2; channelIndex += 1) {
      const channel = buffer.getChannelData(channelIndex);
      for (let index = 0; index < length; index += 1) {
        const decay = 1 - index / length;
        channel[index] = (Math.random() * 2 - 1) * decay ** 2.5;
      }
    }
    this.reverbBuffers.set(context, buffer);
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
    const seconds = renderPatterns.reduce(
      (total, pattern) => total + stepsFor(pattern) * stepDuration,
      0,
    ) + 1;
    const context = new OfflineAudioContext(2, Math.ceil(seconds * 44100), 44100);
    const destination = context.createGain();
    destination.gain.value = 0.8;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -14;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.15;
    destination.connect(compressor);
    compressor.connect(context.destination);
    let patternOffset = 0;
    renderPatterns.forEach((pattern) => {
      for (let step = 0; step < stepsFor(pattern); step += 1) {
        const baseTime = (patternOffset + step) * stepDuration;
        const time = baseTime + (step % 2 === 1 ? (beat.swing / 100) * stepDuration * 0.5 : 0);
        for (const track of beat.data.tracks) {
          const route = this.trackRoute(context, destination, track, time);
          if (track.kind === "drums") {
            for (const voice of BEAT_TRACKS) {
              const value = pattern.drums[track.id]?.[voice]?.[step] ?? 0;
              if (value && !this.mutedVoices.has(voice)) {
                this.scheduleTrackVoice(
                  context,
                  route,
                  voice,
                  value === 2 ? 1.5 : 1,
                  time,
                  beat.kit,
                );
              }
            }
          } else {
            for (const note of pattern.notes[track.id] ?? []) {
              if (note.step === step) {
                this.scheduleInstrument(
                  context,
                  route,
                  track.kind,
                  note.note,
                  note.len,
                  note.vel,
                  beat,
                  time,
                );
              }
            }
          }
        }
      }
      patternOffset += stepsFor(pattern);
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
