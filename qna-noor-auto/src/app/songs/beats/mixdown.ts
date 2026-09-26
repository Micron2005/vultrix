export type MixdownAudioBuffer = {
  length: number;
  numberOfChannels: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
};

export function normalizePeak(buffer: MixdownAudioBuffer, target = 0.891) {
  let peak = 0;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  }
  if (peak === 0) return peak;
  const scale = target / peak;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (let index = 0; index < samples.length; index += 1) samples[index] *= scale;
  }
  return target;
}

export function trimTrailingSilence(
  buffer: MixdownAudioBuffer,
  minTailSeconds = 0.5,
  thresholdDb = -60,
) {
  const threshold = 10 ** (thresholdDb / 20);
  let lastAudibleFrame = -1;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const samples = buffer.getChannelData(channel);
    for (let frame = samples.length - 1; frame >= 0; frame -= 1) {
      if (Math.abs(samples[frame]) >= threshold) {
        lastAudibleFrame = Math.max(lastAudibleFrame, frame);
        break;
      }
    }
  }
  if (lastAudibleFrame < 0) return Math.min(buffer.length, Math.ceil(minTailSeconds * buffer.sampleRate));
  return Math.min(
    buffer.length,
    lastAudibleFrame + 1 + Math.ceil(minTailSeconds * buffer.sampleRate),
  );
}

export function floatToInt16(samples: Float32Array, start = 0, end = samples.length) {
  const result = new Int16Array(Math.max(0, end - start));
  for (let index = start; index < end; index += 1) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    result[index - start] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return result;
}
