"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { MixPanel } from "@/components/mix-panel";
import { VisualField } from "@/components/visual-field";
import { LiltEngine } from "@/lib/audio-engine";
import { HeadCamera } from "@/lib/head-camera";
import {
  MIX_PRESETS,
  activePreset,
  getLiveMix,
  getServerMix,
  peekUndoMix,
  subscribeMix,
  writeMix,
  type MixPresetId,
  type MixSettings,
} from "@/lib/mix";
import { MotionRig } from "@/lib/sensors";
import type { EngineSnapshot, SensorPermissions } from "@/lib/types";

type Phase = "gate" | "starting" | "playing" | "failed";

export function LiltApp() {
  const engineRef = useRef<LiltEngine | null>(null);
  const motionRef = useRef<MotionRig | null>(null);
  const cameraRef = useRef<HeadCamera | null>(null);
  const streamsRef = useRef<MediaStream[]>([]);
  const [phase, setPhase] = useState<Phase>("gate");
  const [error, setError] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<SensorPermissions>({
    microphone: false,
    camera: false,
    motion: false,
  });
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const snapshotRef = useRef<EngineSnapshot | null>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const mix = useSyncExternalStore(subscribeMix, getLiveMix, getServerMix);
  const [mixOpen, setMixOpen] = useState(false);

  const teardown = useCallback(async () => {
    cameraRef.current?.stop();
    cameraRef.current = null;
    motionRef.current?.stop();
    motionRef.current = null;
    await engineRef.current?.stop();
    engineRef.current = null;
    streamsRef.current.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    streamsRef.current = [];
    setVideo(null);
  }, []);

  useEffect(() => {
    return () => {
      void teardown();
    };
  }, [teardown]);

  const applyMix = useCallback((next: MixSettings) => {
    writeMix(next);
    engineRef.current?.setMix(next);
    motionRef.current?.setBounce(next.bounce);
    motionRef.current?.setHang(next.hang);
    motionRef.current?.setGap(next.gap);
  }, []);

  useEffect(() => {
    engineRef.current?.setMix(mix);
    motionRef.current?.setBounce(mix.bounce);
    motionRef.current?.setHang(mix.hang);
    motionRef.current?.setGap(mix.gap);
  }, [mix]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (event.key === "Escape") {
        setMixOpen(false);
        return;
      }
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (event.key === "m" || event.key === "M") {
        setMixOpen((open) => !open);
        return;
      }
      if ((event.key === "z" || event.key === "Z") && !event.metaKey && !event.ctrlKey) {
        const previous = peekUndoMix();
        if (previous) applyMix(previous);
        return;
      }
      if (event.key === "," || event.key === ".") {
        const ids = Object.keys(MIX_PRESETS) as MixPresetId[];
        const current = activePreset(getLiveMix());
        const index = current ? ids.indexOf(current) : -1;
        const nextIndex =
          event.key === "."
            ? (index + 1 + ids.length) % ids.length
            : (index - 1 + ids.length) % ids.length;
        const next = ids[nextIndex];
        if (next) applyMix({ ...MIX_PRESETS[next] });
        return;
      }
      if ((event.key === "[" || event.key === "]") && getLiveMix().tempo === "lock") {
        const live = getLiveMix();
        const delta = event.key === "]" ? 2 : -2;
        applyMix({ ...live, bpm: Math.min(150, Math.max(70, Math.round(live.bpm) + delta)) });
        return;
      }
      if (event.code === "Space" && phase === "playing") {
        event.preventDefault();
        motionRef.current?.registerStep(0.75);
        return;
      }
      if (phase === "playing" && event.key >= "1" && event.key <= "5") {
        engineRef.current?.previewGrain(Number(event.key) - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [applyMix, phase]);

  const begin = useCallback(async () => {
    setPhase("starting");
    setError(null);

    const motion = new MotionRig();
    const motionOk = await motion.requestPermissions();
    motion.start();
    motionRef.current = motion;

    const [mic, cam] = await Promise.all([
      requestMic(),
      requestCamera(),
    ]);
    if (mic) streamsRef.current.push(mic);
    if (cam) streamsRef.current.push(cam);

    const engine = new LiltEngine();
    try {
      await engine.start(mic);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Audio would not start.");
      setPhase("failed");
      await teardown();
      return;
    }
    engineRef.current = engine;
    engine.setMix(getLiveMix());
    motion.setBounce(getLiveMix().bounce);
    motion.setHang(getLiveMix().hang);
    motion.setGap(getLiveMix().gap);
    engine.setStepListener((intensity) => motion.registerStep(intensity));

    if (cam) {
      const headCam = new HeadCamera();
      const ok = await headCam.start(cam, (head) => motion.setCameraHead(head));
      cameraRef.current = headCam;
      if (ok) setVideo(headCam.element);
    }

    setPermissions({
      microphone: Boolean(mic),
      camera: Boolean(cam && cameraRef.current),
      motion: motionOk || motion.snapshot().hasDeviceMotion,
    });
    setPhase("playing");
  }, [teardown]);

  useEffect(() => {
    if (phase !== "playing") return;
    let wake: WakeLockSentinel | null = null;
    const takeWake = async () => {
      try {
        wake = await navigator.wakeLock.request("screen");
      } catch {
        wake = null;
      }
    };
    void takeWake();
    const onVis = () => {
      if (document.visibilityState === "visible") void takeWake();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      void wake?.release();
    };
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    const onPointer = (event: PointerEvent) => {
      const motion = motionRef.current;
      if (!motion) return;
      if (motion.trackingFace) return;
      const yaw = (event.clientX / window.innerWidth) * 2 - 1;
      const pitch = (event.clientY / window.innerHeight) * 2 - 1;
      motion.setPointerHead({
        yaw,
        pitch,
        roll: yaw * 0.25,
        yawVel: 0,
        pitchVel: 0,
        rollVel: 0,
      });
    };
    window.addEventListener("pointermove", onPointer, { passive: true });
    return () => window.removeEventListener("pointermove", onPointer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    let lastHud = 0;
    let lastVibrate = 0;
    const tick = (now: number) => {
      const engine = engineRef.current;
      const motion = motionRef.current;
      if (engine && motion) {
        const motionSnap = motion.snapshot();
        engine.setMotion(motionSnap);
        const next = engine.snapshot();
        snapshotRef.current = next;
        const haptic = getLiveMix().haptic;
        if (next.kickFlash > 0.88 && haptic > 0.03 && now - lastVibrate > 220) {
          lastVibrate = now;
          navigator.vibrate?.(Math.round(5 + haptic * 22));
        }
        if (now - lastHud > 50) {
          lastHud = now;
          setSnapshot(next);
          setPermissions((current) => ({
            ...current,
            motion: motionSnap.hasDeviceMotion || motionSnap.hasOrientation,
            camera: current.camera || motionSnap.hasCameraHead,
          }));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  return (
    <div
      className="relative min-h-dvh overflow-hidden bg-[#0b0907] text-[#f4efe6]"
      onPointerDown={(event) => {
        if (phase !== "playing" || mixOpen) return;
        const target = event.target as HTMLElement | null;
        if (target?.closest("button, input, label, section")) return;
        motionRef.current?.registerStep(0.7);
      }}
    >
      {phase === "playing" ? (
        <VisualField
          snapshotRef={snapshotRef}
          video={video}
          hasCamera={permissions.camera}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(232,168,124,0.12),transparent_55%)]" />
      )}

      {phase !== "playing" ? (
        <StartGate
          phase={phase}
          error={error}
          mixOpen={mixOpen}
          onBegin={() => void begin()}
        />
      ) : (
        <PlayingHud
          snapshot={snapshot}
          permissions={permissions}
          tempo={mix.tempo}
          lockBpm={mix.bpm}
          onHearSample={(index) => engineRef.current?.previewGrain(index)}
        />
      )}

      <MixPanel
        mix={mix}
        open={mixOpen}
        onOpenChange={setMixOpen}
        onChange={applyMix}
        samples={snapshot?.voice.sampleCount ?? 0}
        hear={
          snapshot
            ? {
                rms: snapshot.voice.rms,
                voiced: snapshot.voice.voiced,
                walking: snapshot.walking,
              }
            : null
        }
        onClear={
          phase === "playing"
            ? () => {
                engineRef.current?.clearGrains();
                const next = engineRef.current?.snapshot();
                if (next) {
                  snapshotRef.current = next;
                  setSnapshot(next);
                }
              }
            : undefined
        }
        onEnd={
          phase === "playing"
            ? () => {
                setMixOpen(false);
                void teardown().then(() => setPhase("gate"));
              }
            : undefined
        }
      />
    </div>
  );
}

function StartGate({
  phase,
  error,
  mixOpen,
  onBegin,
}: {
  phase: Phase;
  error: string | null;
  mixOpen: boolean;
  onBegin: () => void;
}) {
  const busy = phase === "starting";
  return (
    <main
      className={`relative z-10 mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-end px-6 pt-16 sm:justify-center ${
        mixOpen ? "pb-[min(72dvh,38rem)]" : "pb-24 sm:pb-28"
      }`}
    >
      <p className="font-mono text-[11px] tracking-[0.28em] text-[#e8a87c]/80 uppercase">
        AirPods instrument
      </p>
      <h1 className="mt-3 font-serif text-6xl leading-none tracking-tight text-[#f4efe6] sm:text-7xl">
        Lilt
      </h1>
      <p className="mt-5 max-w-sm text-[17px] leading-7 text-[#f4efe6]/72">
        Put the buds in. Walk. Hum a line. Turn your head. The beat follows
        your gait, and your voice becomes the sample.
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 text-sm text-[#f4efe6]/62">
        <div>
          <dt className="font-mono text-[10px] tracking-[0.18em] text-[#e8a87c] uppercase">
            Walk
          </dt>
          <dd className="mt-1">Tempo and kick</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] tracking-[0.18em] text-[#7ec8c4] uppercase">
            Hum
          </dt>
          <dd className="mt-1">Chopped samples</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] tracking-[0.18em] text-[#e8a87c] uppercase">
            Nod
          </dt>
          <dd className="mt-1">Snare accents</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] tracking-[0.18em] text-[#7ec8c4] uppercase">
            Turn / tilt
          </dt>
          <dd className="mt-1">Bass, filter, echo</dd>
        </div>
      </dl>

      <div className="mt-10 flex flex-col gap-3">
        <button
          type="button"
          onClick={onBegin}
          disabled={busy}
          className="h-14 rounded-full bg-[#f4efe6] px-8 text-[16px] font-medium text-[#0b0907] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Listening…" : "Begin"}
        </button>
        {error ? (
          <p className="text-sm text-red-300" role="alert">
            {error} You can still retry. Beats will run even if the mic is
            blocked.
          </p>
        ) : (
          <>
            <p className="text-xs leading-5 text-[#f4efe6]/42">
              One tap. Allow the mic (AirPods when they are the system input),
              motion, and camera if you want the face to steer. Pocket mix is for
              a phone in a jacket. On iPhone, Add to Home Screen.
            </p>
            <p className="hidden text-xs leading-5 text-[#f4efe6]/32 sm:block">
              M opens Mix. Space is a step. Keys 1 to 5 play grains. Z undoes Mix.
              [ and ] nudge a locked BPM. Comma and period cycle presets.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function PlayingHud({
  snapshot,
  permissions,
  tempo,
  lockBpm,
  onHearSample,
}: {
  snapshot: EngineSnapshot | null;
  permissions: SensorPermissions;
  tempo: MixSettings["tempo"];
  lockBpm: number;
  onHearSample: (index: number) => void;
}) {
  const missing: string[] = [];
  if (!permissions.microphone) missing.push("mic");
  if (!permissions.motion) missing.push("motion");

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between px-5 pt-5">
      <div>
        <p className="font-serif text-2xl tracking-tight">Lilt</p>
        <p className="mt-1 font-mono text-[10px] tracking-[0.22em] text-[#e8a87c]/80 uppercase">
          {statusLine(snapshot)}
        </p>
      </div>
      <div className="text-right font-mono text-[11px] text-[#f4efe6]/50">
        <p>
          <span
            style={{
              color: `rgba(244, 239, 230, ${0.5 + (snapshot?.clickFlash ?? 0) * 0.5})`,
            }}
          >
            {snapshot ? `${Math.round(snapshot.bpm)} bpm` : "–"}
          </span>
          <span
            className="mt-0.5 block text-[10px] tracking-[0.14em] uppercase"
            style={{
              color: snapshot?.keyTint
                ? `rgba(${snapshot.keyTint.r}, ${snapshot.keyTint.g}, ${snapshot.keyTint.b}, 0.7)`
                : "rgba(244, 239, 230, 0.35)",
            }}
          >
            {tempo === "lock" ? `locked ${Math.round(lockBpm)}` : "follows you"}
            {snapshot?.keyLabel ? ` · ${snapshot.keyLabel}` : ""}
          </span>
        </p>
        <p className="mt-2 flex justify-end gap-1.5" aria-label="Captured samples">
          {Array.from({ length: 5 }, (_, index) => {
            const filled = index < (snapshot?.voice.sampleCount ?? 0);
            return (
              <button
                key={index}
                type="button"
                disabled={!filled}
                onClick={() => onHearSample(index)}
                className="pointer-events-auto block size-3 rounded-full disabled:pointer-events-none"
                style={{
                  background: filled
                    ? snapshot?.captureFlash && snapshot.captureFlash > 0.4
                      ? "#7ec8c4"
                      : "rgba(126, 200, 196, 0.7)"
                    : "rgba(244, 239, 230, 0.18)",
                }}
                aria-label={filled ? `Play sample ${index + 1}` : `Empty sample ${index + 1}`}
              />
            );
          })}
        </p>
        {!permissions.camera ? (
          <p className="mt-2 max-w-[12rem] text-[10px] leading-4 text-[#f4efe6]/35">
            Pointer steers. Tap or Space is a step.
          </p>
        ) : null}
        {missing.length > 0 ? (
          <p className="mt-2 max-w-[12rem] text-[10px] leading-4 text-[#f4efe6]/35">
            No {missing.join(" / ")}. Hum and walk with whatever is open.
          </p>
        ) : null}
      </div>
    </div>
  );
}

async function requestMic(): Promise<MediaStream | null> {
  const detailed = navigator.mediaDevices
    .getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
    })
    .catch(() => navigator.mediaDevices.getUserMedia({ audio: true }));
  return settleStream(detailed);
}

async function requestCamera(): Promise<MediaStream | null> {
  return settleStream(
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: 480, height: 360 },
      audio: false,
    }),
  );
}

async function settleStream(pending: Promise<MediaStream>): Promise<MediaStream | null> {
  let timedOut = false;
  try {
    return await Promise.race([
      pending.then((stream) => {
        if (timedOut) {
          stream.getTracks().forEach((track) => track.stop());
          return null;
        }
        return stream;
      }),
      new Promise<null>((resolve) => {
        window.setTimeout(() => {
          timedOut = true;
          resolve(null);
        }, 8000);
      }),
    ]);
  } catch {
    return null;
  }
}

function statusLine(snapshot: EngineSnapshot | null): string {
  if (!snapshot) return "tuning";
  if (snapshot.captureFlash > 0.45) return "caught";
  if (snapshot.voice.voiced) return "sampling";
  if (snapshot.walking) return "walking";
  return "listening";
}
