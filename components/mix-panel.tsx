"use client";

import {
  MIX_DEFAULTS,
  MIX_PRESETS,
  activePreset,
  mixChipLabel,
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
  | "bed"
>;

const SLIDERS: Record<SliderKey, { label: string; max: number }> = {
  volume: { label: "Volume", max: 1 },
  bed: { label: "Bed", max: 1 },
  drums: { label: "Drums", max: 1 },
  density: { label: "Busy", max: 1 },
  echo: { label: "Echo", max: 1 },
  brightness: { label: "Brightness", max: 1 },
  swing: { label: "Swing", max: 0.4 },
  voice: { label: "Voice", max: 1 },
  chop: { label: "Chop", max: 1 },
  sensitivity: { label: "Catch hums", max: 1 },
  steer: { label: "Steer", max: 1 },
};

const GROUPS: Array<{ label: string; keys: SliderKey[] }> = [
  { label: "Sound", keys: ["volume", "bed", "drums", "density", "echo", "brightness", "swing"] },
  { label: "Voice", keys: ["voice", "chop", "sensitivity"] },
  { label: "Move", keys: ["steer"] },
];

export function MixPanel({
  mix,
  open,
  onOpenChange,
  onChange,
  onEnd,
  onClear,
  samples = 0,
}: MixPanelProps) {
  const current = activePreset(mix);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-lg flex-col items-start gap-3">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className="pointer-events-auto min-h-11 whitespace-nowrap rounded-full border border-[#f4efe6]/15 bg-[#0b0907]/75 px-5 font-mono text-[12px] tracking-[0.16em] text-[#f4efe6]/85 uppercase backdrop-blur-sm"
          aria-expanded={open}
        >
          {open ? "Close mix" : `Mix · ${mixChipLabel(mix)}`}
        </button>

        {open ? (
          <section className="pointer-events-auto max-h-[min(70dvh,36rem)] w-full overflow-y-auto rounded-2xl border border-[#f4efe6]/12 bg-[#120e0c]/94 p-4 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <div className="mb-4 flex flex-wrap gap-2">
              {(Object.keys(MIX_PRESETS) as MixPresetId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onChange({ ...MIX_PRESETS[id] })}
                  className={`min-h-9 rounded-full border px-3.5 py-1.5 font-mono text-[11px] tracking-[0.16em] uppercase ${
                    current === id
                      ? "border-[#e8a87c] bg-[#e8a87c] text-[#0b0907]"
                      : "border-[#e8a87c]/35 text-[#e8a87c]"
                  }`}
                >
                  {id}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onChange({ ...MIX_DEFAULTS })}
                className="min-h-9 rounded-full border border-[#f4efe6]/20 px-3.5 py-1.5 font-mono text-[11px] tracking-[0.16em] text-[#f4efe6]/60 uppercase"
              >
                Reset
              </button>
            </div>

            <div className="space-y-5">
              {GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-[#e8a87c]/70 uppercase">
                    {group.label}
                  </p>
                  <div className="space-y-3">
                    {group.keys.map((key) => {
                      const slider = SLIDERS[key];
                      return (
                        <label key={key} className="block">
                          <span className="mb-1 flex justify-between font-mono text-[10px] tracking-[0.16em] text-[#f4efe6]/50 uppercase">
                            <span>{slider.label}</span>
                            <span>{Math.round((mix[key] / slider.max) * 100)}</span>
                          </span>
                          <input
                            type="range"
                            min={0}
                            max={slider.max}
                            step={slider.max > 1 ? 1 : 0.01}
                            value={mix[key]}
                            onChange={(event) =>
                              onChange({
                                ...mix,
                                [key]: Number(event.target.value),
                              })
                            }
                            className="h-8 w-full cursor-pointer accent-[#e8a87c]"
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex rounded-full border border-[#f4efe6]/15 p-0.5">
                <ModeButton
                  active={mix.tempo === "follow"}
                  onClick={() => onChange({ ...mix, tempo: "follow" })}
                >
                  Follow walk
                </ModeButton>
                <ModeButton
                  active={mix.tempo === "lock"}
                  onClick={() => onChange({ ...mix, tempo: "lock" })}
                >
                  Lock
                </ModeButton>
              </div>
              {mix.tempo === "lock" ? (
                <div className="flex min-w-32 flex-1 flex-col gap-2">
                  <label className="flex items-center gap-2">
                    <span className="w-10 font-mono text-[10px] tracking-[0.16em] text-[#f4efe6]/50 uppercase">
                      {Math.round(mix.bpm)}
                    </span>
                    <input
                      type="range"
                      min={70}
                      max={150}
                      step={1}
                      value={mix.bpm}
                      onChange={(event) =>
                        onChange({ ...mix, bpm: Number(event.target.value) })
                      }
                      className="h-8 w-full cursor-pointer accent-[#7ec8c4]"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="w-10 font-mono text-[10px] tracking-[0.16em] text-[#f4efe6]/50 uppercase">
                      Click
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.01}
                      value={mix.click}
                      onChange={(event) =>
                        onChange({ ...mix, click: Number(event.target.value) })
                      }
                      className="h-8 w-full cursor-pointer accent-[#7ec8c4]"
                    />
                  </label>
                </div>
              ) : null}
            </div>

            {onClear && samples > 0 ? (
              <button
                type="button"
                onClick={onClear}
                className="mt-4 min-h-11 w-full rounded-full border border-[#7ec8c4]/30 font-mono text-[11px] tracking-[0.18em] text-[#7ec8c4]/80 uppercase"
              >
                Drop {samples} {samples === 1 ? "sample" : "samples"}
              </button>
            ) : null}

            {onEnd ? (
              <button
                type="button"
                onClick={onEnd}
                className="mt-3 min-h-11 w-full rounded-full border border-[#f4efe6]/15 font-mono text-[11px] tracking-[0.18em] text-[#f4efe6]/45 uppercase"
              >
                End walk
              </button>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-9 rounded-full px-3.5 py-1.5 font-mono text-[11px] tracking-[0.14em] uppercase ${
        active ? "bg-[#f4efe6] text-[#0b0907]" : "text-[#f4efe6]/55"
      }`}
    >
      {children}
    </button>
  );
}
