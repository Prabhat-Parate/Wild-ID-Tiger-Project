# Live local detection and regression QA — 2026-10-15

Fresh checks of the existing camera/detector integration and this request's added Camera detection option in Identify. The inspect-first discrepancy is documented in `docs/camera-request-inspection.md`; the detector already existed. These are software checks, not detector accuracy or tiger identity validation.

## Commands and actual results

| Command/check | Actual result |
|---|---|
| `python scripts/setup_detector.py` | PASS; cached pinned model/text encoder/vocabulary SHA-256 verified; genuine CLIP features regenerated |
| `python -m pytest -q` | **44 passed**, 0 skipped, 3.27s; one Starlette/httpx TestClient deprecation warning |
| `npm test` | **26 passed** in 4 files |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS; this script is TypeScript checking, **not** a separate ESLint ruleset |
| `npx playwright test` | **29 passed**, Chromium, one worker, 54.7s; all 16 existing + 13 detection tests |
| `npm run build` | PASS; TypeScript project build + Vite 7.3.7, 3.20s |
| `node scripts/verify-targeted-production.mjs` | PASS against actual built SPA/FastAPI on port 8000; original comparison/Evaluation workflow |
| `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8000 PLAYWRIGHT_REPORT=docs/production-detection-results.json npx playwright test tests/browser/detection.spec.ts` | **13 passed**, 19.1s against built same-origin app, including genuine model through fake camera and capture/review/export |
| `npm audit --json` | **0 vulnerabilities** |
| `python -m pip_audit -r requirements.lock.txt --format=json` | **49 packages, 0 known vulnerabilities** |
| `python -m pip check` | No broken requirements |
| `python scripts/evaluate_detector.py` | Real 32-photo qualitative check; details below; **not** an accuracy evaluation |

Raw results: `docs/{pytest-results,vitest-results,typecheck-results,lint-results,build-results,playwright-console,production-smoke,production-detection-console,pip-check}.txt`, `docs/playwright-results.json`, `docs/production-detection-results.json`, `docs/targeted-production-smoke.json`, `docs/npm-audit-camera.json`, `docs/pip-audit-camera.json`. Older `*-initial`/`*-final` audit files remain historical; the camera audit files above are the fresh checks.

## Backend coverage

- Genuine locally loaded ONNX detector on a real bundled tiger photograph, actual Tiger class, normalized bounds, model/version/score/cutoff/latency; white synthetic image returns an empty array. White input is a software sanity fixture, **not** a licensed natural-image negative dataset.
- JPG/PNG success; SVG/unsupported formats, MIME/extension/magic mismatch, corrupt/empty input, oversize files, excessive dimensions; inherited pixel/decompression/EXIF/body-memory/security validation. Exactly one multipart file; duplicate frame parts rejected.
- Missing model/startup failure, health reporting and 503; inference failure disables detector honestly. Baseline full-frame retrieval continues when detection is unavailable.
- Independent detector burst/minute bucket; existing analysis bucket unchanged; busy 429/Retry-After; soft timeout, native worker retains semaphore until it actually finishes. No inference queue after timeout.
- Multipart file remains unrolled in memory; patched image save fails the test if invoked. No frame saving or disk spooling in tested request paths.
- Explicit selected-box re-verification and actual crop descriptor values; UNKNOWN, null identity threshold and five real references preserved. Regular uploads stay full-frame; dataset crop evidence remains exactly `Tiger-pose annotation (not a live detector)`.
- Reported person blocks the whole frame from similarity. Invalid/non-overlapping selected boxes rejected. This is **not** a guarantee that the detector finds every person.

## Frontend/browser coverage and fixture boundaries

- Chromium's `--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`, and `--use-file-for-fake-video-capture` supply a real Tiger-pose photograph as Y4M input. Real browser video/canvas/JPEG, real `/api/detect` and cached model, real overlay, explicit capture/re-verification, existing five-candidate comparison, uncertain review and JSON export are exercised end-to-end. Identity stays UNKNOWN; detection evidence and retrieval/human decision are separate. **This is not a physical camera test.**
- New regression verifies Identify's Camera detection link reaches the existing route without requesting permission and preserves upload. No permission call on mount; explicit Start/Stop. Actual fake-video tracks end on Stop, route exit and tab hide. Lifecycle/abort/URL cleanup, serial requests/no overlap and projection/mirror mathematics also have unit coverage.
- Test-only injected camera errors cover denied permission, no device, device in use and insecure context. Test-only device list covers switching/mirroring. These are deterministic browser behavior fixtures, not claims about actual camera hardware or permission UI.
- Intercepted responses explicitly named TEST FIXTURE cover multiple-box selection, Tiger, generic animal, no detection, unavailable/error, person-ignore/no-capture, 429/network backoff/abort and stale-positive expiry at the 1.2s capture-based target. No fixture enters production or research results.
- Real photo upload detector path and empty synthetic sanity input exercised. Detector score's full exact warning verified next to scores. Capture never silently starts re-ID.
- All existing workflows rerun: real source filename/metadata and query-plus-top-five photographs, score text equals backend values, missing/invalid/empty/fewer references, enlargement/Escape/synchronized zoom, upload validation/loading/cancel/remove, review/history/undo/confirmed clear, separate JSON/CSV fields, manual observations, labelled illustrative sample excluded, source-backed Dataset Information, gallery/information/footer/404/error-boundary and honest UNKNOWN/no-reliable-match.

## Accessibility and responsive checks

Fresh automated axe checks found **0 violations** in the ten baseline routes, enlarged-photo/populated Evaluation states and the detector page with a real uploaded model result. Evidence: `docs/accessibility-results.json`, `docs/targeted-accessibility-results.json`, `docs/detection-accessibility.json`.

320px populated detection/comparison/Evaluation/dialog and 390px navigation checks found no horizontal page overflow; wide tables have bounded internal scrolling. Keyboard visible focus, selection, Escape and reduced-motion preferences exercised. Screenshots include `docs/detection-fake-camera-test.png`, `docs/detection-mobile-test.png`, `docs/targeted-comparison-mobile.png`. This is not manual screen-reader coverage or full WCAG certification.

## Built production app

FastAPI served the generated SPA/assets and security headers, with real local dataset/model. The original production smoke returned 32 records/five references, loaded six comparison photos, checked score equality and independent human/Evaluation records, and observed **zero page errors and zero unexpected external runtime requests**. The separate 13-test detector suite then passed against port 8000, not only Vite; it includes camera-to-comparison/review/export and uploaded photo fallback. These are sandbox/local same-origin production-build checks, **not** verification of an external deployment.

## Qualitative model evidence, not accuracy

`docs/detector-qualitative.json` is computed by `scripts/evaluate_detector.py`: **32 source photographs run, 32 with an output; raw output counts 8 Tiger, 24 Leopard**. On 2 CPU vCPUs, ONNX Runtime CPU provider: first image **171.23ms**, median **156.22ms**, range **142.77–213.09ms**, including preprocessing/inference/postprocessing and excluding HTTP/browser overhead. Significant species confusion is reported, not relabelled away.

**No labelled detector evaluation has been run.** All bundled photos are selection/demo material, possibly adjacent frames. No independent licensed natural-image negative set, held-out encounter split, training-overlap audit, precision/recall/accuracy or validated cutoff exists. No individual identity labels exist either; re-identification accuracy cannot be computed.

## Limitations and reproducibility

Not run: physical webcam/phone/rear-camera tests, Safari/Firefox, external deployment, manual assistive-technology study, penetration/distributed-load tests, field deployment or remote CI. Injected permission/no-device responses do not prove hardware compatibility. CPU latency varies with load; live processing is approximately 1fps, not a guaranteed frame rate. Browser scheduling can delay the target 1.2s stale-result expiry. Soft cancellation cannot kill an already running native inference; the worker remains bounded.

CI now includes explicit setup before real-model tests; no remote CI pass is claimed. Before running tests from the source archive, install locked dependencies and run `python scripts/setup_detector.py` once while online; the model binary is present in the working workspace but deliberately not duplicated in the source ZIP. Runtime/startup never downloads it. Use the real API rate limits; the development proxy shares a peer bucket, so tightly repeated full retrieval suites may need a fresh local API process or the real limit window to expire.
