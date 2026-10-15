import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
async function ready(page: any) {
  await page.goto("/identify");
  await expect(page.getByText("Backend connected")).toBeVisible();
  await expect(page.locator(".dataset-tile")).toHaveCount(32);
}
test("real tiger query, source metadata, crop, UNKNOWN, top-five comparison, review, undo and export", async ({
  page,
}) => {
  await ready(page);
  await expect(
    page.getByRole("heading", { name: "Compare tiger photographs" }),
  ).toBeVisible();
  await expect(page.locator(".query-image img")).toBeVisible();
  await page.getByRole("button", { name: "Animal crop" }).click();
  await expect(
    page.getByRole("button", { name: "Full photograph" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Compare Image", exact: true })
    .click();
  await expect(page.locator(".result-summary h3")).toHaveText("UNKNOWN");
  await expect(page.locator(".candidate-row")).toHaveCount(5);
  await expect(
    page.getByRole("heading", { name: "Visual similarity candidates" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No reliable match established" }),
  ).toBeVisible();
  await expect(page.locator(".reference-comparisons > figure")).toHaveCount(5);
  await expect(page.locator(".comparison-query")).toContainText("Frame_0.jpg");
  await expect(page.locator(".comparison-query")).toContainText(
    "train/images/Frame_0.jpg",
  );
  await expect(page.locator(".comparison-query")).toContainText(
    "Source dimensions",
  );
  const scores = page.locator("[data-similarity-score]");
  await expect(scores).toHaveCount(10);
  for (const score of await scores.all())
    await expect(score).toContainText(
      "Similarity indicates visual resemblance, not verified individual identity.",
    );
  await page
    .getByRole("button", {
      name: "Enlarge tiger query photograph",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("dialog", {
      name: "Enlarged tiger query photograph",
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/GZCD|Grevy|zebra|CA_score|viewpoint/i);
  await page.locator(".candidate-row").nth(1).click();
  await page.getByRole("button", { name: "Zoom all images" }).click();
  await expect(page.locator(".compare-images")).toHaveClass(/zoomed/);
  await page
    .getByRole("button", { name: "Visually similar", exact: true })
    .click();
  await expect(page.locator(".review-feedback")).toContainText(
    "not an identity confirmation",
  );
  await page.getByRole("button", { name: "Reject", exact: true }).click();
  await page.getByRole("button", { name: "Uncertain", exact: true }).click();
  await page.getByRole("button", { name: "Undo last review" }).click();
  await expect(page.locator(".review-feedback")).toContainText("undone");
  await page.getByRole("link", { name: "Review History", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  const s = fs.readFileSync((await (await dl).path())!, "utf8");
  const rows = JSON.parse(s);
  expect(rows).toHaveLength(2);
  expect(
    rows.every(
      (r: any) =>
        r.request_id &&
        r.retrieval_ranking.length === 5 &&
        r.ground_truth_identity === null &&
        r.ground_truth_source === null &&
        r.human_review_decision === r.action,
    ),
  ).toBe(true);
  expect(
    rows.every(
      (r: any) =>
        r.review_scope === "visual_similarity_only" &&
        r.candidate_identity === null,
    ),
  ).toBe(true);
  expect(s).not.toMatch(
    /latitude|longitude|gps_lat|data:image|image_url|notes/,
  );
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  const csv = fs.readFileSync((await (await csvDownload).path())!, "utf8");
  expect(csv).toContain("retrieval_ranking");
  expect(csv).toContain("ground_truth_source");
  expect(csv).toContain("human_review_decision");
  expect(csv).not.toContain("[object Object]");
  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Clear session data" }).click();
  await expect(page.getByText("No visual reviews yet.")).toBeVisible();
  await page.getByRole("link", { name: "Evaluation", exact: true }).click();
  await expect(page.locator(".recorded-rankings tbody tr")).toHaveCount(0);
  await page.locator(".sample-evaluation summary").click();
  const emptyDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "JSON", exact: true }).click();
  expect(
    JSON.parse(fs.readFileSync((await (await emptyDownload).path())!, "utf8")),
  ).toEqual([]);
});
test("upload validation, preview, remove, loading and cancel", async ({
  page,
}) => {
  await ready(page);
  const input = page.getByLabel("Upload query image");
  await input.setInputFiles({
    name: "bad.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg/>"),
  });
  await expect(page.getByRole("alert")).toContainText("Choose a JPG");
  await input.setInputFiles({
    name: "large.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(8388609),
  });
  await expect(page.getByRole("alert")).toContainText("8 MiB");
  const image = fs
    .readdirSync("data/tiger-subset/media")
    .find((f) => !f.includes("crop"))!;
  await input.setInputFiles("data/tiger-subset/media/" + image);
  await expect(page.getByAltText("Uploaded tiger query preview")).toBeVisible();
  await page
    .getByRole("button", { name: "Compare Image", exact: true })
    .click();
  await expect(page.locator(".candidate-row")).toHaveCount(5);
  await expect(page.locator(".comparison-query .source-filename b")).toHaveText(
    image,
  );
  await expect(page.locator(".comparison-query")).toContainText("image/jpeg");
  await expect(page.locator(".comparison-query")).toContainText("Upload size");
  await expect(
    page.getByRole("heading", { name: "No reliable match established" }),
  ).toBeVisible();

  await page.route("**/api/analyze", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.abort();
  });
  await page
    .getByRole("button", { name: "Compare Image", exact: true })
    .click();
  await expect(page.getByText("Comparing tiger photographs")).toBeVisible();
  await page.getByRole("button", { name: "Cancel comparison" }).click();
  await expect(page.getByRole("alert")).toContainText("cancelled");
  await page.getByRole("button", { name: "Remove query" }).click();
  await expect(page.getByText("Add a tiger photograph")).toBeVisible();
});
test("failure, invalid responses and empty results handled honestly", async ({
  page,
}) => {
  await ready(page);
  await page.route("**/api/analyze", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Test backend unavailable" }),
    }),
  );
  await page
    .getByRole("button", { name: "Compare Image", exact: true })
    .click();
  await expect(page.locator(".inline-error")).toContainText(
    "Test backend unavailable",
  );
  await page.route("**/api/analyze", (r) =>
    r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page
    .getByRole("button", { name: "Compare Image", exact: true })
    .click();
  await expect(page.locator(".inline-error")).toContainText("API contract");
  await page.route("**/api/analyze", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        request_id: "test-only",
        timestamp: new Date().toISOString(),
        query_id: "test-only",
        method: "image retrieval",
        model: "test-only",
        dataset_version: "test-only",
        status: "UNKNOWN",
        threshold: null,
        criterion: "Test-only empty references",
        detection: null,
        candidates: [],
        explanation: "Test-only response",
      }),
    }),
  );
  await page
    .getByRole("button", { name: "Compare Image", exact: true })
    .click();
  await expect(
    page.getByText("No reference photographs are available. Identity UNKNOWN."),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "No reliable match established" }),
  ).toBeVisible();
  await expect(page.locator(".candidate-row")).toHaveCount(0);
});
test("tiger gallery selection and manual visual observation log", async ({
  page,
}) => {
  await ready(page);
  await page.getByRole("link", { name: "Tiger Gallery", exact: true }).click();
  await expect(page.locator(".tiger-gallery button")).toHaveCount(32);
  await page
    .getByRole("button", { name: "Compare tiger photograph 3", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Compare tiger photographs" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Evaluation", exact: true }).click();
  await expect(
    page.getByText("Identity evaluation is unavailable."),
  ).toBeVisible();
  await page.getByLabel("Observation photograph").selectOption({ index: 1 });
  await page.getByRole("button", { name: "Record observation" }).click();
  await expect(
    page.getByText("Visual observation added to temporary session."),
  ).toBeVisible();
  await expect(
    page.locator(".table-wrap").last().locator("tbody tr"),
  ).toHaveCount(1);
  await expect(
    page.locator(".table-wrap").last().locator("tbody tr"),
  ).toContainText("Not evaluated");
});
test("info routes, footer, contact hidden and 404", async ({ page }) => {
  for (const [path, title] of [
    ["/about", "About & data"],
    ["/help", "How to compare tiger photographs"],
    ["/privacy", "Privacy notice — draft"],
    ["/responsible", "Responsible use"],
    ["/contact", "Contact & feedback"],
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(page.locator("footer a")).toHaveCount(5);
  }
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  await expect(page.getByText("TODO", { exact: false })).toHaveCount(0);
  await page.goto("/not-a-route");
  await expect(
    page.getByRole("heading", { name: "This page isn’t in the field guide." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Return to Overview" }).click();
  await expect(
    page.getByRole("heading", { name: "Tiger patterns. A closer comparison." }),
  ).toBeVisible();
});
test("axe accessibility on ten tiger routes including comparison results", async ({
  page,
}) => {
  const all: any[] = [];
  for (const path of [
    "/",
    "/identify",
    "/gallery",
    "/history",
    "/evaluation",
    "/about",
    "/help",
    "/privacy",
    "/responsible",
    "/contact",
  ]) {
    await page.goto(path);
    await expect(page.getByText("Backend connected")).toBeVisible();
    if (path === "/identify") {
      await expect(page.locator(".dataset-tile")).toHaveCount(32);
      await page
        .getByRole("button", { name: "Compare Image", exact: true })
        .click();
      await expect(page.locator(".candidate-row")).toHaveCount(5);
    }
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    all.push({ path, violations: results.violations });
  }
  fs.writeFileSync(
    "docs/accessibility-results.json",
    JSON.stringify(all, null, 2),
  );
  expect(
    all.flatMap((x) =>
      x.violations.map((v: any) => ({
        path: x.path,
        id: v.id,
        nodes: v.nodes.map((n: any) => n.target),
      })),
    ),
  ).toEqual([]);
});
test("390px mobile navigation and no horizontal page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "/",
    "/identify",
    "/gallery",
    "/history",
    "/evaluation",
    "/about",
  ]) {
    await page.goto(path);
    await expect(page.getByText("Backend connected")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Compare Tigers", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Compare tiger photographs" }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/tiger-mobile.png", fullPage: true });
});
test("320px layout and missing photograph fallback", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const path of ["/identify", "/evaluation", "/privacy"]) {
    await page.goto(path);
    await expect(page.getByText("Backend connected")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.route("**/api/media/**", (r) => r.abort());
  await page.goto("/identify");
  await expect(page.locator(".image-missing").first()).toBeVisible();
  await expect(page.locator(".topbar")).toBeInViewport();
});
test("dataset failure does not falsely mark healthy backend offline and retry recovers", async ({
  page,
}) => {
  await page.route("**/api/dataset", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Tiger cache unavailable" }),
    }),
  );
  await page.goto("/identify");
  await expect(page.getByText("Backend connected")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Tiger cache unavailable",
  );
  await page.unroute("**/api/dataset");
  await page.getByRole("button", { name: "Retry connection" }).click();
  await expect(page.locator(".dataset-tile")).toHaveCount(32);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("rejects a wrong-species backend response instead of relabelling animals as tigers", async ({
  page,
}) => {
  const source = JSON.parse(
    fs.readFileSync("data/tiger-subset/manifest.json", "utf8"),
  );
  source.records[0].species = "Wrong species";
  await page.route("**/api/dataset", (r) =>
    r.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(source),
    }),
  );
  await page.goto("/identify");
  await expect(page.getByRole("alert")).toContainText("API contract");
  await expect(page.locator(".dataset-tile")).toHaveCount(0);
  await expect(page.getByText("Backend connected")).toBeVisible();
});

const noTruth =
  "No individual-level ground truth available. Re-identification accuracy cannot be computed.";
const disclaimer =
  "Similarity indicates visual resemblance, not verified individual identity.";
test("fewer than five references, absent filenames/metadata and full-image fallback", async ({
  page,
}) => {
  await ready(page);
  const id = JSON.parse(
    fs.readFileSync("data/tiger-subset/manifest.json", "utf8"),
  ).records[0].id;
  const result = await (
    await page.request.post("/api/analyze", { form: { record_id: id } })
  ).json();
  result.candidates = result.candidates.slice(0, 2);
  for (const c of result.candidates)
    for (const key of [
      "source_filename",
      "source_path",
      "source_split",
      "source_annotation_path",
      "width",
      "height",
      "bbox",
      "datetime",
      "viewpoint",
      "manual",
      "crop_url",
    ])
      delete c[key];
  await page.route("**/api/analyze", (r) => r.fulfill({ json: result }));
  await page
    .getByRole("button", { name: "Compare Image", exact: true })
    .click();
  await expect(page.locator(".candidate-row")).toHaveCount(2);
  const refs = page.locator(".reference-comparisons > figure");
  await expect(refs).toHaveCount(2);
  for (const ref of await refs.all()) {
    await expect(ref.locator(".source-filename")).toHaveCount(0);
    await expect(ref.locator("dt")).toHaveText(["Species"]);
    await expect(ref.locator("[data-similarity-score]")).toContainText(
      disclaimer,
    );
    await expect(ref.locator(".enlarge-image img")).toBeVisible();
    expect(await ref.innerText()).not.toMatch(
      /undefined|null|not available|missing filename/i,
    );
  }
  await expect(refs.first().locator(".enlarge-image img")).toHaveAttribute(
    "src",
    result.candidates[0].image_url,
  );
});
test("invalid candidate and missing result state never produce reviewable candidates", async ({
  page,
}) => {
  await ready(page);
  const id = JSON.parse(
    fs.readFileSync("data/tiger-subset/manifest.json", "utf8"),
  ).records[0].id;
  const result = await (
    await page.request.post("/api/analyze", { form: { record_id: id } })
  ).json();
  for (const bad of [
    { ...result, candidates: undefined },
    { ...result, candidates: [{ ...result.candidates[0], score: null }] },
    { ...result, candidates: [{ ...result.candidates[0], rank: 99 }] },
    {
      ...result,
      candidates: [
        { ...result.candidates[0], source_path: { invalid: "object" } },
      ],
    },
    {
      ...result,
      detection: {
        source: "invalid media fixture",
        bbox: [0, 0, 10, 10],
        crop_url: "https://invalid.example/image.jpg",
      },
    },
  ]) {
    await page.route("**/api/analyze", (r) => r.fulfill({ json: bad }));
    await page
      .getByRole("button", { name: "Compare Image", exact: true })
      .click();
    await expect(page.locator(".inline-error")).toContainText("API contract");
    await expect(
      page.getByRole("heading", { name: "No reliable match established" }),
    ).toBeVisible();
    await expect(page.locator(".candidate-row")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Visually similar", exact: true }),
    ).toHaveCount(0);
  }
});
test("recorded ranking, ground truth and human decision stay separate in evaluation and downloads", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("button", { name: "Compare Image", exact: true })
    .click();
  await expect(page.locator(".candidate-row")).toHaveCount(5);
  await page.getByRole("button", { name: "Uncertain", exact: true }).click();
  await page.getByRole("link", { name: "Evaluation", exact: true }).click();
  await expect(page.getByText(noTruth, { exact: true })).toBeVisible();
  await expect(page.locator(".recorded-rankings tbody tr")).toHaveCount(5);
  await expect(
    page.locator(".recorded-rankings tbody tr").first(),
  ).toContainText("Uncertain");
  for (const score of await page.locator("[data-similarity-score]").all())
    await expect(score).toContainText(disclaimer);
  await page.locator(".sample-evaluation summary").click();
  await expect(
    page.getByText("SAMPLE / ILLUSTRATIVE ONLY", { exact: true }),
  ).toBeVisible();
  for (const format of ["JSON", "CSV"]) {
    const waiting = page.waitForEvent("download");
    await page.getByRole("button", { name: format, exact: true }).click();
    const content = fs.readFileSync((await (await waiting).path())!, "utf8");
    expect(content).not.toMatch(
      /illustrative|sample|data:image|image_url|notes|query_filename|source_filename/i,
    );
    expect(content).toContain("retrieval_rank");
    expect(content).toContain("ground_truth_identity");
    expect(content).toContain("ground_truth_source");
    expect(content).toContain("human_review_decision");
    if (format === "JSON") {
      const rows = JSON.parse(content);
      expect(rows).toHaveLength(5);
      expect(rows[0].human_review_decision).toBe("uncertain");
      expect(
        rows.every(
          (r: any) =>
            r.ground_truth_identity === null &&
            r.ground_truth_source === null &&
            r.identity_status === "UNKNOWN",
        ),
      ).toBe(true);
    }
  }
});
test("dataset information is source-backed and redistribution limitations visible", async ({
  page,
}) => {
  await page.goto("/about");
  const section = page.locator(".dataset-information");
  await expect(section).toContainText("32 photographs");
  await expect(section).toContainText("license: agpl-3.0");
  await expect(section).toContainText("100 training and 53 validation");
  await expect(section).toContainText(
    "Ultralytics Tiger-pose is a specialized dataset aimed at the pose estimation of tigers.",
  );
  await expect(section).toContainText("redistribution terms before publishing");
  await expect(section.locator("a")).toHaveAttribute(
    "href",
    "https://huggingface.co/datasets/Ultralytics/Tiger-pose",
  );
});
test("320px populated comparison, enlarged photo, evaluation and reduced motion have no page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  await page
    .getByRole("button", { name: "Compare Image", exact: true })
    .click();
  await expect(page.locator(".reference-comparisons > figure")).toHaveCount(5);
  const fits = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  expect(await fits()).toBe(true);
  await page
    .getByRole("button", {
      name: "Enlarge tiger query photograph",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await fits()).toBe(true);
  await page.getByRole("button", { name: "Close enlarged image" }).click();
  await page.screenshot({
    path: "docs/targeted-comparison-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle navigation" }).click();
  await page.getByRole("link", { name: "Evaluation", exact: true }).click();
  await expect(page.locator(".recorded-rankings tbody tr")).toHaveCount(5);
  await page.locator(".sample-evaluation summary").click();
  expect(await fits()).toBe(true);
});

test("missing comparison media has a textual fallback, and populated evaluation/dialog pass axe", async ({
  page,
}) => {
  await ready(page);
  await page
    .getByRole("button", { name: "Compare Image", exact: true })
    .click();
  await expect(page.locator(".candidate-row")).toHaveCount(5);
  await page
    .getByRole("button", {
      name: "Enlarge tiger query photograph",
      exact: true,
    })
    .click();
  let audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  fs.writeFileSync(
    "docs/targeted-accessibility-results.json",
    JSON.stringify(audit.violations, null, 2),
  );
  expect(
    audit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Uncertain", exact: true }).click();
  await page.getByRole("link", { name: "Evaluation", exact: true }).click();
  await page.locator(".sample-evaluation summary").click();
  audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  fs.writeFileSync(
    "docs/targeted-accessibility-results.json",
    JSON.stringify(audit.violations, null, 2),
  );
  expect(
    audit.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  await page.getByRole("link", { name: "Compare Tigers", exact: true }).click();
  await page.route("**/api/media/**", (r) => r.abort());
  await page
    .getByRole("button", { name: "Compare Image", exact: true })
    .click();
  await expect(
    page.locator(".reference-comparisons .image-missing"),
  ).toHaveCount(5);
  await expect(
    page.getByRole("button", {
      name: "Enlarge tiger reference photograph ranked 1",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "No reliable match established" }),
  ).toBeVisible();
});
