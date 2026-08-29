export type HeadPose = {
  yaw: number;
  pitch: number;
  roll: number;
  yawVel: number;
  pitchVel: number;
  rollVel: number;
};

export type MotionSnapshot = {
  head: HeadPose;
  walking: boolean;
  stepIntensity: number;
  stepJustNow: boolean;
  bpm: number | null;
  accelEnergy: number;
  hasDeviceMotion: boolean;
  hasOrientation: boolean;
  hasCameraHead: boolean;
};

export type VoiceSnapshot = {
  rms: number;
  voiced: boolean;
  noiseFloor: number;
  sampleCount: number;
  lastCaptureAt: number | null;
};

export type EngineSnapshot = {
  time: number;
  bpm: number;
  walking: boolean;
  energy: number;
  head: HeadPose;
  voice: VoiceSnapshot;
  kickFlash: number;
  snareFlash: number;
  hatFlash: number;
  clickFlash: number;
  stepFlash: number;
  nodFlash: number;
  turnFlash: number;
  captureFlash: number;
  waveform: Float32Array;
  brightness: number;
  drums: number;
  space: number;
  keyLabel: string;
  keyTint: { r: number; g: number; b: number };
  ready: boolean;
};

export type SensorPermissions = {
  microphone: boolean;
  camera: boolean;
  motion: boolean;
};
