export type TempoMode = "follow" | "lock";

export type MixSettings = {
  volume: number;
  voice: number;
  sensitivity: number;
  echo: number;
  brightness: number;
  swing: number;
  tempo: TempoMode;
  bpm: number;
};

export type MixPresetId = "street" | "room" | "soft";

export const MIX_DEFAULTS: MixSettings = {
  volume: 0.85,
  voice: 0.7,
  sensitivity: 0.55,
  echo: 0.35,
  brightness: 0.55,
  swing: 0.12,
  tempo: "follow",
  bpm: 96,
};

export const MIX_PRESETS: Record<MixPresetId, MixSettings> = {
  street: {
    ...MIX_DEFAULTS,
    volume: 0.9,
    voice: 0.75,
    sensitivity: 0.45,
    echo: 0.22,
    brightness: 0.62,
    swing: 0.08,
    tempo: "follow",
    bpm: 108,
  },
  room: {
    ...MIX_DEFAULTS,
    volume: 0.8,
    voice: 0.85,
    sensitivity: 0.7,
    echo: 0.48,
    brightness: 0.42,
    swing: 0.2,
    tempo: "follow",
    bpm: 92,
  },
  soft: {
    ...MIX_DEFAULTS,
    volume: 0.62,
    voice: 0.55,
    sensitivity: 0.8,
    echo: 0.55,
    brightness: 0.32,
    swing: 0.16,
    tempo: "lock",
    bpm: 84,
  },
};

const STORAGE_KEY = "lilt-mix-v1";

function asNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function parseMix(raw: unknown): MixSettings {
  if (!raw || typeof raw !== "object") return { ...MIX_DEFAULTS };
  const row = raw as Record<string, unknown>;
  return {
    volume: asNumber(row.volume, MIX_DEFAULTS.volume, 0, 1),
    voice: asNumber(row.voice, MIX_DEFAULTS.voice, 0, 1),
    sensitivity: asNumber(row.sensitivity, MIX_DEFAULTS.sensitivity, 0, 1),
    echo: asNumber(row.echo, MIX_DEFAULTS.echo, 0, 1),
    brightness: asNumber(row.brightness, MIX_DEFAULTS.brightness, 0, 1),
    swing: asNumber(row.swing, MIX_DEFAULTS.swing, 0, 0.4),
    tempo: row.tempo === "lock" ? "lock" : "follow",
    bpm: asNumber(row.bpm, MIX_DEFAULTS.bpm, 70, 150),
  };
}

export function loadMix(): MixSettings {
  if (typeof window === "undefined") return { ...MIX_DEFAULTS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...MIX_DEFAULTS };
    return parseMix(JSON.parse(raw));
  } catch {
    return { ...MIX_DEFAULTS };
  }
}

export function saveMix(mix: MixSettings): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mix));
  } catch {
    // private mode
  }
}
