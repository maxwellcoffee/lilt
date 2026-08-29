export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

export function quantizeToScale(midi: number, scale: readonly number[]): number {
  const octave = Math.floor(midi / 12);
  const pc = ((midi % 12) + 12) % 12;
  let best = scale[0];
  let bestDist = Infinity;
  for (const degree of scale) {
    const dist = Math.min(
      Math.abs(degree - pc),
      Math.abs(degree + 12 - pc),
      Math.abs(degree - 12 - pc),
    );
    if (dist < bestDist) {
      bestDist = dist;
      best = degree;
    }
  }
  return octave * 12 + best;
}

export function hann(length: number, index: number): number {
  if (length <= 1) return 1;
  return 0.5 * (1 - Math.cos((2 * Math.PI * index) / (length - 1)));
}

export function rms(samples: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] ?? 0;
    sum += s * s;
  }
  return Math.sqrt(sum / Math.max(1, samples.length));
}
