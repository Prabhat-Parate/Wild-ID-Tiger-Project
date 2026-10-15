import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
const manifest = JSON.parse(
  fs.readFileSync("data/tiger-subset/manifest.json", "utf8"),
);
const tigerPath = `data/source/tiger/originals/${manifest.records[0].id}.jpg`;
const scoreNote =
  "Detector score is not a probability and not a measure of accuracy. Detection does not identify individual animals.";
async function ready(page: any) {
  await page.goto("/detect");
  await expect(
    page.getByText("Backend connected", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Detect an animal", exact: true }),
  ).toBeVisible();
}
async function trackStreams(page: any) {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    (window as any).__streams = [];
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      (window as any).__streams.push(stream);
      return stream;
    };
  });
}
const allStopped = (page: any) =>
  page.evaluate(() =>
    (window as any).__streams.every((s: MediaStream) =>
      s.getTracks().every((t) => t.readyState === "ended"),
    ),
  );
const fixture = (labels: string[]) => ({
  detections: labels.map((label, i) => ({
    label,
    score: 0.8 - i * 0.1,
    bbox: [0.1 + i * 0.15, 0.2, 0.4 + i * 0.15, 0.7],
    image_width: 1280,
    image_height: 720,
  })),
  detector: "TEST FIXTURE ONLY (not model results)",
  detector_version: "test-only",
  timestamp: "2026-10-15T00:00:00Z",
  latency_ms: 20,
  request_id: "test-fixture",
  score_cutoff: 0.25,
  cutoff_basis: "configurable heuristic, not validated",
});

test("REAL local detector through Chromium FAKE camera (real tiger photo fixture), overlay and explicit capture-to-comparison", async ({
  page,
}) => {
  await trackStreams(page);
  await ready(page);
  expect(await page.evaluate(() => (window as any).__streams.length)).toBe(0);
  const response = page.waitForResponse(
    (r: any) => r.url().endsWith("/api/detect") && r.status() === 200,
  );
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  const body = await (await response).json();
  expect(body.detections.some((d: any) => d.label === "Tiger")).toBe(true);
  await expect(page.getByText("Camera on", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tiger detected", exact: true }),
  ).toBeVisible();
  expect(
    await page
      .locator(".detection-overlay")
      .evaluate((canvas: any) =>
        Array.from(
          canvas
            .getContext("2d")
            .getImageData(0, 0, canvas.width, canvas.height).data,
        ).some((n: any, i: number) => i % 4 === 3 && n > 0),
      ),
  ).toBe(true);
  for (const score of await page.locator(".detector-score").all())
    await expect(score).toContainText(scoreNote);
  await page.screenshot({
    path: "docs/detection-fake-camera-test.png",
    fullPage: true,
  });
  const request = page.waitForRequest((r: any) =>
    r.url().endsWith("/api/analyze"),
  );
  await page
    .getByRole("button", {
      name: "Capture and find visual similarity candidates",
      exact: true,
    })
    .click();
  const sent = await request;
  expect(sent.headers()["content-type"]).toContain("multipart/form-data");
  await expect(page).toHaveURL(/\/identify$/);
  await expect.poll(() => allStopped(page)).toBe(true);
  await expect(page.locator(".candidate-row")).toHaveCount(5);
  await expect(page.locator(".comparison-detection-evidence")).toContainText(
    "YOLOv8s-World v2",
  );
  await expect(
    page.getByRole("heading", {
      name: "No reliable match established",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.locator(".comparison-query .enlarge-image img"),
  ).toHaveAttribute("src", /^blob:/);
  await page.getByRole("button", { name: "Uncertain", exact: true }).click();
  await page.getByRole("link", { name: "Review History", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const rows = JSON.parse(
    fs.readFileSync((await (await download).path())!, "utf8"),
  );
  expect(rows[0].detection_evidence.source).toContain("YOLOv8s-World");
  expect(rows[0].detection_evidence.detector_score).toBeGreaterThan(0);
  expect(rows[0].ground_truth_identity).toBeNull();
  expect(rows[0].human_review_decision).toBe("uncertain");
  expect(rows[0].retrieval_ranking).toHaveLength(5);
});
test("REAL detector uploaded tiger and empty synthetic sanity frame (not an evaluation negative)", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("button", { name: "Upload a photo", exact: true })
    .click();
  await page.getByLabel("Upload photo for detection").setInputFiles(tigerPath);
  await page.getByRole("button", { name: "Detect photo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tiger detected", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Upload photo for detection")
    .setInputFiles("tests/fixtures/empty-sanity.png");
  await page.getByRole("button", { name: "Detect photo", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "No animal detected in this frame",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".detector-score")).toHaveCount(0);
});
test("fake camera tracks stop on Stop, route change and tab hide; no permission requested on mount", async ({
  page,
}) => {
  await trackStreams(page);
  await page.route("**/api/detect", (r) => r.fulfill({ json: fixture([]) }));
  await ready(page);
  expect(await page.evaluate(() => (window as any).__streams.length)).toBe(0);
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.getByText("Camera on", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  await expect.poll(() => allStopped(page)).toBe(true);
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.getByText("Camera on", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Tiger Gallery", exact: true }).click();
  await expect.poll(() => allStopped(page)).toBe(true);
  await page.getByRole("link", { name: "Detect Animal", exact: true }).click();
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.getByText("Camera on", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByText("Camera off", { exact: true })).toBeVisible();
  await expect.poll(() => allStopped(page)).toBe(true);
});
for (const [name, message] of [
  ["NotAllowedError", "permission denied"],
  ["NotFoundError", "No camera found"],
  ["NotReadableError", "in use by another app"],
])
  test(`camera error TEST FIXTURE ${name} has distinct readable recovery`, async ({
    page,
  }) => {
    await page.addInitScript((name) => {
      navigator.mediaDevices.getUserMedia = () =>
        Promise.reject(new DOMException("TEST FIXTURE ONLY", name));
    }, name);
    await ready(page);
    await page
      .getByRole("button", { name: "Start camera", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(message);
    await expect(
      page.getByRole("button", { name: "Retry camera", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Camera off", { exact: true })).toBeVisible();
  });
test("insecure context TEST FIXTURE blocks permission request and offers HTTPS/upload fix", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: false,
    });
    (window as any).__cameraCalls = 0;
    navigator.mediaDevices.getUserMedia = () => {
      (window as any).__cameraCalls++;
      return Promise.reject(new Error("must not request"));
    };
  });
  await ready(page);
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "requires HTTPS or localhost",
  );
  expect(await page.evaluate(() => (window as any).__cameraCalls)).toBe(0);
});
test("multiple cameras/mirroring via TEST FIXTURE device list, real fake-video streams", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    (window as any).__streams = [];
    (window as any).__choices = [];
    navigator.mediaDevices.enumerateDevices = async () =>
      [
        {
          kind: "videoinput",
          deviceId: "fixture-back",
          label: "Rear TEST FIXTURE",
          groupId: "fixture",
          toJSON: () => ({}),
        },
        {
          kind: "videoinput",
          deviceId: "fixture-front",
          label: "Front TEST FIXTURE",
          groupId: "fixture",
          toJSON: () => ({}),
        },
      ] as MediaDeviceInfo[];
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      (window as any).__choices.push(constraints);
      const stream = await original({ video: true, audio: false });
      (window as any).__streams.push(stream);
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings.bind(track);
      track.getSettings = () => ({
        ...settings(),
        facingMode: JSON.stringify(constraints).includes("fixture-front")
          ? "user"
          : "environment",
      });
      return stream;
    };
  });
  await page.route("**/api/detect", (r) => r.fulfill({ json: fixture([]) }));
  await ready(page);
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.getByLabel("Camera", { exact: true })).toBeVisible();
  await page
    .getByLabel("Camera", { exact: true })
    .selectOption("fixture-front");
  await expect(page.getByLabel("Mirror preview")).toBeChecked();
  expect(
    await page.evaluate(() =>
      (window as any).__streams[0]
        .getTracks()
        .every((t: MediaStreamTrack) => t.readyState === "ended"),
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  await expect.poll(() => allStopped(page)).toBe(true);
});
test("all detection statuses and multi-box selection are honest TEST FIXTURE responses; person capture blocked", async ({
  page,
}) => {
  let labels = ["Tiger", "Animal"];
  let failure = 0;
  let analyzeCalls = 0;
  await page.route("**/api/analyze", (r) => {
    analyzeCalls++;
    return r.abort();
  });
  await page.route("**/api/detect", (r) =>
    failure
      ? r.fulfill({
          status: failure,
          json: {
            detail:
              failure === 503
                ? "Detector unavailable TEST FIXTURE"
                : "TEST FIXTURE detection error",
          },
        })
      : r.fulfill({ json: fixture(labels) }),
  );
  await ready(page);
  await page
    .getByRole("button", { name: "Upload a photo", exact: true })
    .click();
  await page.getByLabel("Upload photo for detection").setInputFiles(tigerPath);
  const run = () =>
    page.getByRole("button", { name: "Detect photo", exact: true }).click();
  await run();
  await expect(page.locator(".detection-picker input")).toHaveCount(2);
  await page.locator(".detection-picker input").nth(1).check();
  await expect(page.locator(".detection-picker input").nth(1)).toBeChecked();
  labels = ["Leopard"];
  await run();
  await expect(
    page.getByRole("heading", {
      name: "Animal detected (species not determined)",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Tiger detected", exact: true }),
  ).toHaveCount(0);
  labels = ["Person", "Tiger"];
  await run();
  await expect(
    page.getByRole("heading", {
      name: "Person detected, ignored",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Capture and find visual similarity candidates",
      exact: true,
    }),
  ).toBeDisabled();
  expect(analyzeCalls).toBe(0);
  labels = [];
  await run();
  await expect(
    page.getByRole("heading", {
      name: "No animal detected in this frame",
      exact: true,
    }),
  ).toBeVisible();
  failure = 503;
  await run();
  await expect(
    page.getByRole("heading", { name: "Detector unavailable", exact: true }),
  ).toBeVisible();
  failure = 500;
  await run();
  await expect(
    page.getByRole("heading", { name: "Detection error", exact: true }),
  ).toBeVisible();
});
test("camera serial requests, 429/network backoff and stop abort (TEST FIXTURE responses)", async ({
  page,
}) => {
  let calls = 0,
    active = 0,
    max = 0;
  const times: number[] = [];
  await page.route("**/api/detect", async (r) => {
    calls++;
    active++;
    max = Math.max(max, active);
    times.push(Date.now());
    try {
      if (calls === 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await r.fulfill({
          status: 429,
          headers: { "Retry-After": "2" },
          json: { detail: "TEST FIXTURE 429" },
        });
      } else await r.abort("failed");
    } finally {
      active--;
    }
  });
  await ready(page);
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Retrying in 2.0 seconds",
  );
  await expect.poll(() => calls, { timeout: 6000 }).toBeGreaterThanOrEqual(2);
  expect(times[1] - times[0]).toBeGreaterThanOrEqual(3400);
  expect(max).toBe(1);
  await expect(
    page.getByRole("heading", { name: "Detection error", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
  const stopped = calls;
  await page.waitForTimeout(2200);
  expect(calls).toBe(stopped);
});
test("positive hold expires by 1.2 seconds after capture, no stale boxes (TEST FIXTURE)", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/detect", (r) =>
    r.fulfill({ json: fixture(calls++ === 0 ? ["Tiger"] : []) }),
  );
  await ready(page);
  await page.getByRole("button", { name: "Start camera", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tiger detected", exact: true }),
  ).toBeVisible();
  await expect.poll(() => calls).toBeGreaterThanOrEqual(2);
  await expect(
    page.getByRole("heading", {
      name: "No animal detected in this frame",
      exact: true,
    }),
  ).toBeVisible({ timeout: 1800 });
  await expect(page.locator(".detection-picker")).toHaveCount(0);
  await page.getByRole("button", { name: "Stop camera", exact: true }).click();
});
test("320px detection layout, keyboard focus, reduced motion and axe (real uploaded detector result)", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await page
    .getByRole("button", { name: "Upload a photo", exact: true })
    .click();
  await page.getByLabel("Upload photo for detection").setInputFiles(tigerPath);
  await page.getByRole("button", { name: "Detect photo", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Tiger detected", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Tab");
  await page.getByRole("button", { name: "Detect photo", exact: true }).focus();
  expect(
    await page
      .getByRole("button", { name: "Detect photo", exact: true })
      .evaluate((e) => getComputedStyle(e).outlineStyle),
  ).not.toBe("none");
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  fs.writeFileSync(
    "docs/detection-accessibility.json",
    JSON.stringify(audit.violations, null, 2),
  );
  expect(
    audit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.screenshot({
    path: "docs/detection-mobile-test.png",
    fullPage: true,
  });
});


test("Identify offers Camera detection without requesting permission on navigation", async ({ page }) => {
  await trackStreams(page);
  await page.goto("/identify");
  await expect(page.getByRole("button", { name: "Upload tiger photo", exact: true })).toBeVisible();
  const option = page.getByRole("link", { name: "Camera detection", exact: true });
  await expect(option).toBeVisible();
  expect(await page.evaluate(() => (window as any).__streams.length)).toBe(0);
  await option.click();
  await expect(page).toHaveURL(/\/detect$/);
  await expect(page.getByRole("button", { name: "Start camera", exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__streams.length)).toBe(0);
});
