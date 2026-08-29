import { hann, lerp, rms } from "@/lib/math";

export type CapturedGrain = {
  buffer: AudioBuffer;
  duration: number;
  rms: number;
  f0: number | null;
  looping: boolean;
  createdAt: number;
};

const BUFFER_SECONDS = 2.8;
const MIN_GRAIN = 0.08;

export class VoiceSampler {
  private ring: Float32Array;
  private write = 0;
  private filled = 0;
  private speaking = false;
  private speakStart = 0;
  private speakSamples = 0;
  private noiseFloor = 0.004;
  private lastRms = 0;
  private lastCaptureAt: number | null = null;
  private lastFootstepAt = 0;
  private lastSliceAt = 0;
  private footstep = false;
  private sensitivity = 0.55;
  private chop = 0.42;
  private thump = 0.5;
  readonly grains: CapturedGrain[] = [];
  private readonly maxGrains = 5;

  constructor(private readonly sampleRate: number) {
    this.ring = new Float32Array(Math.floor(sampleRate * BUFFER_SECONDS));
  }

  get rms(): number {
    return this.lastRms;
  }

  get voiced(): boolean {
    return this.speaking;
  }

  get noise(): number {
    return this.noiseFloor;
  }

  get lastCapture(): number | null {
    return this.lastCaptureAt;
  }

  setSensitivity(value: number): void {
    this.sensitivity = Math.min(1, Math.max(0, value));
  }

  setChop(value: number): void {
    this.chop = Math.min(1, Math.max(0, value));
  }

  setThump(value: number): void {
    this.thump = Math.min(1, Math.max(0, value));
  }

  clear(): void {
    this.grains.length = 0;
    this.lastCaptureAt = null;
    this.speaking = false;
    this.speakSamples = 0;
  }

  consumeFootstep(): boolean {
    const hit = this.footstep;
    this.footstep = false;
    return hit;
  }

  push(samples: Float32Array, now: number): CapturedGrain | null {
    for (let i = 0; i < samples.length; i++) {
      this.ring[this.write] = samples[i] ?? 0;
      this.write = (this.write + 1) % this.ring.length;
      if (this.filled < this.ring.length) this.filled += 1;
    }

    const level = rms(samples);
    const zcr = zeroCrossingRate(samples);
    this.lastRms = this.lastRms * 0.55 + level * 0.45;
    if (!this.speaking) {
      this.noiseFloor = this.noiseFloor * 0.992 + this.lastRms * 0.008;
    }

    const openMul = 5.2 - this.sensitivity * 3.4;
    const open = Math.max(this.noiseFloor * openMul, 0.0035);
    const close = Math.max(this.noiseFloor * (openMul * 0.5), 0.0025);
    const voicedLike = zcr > 0.02 && zcr < 0.28;
    const stepFloor = Math.max(
      this.noiseFloor * lerp(4.4, 1.6, this.thump),
      lerp(0.016, 0.004, this.thump),
    );

    if (
      !this.speaking &&
      !voicedLike &&
      this.lastRms > stepFloor &&
      this.lastRms < open * 0.85 &&
      now - this.lastFootstepAt > lerp(0.42, 0.24, this.thump)
    ) {
      this.lastFootstepAt = now;
      this.footstep = true;
    }

    if (!this.speaking && this.lastRms > open && (voicedLike || this.lastRms > open * 1.6)) {
      this.speaking = true;
      this.speakStart =
        (this.write - samples.length + this.ring.length) % this.ring.length;
      this.speakSamples = samples.length;
      this.lastSliceAt = now;
      return null;
    }

    if (this.speaking) {
      this.speakSamples += samples.length;
      const elapsed = this.speakSamples / this.sampleRate;
      const tooLong = elapsed >= lerp(1.12, 0.42, this.chop);
      const quiet = this.lastRms < close;
      const midSlice =
        now - this.lastSliceAt >= lerp(1.02, 0.3, this.chop) && elapsed >= MIN_GRAIN;
      if (quiet || tooLong || midSlice) {
        const grain = this.commit(now);
        if (midSlice && !quiet) {
          this.speakStart =
            (this.write - samples.length + this.ring.length) % this.ring.length;
          this.speakSamples = samples.length;
          this.lastSliceAt = now;
        } else {
          this.speaking = false;
          this.speakSamples = 0;
        }
        return grain;
      }
    }

    return null;
  }

  private commit(now: number): CapturedGrain | null {
    const duration = this.speakSamples / this.sampleRate;
    if (duration < MIN_GRAIN || this.filled < this.speakSamples) return null;

    const data = new Float32Array(this.speakSamples);
    let read = this.speakStart;
    for (let i = 0; i < this.speakSamples; i++) {
      data[i] = (this.ring[read] ?? 0) * hann(this.speakSamples, i);
      read = (read + 1) % this.ring.length;
    }

    const audio = new AudioBuffer({
      length: data.length,
      numberOfChannels: 1,
      sampleRate: this.sampleRate,
    });
    audio.copyToChannel(data, 0);

    const grain: CapturedGrain = {
      buffer: audio,
      duration,
      rms: rms(data),
      f0: estimateF0(data, this.sampleRate),
      looping: duration > lerp(0.72, 0.28, this.chop),
      createdAt: now,
    };

    this.grains.push(grain);
    if (this.grains.length > this.maxGrains) this.grains.shift();
    this.lastCaptureAt = now;
    return grain;
  }
}

function zeroCrossingRate(samples: Float32Array): number {
  let crossings = 0;
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1] ?? 0;
    const b = samples[i] ?? 0;
    if ((a >= 0 && b < 0) || (a < 0 && b >= 0)) crossings += 1;
  }
  return crossings / Math.max(1, samples.length);
}

function estimateF0(buf: Float32Array, sampleRate: number): number | null {
  const minPeriod = Math.floor(sampleRate / 420);
  const maxPeriod = Math.floor(sampleRate / 70);
  const window = Math.min(buf.length, Math.floor(sampleRate * 0.06));
  if (window < maxPeriod + 8) return null;

  let bestCorr = 0;
  let bestPeriod = 0;
  for (let period = minPeriod; period < maxPeriod; period++) {
    let corr = 0;
    for (let i = 0; i < window; i++) {
      corr += (buf[i] ?? 0) * (buf[i + period] ?? 0);
    }
    if (corr > bestCorr) {
      bestCorr = corr;
      bestPeriod = period;
    }
  }

  if (bestPeriod === 0) return null;
  const hz = sampleRate / bestPeriod;
  if (hz < 70 || hz > 420) return null;
  return hz;
}
