# Wild-ID — tiger-only photograph comparison (0.2.0)

Beyond Infinity · St. Vincent Pallotti College of Engineering and Technology, Nagpur · WildHack 2026 Challenge A.

**Current user-approved scope:** tigers only; Hugging Face dataset; scientifically honest visual comparison with real source filenames and available metadata. The latest targeted-improvements request supersedes the earlier metadata-hiding preference. The previous zebra/GZCD scope, cache and scientific results are no longer used or shipped.

## What is real

- 32 real tiger photographs from **https://huggingface.co/datasets/Ultralytics/Tiger-pose**, pinned at `81e28ddc5ce42e30671a261e0aa9b20fec81b065`.
- Published pose boxes produce real animal crops. Comparison figures display actual source filenames and whitelisted available metadata (source path, dimensions, pose partition, original annotation path and published box). Missing fields are omitted; no invented date/viewpoint/identity or matching overlay. EXIF/GPS stays stripped; raw originals are not served.
- Real FastAPI image retrieval using cached, untrained 512-dimensional gradient histograms and cosine similarity; same source photo excluded from dataset queries.
- Full/crop preview, upload/replace/remove, loading/cancel/error/retry, up to five returned references beside the query, click-to-enlarge and synchronized zoom and temporary visual reviews with undo/export.
- Tiger photo gallery, review history, separate recorded retrieval/ground-truth/human-review evaluation and manual visual-observation log, About & Data, Help, Privacy draft, Responsible Use, Contact, 404 and error boundary.

**Not verified tiger re-identification.** The source has pose labels but **no individual-tiger IDs**. `individual_id` is null for every record, `threshold` is null and identity always remains UNKNOWN. No fabricated identities, confidence percentages, identity metrics or ground-truth groups. A visually-similar review is not an identity confirmation. Adjacent frames may show the same tiger; 32 photos do not mean 32 animals. The source includes enclosure/captive imagery and is not field camera-trap validation. No MegaDetector/MegaDescriptor/Supabase connection is claimed.

Every displayed similarity score states: **“Similarity indicates visual resemblance, not verified individual identity.”** Results are **“Visual similarity candidates”** with **“No reliable match established”**, including when references exist but identity ground truth does not. Evaluation states **“No individual-level ground truth available. Re-identification accuracy cannot be computed.”** No scientific cutoff or identity metric was added.

## Start locally / in Arena

Tested with Node 20.20.2 and Python 3.13.16, 2 CPU vCPUs / about 1.9 GiB RAM; no exposed GPU. Local ONNX Runtime needs no PyTorch. Detection requires the pinned 51,142,204-byte ONNX model plus cached text features; no runtime weight download or third-party inference occurs. The workspace includes this local cache. The downloadable `wild-id-tiger-project.zip` is a source/data bundle and excludes the 51MB model binary to avoid duplication. ZIP users must run the explicit setup command while online **before** offline judging; runtime/startup never downloads it.

```sh
npm ci
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.lock.txt
cp .env.example .env
# Dataset cache is included. To reproduce it from the pinned Hugging Face source:
python scripts/load_dataset.py
# Operator setup BEFORE demo/judging, only if the detector cache is missing:
python scripts/setup_detector.py
# Optional: regenerate explicitly labelled fake-camera test fixture (Pillow only):
python scripts/make_camera_fixture.py
# Two terminals:
./scripts/start-backend.sh
./scripts/start-frontend.sh
```

Open port **5173**. Frontend calls relative `/api`; Vite proxies internally to port 8000. This proxy is for development, not a configuration for an unrelated static host. Backend launcher respects `PORT` (default 8000); keep it at 8000 while using the bundled Vite proxy.

## Local camera / photo detection and demo fallback

In **Compare Tigers / Identify**, choose **Camera detection** beside the upload controls to open the existing **Detect Animal** (`/detect`) route; existing comparison/navigation is retained. The model is YOLOv8s-World v2, an AGPL-3.0 open-vocabulary detector with fixed genuine CLIP prompts for Tiger/Lion/Leopard/Cat/Dog/Person/Animal. Only a tiger model output is displayed as Tiger. Other animal outputs say “Animal detected (species not determined)”. The qualitative selection/demo check observed substantial species confusion (see MODEL_CARD.md); this is not field-ready tiger classification. Detection never establishes an individual identity.

Click **Start camera** only after reading the disclosure. Browser permission and HTTPS/localhost are required; open the secure app in its own tab if embedded permission policy blocks the camera. Rear-facing is preferred, available cameras can be selected, and mirror preview keeps boxes aligned. A visible Camera on indicator and Stop camera control are provided. All tracks stop on Stop, route exit/unmount, page exit and tab hide. Revoke browser permission in site settings. Audio and GPS are never requested.

Camera JPEGs (at most 1280 px longest side) go only to this backend, about one request per second: 800 ms after completion, no overlapping jobs/queued frames, 429 and exponential network-error backoff. Boxes are backend-returned normalized coordinates projected through letterboxing/mirroring/resize, not invented overlays. A missed-frame positive targets expiry 1.2 seconds from capture (browser scheduling can delay UI work), then clears; this is not tracking. Frames are processed in memory and discarded, not logged/saved/recorded. A user-initiated capture holds a frame/crop temporarily for comparison; no frame save/record feature is provided.

**Capture and find visual similarity candidates** explicitly stops the stream, verifies the selected non-person box again on the frozen frame, and feeds that crop into existing comparison. No per-frame re-ID. Person detections are ignored and block the entire frame from similarity; no person crops, identification or tracking. This is not a guarantee all people are found.

**Demo fallback:** switch explicitly to **Upload a photo**, choose an authorised JPG/JPEG/PNG (e.g. an included dataset photo) and click Detect photo. Active mode is displayed; no silent fake detections. If detector/camera/permission fails, status and setup/retry instructions are explicit. Full-frame uploads in the original Compare Tigers workflow still work without a detector. Video-file upload was not added.

Every detector score states: **“Detector score is not a probability and not a measure of accuracy. Detection does not identify individual animals.”** The default `DETECTION_SCORE_CUTOFF=0.25` is a **configurable heuristic, not validated**. `DETECTION_TIMEOUT_SECONDS=8` is a soft inference deadline, bounded by one global worker. `/api/detect` has its own 120/minute/peer and 2/second burst cap; `/api/analyze` retains 12/minute. The dev proxy shares peer buckets. Missing/corrupt cache or inference failure reports Detector unavailable/503; health exposes actual detector availability/name/version/labels. `WILDID_DETECTOR=none` disables only detection; `DETECTOR_DIR` can override the local cache directory. No startup download occurs.

No labelled detector evaluation has been run. Evaluation shows detection evidence/evaluation separately from similarity ranking, absent identity ground truth and human decisions. No accuracy metric is invented. Stripes, cats, other big cats, toys, low light/distance and screens/printed photos may cause errors; this model does not determine whether a tiger is alive/physically present. Model licences, artifact hashes, CPU latency, options rejected and qualitative counts are in MODEL_CARD.md.

## Production / separate hosting

**Recommended: one service, one origin.** Build frontend and run FastAPI from this project root:

```sh
npm run build
./scripts/start-backend.sh
```

FastAPI serves both SPA and API. Configure the host’s startup port with `PORT`; use the host’s service URL to open the app, not a downloaded HTML file. `GET /api/health` should return JSON with version 0.2.0 and 32 records. The `dist/` output is generated and must be rebuilt after restoring a workspace snapshot.

For a separate static frontend and backend:
- Set `VITE_API_BASE=https://your-real-backend-host` **before building the frontend**; never use localhost in browser-facing config for a remote service.
- Set backend `ALLOWED_ORIGINS=https://your-real-frontend-host` (exact origin, no wildcard).
- Ensure backend /api routes are reachable over HTTPS; configure CSP/security headers on the actual frontend host to allow the chosen backend origin.
- The previous external deployment’s frontend/backend URLs were not supplied, so that remote site could not be inspected or verified. A working Arena/local preview is not proof a separate deployment is fixed.

All variables: `.env.example`: VITE_API_BASE (blank=same origin), VITE_MAX_UPLOAD_BYTES=8388608, MAX_UPLOAD_BYTES=8388608, ALLOWED_ORIGINS exact comma-separated origins, PORT=8000. No secrets belong in VITE_ variables. Backend launcher reads trusted .env; Vite reads it at build/dev time. Keep file-size limits and UI copy aligned if changed.

## Data, licence and offline behavior

The HF repository is ungated and states **AGPL-3.0**, not CC BY or MIT. Full source card/licence, original selected images and selected pose labels are included in data/source/tiger/; derivatives are in data/tiger-subset/media/. Source inventory: 153 images and 153 labels, 14,183,221 image bytes. The card’s claim of 210 training images disagrees with actual 100 train files; 53 val files were verified. No individual identity fields were found. Exact deterministic selection, schema and corresponding-source notes are in DATASET.md. Public redistribution/deployment still requires institutional/licence/provenance review. Original code licence remains pending; no MIT grant is made by LICENSE. The chosen detector also carries AGPL-3.0 obligations (including applicable corresponding-source/network-service duties); review these and the export-source completeness before public hosting/distribution. No non-commercial-only detector/model is incorporated. CLIP text setup / ONNX Runtime notices are included.

After dependencies and cache are installed, runtime works offline. Missing/inconsistent cache yields dataset_missing health and explicit errors, never fabricated outputs. No external font/script/tracker/model requests occur in app runtime. No CDN Swagger/Redoc is loaded; raw OpenAPI is available at /openapi.json.

## Privacy & security

Uploads remain in bounded request memory and are re-decoded as metadata-free RGB. Same protections retained: extension/MIME/magic/decode validation; 8 MiB file, 9 MiB request, 24M pixels, max side 10000; decompression-bomb checks; safe media allowlist; CORS exact configured origins; 12 analyses/minute/peer (shared by dev proxy); 25s soft server and 28s client deadlines; structured logs without image/client content; production same-origin CSP, NoSniff and no-referrer. The sole CSP addition for camera media is `media-src 'self' blob:` (not a `mediablob:` scheme); `connect-src 'self'` is unchanged. Original selected source photos were checked for EXIF GPS before packaging; raw sources are never served through the media endpoint.

Retrieval rankings, query filenames, reviews and observations exist in browser memory only, with no accounts/cookies/analytics/localStorage. Exports contain identifiers, scores and visual decisions, not images, filenames, locations or free-text notes. Evaluation downloads separate retrieval rank/score/method/descriptor, ground-truth identity/source (null), and human-review decision. The explicitly labelled illustrative sample is never exported. Clear-session requires confirmation. Privacy notice is a draft; host-level logs, region, access control and institution review remain TODO. This is not a public-security certification.

## Checks

```sh
npm run typecheck
npm run lint    # TypeScript static check, not a separate ESLint ruleset
npm test
python -m pytest -q
# Backend + Vite must be running:
npx playwright install --with-deps chromium
npx playwright test
npm run build
npm audit
pip-audit -r requirements.lock.txt
python scripts/evaluate_detector.py  # qualitative selection/demo only, not accuracy
python scripts/notices.py
```

Current tests and raw evidence: TEST_REPORT.md / docs/. Matching accuracy is **not evaluated** because identity labels are absent; software tests do not establish tiger identity performance. See MODEL_CARD.md, API.md, PROJECT_STATUS.md and DEMO_SCRIPT.md.

Contact/repository/issue fields in src/config/project.ts remain empty TODOs, hidden from UI. No invented contact details or partnerships.

## QA reproduction

See TEST_REPORT.md for all fresh results and fixture limitations. After dependency installation and explicit detector setup: `python -m pytest -q`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm audit`, and `python -m pip_audit -r requirements.lock.txt`. Install Playwright Chromium with `npx playwright install chromium` if needed. With backend on 8000 and Vite on 5173, run `npx playwright test`. To exercise detection against the built same-origin app instead, run `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8000 PLAYWRIGHT_REPORT=docs/production-detection-results.json npx playwright test tests/browser/detection.spec.ts`. The fake-camera fixture is a real photo, not physical-device coverage.
