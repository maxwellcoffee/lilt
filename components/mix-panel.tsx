"use client";

import { useState } from "react";

import {
  MIX_DEFAULTS,
  MIX_KEYS,
  MIX_PRESETS,
  activePreset,
  mixChipLabel,
  mixKeyTint,
  peekUndoMix,
  type MixKeyId,
  type MixPresetId,
  type MixSettings,
} from "@/lib/mix";

type MixPanelProps = {
  mix: MixSettings;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (mix: MixSettings) => void;
  onEnd?: () => void;
  onClear?: () => void;
  samples?: number;
  hear?: { rms: number; voiced: boolean; walking: boolean } | null;
};

type SliderKey = keyof Pick<
  MixSettings,
  | "volume"
  | "voice"
  | "sensitivity"
  | "echo"
  | "brightness"
  | "swing"
  | "drums"
  | "density"
  | "steer"
  | "chop"
  | "hold"
  | "snap"
  | "scatter"
  | "bed"
  | "space"
  | "hall"
  | "reach"
  | "bite"
  | "hush"
  | "thump"
  | "haptic"
  | "drive"
  | "punch"
  | "kick"
  | "skin"
  | "snare"
  | "hats"
  | "width"
  | "bounce"
  | "hang"
  | "gap"
  | "lag"
  | "nod"
  | "turn"
  | "wait"
>;

const SLIDERS: Record<SliderKey, { label: string; max: number }> = {
  volume: { label: "Volume", max: 1 },
  bed: { label: "Bed", max: 1 },
  drums: { label: "Drums", max: 1 },
  density: { label: "Busy", max: 1 },
  echo: { label: "Echo", max: 1 },
  space: { label: "Space", max: 1 },
  hall: { label: "Hall", max: 1 },
  reach: { label: "Reach", max: 1 },
  bite: { label: "Bite", max: 1 },
  hush: { label: "Hush", max: 1 },
  brightness: { label: "Brightness", max: 1 },
  swing: { label: "Swing", max: 0.4 },
  voice: { label: "Voice", max: 1 },
  chop: { label: "Chop", max: 1 },
  hold: { label: "Hold", max: 1 },
  snap: { label: "Snap", max: 1 },
  scatter: { label: "Scatter", max: 1 },
  sensitivity: { label: "Catch hums", max: 1 },
  thump: { label: "Thump", max: 1 },
  steer: { label: "Steer", max: 1 },
  haptic: { label: "Pulse", max: 1 },
  drive: { label: "Drive", max: 1 },
  punch: { label: "Punch", max: 1 },
  kick: { label: "Kick", max: 1 },
  skin: { label: "Skin", max: 1 },
  snare: { label: "Snare", max: 1 },
  hats: { label: "Hats", max: 1 },
  width: { label: "Width", max: 1 },
  bounce: { label: "Bounce", max: 1 },
  hang: { label: "Hang", max: 1 },
  gap: { label: "Gap", max: 1 },
  lag: { label: "Lag", max: 1 },
  nod: { label: "Nod", max: 1 },
  turn: { label: "Turn", max: 1 },
  wait: { label: "Wait", max: 1 },
};

const GROUPS: Array<{ label: string; keys: SliderKey[] }> = [
  { label: "Sound", keys: ["volume", "drums", "hush", "bed", "drive", "punch", "kick", "skin", "snare", "hats", "density"] },
  { label: "Color", keys: ["echo", "space", "hall", "brightness", "reach", "bite", "swing", "width"] },
  { label: "Voice", keys: ["voice", "chop", "hold", "snap", "scatter", "sensitivity", "thump"] },
  { label: "Move", keys: ["steer", "nod", "turn", "wait", "bounce", "hang", "gap", "lag", "haptic"] },
];
