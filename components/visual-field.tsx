"use client";

import { useEffect, useRef, type RefObject } from "react";

import type { EngineSnapshot } from "@/lib/types";

type VisualFieldProps = {
  snapshotRef: RefObject<EngineSnapshot | null>;
  video: HTMLVideoElement | null;
  hasCamera: boolean;
};

type RecedingBar = {
  born: number;
  life: number;
  shade: number;
};

type Star = { x: number; y: number; z: number; size: number };

export function VisualField({ snapshotRef, video, hasCamera }: VisualFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const barsRef = useRef<RecedingBar[]>([]);
  const lastKick = useRef(0);
  const starsRef = useRef<Star[] | null>(null);
  const videoRef = useRef(video);
  const cameraRef = useRef(hasCamera);

  useEffect(() => {
    videoRef.current = video;
    cameraRef.current = hasCamera;
  }, [video, hasCamera]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!starsRef.current) {
      starsRef.current = Array.from({ length: 90 }, () => ({
        x: Math.random(),
        y: Math.random() * 0.55,
        z: 0.3 + Math.random() * 0.7,
        size: 0.6 + Math.random() * 1.6,
      }));
    }

    let raf = 0;
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const state = snapshotRef.current;
      const yaw = state?.head.yaw ?? 0;
      const pitch = state?.head.pitch ?? 0;
      const roll = state?.head.roll ?? 0;
      const kick = state?.kickFlash ?? 0;
      const snare = state?.snareFlash ?? 0;
      const voice = state?.voice.rms ?? 0;
      const capture = state?.captureFlash ?? 0;

      if (kick > 0.7 && now - lastKick.current > 70) {
        lastKick.current = now;
        barsRef.current.push({
          born: now,
          life: 1500,
          shade: 0.28 + (state?.stepFlash ?? 0) * 0.35,
        });
        if (barsRef.current.length > 22) barsRef.current.shift();
      }

      const warm = state?.brightness ?? 0.55;
      const space = state?.space ?? 0.28;
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, `rgb(${16 + warm * 22}, ${12 + warm * 6}, ${20 - warm * 6})`);
      sky.addColorStop(0.42, `rgb(${24 + warm * 18}, ${16 + warm * 8}, ${14})`);
      sky.addColorStop(1, "#0b0907");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      drawStars(ctx, width, height, starsRef.current ?? [], yaw, pitch, kick);

      const glow = `rgba(232, 168, 124, ${0.06 + kick * 0.16 + voice * 2.4 + capture * 0.2})`;
      const gradient = ctx.createRadialGradient(
        width * 0.5 + yaw * 40,
        height * 0.38,
        10,
        width * 0.5,
        height * 0.48,
        Math.max(width, height) * 0.72,
      );
      gradient.addColorStop(0, glow);
      gradient.addColorStop(0.55, `rgba(126, 200, 196, ${0.03 + capture * 0.18})`);
      gradient.addColorStop(1, "rgba(11, 9, 7, 0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      if (space > 0.04) {
        const haze = ctx.createRadialGradient(
          width * 0.5,
          height * 0.42,
          20,
          width * 0.5,
          height * 0.5,
          Math.max(width, height) * 0.62,
        );
        haze.addColorStop(0, `rgba(180, 196, 210, ${space * 0.16})`);
        haze.addColorStop(0.55, `rgba(126, 160, 176, ${space * 0.1})`);
        haze.addColorStop(1, "rgba(11, 9, 7, 0)");
        ctx.fillStyle = haze;
        ctx.fillRect(0, 0, width, height);
      }

      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate(roll * 0.28);
      ctx.translate(-width / 2, -height / 2);

      const vanishingX = width * 0.5 + yaw * width * 0.24;
      const vanishingY = height * 0.34 + pitch * height * 0.14;

      drawRoad(ctx, width, height, vanishingX, vanishingY, barsRef.current, now);
      drawLamps(
        ctx,
        width,
        height,
        vanishingX,
        vanishingY,
        kick,
        snare,
        state?.clickFlash ?? 0,
        state?.drums ?? 0.82,
      );
      if (state) {
        drawVoiceRibbon(ctx, width, height, vanishingX, vanishingY, state);
        drawSampleOrbs(ctx, vanishingX, vanishingY, state);
      }
      drawHorizon(ctx, width, vanishingX, vanishingY, yaw);

      ctx.restore();

      drawFaceHint(ctx, width, height, videoRef.current, cameraRef.current);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [snapshotRef]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    />
  );
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stars: Star[],
  yaw: number,
  pitch: number,
  kick: number,
) {
  for (const star of stars) {
    const x = ((star.x + yaw * 0.08 * star.z) % 1) * width;
    const y = star.y * height * 0.5 - pitch * 18 * star.z;
    ctx.fillStyle = `rgba(244, 239, 230, ${0.18 + star.z * 0.45 + kick * 0.15})`;
    ctx.fillRect(x, y, star.size, star.size);
  }
}

function drawRoad(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  vx: number,
  vy: number,
  bars: RecedingBar[],
  now: number,
) {
  ctx.fillStyle = "rgba(8, 7, 6, 0.55)";
  ctx.beginPath();
  ctx.moveTo(width * 0.08, height);
  ctx.lineTo(vx, vy);
  ctx.lineTo(width * 0.92, height);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "rgba(244, 239, 230, 0.09)";
  ctx.lineWidth = 1;
  const lanes = 7;
  for (let i = 0; i < lanes; i++) {
    const t = i / (lanes - 1);
    const x = width * (0.08 + t * 0.84);
    ctx.beginPath();
    ctx.moveTo(x, height);
    ctx.lineTo(vx, vy);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(244, 239, 230, 0.22)";
  ctx.setLineDash([10, 18]);
  ctx.beginPath();
  ctx.moveTo(width * 0.5, height);
  ctx.lineTo(vx, vy);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = bars.length - 1; i >= 0; i--) {
    const bar = bars[i];
    if (!bar) continue;
    const age = (now - bar.born) / bar.life;
    if (age >= 1) {
      bars.splice(i, 1);
      continue;
    }
    const y = height - (height - vy) * easeOut(age);
    const widthAtY = roadWidth(y, height, vy, width);
    ctx.fillStyle = `rgba(232, 168, 124, ${bar.shade * (1 - age)})`;
    ctx.fillRect(vx - widthAtY / 2, y, widthAtY, 5 + (1 - age) * 12);
  }
}

function drawLamps(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  vx: number,
  vy: number,
  kick: number,
  snare: number,
  click: number,
  drums: number,
) {
  const rows = 7;
  for (let i = 1; i <= rows; i++) {
    const t = i / (rows + 1);
    const y = vy + (height - vy) * t;
    const half = roadWidth(y, height, vy, width) / 2 + 20;
    const size = 2 + t * 6;
    const pulse =
      (0.2 + kick * 0.5 + click * 0.35 + (i % 2 === 0 ? snare * 0.4 : 0)) *
      (0.35 + drums * 0.65);
    ctx.fillStyle = `rgba(255, 214, 160, ${pulse})`;
    ctx.shadowColor = "rgba(255, 196, 120, 0.6)";
    ctx.shadowBlur = 8 + kick * 12;
    ctx.beginPath();
    ctx.arc(vx - half, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(vx + half, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawVoiceRibbon(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  vx: number,
  vy: number,
  state: EngineSnapshot,
) {
  const wave = state.waveform;
  ctx.beginPath();
  ctx.strokeStyle = state.voice.voiced
    ? "rgba(126, 200, 196, 0.9)"
    : "rgba(126, 200, 196, 0.32)";
  ctx.lineWidth = state.voice.voiced ? 2.2 : 1.5;
  const points = 90;
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const y = height - (height - vy) * t;
    const half = roadWidth(y, height, vy, width) * 0.2;
    const sample = wave[Math.floor(t * (wave.length - 1))] ?? 0;
    const x = vx + sample * half * (9 + state.voice.rms * 48);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawSampleOrbs(
  ctx: CanvasRenderingContext2D,
  vx: number,
  vy: number,
  state: EngineSnapshot,
) {
  const count = state.voice.sampleCount;
  for (let i = 0; i < 5; i++) {
    const lit = i < count;
    const x = vx + (i - 2) * 16;
    ctx.fillStyle = lit
      ? `rgba(126, 200, 196, ${0.45 + state.captureFlash * 0.5})`
      : "rgba(244, 239, 230, 0.12)";
    ctx.beginPath();
    ctx.arc(x, vy - 18, lit ? 3.2 : 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHorizon(
  ctx: CanvasRenderingContext2D,
  width: number,
  vx: number,
  vy: number,
  yaw: number,
) {
  ctx.strokeStyle = "rgba(244, 239, 230, 0.16)";
  ctx.beginPath();
  ctx.moveTo(0, vy + 10);
  ctx.lineTo(width, vy - yaw * 12);
  ctx.stroke();
  ctx.fillStyle = "rgba(244, 239, 230, 0.65)";
  ctx.beginPath();
  ctx.arc(vx, vy, 2.8, 0, Math.PI * 2);
  ctx.fill();
}

function drawFaceHint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  video: HTMLVideoElement | null,
  hasCamera: boolean,
) {
  if (!video || video.readyState < 2) return;
  const size = Math.min(88, width * 0.22);
  const x = width - size - 18;
  const y = height - size - 22;
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.globalAlpha = 0.4;
  ctx.translate(x + size, y);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, size, size);
  ctx.restore();
  ctx.strokeStyle = hasCamera
    ? "rgba(126, 200, 196, 0.45)"
    : "rgba(244, 239, 230, 0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.stroke();
}

function roadWidth(y: number, height: number, vy: number, width: number): number {
  const t = (y - vy) / Math.max(1, height - vy);
  return Math.max(8, width * 0.12 + width * 0.64 * t);
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
