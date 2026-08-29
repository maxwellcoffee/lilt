import { clamp, median } from "@/lib/math";
import type { HeadPose, MotionSnapshot } from "@/lib/types";

type MotionPermissionEvent = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const IDLE_HEAD: HeadPose = {
  yaw: 0,
  pitch: 0,
  roll: 0,
  yawVel: 0,
  pitchVel: 0,
  rollVel: 0,
};

export class MotionRig {
  private lastStepAt = 0;
  private stepIntervals: number[] = [];
  private gravity = 1;
  private walkingUntil = 0;
  private lastStepIntensity = 0;
  private stepJustNow = false;
  private accelEnergy = 0;
  private hasDeviceMotion = false;
  private hasOrientation = false;
  private hasCameraHead = false;
  private deviceHead: HeadPose = { ...IDLE_HEAD };
  private cameraHead: HeadPose | null = null;
  private pointerHead: HeadPose | null = null;
  private lastDeviceHeadAt = 0;
  private lastCameraHeadAt = 0;
  private lastPointerAt = 0;
  private lastFused: HeadPose = { ...IDLE_HEAD };
  private lastFusedAt = 0;
  private origin: { alpha: number; beta: number; gamma: number } | null = null;
  private listening = false;
  private onMotion = (event: DeviceMotionEvent) => this.handleMotion(event);
  private onOrientation = (event: DeviceOrientationEvent) =>
    this.handleOrientation(event);

  async requestPermissions(): Promise<boolean> {
    const motion = DeviceMotionEvent as unknown as MotionPermissionEvent;
    const orientation =
      DeviceOrientationEvent as unknown as MotionPermissionEvent;
    try {
      if (typeof motion.requestPermission === "function") {
        const result = await motion.requestPermission();
        if (result !== "granted") return false;
      }
      if (typeof orientation.requestPermission === "function") {
        const result = await orientation.requestPermission();
        if (result !== "granted") return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  start(): void {
    if (this.listening) return;
    this.listening = true;
    window.addEventListener("devicemotion", this.onMotion);
    window.addEventListener("deviceorientation", this.onOrientation);
  }

  stop(): void {
    this.listening = false;
    window.removeEventListener("devicemotion", this.onMotion);
    window.removeEventListener("deviceorientation", this.onOrientation);
  }

  registerStep(intensity: number): void {
    const now = performance.now() / 1000;
    if (now - this.lastStepAt < 0.28) return;
    if (this.lastStepAt > 0) {
      const interval = now - this.lastStepAt;
      if (interval < 1.4) {
        this.stepIntervals.push(interval);
        if (this.stepIntervals.length > 8) this.stepIntervals.shift();
      }
    }
    this.lastStepAt = now;
    this.lastStepIntensity = clamp(intensity, 0.2, 1);
    this.stepJustNow = true;
    this.walkingUntil = now + 1.6;
  }

  setPointerHead(head: HeadPose | null): void {
    if (!head) {
      this.pointerHead = null;
      return;
    }
    this.lastPointerAt = performance.now() / 1000;
    this.pointerHead = head;
  }

  get trackingFace(): boolean {
    return this.hasCameraHead;
  }

  setCameraHead(head: HeadPose | null): void {
    if (!head) {
      this.hasCameraHead = false;
      this.cameraHead = null;
      return;
    }
    this.hasCameraHead = true;
    this.lastCameraHeadAt = performance.now() / 1000;
    this.cameraHead = head;
  }

  snapshot(): MotionSnapshot {
    const now = performance.now() / 1000;
    if (this.lastCameraHeadAt && now - this.lastCameraHeadAt > 0.6) {
      this.hasCameraHead = false;
      this.cameraHead = null;
    }
    const head = this.fuseHead(now);
    const walking = now < this.walkingUntil;
    const stepJustNow = this.stepJustNow;
    this.stepJustNow = false;
    return {
      head,
      walking,
      stepIntensity: this.lastStepIntensity * (walking ? 1 : 0.15),
      stepJustNow,
      bpm: this.estimateBpm(now),
      accelEnergy: this.accelEnergy,
      hasDeviceMotion: this.hasDeviceMotion,
      hasOrientation: this.hasOrientation,
      hasCameraHead: this.hasCameraHead,
    };
  }

  private fuseHead(now: number): HeadPose {
    const cameraFresh =
      this.cameraHead && now - this.lastCameraHeadAt < 0.4
        ? this.cameraHead
        : null;
    const deviceFresh =
      this.hasOrientation && now - this.lastDeviceHeadAt < 0.4
        ? this.deviceHead
        : null;
    const pointerFresh =
      this.pointerHead && now - this.lastPointerAt < 0.35
        ? this.pointerHead
        : null;
    const next = cameraFresh ?? deviceFresh ?? pointerFresh ?? this.lastFused;
    const dt = Math.max(0.001, now - (this.lastFusedAt || now));
    const fused: HeadPose = {
      yaw: next.yaw,
      pitch: next.pitch,
      roll: next.roll,
      yawVel: (next.yaw - this.lastFused.yaw) / dt,
      pitchVel: (next.pitch - this.lastFused.pitch) / dt,
      rollVel: (next.roll - this.lastFused.roll) / dt,
    };
    this.lastFused = fused;
    this.lastFusedAt = now;
    return fused;
  }

  private handleMotion(event: DeviceMotionEvent): void {
    const accel = event.accelerationIncludingGravity;
    if (!accel) return;
    const ax = accel.x ?? 0;
    const ay = accel.y ?? 0;
    const az = accel.z ?? 0;
    const mag = Math.hypot(ax, ay, az);
    if (mag < 0.01) return;
    this.hasDeviceMotion = true;
    this.gravity = this.gravity * 0.92 + mag * 0.08;
    const dynamic = mag - this.gravity;
    this.accelEnergy = this.accelEnergy * 0.85 + Math.abs(dynamic) * 0.15;
    const now = performance.now() / 1000;
    const threshold = 0.38;
    if (dynamic > threshold && now - this.lastStepAt > 0.28) {
      if (this.lastStepAt > 0) {
        const interval = now - this.lastStepAt;
        if (interval < 1.4) {
          this.stepIntervals.push(interval);
          if (this.stepIntervals.length > 8) this.stepIntervals.shift();
        }
      }
      this.lastStepAt = now;
      this.lastStepIntensity = clamp(dynamic / 2.2, 0.2, 1);
      this.stepJustNow = true;
      this.walkingUntil = now + 1.6;
    }
  }

  private handleOrientation(event: DeviceOrientationEvent): void {
    if (event.beta == null || event.gamma == null || event.alpha == null) {
      return;
    }
    this.hasOrientation = true;
    this.lastDeviceHeadAt = performance.now() / 1000;
    if (!this.origin) {
      this.origin = {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
      };
    }
    const yaw = clamp(shortestDegrees(event.alpha - this.origin.alpha) / 55, -1, 1);
    const pitch = clamp((event.beta - this.origin.beta) / 28, -1, 1);
    const roll = clamp((event.gamma - this.origin.gamma) / 28, -1, 1);
    this.deviceHead = {
      yaw,
      pitch,
      roll,
      yawVel: 0,
      pitchVel: 0,
      rollVel: 0,
    };
  }

  private estimateBpm(now: number): number | null {
    if (this.stepIntervals.length < 2) return null;
    if (now - this.lastStepAt > 2.2) return null;
    const bpm = 60 / median(this.stepIntervals);
    if (bpm < 68 || bpm > 168) return null;
    return bpm;
  }
}

function shortestDegrees(delta: number): number {
  const wrapped = ((delta % 360) + 360) % 360;
  return wrapped > 180 ? wrapped - 360 : wrapped;
}
