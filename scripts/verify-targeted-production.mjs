/** Production-only smoke check. Requires npm run build and FastAPI on port 8000. */
import { chromium, expect } from "@playwright/test";
import fs from "node:fs";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  baseURL: "http://127.0.0.1:8000",
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [],
  external = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (r) => {
  if (/^https?:/.test(r.url()) && !r.url().startsWith("http://127.0.0.1:8000/"))
    external.push(r.url());
});
try {
  const healthResponse = await page.request.get("/api/health");
  const health = await healthResponse.json();
  expect(health.status).toBe("ok");
  expect(health.dataset.records).toBe(32);
  expect(health.model_loaded).toBe(false);
  expect(health.threshold).toBeNull();
  const navigation = await page.goto("/identify");
  expect(navigation.status()).toBe(200);
  expect(navigation.headers()["content-security-policy"]).toContain(
    "script-src 'self'",
  );
  expect(navigation.headers()["referrer-policy"]).toBe("no-referrer");
  await expect(page.locator(".dataset-tile")).toHaveCount(32);
  const waiting = page.waitForResponse(
    (r) => r.url().endsWith("/api/analyze") && r.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Compare Image", exact: true })
    .click();
  const response = await waiting;
  expect(response.status()).toBe(200);
  const analysis = await response.json();
  expect(analysis.status).toBe("UNKNOWN");
  expect(analysis.candidates).toHaveLength(5);
  await expect(page.locator(".reference-comparisons > figure")).toHaveCount(5);
  await expect(
    page.getByRole("heading", { name: "Visual similarity candidates" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No reliable match established" }),
  ).toBeVisible();
  const photos = page.locator(".comparison-collection .enlarge-image img");
  await expect(photos).toHaveCount(6);
  for (const photo of await photos.all())
    await expect
      .poll(() => photo.evaluate((i) => i.complete && i.naturalWidth > 0))
      .toBeTruthy();
  await expect(
    page
      .locator(".reference-comparisons [data-similarity-score] strong")
      .first(),
  ).toHaveText(analysis.candidates[0].score.toFixed(4));
  for (const score of await page.locator("[data-similarity-score]").all())
    await expect(score).toContainText(
      "Similarity indicates visual resemblance, not verified individual identity.",
    );
  await page.screenshot({ path: "docs/tiger-workspace.png", fullPage: true });
  await page
    .locator(".comparison")
    .screenshot({ path: "docs/targeted-comparison-desktop.png" });
  await page
    .getByRole("button", {
      name: "Enlarge tiger query photograph",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Uncertain", exact: true }).click();
  await page.getByRole("link", { name: "Evaluation", exact: true }).click();
  await expect(page.locator(".recorded-rankings tbody tr")).toHaveCount(5);
  await expect(
    page.getByText(
      "No individual-level ground truth available. Re-identification accuracy cannot be computed.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.locator(".sample-evaluation summary").click();
  await page.screenshot({
    path: "docs/targeted-evaluation-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "About & Data", exact: true })
    .first()
    .click();
  await expect(page.locator(".dataset-information")).toContainText(
    "32 photographs",
  );
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  const evidence = {
    production_origin: "http://127.0.0.1:8000",
    build_assets: fs.readdirSync("dist/assets"),
    health_status: health.status,
    photographs: 32,
    returned_candidates: 5,
    loaded_comparison_photographs: 6,
    descriptor: analysis.model,
    method: analysis.method,
    identity_status: analysis.status,
    threshold: analysis.threshold,
    source_filenames: analysis.candidates.map((c) => c.source_filename),
    score_values_equal_backend_response: true,
    recorded_evaluation_rows: 5,
    source_metadata_present: true,
    csp_and_no_referrer: true,
    external_runtime_requests: external,
    page_errors: errors,
    result: "PASS",
  };
  fs.writeFileSync(
    "docs/targeted-production-smoke.json",
    JSON.stringify(evidence, null, 2) + "\n",
  );
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser.close();
}
