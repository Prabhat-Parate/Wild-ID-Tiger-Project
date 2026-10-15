import { useEffect, useRef, useState } from "react";
import { media, type Analysis, type RecordImage } from "./api";

export const SCORE_DISCLAIMER =
  "Similarity indicates visual resemblance, not verified individual identity.";
export const ACCURACY_UNAVAILABLE =
  "No individual-level ground truth available. Re-identification accuracy cannot be computed.";
export function sourceFilename(
  record?: Partial<RecordImage> | null,
): string | undefined {
  if (
    typeof record?.source_filename === "string" &&
    record.source_filename.trim()
  )
    return record.source_filename;
  if (typeof record?.source_path === "string" && record.source_path.trim())
    return record.source_path.split(/[\\/]/).filter(Boolean).pop();
  return undefined;
}
export function SimilarityScore({ score }: { score: number }) {
  return (
    <span className="similarity-score" data-similarity-score>
      <strong>
        {Number.isFinite(score) ? score.toFixed(4) : "Score not available"}
      </strong>
      <span className="score-unit">
        Cosine similarity · Relative ranking value, not a probability.
      </span>
      <span className="score-disclaimer">{SCORE_DISCLAIMER}</span>
    </span>
  );
}
export function NoReliableMatch({ reason }: { reason: string }) {
  return (
    <div className="uncertainty-state" role="status">
      <div className="result-summary unknown">
        <div>
          <span className="micro-label">INDIVIDUAL IDENTITY</span>
          <h3>UNKNOWN</h3>
        </div>
        <span className="tag">VISUAL RETRIEVAL ONLY</span>
      </div>
      <h4>No reliable match established</h4>
      <p>
        {reason} The current descriptor has not been validated for individual
        tiger re-identification.
      </p>
    </div>
  );
}
export function ImageMetadata({
  record,
  filename,
  upload,
}: {
  record?: Partial<RecordImage> | null;
  filename?: string;
  upload?: { type: string; size: number } | null;
}) {
  const name = filename || sourceFilename(record);
  const rows: [string, string][] = [];
  if (record?.species) rows.push(["Species", record.species]);
  if (
    Number.isFinite(record?.width) &&
    Number.isFinite(record?.height) &&
    record!.width! > 0 &&
    record!.height! > 0
  )
    rows.push(["Source dimensions", `${record!.width} × ${record!.height} px`]);
  if (record?.source_path) rows.push(["Source path", record.source_path]);
  if (record?.source_split)
    rows.push(["Source partition (pose)", record.source_split]);
  if (record?.datetime) rows.push(["Source capture time", record.datetime]);
  if (record?.viewpoint) rows.push(["Source viewpoint", record.viewpoint]);
  if (
    Array.isArray(record?.bbox) &&
    record.bbox.length === 4 &&
    record.bbox.every(Number.isFinite)
  )
    rows.push([
      "Published box [x, y, w, h]",
      record.bbox.map((n) => Number(n.toFixed(1))).join(", ") + " px",
    ]);
  if (record?.source_annotation_path)
    rows.push(["Source annotation", record.source_annotation_path]);
  if (typeof record?.manual === "boolean")
    rows.push(["Source manual review", record.manual ? "Yes" : "No"]);
  if (upload?.type) rows.push(["Upload type", upload.type]);
  if (upload && Number.isFinite(upload.size))
    rows.push(["Upload size", `${upload.size.toLocaleString()} bytes`]);
  return (
    <div className="image-metadata">
      {name && (
        <p className="source-filename">
          <span>Source filename</span> <b>{name}</b>
        </p>
      )}
      {rows.length > 0 && (
        <details open>
          <summary>Available source metadata</summary>
          <dl>
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  );
}
function EnlargeableImage({
  src,
  alt,
  filename,
}: {
  src: string;
  alt: string;
  filename?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <>
      <button
        className="enlarge-image"
        aria-label={`Enlarge ${alt.toLowerCase()}`}
        disabled={failed}
        onClick={() => dialog.current?.showModal()}
      >
        {failed ? (
          <span
            className="image-missing"
            role="img"
            aria-label={`${alt} unavailable`}
          >
            Photograph unavailable
          </span>
        ) : (
          <img src={src} alt={alt} onError={() => setFailed(true)} />
        )}
        {!failed && <span>Click to enlarge</span>}
      </button>
      <dialog
        className="image-dialog"
        ref={dialog}
        aria-label={`Enlarged ${alt.toLowerCase()}`}
      >
        <button className="button" onClick={() => dialog.current?.close()}>
          Close enlarged image
        </button>
        <img
          src={src}
          alt={alt}
          onError={() => {
            setFailed(true);
            dialog.current?.close();
          }}
        />
        {filename && <p>{filename}</p>}
      </dialog>
    </>
  );
}
export function CandidateComparison({
  analysis,
  query,
  queryFilename,
  upload,
  queryUrl,
  selectedId,
  onSelect,
  zoom,
}: {
  analysis: Analysis;
  query: RecordImage | null;
  queryFilename?: string;
  upload: { type: string; size: number } | null;
  queryUrl: string;
  selectedId?: string;
  onSelect: (id: string) => void;
  zoom: boolean;
}) {
  const candidates = analysis.candidates.slice(0, 5);
  return (
    <>
      <p className="retrieval-method">
        Retrieval method: <b>{analysis.method}</b> · Descriptor:{" "}
        <b>{analysis.model}</b>. Inspect pose, visible stripe pattern, lighting
        and image quality. These observations do not prove identity.
      </p>
      <div
        className={
          "compare-images comparison-collection " + (zoom ? "zoomed" : "")
        }
      >
        <figure className="comparison-query">
          <figcaption>QUERY PHOTOGRAPH · IDENTITY UNKNOWN</figcaption>
          <EnlargeableImage
            src={queryUrl}
            alt={
              query || analysis.detection?.label === "Tiger"
                ? "Tiger query photograph"
                : analysis.detection?.label
                  ? "Animal query photograph"
                  : "Uploaded query photograph"
            }
            filename={queryFilename}
          />
          <ImageMetadata
            record={query}
            filename={queryFilename}
            upload={upload}
          />
        </figure>
        <div
          className="reference-comparisons"
          aria-label="Top retrieved reference photographs"
        >
          {candidates.map((c) => (
            <figure
              key={c.id}
              className={selectedId === c.id ? "selected-reference" : ""}
            >
              <figcaption>
                VISUAL SIMILARITY CANDIDATE · RANK {c.rank}
              </figcaption>
              <EnlargeableImage
                src={media(c.crop_url || c.image_url)}
                alt={`Tiger reference photograph ranked ${c.rank}`}
                filename={sourceFilename(c)}
              />
              <p className="reference-method">
                {c.crop_url
                  ? "Published animal crop"
                  : "Full source photograph"}
              </p>
              <ImageMetadata record={c} />
              <SimilarityScore score={c.score} />
              <p className="reference-method">
                {analysis.method} · {analysis.model}
              </p>
              <p className="reference-identity">Individual identity: UNKNOWN</p>
              <button
                className={
                  "button small " + (selectedId === c.id ? "selected" : "")
                }
                aria-pressed={selectedId === c.id}
                onClick={() => onSelect(c.id)}
              >
                Review this candidate
              </button>
            </figure>
          ))}
        </div>
      </div>
    </>
  );
}
