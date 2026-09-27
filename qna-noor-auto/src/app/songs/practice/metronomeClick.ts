export function scheduleMetronomeClick(
  context: BaseAudioContext,
  time: number,
  accent: boolean,
  volume = 0.15,
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = accent ? 1000 : 800;
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), time + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(time);
  oscillator.stop(time + 0.035);
}
