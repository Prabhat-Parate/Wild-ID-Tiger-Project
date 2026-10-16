export interface RecordImage {
  id: string;
  image_uuid?: string;
  individual_id: string | null;
  species: string;
  source_path?: string | null;
  source_filename?: string | null;
  source_split?: string | null;
  source_annotation_path?: string | null;
  width?: number | null;
  height?: number | null;
  datetime?: string | null;
  bbox?: number[] | null;
  region_bbox?: number[] | null;
  viewpoint?: string | null;
  CA_score?: number | null;
  manual?: boolean | null;
  split: string;
  role: string;
  withheld_identity: boolean;
  image_url: string;
  crop_url?: string | null;
}
export interface Health {
  detector_loaded: boolean;
  detector_name: string | null;
  detector_version: string | null;
  detector_labels: string[];
  detector_score_cutoff: number | null;
  detector_scope: string;
  detector_setup: string;

  status: string;
  model_loaded: boolean;
  model: string;
  method: string;
  version: string;
  dataset: {
    commit: string | null;
    records: number;
    images: number;
    individuals: number;
    reference_records: number;
  };
  threshold: number | null;
  calibration: string | null;
}
export interface DatasetInformation {
  name: string;
  source_url: string;
  card_license_declaration: string | null;
  attribution_text: string | null;
  included_image_count: number;
  original_image_file_count: number;
  crop_file_count: number;
  source_train_image_count: number;
  source_validation_image_count: number;
}
export interface Dataset {
  information?: DatasetInformation | null;
  source: string;
  commit: string;
  license: string;
  selection: string;
  source_counts: {
    images: number;
    annotations: number;
    identities: number;
    identified_annotations: number;
  };
  records: RecordImage[];
}
export interface Candidate extends RecordImage {
  rank: number;
  score: number;
}
export interface Analysis {
  request_id: string;
  timestamp: string;
  query_id: string;
  method: "image retrieval";
  model: string;
  dataset_version: string;
  status: "CANDIDATE" | "UNKNOWN";
  threshold: number | null;
  criterion: string;
  detection: null | {
    source: string;
    bbox: number[];
    crop_url: string | null;
    normalized_bbox?: number[] | null;
    label?: string | null;
    detector_score?: number | null;
    detector_version?: string | null;
  };
  candidates: Candidate[];
  explanation: string;
}
export interface EvalRow {
  query_id: string;
  expected_identity: string;
  predicted_identity: string;
  score: number;
  withheld_identity: boolean;
  correct_top1: boolean;
  scenario: string;
  accepted: boolean;
  correct_outcome: boolean;
  query_viewpoint?: string | null;
  candidate_viewpoint?: string | null;
}
export interface EvalReport {
  threshold: number | null;
  calibration: string;
  split_method: string;
  validation: EvalRow[];
  test: EvalRow[];
  demo: EvalRow[];
  dataset_commit: string;
}
const BASE =
  (
    import.meta as unknown as { env: { VITE_API_BASE?: string } }
  ).env.VITE_API_BASE?.replace(/\/+$/, "") || "";
export const media = (url: string) => BASE + url;
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter: number = 0,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
export interface FrameDetection {
  label: string;
  display_label?: string | null;
  species_status?: "named" | "undetermined" | "not_on_reference_list";
  score: number;
  bbox: [number, number, number, number];
  image_width: number;
  image_height: number;
  model_name?: string | null;
  model_version?: string | null;
}
export interface SpeciesEntry {
  common_name: string;
  scientific_name: string | null;
  group: string;
  tier: string | null;
  source_urls: string[];
  notes: string;
  detector_label: string | null;
  verification_status?: string;
  detector_supported?: boolean;
  support_flag?: string;
}
export interface SpeciesRegistry {
  title?: string;
  disclaimer: string;
  entry_count_label?: string;
  entry_count?: number;
  camera_detection_limit?: string;
  species: SpeciesEntry[];
  detector_only_labels?: SpeciesEntry[];
  detector_labels?: string[];
}
export interface DetectionResponse {
  detections: FrameDetection[];
  detector: string;
  detector_version: string;
  timestamp: string;
  latency_ms: number;
  request_id: string;
  score_cutoff: number;
  cutoff_basis: string;
}
export const normalizedBox = (
  b: unknown,
): b is [number, number, number, number] =>
  Array.isArray(b) &&
  b.length === 4 &&
  b.every(
    (n) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1,
  ) &&
  b[0] < b[2] &&
  b[1] < b[3];
export async function request<T>(
  path: string,
  options: RequestInit = {},
  guard?: (v: any) => boolean,
  timeoutMs = 28000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;
  try {
    const r = await fetch(BASE + path, { ...options, signal });
    let body: any;
    try {
      body = await r.json();
    } catch {
      throw new Error("Backend returned an invalid response");
    }
    if (!r.ok)
      throw new ApiError(
        typeof body?.detail === "string"
          ? body.detail
          : `Request failed (${r.status})`,
        r.status,
        Math.max(0, Math.min(60, Number(r.headers.get("Retry-After")) || 0)),
      );
    if (guard && !guard(body))
      throw new Error("Backend response does not match the API contract");
    return body as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError")
      throw new Error(
        options.signal?.aborted
          ? "Analysis cancelled"
          : "Request timed out. Retry or check the backend.",
      );
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
const safeMedia = (u: unknown) =>
  typeof u === "string" && /^\/api\/media\/[a-z0-9-]+\.jpg$/.test(u);
const recordShape = (r: any): boolean =>
  r &&
  r.species === "Tiger" &&
  r.individual_id === null &&
  typeof r.id === "string" &&
  r.id.length > 0 &&
  [
    "source_filename",
    "source_path",
    "source_split",
    "source_annotation_path",
    "datetime",
    "viewpoint",
  ].every((k) => r[k] == null || typeof r[k] === "string") &&
  ["width", "height"].every((k) => r[k] == null || Number.isFinite(r[k])) &&
  (r.bbox == null ||
    (Array.isArray(r.bbox) &&
      r.bbox.length === 4 &&
      r.bbox.every(Number.isFinite))) &&
  (r.manual == null || typeof r.manual === "boolean") &&
  safeMedia(r.image_url) &&
  (r.crop_url == null || safeMedia(r.crop_url));
export const api = {
  detect: (file: Blob, filename: string, signal: AbortSignal) => {
    const body = new FormData();
    body.append("file", file, filename);
    return request<DetectionResponse>(
      "/api/detect",
      { method: "POST", body, signal },
      (v) =>
        v &&
        typeof v.detector === "string" &&
        typeof v.detector_version === "string" &&
        typeof v.request_id === "string" &&
        typeof v.timestamp === "string" &&
        Number.isFinite(v.latency_ms) &&
        Array.isArray(v.detections) &&
        v.detections.length <= 20 &&
        v.detections.every(
          (d: any) =>
            typeof d.label === "string" &&
            Number.isFinite(d.score) &&
            d.score >= 0 &&
            d.score <= 1 &&
            normalizedBox(d.bbox) &&
            Number.isInteger(d.image_width) &&
            d.image_width > 0 &&
            Number.isInteger(d.image_height) &&
            d.image_height > 0,
        ),
      10000,
    );
  },
  species: () =>
    request<SpeciesRegistry>(
      "/api/species",
      {},
      (v) => v && Array.isArray(v.species) && typeof v.disclaimer === "string",
    ),
  ready: () =>
    request<{
      ready: boolean;
      detector_loaded: boolean;
      in_flight: number;
      rejected: number;
    }>("/api/ready"),
  health: () =>
    request<Health>(
      "/api/health",
      {},
      (v) =>
        v &&
        typeof v.status === "string" &&
        typeof v.model_loaded === "boolean" &&
        v.dataset &&
        typeof v.dataset.records === "number",
    ),
  dataset: () =>
    request<Dataset>(
      "/api/dataset",
      {},
      (v) => v && Array.isArray(v.records) && v.records.every(recordShape),
    ),
  evaluation: () =>
    request<EvalReport>(
      "/api/evaluation-report",
      {},
      (v) =>
        v &&
        Array.isArray(v.test) &&
        Array.isArray(v.validation) &&
        (v.threshold === null || Number.isFinite(v.threshold)),
    ),
  analyze: (body: FormData, signal: AbortSignal) =>
    request<Analysis>(
      "/api/analyze",
      { method: "POST", body, signal },
      (v) =>
        v &&
        v.status === "UNKNOWN" &&
        [
          "request_id",
          "timestamp",
          "query_id",
          "model",
          "dataset_version",
          "criterion",
          "explanation",
        ].every((k) => typeof v[k] === "string") &&
        v.method === "image retrieval" &&
        (v.detection === null ||
          (v.detection &&
            typeof v.detection.source === "string" &&
            Array.isArray(v.detection.bbox) &&
            v.detection.bbox.length === 4 &&
            v.detection.bbox.every(Number.isFinite) &&
            (safeMedia(v.detection.crop_url) ||
              (v.detection.crop_url === null &&
                normalizedBox(v.detection.normalized_bbox) &&
                typeof v.detection.label === "string" &&
                Number.isFinite(v.detection.detector_score) &&
                v.detection.detector_score >= 0 &&
                v.detection.detector_score <= 1 &&
                typeof v.detection.detector_version === "string")))) &&
        v.threshold === null &&
        Array.isArray(v.candidates) &&
        v.candidates.length <= 5 &&
        new Set(v.candidates.map((c: any) => c?.id)).size ===
          v.candidates.length &&
        v.candidates.every(
          (c: any, i: number) =>
            recordShape(c) &&
            Number.isFinite(c.score) &&
            c.score >= -1.000001 &&
            c.score <= 1.000001 &&
            Number.isInteger(c.rank) &&
            c.rank === i + 1,
        ),
    ),
};
