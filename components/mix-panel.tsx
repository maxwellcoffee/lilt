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

const SLIDERS: Array<{
  key: keyof Pick<
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
  >;
  label: string;
  max: number;
}> = [
  { key: "volume", label: "Volume", max: 1 },
  { key: "voice", label: "Voice", max: 1 },
  { key: "drums", label: "Drums", max: 1 },
  { key: "density", label: "Busy", max: 1 },
  { key: "steer", label: "Steer", max: 1 },
  { key: "chop", label: "Chop", max: 1 },
  { key: "sensitivity", label: "Catch hums", max: 1 },
  { key: "echo", label: "Echo", max: 1 },
  { key: "brightness", label: "Brightness", max: 1 },
  { key: "swing", label: "Swing", max: 0.4 },
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

            <div className="space-y-3">
              {SLIDERS.map((slider) => (
                <label key={slider.key} className="block">
                  <span className="mb-1 flex justify-between font-mono text-[10px] tracking-[0.16em] text-[#f4efe6]/50 uppercase">
                    <span>{slider.label}</span>
                    <span>{Math.round((mix[slider.key] / slider.max) * 100)}</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={slider.max}
                    step={slider.max > 1 ? 1 : 0.01}
                    value={mix[slider.key]}
                    onChange={(event) =>
                      onChange({
                        ...mix,
                        [slider.key]: Number(event.target.value),
                      })
                    }
                    className="h-8 w-full cursor-pointer accent-[#e8a87c]"
                  />
                </label>
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
                <label className="flex min-w-32 flex-1 items-center gap-2">
                  <span className="font-mono text-[10px] tracking-[0.16em] text-[#f4efe6]/50 uppercase">
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
