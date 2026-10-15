# Camera-option request: inspect-first findings — 2026-10-15

Inspected the existing files before making this request's edits. The requested assumption that no detector/camera code exists was **false** in the current workspace: the preceding implementation already supplied the backend interface/local model, `/api/detect`, `/detect` screen and browser camera utilities. No duplicate implementation was added.

## Stack and routes, from code

- `package.json`: React 19.2.0, TypeScript 5.9.3, Vite 7.3.7, React Router DOM 7.18.4, Tailwind 4.1.16 and Lucide. FastAPI/Uvicorn backend in `backend/main.py`, pinned Python dependencies.
- `src/App.tsx`: `/` Overview, `/identify` Compare Tigers, `/detect` Detect Animal, `/gallery`, `/history`, `/evaluation`; `/about`, `/help`, `/privacy`, `/responsible`, `/contact`; wildcard 404. The existing navigation array was left unchanged for this request.
- `src/api.ts`: typed health/dataset/analysis/detection contracts and relative same-origin API requests by default; explicit build-time API origin configuration remains available. Detector metadata and normalized boxes already present.

## Existing backend behavior

- `/api/analyze` accepts exactly one dataset record or upload. Dataset uses actual published Tiger-pose annotation; upload stays full-frame unless `detect_first`/`detection_box` explicitly requests a re-verified detector crop. Retrieval is the existing untrained spatial-gradient descriptor/cosine ranking, identity UNKNOWN with null threshold, not tiger re-ID.
- Middleware uses independent salted peer buckets: analyze **12/minute**; detect **120/minute and at most 2 requests in a rolling second**. The Vite proxy can share a peer bucket. Security headers, strict input validation and memory-only handling remain unchanged.
- `backend/detection.py`: Detector protocol and actual cached YOLOv8s-World v2 ONNX CPU inference. `backend/main.py`: startup load, health detector fields, single-frame endpoint, bounded one-worker/timeout behavior, explicit unavailable responses and selected-box/person guards.
- `src/Detect.tsx`/`src/camera.ts`: existing click-only camera permission, live video/JPEG loop, overlays, cleanup, error/backoff handling, explicit selected crop handoff and photo fallback.

## Gap addressed in this request

The camera route existed in navigation, but Identify did not have an explicit camera option beside its upload controls. Added a **Camera detection** link to the existing `/detect` route in Identify's query actions, without replacing upload or editing the navigation array/design styles. Added a browser regression proving that following the option requests no camera permission; Start camera remains the required explicit action.

## Fresh verification

44 backend tests; 26 frontend tests; 29 full Chromium browser tests; 13 detector/browser tests again against the built same-origin app. Typecheck, existing TypeScript lint, build, original production smoke, npm audit, pip-audit and pip check passed. Full raw results and fixture/physical-device limitations are in TEST_REPORT.md.

Re-ran `scripts/evaluate_detector.py` on 32 real bundled source photos: 8 Tiger and 24 Leopard raw labels. First 171.23ms, median 156.22ms, range 142.77–213.09ms on CPU, excluding HTTP/browser. This is a qualitative selection/demo check, not held-out detector accuracy. The model's substantial species confusion is retained and disclosed; no relabeling or simulated results were introduced.
