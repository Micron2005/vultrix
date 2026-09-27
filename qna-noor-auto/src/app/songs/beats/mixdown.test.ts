import test from "node:test";
import assert from "node:assert/strict";
import { floatToInt16, normalizePeak, trimTrailingSilence, type MixdownAudioBuffer } from "./mixdown";

function fakeBuffer(channels: Float32Array[], sampleRate = 100) {
  return {
    length: channels[0]?.length ?? 0,
    numberOfChannels: channels.length,
    sampleRate,
    getChannelData(channel: number) {
      return channels[channel];
    },
  } satisfies MixdownAudioBuffer;
}

test("normalizes all channels to a -1 dBFS peak", () => {
  const buffer = fakeBuffer([new Float32Array([0.25, -0.5]), new Float32Array([0.1, 0.2])]);
  normalizePeak(buffer);
  assert.ok(Math.abs(buffer.getChannelData(0)[1] + 0.891) < 0.00001);
  assert.ok(Math.abs(buffer.getChannelData(0)[0] - 0.4455) < 0.00001);
});

test("leaves a silent buffer unchanged", () => {
  const buffer = fakeBuffer([new Float32Array(20), new Float32Array(20)]);
  normalizePeak(buffer);
  assert.deepEqual(Array.from(buffer.getChannelData(0)), Array.from(new Float32Array(20)));
});

test("trailing-silence trim preserves at least half a second", () => {
  const samples = new Float32Array(300);
  samples[100] = 0.5;
  const buffer = fakeBuffer([samples, new Float32Array(300)], 100);
  assert.equal(trimTrailingSilence(buffer), 151);
});

test("float samples convert to clamped signed 16-bit values", () => {
  assert.deepEqual(Array.from(floatToInt16(new Float32Array([-2, -0.5, 0.5, 2]))), [-32768, -16384, 16383, 32767]);
});
