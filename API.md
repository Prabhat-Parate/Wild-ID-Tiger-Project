# Wild-ID tiger API contract (0.2.0)

FastAPI generates backend/openapi.json; JSON schema also at GET /openapi.json. No CDN Swagger/Redoc pages. TypeScript service/guards: src/api.ts. CORS: configured exact origins only. Frontend uses relative /api in same-origin deployment;VITE_API_BASE supports separately hosted API.

- **GET /api/health**: status,method,model/version,model_loaded=false,subset count/source commit,threshold=null and absence-of-identity-labels explanation. `dataset.individuals=0` means no supplied identity labels,not zero animals photographed.
- **GET /api/dataset**:32 safe image records,source/licence/commit/selection. Internal records contain image record ID,path/hash,dimensions,published box and media paths;no coordinates. individual_id/datetime/viewpoint/CA_score/region_bbox/manual are null if absent. The comparison displays actual source_filename (basename of source_path), source_path, source_split, source_annotation_path, dimensions and published boxes when available; absent metadata is omitted. `information` includes file-counted included_image_count/original_image_file_count/crop_file_count, source inventory train/validation counts, source_url/name, copied card_license_declaration and attribution_text. Counts distinguish original photos from derivative crops.
- **POST /api/analyze**: multipart exactly one of record_id or file. Result: request_id,timestamp,query_id,method='image retrieval',model,dataset_version,status='UNKNOWN',threshold=null,criterion,optional source crop detection,candidates and explanation. Candidate score=real cosine similarity,rank1–5;individual_id=null. Same source photo excluded for dataset queries. Whole-frame uploads have detection=null. No identity acceptance is performed.
- **GET /api/media/{filename}**: allowlisted cached metadata-free tiger preview/crop only. Original source JPEGs/annotations are not served.
- **GET /api/individuals**:[] because no real identity groups can be built.
- **GET /api/evaluation-report**:threshold=null,empty identity validation/test/demo arrays and explicit unavailable methodology. No old threshold/metrics retained.
- **GET /api/sightings**, **GET /api/evaluations**:[];no persistent records.
- **POST /api/reviews**:501;no fake successful persistence. UI uses browser-memory visual reviews/observations and export.

Frontend review records have review_scope='visual_similarity_only',candidate/ground-truth identity=null,actual query/candidate IDs/scores,method/model/version/timestamp/action. Confirm action means visual similarity only,not human-confirmed tiger identity. Exports omit notes/conditions/images/location fields and neutralise CSV formulas.

Limits retained:8MiB file/9MiB complete request,24million pixels,max side10000;JPEG/PNG extension+MIME+magic+decoder checks;metadata-free RGB upload processing;multipart spool threshold above request cap;25s soft server/28s client timeout;12 analyses/minute/peer. Structured route/status/duration logs only. Peer hashes are salted,in-memory,one-minute-window,lazily expired. Shared dev proxy means shared rate-limit bucket. Production FastAPI serves built dist SPA/API same origin and sets CSP/NoSniff/NoReferrer. Unknown API paths404;no source files or coordinates exposed.

PORT environment is respected by start-backend.sh (default8000). Vite development proxy targets8000. Separate deployment configuration and security-header responsibilities are documented in README;actual external URLs were not supplied or verified.

## Browser-session evaluation / exports

Successful `/api/analyze` responses are retained in browser memory, keyed by actual request_id; refresh/confirmed clear removes them. Evaluation distinguishes image-retrieval ranking, individual ground-truth identity/source (currently always null) and human decision. Nothing is written to a database. A labelled illustrative sample lives outside the recorded data and export projection.

Review CSV/JSON retains legacy fields and adds request_id, retrieval_ranking (rank/reference/score/method/descriptor), selected retrieval_rank/retrieval_score, ground_truth_source=null and human_review_decision. CSV serializes the nested ranking as JSON, not `[object Object]`. Evaluation exports flat recorded_image_retrieval rows and separately typed manual_visual_observation rows. Neither export includes images, filenames, locations or free-text notes. Human review never creates a ground-truth identity label.

Frontend result guards reject missing/invalid candidates, non-finite or out-of-range cosine scores, duplicate references and nonsequential ranks; at most five references are accepted. Optional filename/source/crop metadata can be absent; full source media is the crop fallback. Identity always remains UNKNOWN with threshold null.

## Live/local detection additions

`GET /api/health` now includes `detector_loaded`, `detector_name`, `detector_version`, `detector_labels` (actual configured output prompts), `detector_score_cutoff`, `detector_scope` and `detector_setup`. Retrieval's `model_loaded=false` remains accurate for its untrained descriptor; it is distinct from `detector_loaded`. Detector initialization uses only local cached hashed artifacts. Startup/import failures are logged by safe event/error type; inference errors disable detection and health reflects unavailability. Existing dataset/retrieval endpoints and security limits are retained.

**POST `/api/detect`** — multipart exactly one `file` (JPG/JPEG/PNG). Reuses original extension/MIME/magic/decode/EXIF stripping/8MiB/24M pixel/max-side10000 validation;9MiB complete request cap. Frames are processed in memory; no image/crop persistence or logging, no external inference. Empty detections means no object crossed the configured cutoff, **not proof the frame has no animal**.

Response shape (types, not invented example detections):

```ts
{
  detections: Array<{
    label: string; // actual configured model output, including Tiger or Person
    score: number; // native detector score, NOT probability/accuracy/identity
    bbox: [number,number,number,number]; // normalized x1,y1,x2,y2, 0..1
    image_width: number; image_height: number; // decoded, EXIF-oriented frame pixels
  }>;
  detector: string; detector_version: string; timestamp: string;
  latency_ms: number; request_id: string;
  score_cutoff: number; cutoff_basis: "configurable heuristic, not validated";
}
```

Statuses:200 including `detections:[]`;415 unsupported/spoofed type,422 corrupt file/bad single-frame input,413 byte/pixel/dimension limit,429 per-peer/busy (`Retry-After`),503 Detector unavailable,504 soft inference timeout. Independent detection limits:120/minute/peer and2 requests in a rolling1-second window. Analyze remains12/minute/peer; exhausting detection does not consume its bucket. The dev proxy shares peers across preview users. One global detector worker, no inference queue; `DETECTION_TIMEOUT_SECONDS=8` default (clamped1..20). A timed-out/disconnected native inference may continue in its single bounded worker until finishing; subsequent frames get busy429. No hard CPU cancellation or distributed/public-service load guarantee is claimed.

Configuration: `WILDID_DETECTOR=onnx-world` (or `none`), optional `DETECTOR_DIR`, `DETECTION_SCORE_CUTOFF=0.25` (strictly0..1, heuristic/unvalidated). Operator restores cache with `python scripts/setup_detector.py`; runtime never downloads weights. Version/labels/checksums/source/licences in `models/tiger-open-vocabulary/manifest.json` and MODEL_CARD.md.

**`/api/analyze` optional detector crop:** existing exactly-one dataset record or file remains. Dataset record behavior is unchanged: `detection.source="Tiger-pose annotation (not a live detector)"`, `detection.bbox` is legacy **pixel `[x,y,width,height]`** and `crop_url` is allowlisted static media. Detector options with a record_id are rejected422 instead of relabelling an annotation as a prediction.

For uploaded file only, set `detect_first=true` and optionally `detection_box` as JSON normalized `[x1,y1,x2,y2]`. A supplied box also requests detection. The backend **runs the real detector again** and checks agreement (IoU>=0.8 selection-consistency guard, not model validation) with a current non-person result; it does not trust a client-proclaimed model label/box. Without a box, the top eligible returned animal is chosen. Any reported Person blocks the entire frame from forwarding; no person crop is created. No animal result yields422, unavailability503, busy429 or timeout504; there is no silent full-frame fallback. Normal uploads with neither option still use the full frame, even when detection is unavailable.

For a detector crop, `Analysis.detection` contains:
- `source`: actual detector name; `detector_version`, `label`, `detector_score` — detection evidence, not similarity or identity.
- `bbox`: actual integer pixel `[x,y,width,height]` used for cropping; `normalized_bbox`: original returned normalized xyxy selection.
- `crop_url:null`: transient uploads are not written to media or stored behind a token. Browser reconstructs the temporary crop from its own original frame and returned pixel box.

Candidate scores remain real cosine visual-ranking values, threshold remainsnull and identity remainsUNKNOWN. Frames are not automatically re-identified: the UI sends this request only after Capture and find visual similarity candidates. It stops/aborts camera work first and may retry a busy429 once after the stated delay; no frame queue is created.

Review exports add a separate `detection_evidence` object (source/label/detector_score/version; no image/URL). Evaluation exports have distinct detection_source/detection_label/detector_score/detector_version columns next to existing retrieval rank/score/method/descriptor, null ground-truth identity/source and human-review decision. Normal live-frame outputs are not recorded/exported. No field merges detector scores with similarity, human judgments or ground-truth identity.

Production CSP change: add only `media-src 'self' blob:` for browser media. There is no `mediablob:` scheme. `connect-src 'self'`, script/style self restrictions, CORS exact origin allowlist, NoSniff/no-referrer/no-store and all existing upload protections remain unchanged. Neither getUserMedia/srcObject nor local canvases need a third-party connection. Separate frontend/backend hosting still requires explicit host-specific CSP/origin configuration and has not been inspected without real URLs.
