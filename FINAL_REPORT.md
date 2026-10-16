## 0. 2026-10-16 multi-species and backend bounds

Inspected in this checkout: React/TypeScript/Vite/FastAPI; `/api/detect` and `/api/analyze` as in `backend/main.py`; detector `OnnxWorldDetector` in `backend/detection.py`; labels from `models/tiger-open-vocabulary/manifest.json`: Tiger, Lion, Leopard, Cat, Dog, Person, Animal. Rate limits: detect 120/min and 2/s per hashed peer; analyze 12/min. Unbounded before this change: in-memory `buckets`/`detect_buckets` dictionaries. ONNX CPU. Windows: PowerShell launchers added; UTF-8 reads.

**Models:** existing YOLO-World ONNX kept (AGPL-3.0). MegaDetector+SpeciesNet and prompt expansion rejected without on-device licensed weights / labelled tests. Fine-tune rejected (no licensed Tadoba data).

**Registry:** `data/tadoba-species.json` entry count is the file size, not a fauna total. Tier B marked `unconfirmed_for_tadoba`. Detector support flags come from loaded labels (Tiger, Leopard supported among reference mammals; most species Not supported).

**Backend:** inference slot cap (`INFERENCE_WORKERS`+`INFERENCE_QUEUE`), 503+Retry-After when full, rate-bucket cap, `/api/ready`, rotating logs, kill-switch `WILDID_DETECTOR=none`, max-side downscale, ONNX thread env, stream body cap retained. Load-test numbers are only those written by `scripts/load_test.py` when that script is run against a live server.

## 1. Inspection discrepancy, chosen detector and alternatives

**Inspected first:** React/TypeScript, Vite, React Router and FastAPI confirmed from code. Contrary to this request's assumption, detector/camera code already existed in the current workspace. Verified and reused it rather than duplicating it. This request adds a **Camera detection** option beside Identify's upload controls linking to the existing `/detect` route; the navigation array/design remain unchanged. See `docs/camera-request-inspection.md` for routes, API contracts and rate-limit findings.

Implemented a real local **YOLOv8s-World v2 ONNX** detector with cached genuine CLIP prompt features, not a COCO model relabelled as tiger and not simulated inference. Source: https://huggingface.co/Instemic/yolo-world-onnx, commit `7e1d02c9467c32b141df81890737490764776785`, `yolov8s-worldv2.onnx` (export card: Ultralytics 8.4.37). Repository-stated **AGPL-3.0**, **51,142,204 bytes / 48.77MiB**, SHA-256 `381ced485b23ed8f06de3e82bb2745e1420c181c64f0a176784c34a959d550a1`.

Fixed actual prompt labels: **Tiger, Lion, Leopard, Cat, Dog, Person, Animal**. Only a model Tiger output earns “Tiger detected”; other animal outputs say species not determined, showing the raw unverified label separately. CLIP setup source: Xenova/clip-vit-base-patch32 commit `d15189d7028b43f1d3e65039190477f6af591c2a`, OpenAI CLIP MIT; setup-only encoder 64,504,507 bytes, runtime features 14,464 bytes. ONNX Runtime 1.31.0 (MIT) runs CPU-only; no PyTorch/transformers runtime added. Setup verifies fixed model/encoder/vocabulary SHA-256 values; runtime checks its cache manifest.

Measured on 2 CPU vCPUs: first image **171.23ms**, median **156.22ms**, range **142.77–213.09ms** on 32 real demo photos, including image preprocessing and postprocessing but excluding transport/browser cost. Source/version/licence/hash/preprocessing/native-sigmoid discrepancy and measurements are recorded in `MODEL_CARD.md` and `docs/detector-qualitative.json`.

Alternatives genuinely inspected, **not** claimed benchmarked: MegaDetector outputs animal/person/vehicle, so needs a separate tiger species classifier; Google SpeciesNet really includes tiger, but its classifier + bundled detector are about 505MB before runtime and were not installed within the intended small shipping budget; OWLv2-base weights are about 620MB and were not installed/timed; CLIP alone cannot localize boxes. Fine-tuning Tiger-pose with only 32 correlated demo photos/no negatives would not establish a valid tiger detector. No silent fake fallback. Component-specific licences still need review; a mirror's licence is not assumed to override upstream terms.

## 2. Camera end-to-end behavior and tested browsers/devices

Added **Detect Animal** (`/detect`) while retaining the existing compact forest-green app and navigation. Camera permission is requested only by Start camera, with prior privacy/HTTPS disclosure. Rear-facing preference, device picker, mirroring, Camera on/Stop, readable denied/no-device/in-use/insecure errors, retry and explicit JPG/PNG upload fallback are connected.

Real video-to-canvas JPEG-to-API-to-returned-box-overlay-to-explicit-capture-to-comparison/review/export passed in **headless Chromium using a fake camera carrying a genuine Tiger-pose photograph**. The model/backend were real. All 13 detection tests also passed against the built same-origin FastAPI-served app. Error/device/model-response fixtures are explicitly labelled software fixtures.

Tracks stop and pending fetches abort on Stop, route exit/unmount and tab hide. Frames are serialized 800ms after completion, no request queue, with 429/network backoff. Overlay projection accounts for contain letterboxing, mirroring and resize; only returned boxes are drawn. A positive can be held to a capture-based **1.2s target**, not indefinitely; browser scheduling may delay UI work. Explicit user capture stops the camera and re-verifies the selected box; no automatic per-frame re-ID.

**Not tested:** physical cameras/phones, Safari/Firefox, actual rear-camera hardware switching or external deployment. Embedded browser permission policy may require opening the secure app in its own tab.

## 3. Files and preserved behavior

Implementation inventory (including the preceding camera integration): `backend/detection.py`, detection/health/crop additions in `backend/main.py`, schemas/OpenAPI; `src/Detect.tsx`, `src/camera.ts`, route/handoff/Evaluation in `src/App.tsx`, separate evidence in `src/Comparison.tsx`, API/session/export types, responsive styles and truthful Privacy/Help/About. Added setup/qualitative/fake-camera scripts, cached model provenance/licences, pinned ONNX dependencies and detector/unit/browser tests. Full inventory: `FILES_CHANGED.md`.

Preserved real source-photo gallery, existing descriptor/retrieval, full-frame manual uploads, published annotation crops, top-five comparison/enlarge/zoom, source filenames/available metadata, reviews/history/undo/confirmed clear and export. Dataset provenance remains exactly **“Tiger-pose annotation (not a live detector)”**. Live detector score, similarity ranking, absent identity ground truth and human review are separate. The actual retrieval method remains an **untrained 512-dimensional spatial gradient histogram**, not MegaDescriptor or genuine tiger re-ID; identity remains **UNKNOWN**, threshold null, with “No reliable match established”.

Current follow-up: added Identify entry and no-permission-on-navigation regression; reran all checks and qualitative inference, refreshed reports/model latency/source bundle. Integration documentation includes README, PROJECT_STATUS, MODEL_CARD, API/OpenAPI, DATASET, notices, Privacy/Help, demo, inventory and test/final reports. `wild-id-tiger-project.zip` is a source/data/test/documentation handoff; to avoid binary duplication it excludes model.onnx, dependencies, setup cache and generated build. The actual workspace retains cached weights; ZIP users must run the documented explicit setup once **before** judging/offline use. Runtime never downloads.

## 4. Actual tests, accessibility, audits and build

Fresh completed checks on 2026-10-15:

- **44 backend tests passed**, none skipped; one Starlette/httpx TestClient deprecation warning.
- **26 frontend unit/component tests passed** in four files.
- **29 Chromium browser tests passed** (16 preserved + 13 detection), 54.7s.
- **13 detection browser tests passed again against the production build**, 19.1s; original built-app comparison smoke passed too.
- Typecheck, existing lint script (TypeScript checking, not ESLint), production build and `pip check` passed.
- Fresh **npm audit: 0 vulnerabilities**; **pip-audit: 49 packages, 0 known vulnerabilities**. These are point-in-time checks, not security certification.
- Automated axe: **0 violations** across ten baseline routes, populated Evaluation/enlargement states and detector result screen. 320px/390px checks, keyboard focus/Escape and reduced motion passed; no page overflow in tested states. No full WCAG/manual screen-reader certification claimed.

Validation includes MIME/magic/corrupt/oversize/pixel/EXIF, duplicate frame rejection, empty output, unavailable health/503, separate rate caps, no disk spool/save, worker timeout/concurrency, person block, genuine model and exact crop retrieval. Browser coverage includes real fake-media E2E, permission/error fixtures, lifecycle, no overlap, projection/statuses, multi-box, backoff, stale expiry, crop and fallback. Commands/raw evidence and all limitations: `TEST_REPORT.md`, `docs/`. CI setup was updated, but no remote CI execution is claimed.

## 5. Evaluation size, split and honest result

**No labelled detector evaluation has been run.** The repository script computes the displayed qualitative check: **32 demo/source photos processed, 32 with an output, 8 Tiger outputs and 24 Leopard outputs**. This substantial species confusion is real. These are raw output counts, **not** accuracy, recall, precision or a detection-rate percentage. None are relabelled as Tiger for presentation.

All 32 photos were used only for selection/demo; they may be adjacent/captive frames. There is no independent licensed natural-image negative set, leakage-aware held-out split, training-overlap audit, validated cutoff or IoU evaluation. Synthetic blank input and intercepted responses test software behavior only. Detector Evaluation is separate from identity Evaluation. The source has no individual-tiger IDs, so identity accuracy cannot be computed either.

## 6. Privacy, security and licences

No audio, GPS, recording, analytics or third-party frame/image inference. Frames are processed in bounded memory and not saved or logged; an explicit capture keeps a temporary browser image/crop for the requested comparison, not persistent storage. Reported people are ignored and block the **whole frame** from crop forwarding; no person crop, tracking or identification. The detector is not a reliable privacy filter and can miss people.

Preserved 8MiB file/9MiB body/24M-pixel/max-side validation, EXIF-free RGB, allowlisted media, exact CORS, minimised structured logs and same-origin connects. Detector has independent 120/minute/peer + 2/sec burst caps, one bounded inference worker and an 8s soft inference timeout; original analyze stays 12/minute. A cancelled/timed-out native inference continues holding the worker until it ends. CSP only gains `media-src 'self' blob:`; `connect-src 'self'` is unchanged. Host-level logs, access, region and public deployment require review.

Detector and Tiger-pose dataset are repository-stated **AGPL-3.0**; applicable corresponding-source/network-service obligations and ONNX export-source completeness require legal/institutional review before public hosting/distribution. CLIP/ONNX Runtime MIT and other dependency notices/full licence texts are included. **No noncommercial-only model is incorporated**; previously inspected CC BY-NC MegaDescriptor remains unused. Original app-code licence approval remains pending; no MIT grant/publication clearance is invented.

## 7. Known failures and operating limitations

This is an **unvalidated demonstration detector**, not a field-ready tiger or safety system. Species confusion is already observed. Cats/other big cats/stripes, toys, screens/printed photos, enclosure/background bias, occlusion, low light, small/distant animals and motion can cause false positives/negatives. It does not prove a live tiger is physically present. CPU contention, capture/encoding/network cost, shared proxy rate buckets and the single global worker limit throughput; about 1fps here is not a guaranteed performance SLA.

Cutoff 0.25 is a **configurable heuristic, not validated**. Every detector score carries exactly: **“Detector score is not a probability and not a measure of accuracy. Detection does not identify individual animals.”** Nothing in detection, visual similarity or a human visual review establishes an individual identity. Missing/corrupt/failed model returns explicit unavailable/503 with setup instructions, never invented boxes. Physical-device, field, external-deployment, public-security and compliance approval remain unverified.

## 8. What is needed next

Acquire an authorised, provenance/licence-verified **camera-trap tiger dataset plus tiger-absent negatives**: people, domestic cats, other big cats, stripes, toys/screens/prints and varied field light/distance/occlusion. Label boxes/species; group all same encounter/video/near-duplicate/camera-location frames together, audit training overlap, reserve independent validation/test partitions and tune only on validation. Benchmark an appropriate detector/classifier and validate the operating cutoff and false-positive/negative trade-offs before claiming metrics or field suitability.

For actual tiger identification, separately acquire **individual-labelled encounter data** and a genuine licence-compatible re-ID model, with encounter-aware known/unknown held-out testing, training-overlap audit and calibrated acceptance policy. Do not convert visual reviews into ground truth. Complete physical/mobile/browser/accessibility/hosting tests, public privacy/security review and original-code/dataset/model licence approvals before deployment.
