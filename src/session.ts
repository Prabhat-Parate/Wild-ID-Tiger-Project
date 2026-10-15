import type { Analysis } from "./api";
export interface RankingEntry {
  rank: number;
  reference_id: string;
  score: number;
  method: string;
  descriptor: string;
}
export interface SessionRetrieval {
  analysis: Analysis;
  query_filename?: string;
}
export interface Review {
  detection_evidence: {
    source: string;
    label: string | null;
    detector_score: number | null;
    detector_version: string | null;
  } | null;
  request_id: string;
  retrieval_ranking: RankingEntry[];
  retrieval_rank: number | null;
  retrieval_score: number | null;
  ground_truth_source: null;
  human_review_decision: "confirm" | "reject" | "uncertain";
  review_scope: "visual_similarity_only";
  id: string;
  timestamp: string;
  query_id: string;
  candidate_id: string | null;
  candidate_identity: string | null;
  ground_truth_identity: string | null;
  candidate_ids: string[];
  scores: number[];
  method: string;
  model: string;
  dataset_version: string;
  result_status: string;
  action: "confirm" | "reject" | "uncertain";
  notes: string;
}
export function reviewRecord(
  a: Analysis,
  candidateId: string | null,
  action: Review["action"],
  _unverifiedTruth: string | null,
  notes: string,
): Review {
  const c = a.candidates.find((c) => c.id === candidateId);
  return {
    detection_evidence: a.detection
      ? {
          source: a.detection.source,
          label: a.detection.label ?? null,
          detector_score: a.detection.detector_score ?? null,
          detector_version: a.detection.detector_version ?? null,
        }
      : null,
    request_id: a.request_id,
    retrieval_ranking: a.candidates.map((c) => ({
      rank: c.rank,
      reference_id: c.id,
      score: c.score,
      method: a.method,
      descriptor: a.model,
    })),
    retrieval_rank: c?.rank ?? null,
    retrieval_score: c?.score ?? null,
    ground_truth_source: null,
    human_review_decision: action,
    review_scope: "visual_similarity_only",
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    query_id: a.query_id,
    candidate_id: c?.id || null,
    candidate_identity: c?.individual_id || null,
    ground_truth_identity: null, // This pose-only source has no validated individual ground truth.
    candidate_ids: a.candidates.map((c) => c.id),
    scores: a.candidates.map((c) => c.score),
    method: a.method,
    model: a.model,
    dataset_version: a.dataset_version,
    result_status: a.status,
    action,
    notes: clean(notes),
  };
}
export const clean = (s: string) =>
  s.replace(/[\u0000-\u001f<>]/g, "").slice(0, 1000);
export function serialize(rows: object[], type: "csv" | "json") {
  if (type === "json") return JSON.stringify(rows, null, 2);
  if (!rows.length) return "id,timestamp\r\n";
  const keys = Array.from(new Set(rows.flatMap(Object.keys)));
  const escape = (x: unknown) => {
    let s = Array.isArray(x)
      ? x.some((v) => typeof v === "object")
        ? JSON.stringify(x)
        : x.join(";")
      : x && typeof x === "object"
        ? JSON.stringify(x)
        : String(x ?? "");
    if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  return [
    keys.map(escape).join(","),
    ...rows.map((r) =>
      keys.map((k) => escape((r as { [key: string]: unknown })[k])).join(","),
    ),
  ].join("\r\n");
}
export function download(rows: object[], name: string, type: "csv" | "json") {
  const url = URL.createObjectURL(
    new Blob([serialize(rows, type)], {
      type: type === "json" ? "application/json" : "text/csv;charset=utf-8",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `wild-id-${name}.${type}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function validateFile(f: File, max = 8 * 1024 * 1024) {
  if (
    !/\.(jpe?g|png)$/i.test(f.name) ||
    !["image/jpeg", "image/png"].includes(f.type)
  )
    return "Choose a JPG, JPEG or PNG image.";
  if (f.size > max) return "Image exceeds the 8 MiB upload limit.";
  if (!f.size) return "The selected file is empty.";
  return null;
}

// Flat, explicit export columns; never include images, free-text notes or source filenames.
export function evaluationRankingRows(
  retrievals: SessionRetrieval[],
  reviews: Review[],
) {
  return retrievals.flatMap(({ analysis: a }) =>
    (a.candidates.length ? a.candidates : [null]).map((c) => ({
      record_type: "recorded_image_retrieval",
      request_id: a.request_id,
      timestamp: a.timestamp,
      query_id: a.query_id,
      reference_id: c?.id ?? null,
      retrieval_rank: c?.rank ?? null,
      retrieval_score: c?.score ?? null,
      retrieval_method: a.method,
      descriptor: a.model,
      dataset_version: a.dataset_version,
      detection_source: a.detection?.source ?? null,
      detection_label: a.detection?.label ?? null,
      detector_score: a.detection?.detector_score ?? null,
      detector_version: a.detection?.detector_version ?? null,
      ground_truth_identity: null,
      ground_truth_source: null,
      identity_status: "UNKNOWN",
      human_review_decision:
        reviews.find(
          (r) =>
            r.request_id === a.request_id && r.candidate_id === (c?.id ?? null),
        )?.human_review_decision ?? null,
    })),
  );
}
