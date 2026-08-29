export type TempoMode = "follow" | "lock";

export type MixSettings = {
  volume: number;
  voice: number;
  sensitivity: number;
  echo: number;
  brightness: number;
  swing: number;
  drums: number;
  density: number;
  steer: number;
  tempo: TempoMode;
  bpm: number;
};

export type MixPresetId = "street" | "room" | "soft" | "pocket";

export const MIX_DEFAULTS: MixSettings = {
  volume: 0.85,
  voice: 0.7,
  sensitivity: 0.55,
  echo: 0.35,
  brightness: 0.55,
  swing: 0.12,
  drums: 0.82,
  density: 0.5,
  steer: 0.55,
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
    drums: 0.95,
    density: 0.68,
    steer: 0.62,
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
    drums: 0.7,
    density: 0.42,
    steer: 0.5,
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
    drums: 0.48,
    density: 0.28,
    steer: 0.38,
    tempo: "lock",
    bpm: 84,
  },
  pocket: {
    ...MIX_DEFAULTS,
    volume: 0.88,
    voice: 0.62,
    sensitivity: 0.86,
    echo: 0.26,
    brightness: 0.48,
    swing: 0.1,
    drums: 0.9,
    density: 0.52,
    steer: 0.12,
    tempo: "follow",
    bpm: 100,
  },
};

const STORAGE_KEY = "lilt-mix-v1";
const listeners = new Set<() => void>();
let live: MixSettings | null = null;

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
    drums: asNumber(row.drums, MIX_DEFAULTS.drums, 0, 1),
    density: asNumber(row.density, MIX_DEFAULTS.density, 0, 1),
    steer: asNumber(row.steer, MIX_DEFAULTS.steer, 0, 1),
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

export function subscribeMix(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getServerMix(): MixSettings {
  return MIX_DEFAULTS;
}

export function getLiveMix(): MixSettings {
  if (!live) live = loadMix();
  return live;
}

export function writeMix(next: MixSettings): MixSettings {
  live = parseMix(next);
  saveMix(live);
  listeners.forEach((fn) => fn());
  return live;
}

export function mixEquals(a: MixSettings, b: MixSettings): boolean {
  return (
    a.volume === b.volume &&
    a.voice === b.voice &&
    a.sensitivity === b.sensitivity &&
    a.echo === b.echo &&
    a.brightness === b.brightness &&
    a.swing === b.swing &&
    a.drums === b.drums &&
    a.density === b.density &&
    a.steer === b.steer &&
    a.tempo === b.tempo &&
    a.bpm === b.bpm
  );
}

export function activePreset(mix: MixSettings): MixPresetId | null {
  for (const id of Object.keys(MIX_PRESETS) as MixPresetId[]) {
    if (mixEquals(mix, MIX_PRESETS[id])) return id;
  }
  return null;
}

export function mixChipLabel(mix: MixSettings): string {
  const preset = activePreset(mix);
  const tempo = mix.tempo === "lock" ? `lock ${Math.round(mix.bpm)}` : "follow";
  return preset ? `${preset} · ${tempo}` : tempo;
}
