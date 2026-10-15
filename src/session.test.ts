import { describe, it, expect } from "vitest";
import { validateFile, serialize, clean, reviewRecord } from "./session";
import type { Analysis } from "./api";
describe("file validation", () => {
  it("accepts JPG and PNG", () => {
    expect(
      validateFile(new File(["x"], "a.jpg", { type: "image/jpeg" })),
    ).toBeNull();
    expect(
      validateFile(new File(["x"], "a.png", { type: "image/png" })),
    ).toBeNull();
  });
  it("rejects invalid type and extension", () => {
    expect(
      validateFile(new File(["x"], "a.svg", { type: "image/svg+xml" })),
    ).toMatch(/JPG/);
  });
  it("rejects oversized and empty files", () => {
    expect(
      validateFile(new File(["123"], "a.jpg", { type: "image/jpeg" }), 2),
    ).toMatch(/limit/);
    expect(validateFile(new File([], "a.png", { type: "image/png" }))).toMatch(
      /empty/,
    );
  });
});
describe("safe session export", () => {
  it("exports valid JSON", () => {
    expect(
      JSON.parse(serialize([{ id: "x", action: "confirm" }], "json"))[0].action,
    ).toBe("confirm");
  });
  it("escapes CSV quotes and formulas", () => {
    const s = serialize([{ id: "=danger", action: 'a"b' }], "csv");
    expect(s).toContain("'=danger");
    expect(s).toContain('a""b');
  });
  it("handles empty records", () => {
    expect(serialize([], "csv")).toContain("id,timestamp");
  });
  it("cleans markup/control characters", () => {
    expect(clean("<x>\u0000")).toBe("x");
  });
});
describe("review semantics", () => {
  it("records a visual review without inventing an animal identity", () => {
    const a = {
      candidates: [{ id: "ref", individual_id: null, score: 0.8 }],
      query_id: "query",
      method: "image retrieval",
      model: "baseline",
      dataset_version: "sha",
      status: "UNKNOWN",
    } as Analysis;
    const r = reviewRecord(a, "ref", "confirm", null, "note");
    expect(r.ground_truth_identity).toBeNull();
    expect(r.candidate_identity).toBeNull();
    expect(r.review_scope).toBe("visual_similarity_only");
    expect(r.result_status).toBe("UNKNOWN");
    expect(r.action).toBe("confirm");
  });
});
