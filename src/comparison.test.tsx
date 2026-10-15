import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import {
  ImageMetadata,
  SimilarityScore,
  sourceFilename,
  SCORE_DISCLAIMER,
} from "./Comparison";
import { evaluationRankingRows, reviewRecord, serialize } from "./session";
import type { Analysis } from "./api";
afterEach(cleanup);
describe("source metadata and scientific score labels", () => {
  it("derives the real basename and never substitutes an internal ID", () => {
    expect(
      sourceFilename({
        source_path: "train/images/Frame_0.jpg",
        id: "internal",
      }),
    ).toBe("Frame_0.jpg");
    expect(sourceFilename({ id: "internal" })).toBeUndefined();
  });
  it("omits missing filename and optional metadata rather than making placeholders", () => {
    const { container } = render(<ImageMetadata record={{ id: "internal" }} />);
    expect(container.textContent).toBe("");
  });
  it("rejects malformed optional box and dimensions without crashing", () => {
    const { container } = render(
      <ImageMetadata record={{ bbox: [NaN, 1, 2, 3], width: 0, height: 0 }} />,
    );
    expect(container.textContent).toBe("");
  });
  it("puts the exact disclaimer and relative-ranking meaning beside every rendered score", () => {
    const { container } = render(<SimilarityScore score={0.812345} />);
    expect(container.textContent).toContain("0.8123");
    expect(container.textContent).toContain(SCORE_DISCLAIMER);
    expect(container.textContent).toContain("not a probability");
  });
});
const analysis = {
  request_id: "actual-request",
  timestamp: "2026-10-15",
  query_id: "query",
  method: "image retrieval",
  model: "descriptor",
  dataset_version: "sha",
  status: "UNKNOWN",
  threshold: null,
  candidates: [{ id: "ref", rank: 1, score: 0.8, individual_id: null }],
} as Analysis;
describe("separate recorded ranking, unknown ground truth and human review", () => {
  it("exports the actual rank and decision without converting review into ground truth", () => {
    const review = reviewRecord(
      analysis,
      "ref",
      "confirm",
      "unvalidated claim",
      "private note",
    );
    expect(review.ground_truth_identity).toBeNull();
    expect(review.ground_truth_source).toBeNull();
    expect(review.retrieval_ranking[0].rank).toBe(1);
    const rows = evaluationRankingRows(
      [{ analysis, query_filename: "private.jpg" }],
      [review],
    );
    expect(rows[0]).toMatchObject({
      retrieval_rank: 1,
      retrieval_score: 0.8,
      ground_truth_identity: null,
      ground_truth_source: null,
      human_review_decision: "confirm",
      identity_status: "UNKNOWN",
    });
    expect(JSON.stringify(rows)).not.toMatch(/private|sample|notes/);
    expect(serialize([review], "csv")).not.toContain("[object Object]");
  });
  it("keeps empty retrievals distinct and never adds illustrative rows", () => {
    expect(evaluationRankingRows([], [])).toEqual([]);
    expect(
      evaluationRankingRows(
        [{ analysis: { ...analysis, candidates: [] } }],
        [],
      )[0],
    ).toMatchObject({
      retrieval_rank: null,
      retrieval_score: null,
      ground_truth_identity: null,
      human_review_decision: null,
    });
  });
});
