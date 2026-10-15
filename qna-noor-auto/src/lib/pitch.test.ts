import assert from "node:assert/strict";
import test from "node:test";
import {
  detectKey,
  detectPitch,
  chromaFromAudio,
  nearestGuitarString,
  noteFromFrequency,
} from "./pitch";

function sine(frequency: number, sampleRate = 48_000, length = 8192) {
  return Float32Array.from(
    { length },
    (_, index) => Math.sin((2 * Math.PI * frequency * index) / sampleRate),
  );
}

test("detects A4 and reports its cents offset", () => {
  const pitch = detectPitch(sine(440), 48_000);
  assert.ok(pitch);
  assert.ok(Math.abs(pitch.hz - 440) < 1);
  const detectedNote = noteFromFrequency(pitch.hz);
  assert.equal(detectedNote.midi, 69);
  assert.equal(detectedNote.name, "A");
  assert.equal(detectedNote.octave, 4);
  assert.ok(Math.abs(detectedNote.cents) <= 3);
  assert.equal(noteFromFrequency(440).cents, 0);
  const sharp = detectPitch(sine(446), 48_000);
  assert.ok(sharp);
  assert.ok(Math.abs(noteFromFrequency(sharp.hz).cents - 23) <= 3);
});

test("finds low guitar notes and silence", () => {
  const pitch = detectPitch(sine(82.41), 48_000);
  assert.ok(pitch);
  assert.equal(nearestGuitarString(pitch.hz).name, "E2");
  assert.ok(Math.abs(nearestGuitarString(pitch.hz).cents) < 2);
  assert.equal(detectPitch(new Float32Array(4096), 48_000), null);
});

test("classifies weighted A minor and C major chroma", () => {
  const aMinor = Array<number>(12).fill(0.25);
  aMinor[9] = 8;
  aMinor[0] = 6;
  aMinor[4] = 7;
  assert.equal(detectKey(aMinor)?.label, "A minor");

  const cMajor = Array<number>(12).fill(0.1);
  cMajor[0] = 8;
  cMajor[4] = 6;
  cMajor[7] = 7;
  assert.equal(detectKey(cMajor)?.label, "C major");
  assert.equal(detectKey(Array<number>(12).fill(0)), null);
});

test("detects A minor from weighted natural-minor scale tones", () => {
  const sampleRate = 8000;
  const tones = [
    [220, 3],
    [246.94, 0.75],
    [261.63, 3],
    [293.66, 0.75],
    [329.63, 3],
    [349.23, 0.75],
    [392, 0.75],
  ] as const;
  const samples = new Float32Array(
    Math.round(tones.reduce((total, [, seconds]) => total + seconds, 0) * sampleRate),
  );
  let offset = 0;
  for (const [hz, seconds] of tones) {
    const count = Math.round(seconds * sampleRate);
    for (let index = 0; index < count; index += 1) {
      samples[offset + index] = Math.sin((2 * Math.PI * hz * index) / sampleRate);
    }
    offset += count;
  }
  assert.equal(detectKey(chromaFromAudio(samples, sampleRate))?.label, "A minor");
});
