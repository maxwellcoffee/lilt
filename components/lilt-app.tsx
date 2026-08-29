"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { MixPanel } from "@/components/mix-panel";
import { VisualField } from "@/components/visual-field";
import { LiltEngine } from "@/lib/audio-engine";
import { HeadCamera } from "@/lib/head-camera";
import { MIX_DEFAULTS, loadMix, saveMix, type MixSettings } from "@/lib/mix";
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
  const [mix, setMix] = useState<MixSettings>(MIX_DEFAULTS);
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
    setMix(next);
    saveMix(next);
    engineRef.current?.setMix(next);
  }, []);

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
    const stored = loadMix();
    setMix(stored);
    engine.setMix(stored);
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
    const tick = (now: number) => {
      const engine = engineRef.current;
      const motion = motionRef.current;
      if (engine && motion) {
        const motionSnap = motion.snapshot();
        engine.setMotion(motionSnap);
        const next = engine.snapshot();
        snapshotRef.current = next;
        if (now - lastHud > 180) {
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
    <div className="relative min-h-dvh overflow-hidden bg-[#0b0907] text-[#f4efe6]">
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
          onBegin={() => void begin()}
        />
      ) : (
        <>
          <PlayingHud snapshot={snapshot} permissions={permissions} />
          <MixPanel
            mix={mix}
            open={mixOpen}
            onOpenChange={setMixOpen}
            onChange={applyMix}
            onEnd={() => {
              setMixOpen(false);
              void teardown().then(() => setPhase("gate"));
            }}
          />
        </>
      )}
    </div>
  );
}

function StartGate({
  phase,
  error,
  onBegin,
}: {
  phase: Phase;
  error: string | null;
  onBegin: () => void;
}) {
  const busy = phase === "starting";
  return (
    <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-end px-6 pb-10 pt-16 sm:justify-center sm:pb-16">
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
          className="h-12 rounded-full bg-[#f4efe6] px-8 text-[15px] font-medium text-[#0b0907] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Listening…" : "Begin"}
        </button>
        {error ? (
          <p className="text-sm text-red-300" role="alert">
            {error} You can still retry — beats will run even if the mic is
            blocked.
          </p>
        ) : (
          <p className="text-xs leading-5 text-[#f4efe6]/42">
            One tap. After that, do not touch the screen. Allow the mic (AirPods
            when they are connected), motion, and camera if you want head
            tracking while the phone can see your face.
          </p>
        )}
      </div>
    </main>
  );
}

function PlayingHud({
  snapshot,
  permissions,
}: {
  snapshot: EngineSnapshot | null;
  permissions: SensorPermissions;
}) {
  const missing: string[] = [];
  if (!permissions.microphone) missing.push("mic");
  if (!permissions.camera) missing.push("camera");
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
        <p>{snapshot ? `${Math.round(snapshot.bpm)} bpm` : "—"}</p>
        <p className="mt-2 flex justify-end gap-1.5" aria-label="Captured samples">
          {Array.from({ length: 5 }, (_, index) => (
            <span
              key={index}
              className="block size-1.5 rounded-full"
              style={{
                background:
                  index < (snapshot?.voice.sampleCount ?? 0)
                    ? snapshot?.captureFlash && snapshot.captureFlash > 0.4
                      ? "#7ec8c4"
                      : "rgba(126, 200, 196, 0.7)"
                    : "rgba(244, 239, 230, 0.18)",
              }}
            />
          ))}
        </p>
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
