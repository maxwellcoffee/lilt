import { clamp, hzToMidi, lerp, midiToHz, quantizeToScale } from "@/lib/math";
import { MIX_DEFAULTS, mixHarmony, mixKeyTint, type MixSettings } from "@/lib/mix";
import type { EngineSnapshot, HeadPose, MotionSnapshot } from "@/lib/types";
import { VoiceSampler, type CapturedGrain } from "@/lib/voice-sampler";

const LOOKAHEAD = 0.025;
const SCHEDULE_AHEAD = 0.12;
const DEFAULT_BPM = 96;

type Flash = {
  kick: number;
  snare: number;
  hat: number;
  click: number;
  step: number;
  nod: number;
  turn: number;
  capture: number;
};

export class LiltEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private compressor!: DynamicsCompressorNode;
  private analyser!: AnalyserNode;
  private delay!: DelayNode;
  private delayGain!: GainNode;
  private reverbWet!: GainNode;
  private convolver: ConvolverNode | null = null;
  private lastHall = Number.NaN;
  private filter!: BiquadFilterNode;
  private bassOsc!: OscillatorNode;
  private bassGain!: GainNode;
  private bassFilter!: BiquadFilterNode;
  private bassShaper!: WaveShaperNode;
  private padOscA!: OscillatorNode;
  private padOscB!: OscillatorNode;
  private padOscC!: OscillatorNode;
  private padGain!: GainNode;
  private padFilter!: BiquadFilterNode;
  private sampler: VoiceSampler | null = null;
  private loopSources = new Map<AudioBuffer, AudioBufferSourceNode>();
  private timer: number | null = null;
  private nextNoteTime = 0;
  private step16 = 0;
  private bpm = DEFAULT_BPM;
  private targetBpm = DEFAULT_BPM;
  private motion: MotionSnapshot | null = null;
  private onHeardStep: ((intensity: number) => void) | null = null;
  private waveform = new Float32Array(256);
  private flashes: Flash = {
    kick: 0,
    snare: 0,
    hat: 0,
    click: 0,
    step: 0,
    nod: 0,
    turn: 0,
    capture: 0,
  };
  private lastNodAt = 0;
  private lastTurnAt = 0;
  private lastStepScheduled = 0;
  private captureNode: ScriptProcessorNode | AudioWorkletNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private startedAt = 0;
  private running = false;
  private mix: MixSettings = { ...MIX_DEFAULTS };

  get context(): AudioContext | null {
    return this.ctx;
  }

  async start(mic: MediaStream | null): Promise<void> {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctor();
    this.ctx = ctx;
    await ctx.resume();

    this.master = ctx.createGain();
    this.master.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(this.mix.volume, ctx.currentTime + 0.9);

    this.compressor = ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 4;
    this.compressor.attack.value = 0.003;
    this.compressor.release.value = 0.18;

    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.7;

    this.filter = ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 2400;
    this.filter.Q.value = this.biteQ();

    this.delay = ctx.createDelay(1.2);
    this.delay.delayTime.value = 0.35;
    this.delayGain = ctx.createGain();
    this.delayGain.gain.value = 0.18;
    const delayFilter = ctx.createBiquadFilter();
    delayFilter.type = "lowpass";
    delayFilter.frequency.value = 2800;

    this.filter.connect(this.compressor);
    this.compressor.connect(this.analyser);
    this.analyser.connect(this.master);
    this.master.connect(ctx.destination);

    this.filter.connect(this.delay);
    this.delay.connect(delayFilter);
    delayFilter.connect(this.delayGain);
    this.delayGain.connect(this.delay);
    this.delayGain.connect(this.compressor);

    this.buildBass(ctx);
    this.buildPad(ctx);
    this.connectReverb(ctx);

    this.sampler = new VoiceSampler(ctx.sampleRate);
    this.sampler.setSensitivity(this.mix.sensitivity);
    this.sampler.setChop(this.mix.chop);
    this.sampler.setHold(this.mix.hold);
    this.sampler.setThump(this.mix.thump);
    if (mic) {
      await this.connectMic(ctx, mic);
    }

    this.startedAt = ctx.currentTime;
    this.nextNoteTime = ctx.currentTime + 0.08;
    this.step16 = 0;
    this.running = true;
    this.timer = window.setInterval(() => this.scheduler(), LOOKAHEAD * 1000);
  }

  setMix(mix: MixSettings): void {
    this.mix = mix;
    const ctx = this.ctx;
    if (ctx && this.master) {
      const fadeEnds = this.startedAt + 0.9;
      if (ctx.currentTime < fadeEnds) {
        this.master.gain.cancelScheduledValues(ctx.currentTime);
        this.master.gain.linearRampToValueAtTime(mix.volume, fadeEnds);
      } else {
        this.master.gain.setTargetAtTime(mix.volume, ctx.currentTime, 0.04);
      }
    }
    this.sampler?.setSensitivity(mix.sensitivity);
    this.sampler?.setChop(mix.chop);
    this.sampler?.setHold(mix.hold);
    this.sampler?.setThump(mix.thump);
    if (this.bassShaper) {
      this.bassShaper.curve = makeDriveCurve(lerp(2, 28, mix.drive)) as Float32Array<ArrayBuffer>;
    }
    if (ctx && this.bassGain) {
      this.bassGain.gain.setTargetAtTime(0.06 + mix.bed * 0.22, ctx.currentTime, 0.06);
    }
    if (ctx && this.reverbWet) {
      this.reverbWet.gain.setTargetAtTime(mix.space * 0.42, ctx.currentTime, 0.08);
    }
    if (ctx && this.convolver && mix.hall !== this.lastHall) {
      this.writeImpulse(ctx);
    }
    if (ctx && this.filter) {
      this.filter.Q.setTargetAtTime(this.biteQ(), ctx.currentTime, 0.08);
    }
    if (mix.tempo === "lock") {
      this.targetBpm = clamp(mix.bpm, 70, 150);
    }
  }

  clearGrains(): void {
    this.loopSources.forEach((node) => {
      try {
        node.stop();
      } catch {
        // already stopped
      }
    });
    this.loopSources.clear();
    this.sampler?.clear();
  }

  previewGrain(index: number): void {
    const grains = this.sampler?.grains;
    const ctx = this.ctx;
    if (!grains || !ctx) return;
    const grain = grains[index];
    if (!grain) return;
    this.playGrain(ctx.currentTime + 0.02, grain, 0.88);
  }

  setStepListener(listener: ((intensity: number) => void) | null): void {
    this.onHeardStep = listener;
  }

  setMotion(motion: MotionSnapshot): void {
    this.motion = motion;
    if (this.mix.tempo === "lock") {
      this.targetBpm = clamp(this.mix.bpm, 70, 150);
    } else if (motion.bpm) {
      this.targetBpm = clamp(motion.bpm, 74, 148);
    } else if (!motion.walking) {
      this.targetBpm = lerp(this.targetBpm, this.mix.bpm, 0.02);
    }

    const now = this.ctx?.currentTime ?? 0;
    const steer = clamp(this.mix.steer, 0, 1);
    const nodThresh = lerp(3.6, 1.05, steer);
    const turnThresh = lerp(3.9, 1.15, steer);
    if (steer > 0.08 && motion.head.pitchVel < -nodThresh && now - this.lastNodAt > 0.2) {
      this.lastNodAt = now;
      this.flashes.nod = 1;
      this.hitSnare(now, 0.7);
    }
    if (
      steer > 0.08 &&
      Math.abs(motion.head.yawVel) > turnThresh &&
      now - this.lastTurnAt > 0.24
    ) {
      this.lastTurnAt = now;
      this.flashes.turn = 1;
      this.hitTom(now, motion.head.yaw);
    }
    if (motion.stepJustNow && now - this.lastStepScheduled > 0.12) {
      this.lastStepScheduled = now;
      this.flashes.step = 1;
      this.hitKick(now, 0.55 + motion.stepIntensity * 0.4);
    }

    this.applyMotionAudio(motion);
  }

  snapshot(): EngineSnapshot {
    const ctx = this.ctx;
    const motion = this.motion;
    const sampler = this.sampler;
    if (ctx && this.analyser) {
      this.analyser.getFloatTimeDomainData(this.waveform);
    }
    this.decayFlashes();
    const head: HeadPose = motion?.head ?? {
      yaw: 0,
      pitch: 0,
      roll: 0,
      yawVel: 0,
      pitchVel: 0,
      rollVel: 0,
    };
    const energy = clamp(
      (motion?.accelEnergy ?? 0) * 0.7 +
        (sampler?.rms ?? 0) * 8 +
        (motion?.walking ? 0.25 : 0.08),
      0,
      1,
    );
    return {
      time: ctx?.currentTime ?? 0,
      bpm: this.bpm,
      walking: Boolean(motion?.walking),
      energy,
      head,
      voice: {
        rms: sampler?.rms ?? 0,
        voiced: sampler?.voiced ?? false,
        noiseFloor: sampler?.noise ?? 0,
        sampleCount: sampler?.grains.length ?? 0,
        lastCaptureAt: sampler?.lastCapture ?? null,
      },
      kickFlash: this.flashes.kick,
      snareFlash: this.flashes.snare,
      hatFlash: this.flashes.hat,
      clickFlash: this.flashes.click,
      stepFlash: this.flashes.step,
      nodFlash: this.flashes.nod,
      turnFlash: this.flashes.turn,
      captureFlash: this.flashes.capture,
      waveform: this.waveform,
      brightness: this.mix.brightness,
      drums: this.mix.drums,
      space: this.mix.space,
      keyLabel: mixHarmony(this.mix).label,
      keyTint: mixKeyTint(this.mix.key),
      ready: this.running,
    };
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer != null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    const ctx = this.ctx;
    if (ctx && this.master) {
      const now = ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);
      this.master.gain.linearRampToValueAtTime(0.0001, now + 0.22);
      await new Promise((resolve) => window.setTimeout(resolve, 240));
    }
    this.loopSources.forEach((node) => {
      try {
        node.stop();
      } catch {
        // already stopped
      }
    });
    this.loopSources.clear();
    this.captureNode?.disconnect();
    this.micSource?.disconnect();
    this.captureNode = null;
    this.micSource = null;
    this.onHeardStep = null;
    if (this.ctx) {
      await this.ctx.close().catch(() => undefined);
      this.ctx = null;
    }
  }

  private buildBass(ctx: AudioContext): void {
    this.bassFilter = ctx.createBiquadFilter();
    this.bassFilter.type = "lowpass";
    this.bassFilter.frequency.value = 320;
    this.bassGain = ctx.createGain();
    this.bassGain.gain.value = 0.2;
    this.bassOsc = ctx.createOscillator();
    this.bassOsc.type = "sawtooth";
    this.bassOsc.frequency.value = midiToHz(mixHarmony(this.mix).root);
    this.bassShaper = ctx.createWaveShaper();
    this.bassShaper.curve = makeDriveCurve(lerp(2, 28, this.mix.drive)) as Float32Array<ArrayBuffer>;
    this.bassOsc.connect(this.bassFilter);
    this.bassFilter.connect(this.bassShaper);
    this.bassShaper.connect(this.bassGain);
    this.bassGain.connect(this.filter);
    this.bassOsc.start();
  }

  private buildPad(ctx: AudioContext): void {
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = "lowpass";
    this.padFilter.frequency.value = 1100;
    this.padFilter.Q.value = 0.5;
    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.07;
    this.padOscA = ctx.createOscillator();
    this.padOscB = ctx.createOscillator();
    this.padOscC = ctx.createOscillator();
    this.padOscA.type = "sine";
    this.padOscB.type = "triangle";
    this.padOscC.type = "sine";
    const hz = midiToHz(mixHarmony(this.mix).root + 12);
    this.padOscA.frequency.value = hz;
    this.padOscB.frequency.value = hz * 1.004;
    this.padOscC.frequency.value = hz * 0.5;
    this.padOscA.connect(this.padFilter);
    this.padOscB.connect(this.padFilter);
    this.padOscC.connect(this.padFilter);
    this.padFilter.connect(this.padGain);
    this.padGain.connect(this.filter);
    this.padOscA.start();
    this.padOscB.start();
    this.padOscC.start();
  }

  private connectReverb(ctx: AudioContext): void {
    this.convolver = ctx.createConvolver();
    this.reverbWet = ctx.createGain();
    this.reverbWet.gain.value = this.mix.space * 0.42;
    this.filter.connect(this.convolver);
    this.convolver.connect(this.reverbWet);
    this.reverbWet.connect(this.compressor);
    this.writeImpulse(ctx);
  }

  private writeImpulse(ctx: AudioContext): void {
    if (!this.convolver) return;
    const seconds = lerp(0.55, 2.8, clamp(this.mix.hall, 0, 1));
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        const decay = (1 - i / length) ** 2.4;
        data[i] = (Math.random() * 2 - 1) * decay * 0.35;
      }
    }
    this.convolver.buffer = impulse;
    this.lastHall = this.mix.hall;
  }

  private async connectMic(ctx: AudioContext, mic: MediaStream): Promise<void> {
    this.micSource = ctx.createMediaStreamSource(mic);
    const silent = ctx.createGain();
    silent.gain.value = 0;

    try {
      const worklet = `
        class LiltCapture extends AudioWorkletProcessor {
          process(inputs) {
            const channel = inputs[0]?.[0];
            if (channel) this.port.postMessage(channel);
            return true;
          }
        }
        registerProcessor("lilt-capture", LiltCapture);
      `;
      const blob = new Blob([worklet], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const node = new AudioWorkletNode(ctx, "lilt-capture");
      node.port.onmessage = (event: MessageEvent<Float32Array>) => {
        this.ingestMic(event.data);
      };
      this.micSource.connect(node);
      node.connect(silent);
      silent.connect(ctx.destination);
      this.captureNode = node;
    } catch {
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      processor.onaudioprocess = (event) => {
        this.ingestMic(event.inputBuffer.getChannelData(0));
      };
      this.micSource.connect(processor);
      processor.connect(silent);
      silent.connect(ctx.destination);
      this.captureNode = processor;
    }
  }

  private ingestMic(samples: Float32Array): void {
    if (!this.sampler || !this.ctx) return;
    const grain = this.sampler.push(samples, this.ctx.currentTime);
    if (grain) this.onGrain(grain);
    if (this.sampler.consumeFootstep()) {
      this.onHeardStep?.(0.45);
    }
  }

  private onGrain(grain: CapturedGrain): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.flashes.capture = 1;
    if (grain.looping) {
      this.startLoop(grain);
      return;
    }
    this.playGrain(ctx.currentTime + 0.02, grain, 0.82);
  }

  private startLoop(grain: CapturedGrain): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const existing = this.loopSources.get(grain.buffer);
    if (existing) {
      try {
        existing.stop();
      } catch {
        // already stopped
      }
    }
    const source = ctx.createBufferSource();
    source.buffer = grain.buffer;
    source.loop = true;
    source.playbackRate.value = this.grainRate(grain);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.4);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 900;
    filter.Q.value = lerp(0.4, 2.4, clamp(this.mix.bite, 0, 1));
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.filter);
    source.start();
    this.loopSources.set(grain.buffer, source);
    if (this.loopSources.size > 2) {
      const oldest = this.loopSources.keys().next().value;
      if (oldest) {
        const node = this.loopSources.get(oldest);
        try {
          node?.stop();
        } catch {
          // already stopped
        }
        this.loopSources.delete(oldest);
      }
    }
  }

  private scheduler(): void {
    const ctx = this.ctx;
    if (!ctx || !this.running) return;
    this.bpm = lerp(this.bpm, this.targetBpm, lerp(0.24, 0.03, clamp(this.mix.glide, 0, 1)));
    const secondsPer16 = 60 / this.bpm / 4;
    const swing = clamp(
      this.mix.swing + (this.motion?.head.roll ?? 0) * 0.12 * this.mix.steer,
      -0.08,
      0.32,
    );

    while (this.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
      const beat = this.step16 % 16;
      const swingOffset = beat % 2 === 1 ? secondsPer16 * swing : 0;
      this.scheduleStep(this.nextNoteTime + swingOffset, beat);
      this.nextNoteTime += secondsPer16;
      this.step16 += 1;
    }
  }

  private scheduleStep(time: number, beat: number): void {
    const motion = this.motion;
    const walking = motion?.walking ?? false;
    const energy = clamp(
      (motion?.accelEnergy ?? 0) * 0.8 + (this.sampler?.rms ?? 0) * 6,
      0,
      1,
    );
    const pitch = motion?.head.pitch ?? 0;
    const denseHats = pitch > 0.2 || energy > 0.45;

    const density = this.mix.density;
    const bar = Math.floor(this.step16 / 16) % 4;
    const kick =
      beat === 0 ||
      beat === 8 ||
      (walking && density > 0.28 && (beat === 4 || (energy > 0.22 && beat === 12))) ||
      (walking && density > 0.78 && (beat === 6 || beat === 14));
    const snare =
      beat === 4 ||
      beat === 12 ||
      (density > 0.62 && bar === 3 && beat === 14 && energy > 0.25);
    const hat =
      density < 0.18
        ? beat % 4 === 0
        : density < 0.55
          ? beat % 2 === 0 || denseHats || walking
          : true;
    const open = beat === 14 || (Math.abs(motion?.head.roll ?? 0) > 0.4 && beat === 6);
    const shaker = walking && density > 0.38 && beat % 2 === 1;
    const grainHit =
      (this.sampler?.grains.length ?? 0) > 0 &&
      density > 0.12 &&
      (beat === 4 ||
        beat === 12 ||
        (density > 0.35 && (beat === 2 || beat === 10)) ||
        (density > 0.6 && (beat === 6 || beat === 14)));

    if (
      this.mix.tempo === "lock" &&
      this.mix.click > 0 &&
      beat % 4 === 0
    ) {
      this.hitClick(time, this.mix.click * (beat === 0 ? 0.22 : 0.11), beat === 0);
    }
    if (kick) this.hitKick(time, this.drumLevel(walking ? 0.95 : 0.68));
    if (snare) this.hitSnare(time, this.drumLevel(0.58 + energy * 0.28));
    if (hat) this.hitHat(time, open, this.hatLevel(denseHats ? 0.26 : walking ? 0.18 : 0.13));
    if (shaker) this.hitShaker(time, this.hatLevel(0.08 + energy * 0.08));
    if (grainHit) this.hitLatestGrain(time, beat);

    if (beat % 8 === 0) this.moveHarmony(time);
  }

  private applyMotionAudio(motion: MotionSnapshot): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const steer = clamp(this.mix.steer, 0, 1);
    const reach = lerp(220, 1680, clamp(this.mix.reach, 0, 1));
    const cutoff =
      400 +
      this.mix.brightness * 2200 +
      (motion.head.yaw + 1) * reach * steer +
      motion.accelEnergy * 300;
    this.filter.frequency.setTargetAtTime(clamp(cutoff, 280, 6200), now, 0.08);
    this.filter.Q.setTargetAtTime(this.biteQ(), now, 0.08);
    const delayTime = clamp(
      (60 / this.bpm) * (0.55 + motion.head.roll * 0.2 * steer),
      0.12,
      0.75,
    );
    this.delay.delayTime.setTargetAtTime(delayTime, now, 0.12);
    this.delayGain.gain.setTargetAtTime(
      clamp(this.mix.echo * 0.55 + Math.abs(motion.head.roll) * 0.18 * steer, 0.02, 0.5),
      now,
      0.1,
    );
    this.padFilter.frequency.setTargetAtTime(
      500 + (motion.head.pitch * steer + 1) * 1400,
      now,
      0.1,
    );
    this.padGain.gain.setTargetAtTime(
      this.mix.bed * (0.03 + (this.sampler?.voiced ? 0.04 : 0) + Math.abs(motion.head.yaw) * 0.03 * steer),
      now,
      0.12,
    );
  }

  private moveHarmony(time: number): void {
    const yaw = (this.motion?.head.yaw ?? 0) * clamp(this.mix.steer, 0, 1);
    const { root, scale } = mixHarmony(this.mix);
    const index = Math.round(((yaw + 1) / 2) * (scale.length - 1));
    const degree = scale[clamp(index, 0, scale.length - 1)] ?? 2;
    const bassMidi = root + degree;
    const padMidi = root + 12 + degree;
    this.bassOsc.frequency.setTargetAtTime(midiToHz(bassMidi), time, 0.09);
    this.padOscA.frequency.setTargetAtTime(midiToHz(padMidi), time, 0.16);
    this.padOscB.frequency.setTargetAtTime(midiToHz(padMidi) * 1.004, time, 0.16);
    this.padOscC.frequency.setTargetAtTime(midiToHz(bassMidi), time, 0.2);
  }

  private hitKick(time: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.flashes.kick = 1;
    gain *= lerp(0.08, 1.12, clamp(this.mix.kick, 0, 1));
    this.duckBed(time);

    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const punchAmt = clamp(this.mix.punch, 0, 1);
    osc.type = "sine";
    osc.frequency.setValueAtTime(lerp(110, 188, punchAmt), time);
    osc.frequency.exponentialRampToValueAtTime(lerp(28, 42, punchAmt), time + lerp(0.22, 0.12, punchAmt));
    amp.gain.setValueAtTime(gain, time);
    amp.gain.exponentialRampToValueAtTime(0.001, time + lerp(0.4, 0.22, punchAmt));
    osc.connect(amp);
    amp.connect(this.filter);
    osc.start(time);
    osc.stop(time + lerp(0.42, 0.24, punchAmt));

    const punch = ctx.createOscillator();
    const punchAmp = ctx.createGain();
    punch.type = "triangle";
    punch.frequency.setValueAtTime(lerp(62, 110, punchAmt), time);
    punch.frequency.exponentialRampToValueAtTime(lerp(40, 56, punchAmt), time + 0.08);
    punchAmp.gain.setValueAtTime(gain * lerp(0.18, 0.42, punchAmt), time);
    punchAmp.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
    punch.connect(punchAmp);
    punchAmp.connect(this.filter);
    punch.start(time);
    punch.stop(time + 0.12);

    const click = ctx.createOscillator();
    const clickAmp = ctx.createGain();
    click.type = "square";
    click.frequency.value = 1100;
    clickAmp.gain.setValueAtTime(gain * lerp(0.02, 0.14, punchAmt), time);
    clickAmp.gain.exponentialRampToValueAtTime(0.001, time + 0.018);
    click.connect(clickAmp);
    clickAmp.connect(this.filter);
    click.start(time);
    click.stop(time + 0.025);
  }

  private hitSnare(time: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.flashes.snare = 1;
    gain *= lerp(0.08, 1.12, clamp(this.mix.snare, 0, 1));
    const skinAmt = clamp(this.mix.skin, 0, 1);
    this.noiseBurst(
      ctx,
      time,
      lerp(0.2, 0.1, skinAmt),
      lerp(1200, 2600, skinAmt),
      gain * lerp(0.22, 0.42, skinAmt),
    );

    const body = ctx.createOscillator();
    const amp = ctx.createGain();
    body.type = "triangle";
    body.frequency.setValueAtTime(lerp(148, 228, skinAmt), time);
    body.frequency.exponentialRampToValueAtTime(
      lerp(88, 148, skinAmt),
      time + lerp(0.12, 0.055, skinAmt),
    );
    amp.gain.setValueAtTime(gain * 0.28, time);
    amp.gain.exponentialRampToValueAtTime(0.001, time + lerp(0.18, 0.09, skinAmt));
    body.connect(amp);
    amp.connect(this.filter);
    body.start(time);
    body.stop(time + lerp(0.2, 0.11, skinAmt));
  }

  private duckBed(time: number): void {
    if (!this.padGain || !this.bassGain) return;
    const pad = this.padGain.gain.value;
    const bass = this.bassGain.gain.value;
    this.padGain.gain.cancelScheduledValues(time);
    this.bassGain.gain.cancelScheduledValues(time);
    this.padGain.gain.setValueAtTime(pad, time);
    this.bassGain.gain.setValueAtTime(bass, time);
    this.padGain.gain.linearRampToValueAtTime(Math.max(0.001, pad * 0.35), time + 0.02);
    this.bassGain.gain.linearRampToValueAtTime(Math.max(0.001, bass * 0.45), time + 0.02);
    this.padGain.gain.exponentialRampToValueAtTime(Math.max(0.001, pad), time + 0.18);
    this.bassGain.gain.exponentialRampToValueAtTime(Math.max(0.001, bass), time + 0.2);
  }

  private hitHat(time: number, open: boolean, gain: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.flashes.hat = open ? 0.8 : 0.45;
    const decay = open ? 0.2 : 0.034;
    this.noiseBurst(ctx, time, decay, 7800, gain);
  }

  private hitShaker(time: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.noiseBurst(ctx, time, 0.045, 6200, gain);
  }

  private hitTom(time: number, yaw: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "sine";
    const hz = yaw < 0 ? 148 : 220;
    osc.frequency.setValueAtTime(hz, time);
    osc.frequency.exponentialRampToValueAtTime(hz * 0.55, time + 0.18);
    amp.gain.setValueAtTime(this.drumLevel(0.28), time);
    amp.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    osc.connect(amp);
    amp.connect(this.filter);
    osc.start(time);
    osc.stop(time + 0.24);
  }

  private drumLevel(gain: number): number {
    const walking = this.motion?.walking ?? false;
    const hush = walking ? 1 : lerp(1, 0.12, clamp(this.mix.hush, 0, 1));
    return gain * clamp(this.mix.drums, 0, 1) * hush;
  }

  private hatLevel(gain: number): number {
    return this.drumLevel(gain) * lerp(0.06, 1.15, clamp(this.mix.hats, 0, 1));
  }

  private hitClick(time: number, gain: number, downbeat: boolean): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.flashes.click = downbeat ? 1 : 0.55;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(downbeat ? 1860 : 1480, time);
    amp.gain.setValueAtTime(Math.max(0.001, gain), time);
    amp.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
    osc.connect(amp);
    amp.connect(this.filter);
    osc.start(time);
    osc.stop(time + 0.04);
  }

  private hitLatestGrain(time: number, beat: number): void {
    const grains = this.sampler?.grains;
    if (!grains || grains.length === 0) return;
    const oneshots = grains.filter((grain) => !grain.looping);
    const pool = oneshots.length > 0 ? oneshots : grains;
    const grain = pool[this.scatterIndex(pool.length, beat)];
    if (!grain) return;
    this.playGrain(time, grain, 0.55);
  }

  private playGrain(time: number, grain: CapturedGrain, gain: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const source = ctx.createBufferSource();
    source.buffer = grain.buffer;
    source.playbackRate.value = this.grainRate(grain);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, time);
    amp.gain.linearRampToValueAtTime(
      gain * this.mix.voice * clamp(grain.rms * 8, 0.25, 0.7),
      time + 0.01,
    );
    amp.gain.exponentialRampToValueAtTime(0.001, time + Math.min(0.55, grain.duration + 0.05));
    const pan = ctx.createStereoPanner();
    pan.pan.value = clamp(
      (this.motion?.head.yaw ?? 0) * lerp(0.04, 0.95, this.mix.width),
      -0.85,
      0.85,
    );
    source.connect(amp);
    amp.connect(pan);
    pan.connect(this.filter);
    source.start(time);
    source.stop(time + grain.duration + 0.05);
  }

  private scatterIndex(poolLen: number, beat: number): number {
    const latest = poolLen - 1;
    const scatter = clamp(this.mix.scatter, 0, 1);
    const span = Math.max(1, Math.round(lerp(1, poolLen, scatter)));
    const start = latest - span + 1;
    const salt = Math.imul(beat + 1, 2654435761) >>> 0;
    const pick = scatter > 0.5 ? salt % span : beat % span;
    return start + pick;
  }

  private biteQ(): number {
    return lerp(0.25, 4.2, clamp(this.mix.bite, 0, 1));
  }

  private grainRate(grain: CapturedGrain): number {
    const steer = clamp(this.mix.steer, 0, 1);
    const yaw = (this.motion?.head.yaw ?? 0) * steer;
    const pitch = (this.motion?.head.pitch ?? 0) * steer;
    const { root, scale } = mixHarmony(this.mix);
    const index = Math.round(((yaw + 1) / 2) * (scale.length - 1));
    const targetMidi = root + 12 + (scale[clamp(index, 0, scale.length - 1)] ?? 7);
    const targetHz = midiToHz(targetMidi + pitch * 4);
    if (grain.f0) {
      const raw = grain.f0;
      const snapped = midiToHz(quantizeToScale(hzToMidi(grain.f0), scale));
      const from = lerp(raw, snapped, clamp(this.mix.snap, 0, 1));
      return clamp(targetHz / from, 0.55, 1.7);
    }
    return clamp(0.85 + pitch * 0.25 + yaw * 0.08, 0.6, 1.5);
  }

  private noiseBurst(
    ctx: AudioContext,
    time: number,
    decay: number,
    cutoff: number,
    gain: number,
  ): void {
    const length = Math.max(1, Math.floor(ctx.sampleRate * decay));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = cutoff > 4000 ? "highpass" : "bandpass";
    filter.frequency.value = cutoff;
    filter.Q.value = cutoff > 4000 ? 0.6 : 1.1;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, time);
    amp.gain.exponentialRampToValueAtTime(0.001, time + decay);
    source.connect(filter);
    filter.connect(amp);
    amp.connect(this.filter);
    source.start(time);
    source.stop(time + decay + 0.02);
  }

  private decayFlashes(): void {
    this.flashes.kick *= 0.82;
    this.flashes.snare *= 0.78;
    this.flashes.hat *= 0.7;
    this.flashes.click *= 0.72;
    this.flashes.step *= 0.84;
    this.flashes.nod *= 0.8;
    this.flashes.turn *= 0.8;
    this.flashes.capture *= 0.88;
  }
}

function makeDriveCurve(amount: number): Float32Array {
  const samples = 256;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}
