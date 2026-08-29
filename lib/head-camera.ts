import { clamp } from "@/lib/math";
import type { HeadPose } from "@/lib/types";

type FaceLandmarkerInstance = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestamp: number,
  ) => {
    facialTransformationMatrixes?: Array<{ data?: Float32Array | number[] }>;
  };
  close: () => void;
};

function matrixToHead(data: ArrayLike<number>): HeadPose {
  const r00 = data[0] ?? 1;
  const r10 = data[1] ?? 0;
  const r20 = data[2] ?? 0;
  const r21 = data[6] ?? 0;
  const r22 = data[10] ?? 1;
  const pitch = Math.asin(clamp(-r20, -1, 1));
  const yaw = Math.atan2(r10, r00);
  const roll = Math.atan2(r21, r22);
  return {
    yaw: clamp(yaw / 0.7, -1, 1),
    pitch: clamp(pitch / 0.45, -1, 1),
    roll: clamp(roll / 0.55, -1, 1),
    yawVel: 0,
    pitchVel: 0,
    rollVel: 0,
  };
}

export class HeadCamera {
  private landmarker: FaceLandmarkerInstance | null = null;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private raf = 0;
  private running = false;
  private last: HeadPose | null = null;
  private onHead: ((head: HeadPose | null) => void) | null = null;

  get element(): HTMLVideoElement | null {
    return this.video;
  }

  async start(
    stream: MediaStream,
    onHead: (head: HeadPose | null) => void,
  ): Promise<boolean> {
    this.onHead = onHead;
    this.stream = stream;
    const video = document.createElement("video");
    video.playsInline = true;
    video.muted = true;
    video.autoplay = true;
    video.srcObject = stream;
    video.setAttribute("aria-hidden", "true");
    await video.play().catch(() => undefined);
    this.video = video;

    try {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm",
      );
      const options = {
        runningMode: "VIDEO" as const,
        numFaces: 1,
        outputFacialTransformationMatrixes: true,
      };
      try {
        this.landmarker = (await vision.FaceLandmarker.createFromOptions(
          fileset,
          {
            ...options,
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "GPU",
            },
          },
        )) as unknown as FaceLandmarkerInstance;
      } catch {
        this.landmarker = (await vision.FaceLandmarker.createFromOptions(
          fileset,
          {
            ...options,
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
              delegate: "CPU",
            },
          },
        )) as unknown as FaceLandmarkerInstance;
      }
    } catch {
      this.landmarker = null;
      return false;
    }

    this.running = true;
    this.tick();
    return true;
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.landmarker?.close();
    this.landmarker = null;
    if (this.video) {
      this.video.srcObject = null;
      this.video = null;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.onHead?.(null);
    this.onHead = null;
    this.last = null;
  }

  private tick = (): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    const video = this.video;
    const landmarker = this.landmarker;
    if (!video || !landmarker || video.readyState < 2) return;
    const now = performance.now();
    try {
      const result = landmarker.detectForVideo(video, now);
      const matrix = result.facialTransformationMatrixes?.[0]?.data;
      if (matrix && matrix.length >= 16) {
        this.last = matrixToHead(matrix);
        this.onHead?.(this.last);
        return;
      }
    } catch {
      // Keep the last pose; a missed frame is fine.
    }
    this.onHead?.(this.last);
  };
}
