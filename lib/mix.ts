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
