import assert from "node:assert/strict";
import test from "node:test";
import { trackCellsAt, trackStepTimes } from "./engine";
import type { BeatTrackInstance } from "./kits";

function track(id: string, speed: number): BeatTrackInstance {
  return {
    id,
    kind: "machine",
    name: id,
    kit: "808",
    volume: 1,
    pan: 0,
    reverb: 0,
    speed,
  };
}

test("trackCellsAt follows the global step at normal speed", () => {
  const normal = track("normal", 1);

  for (let step = 0; step < 32; step += 1) {
    assert.equal(trackCellsAt([normal], step, 16).normal, step % 16);
  }
});

test("trackCellsAt matches the latest scheduled track cell at other speeds", () => {
  for (const speed of [0.5, 2]) {
    const currentTrack = track(`speed-${speed}`, speed);

    for (let globalStep = 0; globalStep < 64; globalStep += 1) {
      let lastSoundedStep = -1;
      for (let step = 0; step <= globalStep; step += 1) {
        for (const scheduled of trackStepTimes(step, speed, 1, step)) {
          if (scheduled.time <= globalStep + 1e-9) {
            lastSoundedStep = scheduled.step;
          }
        }
      }

      assert.notEqual(lastSoundedStep, -1);
      assert.equal(
        trackCellsAt([currentTrack], globalStep, 16)[currentTrack.id],
        lastSoundedStep % 16,
        `speed ${speed} at global step ${globalStep}`,
      );
    }
  }
});

test("trackCellsAt wraps track cells at the pattern length", () => {
  const tracks = [track("normal", 1), track("half", 0.5), track("double", 2)];

  assert.deepEqual(trackCellsAt(tracks, 16, 16), {
    normal: 0,
    half: 8,
    double: 0,
  });
  assert.deepEqual(trackCellsAt(tracks, 32, 16), {
    normal: 0,
    half: 0,
    double: 0,
  });
});
