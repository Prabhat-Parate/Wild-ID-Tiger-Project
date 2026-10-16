import { ApiError, type FrameDetection } from "./api";
export const DETECTOR_SCORE_NOTE =
  "Detector score is not a probability and not a measure of accuracy. Detection does not identify individual animals.";
export const STALE_MS = 1200;
export function cameraError(error: unknown) {
  const name =
    error && typeof error === "object" && "name" in error
      ? String(error.name)
      : "";
  return (
    (
      {
        NotAllowedError:
          "Camera permission denied or blocked. Allow camera access in browser site settings, then retry. Open the app in its own secure tab if embedding blocks permission.",
        NotFoundError:
          "No camera found. Connect a camera or upload a photo, then retry.",
        NotReadableError:
          "Camera is in use by another app or could not be opened. Close the other app and retry.",
        OverconstrainedError:
          "The selected camera is unavailable. Choose another camera and retry.",
        SecurityError:
          "Camera access is blocked by browser security. Open this app over HTTPS or localhost and allow camera permission.",
      } as Record<string, string>
    )[name] ||
    "Could not start the camera. Check browser camera settings or use photo upload, then retry."
  );
}
export function stopTracks(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}
/** object-fit:contain projection, in CSS pixels. Video alone is mirrored, so boxes must also flip. */
export function projectBox(
  b: readonly number[],
  width: number,
  height: number,
  sourceWidth: number,
  sourceHeight: number,
  mirror = false,
) {
  const scale = Math.min(width / sourceWidth, height / sourceHeight),
    dw = sourceWidth * scale,
    dh = sourceHeight * scale;
  return {
    x: (width - dw) / 2 + (mirror ? 1 - b[2] : b[0]) * dw,
    y: (height - dh) / 2 + b[1] * dh,
    width: (b[2] - b[0]) * dw,
    height: (b[3] - b[1]) * dh,
  };
}
export function detectionStatus(detections: FrameDetection[]) {
  if (detections.some((d) => d.label === "Person"))
    return "Person detected, ignored";
  const named = detections.filter(
    (d) => d.species_status === "named" || d.label === "Tiger",
  );
  if (named.length)
    return named.map((d) => d.display_label || d.label).join(", ") + " detected";
  return detections.length
    ? "Animal detected (species not determined)"
    : "No animal detected in this frame";
}
/** One in-flight job, no queue. 800ms after completion, exponential/429 backoff up to 8s. */
export class SerialFrameLoop {
  private running = false;
  private pending = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private controller: AbortController | null = null;
  private failures = 0;
  constructor(
    private task: (signal: AbortSignal) => Promise<void>,
    private onError: (e: unknown, delay: number) => void,
    private period = 800,
  ) {}
  start() {
    if (this.running) return;
    this.running = true;
    if (typeof document !== "undefined")
      document.addEventListener("visibilitychange", this.onVisibility);
    this.schedule(0);
  }
  stop() {
    this.running = false;
    if (typeof document !== "undefined")
      document.removeEventListener("visibilitychange", this.onVisibility);
    clearTimeout(this.timer);
    this.controller?.abort();
  }
  private onVisibility = () => {
    if (typeof document !== "undefined" && document.hidden) {
      this.controller?.abort();
      clearTimeout(this.timer);
    } else if (this.running) this.schedule(this.period);
  };
  private schedule(ms: number) {
    clearTimeout(this.timer);
    if (this.running) this.timer = setTimeout(() => void this.tick(), ms);
  }
  private async tick() {
    if (!this.running) return;
    if (this.pending) {
      this.schedule(this.period);
      return;
    }
    this.pending = true;
    this.controller = new AbortController();
    let delay = this.period;
    try {
      await this.task(this.controller.signal);
      this.failures = 0;
    } catch (e) {
      if (this.running) {
        this.failures++;
        delay =
          e instanceof ApiError && (e.status === 429 || e.status === 503)
            ? Math.max(2000, e.retryAfter * 1000)
            : Math.min(8000, 1000 * 2 ** Math.min(this.failures - 1, 3));
        this.onError(e, delay);
      }
    } finally {
      this.pending = false;
      this.controller = null;
      this.schedule(delay);
    }
  }
}
export async function jpegFrame(video: HTMLVideoElement): Promise<Blob | null> {
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight)
    return null;
  const scale = Math.min(
    1,
    1280 / Math.max(video.videoWidth, video.videoHeight),
  );
  const c = document.createElement("canvas");
  c.width = Math.round(video.videoWidth * scale);
  c.height = Math.round(video.videoHeight * scale);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable. Use photo upload.");
  ctx.drawImage(video, 0, 0, c.width, c.height);
  return await new Promise((resolve) => c.toBlob(resolve, "image/jpeg", 0.86));
}
export async function cropBlob(
  blob: Blob,
  bbox: readonly number[],
  pixels = false,
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const [a, b, c, d] = bbox;
    const x = pixels ? a : Math.floor(a * bitmap.width),
      y = pixels ? b : Math.floor(b * bitmap.height),
      w = pixels ? c : Math.ceil(c * bitmap.width) - x,
      h = pixels ? d : Math.ceil(d * bitmap.height) - y;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Cannot prepare the detection crop.");
    ctx.drawImage(bitmap, x, y, w, h, 0, 0, w, h);
    const result = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!result) throw new Error("Cannot encode the detection crop.");
    return result;
  } finally {
    bitmap.close();
  }
}
