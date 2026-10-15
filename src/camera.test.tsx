import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import {
  cameraError,
  detectionStatus,
  projectBox,
  SerialFrameLoop,
  stopTracks,
  DETECTOR_SCORE_NOTE,
} from "./camera";
import { ApiError, type FrameDetection } from "./api";
import { DetectorScore } from "./Detect";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const fixture = (label: string) =>
  ({
    label,
    score: 0.8,
    bbox: [0.1, 0.2, 0.8, 0.9],
    image_width: 100,
    image_height: 100,
  }) as FrameDetection;
describe("camera utilities (explicit test fixtures, not model predictions)", () => {
  it.each([
    ["NotAllowedError", "permission denied"],
    ["NotFoundError", "No camera found"],
    ["NotReadableError", "in use"],
    ["OverconstrainedError", "selected camera"],
    ["SecurityError", "HTTPS"],
  ])("explains %s distinctly", (name, text) => {
    expect(cameraError(new DOMException("test fixture", name))).toContain(text);
  });
  it("stops every media track", () => {
    const one = vi.fn(),
      two = vi.fn();
    stopTracks({
      getTracks: () => [{ stop: one }, { stop: two }],
    } as unknown as MediaStream);
    expect(one).toHaveBeenCalledOnce();
    expect(two).toHaveBeenCalledOnce();
  });
  it("projects returned normalized boxes through contain letterboxing and mirroring", () => {
    const box = [0.1, 0.2, 0.4, 0.6];
    const normal = projectBox(box, 1000, 1000, 1920, 1080, false),
      mirror = projectBox(box, 1000, 1000, 1920, 1080, true);
    expect(normal.x).toBeCloseTo(100);
    expect(normal.y).toBeCloseTo(331.25);
    expect(normal.width).toBeCloseTo(300);
    expect(normal.height).toBeCloseTo(225);
    expect(mirror.x).toBeCloseTo(600);
    expect(mirror.y).toBe(normal.y);
    const portrait = projectBox([0, 0, 1, 1], 640, 360, 720, 1280);
    expect(portrait.width).toBeCloseTo(202.5);
    expect(portrait.x).toBeCloseTo(218.75);
  });
  it("only calls an actual tiger output Tiger and gives person ignore priority", () => {
    expect(detectionStatus([fixture("Tiger")])).toBe("Tiger detected");
    expect(detectionStatus([fixture("Leopard")])).toBe(
      "Animal detected (species not determined)",
    );
    expect(detectionStatus([fixture("Tiger"), fixture("Person")])).toBe(
      "Person detected, ignored",
    );
    expect(detectionStatus([])).toBe("No animal detected in this frame");
  });
  it("puts the exact detector disclaimer beside a raw detector score", () => {
    const { container } = render(<DetectorScore score={0.8123} />);
    expect(container.textContent).toContain("0.8123");
    expect(container.textContent).toContain(DETECTOR_SCORE_NOTE);
    expect(container.textContent).not.toContain("%");
  });
  it("never overlaps requests, queues frames, or leaves an unaborted job when stopped", async () => {
    vi.useFakeTimers();
    let release: () => void = () => {};
    let signal: AbortSignal | undefined;
    const task = vi.fn((s: AbortSignal) => {
      signal = s;
      return new Promise<void>((r) => {
        release = r;
      });
    });
    const loop = new SerialFrameLoop(task, vi.fn());
    loop.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(task).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(800);
    expect(task).toHaveBeenCalledTimes(2);
    loop.stop();
    expect(signal?.aborted).toBe(true);
    release();
    await vi.advanceTimersByTimeAsync(9000);
    expect(task).toHaveBeenCalledTimes(2);
  });
  it("backs off on 429 and repeated network errors", async () => {
    vi.useFakeTimers();
    const errors = vi.fn();
    const task = vi
      .fn()
      .mockRejectedValueOnce(new ApiError("test-only rate limit", 429, 3))
      .mockRejectedValue(new Error("test-only network failure"));
    const loop = new SerialFrameLoop(task, errors);
    loop.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(errors.mock.calls[0][1]).toBe(3000);
    await vi.advanceTimersByTimeAsync(2999);
    expect(task).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(errors.mock.calls[1][1]).toBe(2000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(errors.mock.calls[2][1]).toBe(4000);
    await vi.advanceTimersByTimeAsync(4000);
    expect(errors.mock.calls[3][1]).toBe(8000);
    loop.stop();
  });
});
