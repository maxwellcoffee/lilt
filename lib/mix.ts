export type TempoMode = "follow" | "lock";

export type MixKeyId = "dorian" | "minor" | "major" | "penta" | "phryg";

export type MixHarmony = {
  label: string;
  root: number;
  scale: readonly number[];
};

export const MIX_KEYS: Record<MixKeyId, MixHarmony> = {
  dorian: { label: "D dorian", root: 50, scale: [2, 4, 5, 7, 9, 11, 12] },
  minor: { label: "A minor", root: 45, scale: [0, 3, 5, 7, 8, 10, 12] },
  major: { label: "C major", root: 48, scale: [0, 4, 5, 7, 11, 12, 16] },
  penta: { label: "G penta", root: 43, scale: [0, 3, 5, 7, 10] },
  phryg: { label: "E phryg", root: 52, scale: [0, 1, 5, 7, 8, 10, 12] },
};

const KEY_IDS = Object.keys(MIX_KEYS) as MixKeyId[];

export function mixHarmony(mix: MixSettings): MixHarmony {
  return MIX_KEYS[mix.key] ?? MIX_KEYS.dorian;
}

export function mixKeyTint(id: MixKeyId): { r: number; g: number; b: number } {
  switch (id) {
    case "minor":
      return { r: 126, g: 160, b: 196 };
    case "major":
      return { r: 232, g: 196, b: 140 };
    case "penta":
      return { r: 126, g: 200, b: 196 };
    case "phryg":
      return { r: 196, g: 120, b: 150 };
    default:
      return { r: 232, g: 168, b: 124 };
  }
}

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
  chop: number;
  hold: number;
  snap: number;
  scatter: number;
  click: number;
  glide: number;
  bed: number;
  space: number;
  hall: number;
  reach: number;
  bite: number;
  hush: number;
  thump: number;
  haptic: number;
  drive: number;
  punch: number;
  kick: number;
  skin: number;
  snare: number;
  hats: number;
  tom: number;
  width: number;
  bounce: number;
  hang: number;
  gap: number;
  lag: number;
  nod: number;
  turn: number;
  wait: number;
  key: MixKeyId;
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
  chop: 0.42,
  hold: 0.42,
  snap: 0.5,
  scatter: 0.4,
  click: 0,
  glide: 0.4,
  bed: 0.55,
  space: 0.28,
  hall: 0.32,
  reach: 0.48,
  bite: 0.42,
  hush: 0.2,
  thump: 0.5,
  haptic: 0.55,
  drive: 0.4,
  punch: 0.45,
  kick: 0.55,
  skin: 0.45,
  snare: 0.5,
  hats: 0.5,
  tom: 0.5,
  width: 0.5,
  bounce: 0.45,
  hang: 0.5,
  gap: 0.4,
  lag: 0.4,
  nod: 0.5,
  turn: 0.5,
  wait: 0.4,
  key: "dorian",
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
    chop: 0.58,
    hold: 0.32,
    snap: 0.72,
    scatter: 0.62,
    glide: 0.18,
    bed: 0.38,
    space: 0.12,
    hall: 0.14,
    reach: 0.68,
    bite: 0.72,
    hush: 0.06,
    thump: 0.45,
    haptic: 0.7,
    drive: 0.55,
    punch: 0.62,
    kick: 0.78,
    skin: 0.62,
    snare: 0.68,
    hats: 0.72,
    tom: 0.62,
    width: 0.62,
    bounce: 0.58,
    hang: 0.45,
    gap: 0.22,
    lag: 0.16,
    nod: 0.68,
    turn: 0.62,
    wait: 0.18,
    key: "dorian",
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
    chop: 0.35,
    hold: 0.62,
    snap: 0.48,
    scatter: 0.45,
    glide: 0.48,
    bed: 0.72,
    space: 0.44,
    hall: 0.62,
    reach: 0.48,
    bite: 0.48,
    hush: 0.28,
    thump: 0.35,
    haptic: 0.4,
    drive: 0.28,
    punch: 0.38,
    kick: 0.52,
    skin: 0.38,
    snare: 0.48,
    hats: 0.48,
    tom: 0.48,
    width: 0.45,
    bounce: 0.4,
    hang: 0.52,
    gap: 0.42,
    lag: 0.42,
    nod: 0.48,
    turn: 0.48,
    wait: 0.42,
    key: "minor",
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
    chop: 0.22,
    hold: 0.78,
    snap: 0.58,
    scatter: 0.18,
    click: 0.28,
    glide: 0.7,
    bed: 0.64,
    space: 0.5,
    hall: 0.55,
    reach: 0.22,
    bite: 0.18,
    hush: 0.48,
    thump: 0.22,
    haptic: 0.2,
    drive: 0.12,
    punch: 0.18,
    kick: 0.22,
    skin: 0.18,
    snare: 0.22,
    hats: 0.18,
    tom: 0.18,
    width: 0.32,
    bounce: 0.28,
    hang: 0.22,
    gap: 0.55,
    lag: 0.72,
    nod: 0.28,
    turn: 0.32,
    wait: 0.68,
    key: "major",
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
    chop: 0.48,
    hold: 0.2,
    snap: 0.28,
    scatter: 0.78,
    glide: 0.32,
    bed: 0.32,
    space: 0.1,
    hall: 0.16,
    reach: 0.28,
    bite: 0.38,
    hush: 0.12,
    thump: 0.82,
    haptic: 0.85,
    drive: 0.48,
    punch: 0.7,
    kick: 0.72,
    skin: 0.7,
    snare: 0.42,
    hats: 0.38,
    tom: 0.38,
    width: 0.22,
    bounce: 0.12,
    hang: 0.78,
    gap: 0.78,
    lag: 0.48,
    nod: 0.42,
    turn: 0.38,
    wait: 0.45,
    key: "penta",
    tempo: "follow",
    bpm: 100,
  },
};

const STORAGE_KEY = "lilt-mix-v1";
const listeners = new Set<() => void>();
let live: MixSettings | null = null;
let prior: MixSettings | null = null;

function asNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseKey(value: unknown): MixKeyId {
  return KEY_IDS.includes(value as MixKeyId) ? (value as MixKeyId) : MIX_DEFAULTS.key;
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
    chop: asNumber(row.chop, MIX_DEFAULTS.chop, 0, 1),
    hold: asNumber(row.hold, MIX_DEFAULTS.hold, 0, 1),
    snap: asNumber(row.snap, MIX_DEFAULTS.snap, 0, 1),
    scatter: asNumber(row.scatter, MIX_DEFAULTS.scatter, 0, 1),
    click: asNumber(row.click, MIX_DEFAULTS.click, 0, 1),
    glide: asNumber(row.glide, MIX_DEFAULTS.glide, 0, 1),
    bed: asNumber(row.bed, MIX_DEFAULTS.bed, 0, 1),
    space: asNumber(row.space, MIX_DEFAULTS.space, 0, 1),
    hall: asNumber(row.hall, MIX_DEFAULTS.hall, 0, 1),
    reach: asNumber(row.reach, MIX_DEFAULTS.reach, 0, 1),
    bite: asNumber(row.bite, MIX_DEFAULTS.bite, 0, 1),
    hush: asNumber(row.hush, MIX_DEFAULTS.hush, 0, 1),
    thump: asNumber(row.thump, MIX_DEFAULTS.thump, 0, 1),
    haptic: asNumber(row.haptic, MIX_DEFAULTS.haptic, 0, 1),
    drive: asNumber(row.drive, MIX_DEFAULTS.drive, 0, 1),
    punch: asNumber(row.punch, MIX_DEFAULTS.punch, 0, 1),
    kick: asNumber(row.kick, MIX_DEFAULTS.kick, 0, 1),
    skin: asNumber(row.skin, MIX_DEFAULTS.skin, 0, 1),
    snare: asNumber(row.snare, MIX_DEFAULTS.snare, 0, 1),
    hats: asNumber(row.hats, MIX_DEFAULTS.hats, 0, 1),
    tom: asNumber(row.tom, MIX_DEFAULTS.tom, 0, 1),
    width: asNumber(row.width, MIX_DEFAULTS.width, 0, 1),
    bounce: asNumber(row.bounce, MIX_DEFAULTS.bounce, 0, 1),
    hang: asNumber(row.hang, MIX_DEFAULTS.hang, 0, 1),
    gap: asNumber(row.gap, MIX_DEFAULTS.gap, 0, 1),
    lag: asNumber(row.lag, MIX_DEFAULTS.lag, 0, 1),
    nod: asNumber(row.nod, MIX_DEFAULTS.nod, 0, 1),
    turn: asNumber(row.turn, MIX_DEFAULTS.turn, 0, 1),
    wait: asNumber(row.wait, MIX_DEFAULTS.wait, 0, 1),
    key: parseKey(row.key),
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
  const parsed = parseMix(next);
  if (live && !mixEquals(live, parsed)) prior = live;
  live = parsed;
  saveMix(live);
  listeners.forEach((fn) => fn());
  return live;
}

export function peekUndoMix(): MixSettings | null {
  return prior ? { ...prior } : null;
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
    a.chop === b.chop &&
    a.hold === b.hold &&
    a.snap === b.snap &&
    a.scatter === b.scatter &&
    a.click === b.click &&
    a.glide === b.glide &&
    a.bed === b.bed &&
    a.space === b.space &&
    a.hall === b.hall &&
    a.reach === b.reach &&
    a.bite === b.bite &&
    a.hush === b.hush &&
    a.thump === b.thump &&
    a.haptic === b.haptic &&
    a.drive === b.drive &&
    a.punch === b.punch &&
    a.kick === b.kick &&
    a.skin === b.skin &&
    a.snare === b.snare &&
    a.hats === b.hats &&
    a.tom === b.tom &&
    a.width === b.width &&
    a.bounce === b.bounce &&
    a.hang === b.hang &&
    a.gap === b.gap &&
    a.lag === b.lag &&
    a.nod === b.nod &&
    a.turn === b.turn &&
    a.wait === b.wait &&
    a.key === b.key &&
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
  const tempo = mix.tempo === "lock" ? `${Math.round(mix.bpm)}` : "follow";
  return preset ? `${preset} · ${tempo}` : tempo;
}
