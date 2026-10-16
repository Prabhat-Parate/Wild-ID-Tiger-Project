# Wild-ID status — tiger-only scope, version 0.2.0

## 2026-10-16

Tadoba **reference** registry (not a deployment claim) plus detector vocabulary shown separately. Backend inference slots, `/api/ready`, PowerShell launchers, `scripts/doctor.py`, `scripts/load_test.py`. Detector weights were **not** present in this environment; real ONNX tests were not re-run here.

## Scope change

The user explicitly replaced the original zebra/GZCD requirement with **tigers only, Hugging Face source only**, then requested **real source filenames/available metadata plus targeted scientific-honesty, comparison and evaluation improvements**, superseding the earlier metadata-hiding preference. The latest addition is real local live-camera/photo detection without replacing those workflows. The dataset/retrieval remain tiger-focused; the detector honestly handles configured non-tiger animal/person outputs, never renaming them Tiger. Existing React/Tailwind design, typed service, FastAPI descriptor pipeline, security protections, memory-only review/export foundation, tests and start scripts were adapted rather than replaced with a static mockup. Previous zebra photos, evaluations and threshold are not used/shipped.

## Verified source and limitation

Ultralytics/Tiger-pose at Hugging Face, pinned `81e28ddc5ce42e30671a261e0aa9b20fec81b065`, ungated, repository-stated AGPL-3.0. Actual source:153 images;32 unique decoded photographs cached (18 from source train,14 from source val), with real published pose boxes and corresponding selected source. **No individual-tiger identity labels.** All individual_id values and identity threshold are null. Always UNKNOWN means inability to establish identity, not proof an animal is new. No identity accuracy/split/acceptance has been invented.

## Proposed four-member ownership

| Member | Component | Current status | Blocker / next task |
|---|---|---|---|
|1 | Matching/retrieval | Real untrained512-dimensional descriptors,cosine ranking,source-image exclusion;test coverage | Learned tiger re-ID/model licence and individual-labelled dataset not connected;no valid identity threshold possible |
|2 | Processing | Published dataset boxes; local ONNX open-vocabulary live/photo detector; explicit verified crop-to-retrieval; EXIF-free memory-only inputs | Species confusion observed; no held-out detector evaluation or validated field cutoff |
|3 | UI/integration | Tiger-only photo-first workflow,real source metadata,gallery,query-plus-top-five/enlarge/zoom,visual review/undo/history/export,error recovery | Separate deployment URLs still not supplied;rebuild/redeploy with proper API origin/CORS or same-origin FastAPI hosting |
|4 | Data/evaluation/docs | Verified HF source/size/schema/licence,32-photo reproducible cache,empty identity evaluation,manual observation log,updated docs | No independent tiger IDs/encounters;institution/licence/provenance/privacy/hosting review pending |

Member numbers are handoff responsibilities, not invented personal names.

## Actual behavior

- Overview: real tiger photo,actual cache count,backend status,explicit identity limitation.
- Detect Animal: actual local detector, live camera permission/stop/device selection/mirroring, serial memory-only frames, bounded stale display, explicit capture, honest failure/upload fallback; substantial species confusion, no field validation.
- Compare Tigers: choose/upload/preview/crop;real cosine-ranked photos;UNKNOWN;query beside up to five actual references;real filenames/available metadata;enlarge/zoom;exact per-score disclaimer;No reliable match established;visual review only.
- Tiger Gallery: photos only,no invented individual groups,IDs,filenames or capture metadata.
- Review History: actual browser-session visual decisions;no live sightings or human-confirmed identity claim.
- Evaluation: separate detector evidence/evaluation, recorded retrieval ranking, ground-truth identity (UNKNOWN/no labels), and human review. Manual observations start empty. An explicitly labelled illustrative sample is separated, excluded from recorded results and exports; no fabricated metric.
- About/Help/Privacy/Responsible/Contact: current truthful source/licence/fallback/privacy information.
- API health/primary response schemas updated for null tiger IDs/threshold. Real source filenames, paths, pose partitions, original annotation paths and published boxes are exposed as optional comparison metadata, not identity evidence.
- Source/crop/media/version caches checked;missing/inconsistent cache reports errors without simulation.
- No database persistence. Retrievals/reviews/observations remain browser memory until exported;free text/images/locations excluded.

## Technology/presentation alignment

| Technology/claim | Status | Honest presentation |
|---|---|---|
| FastAPI,React/TS,Vite,Tailwind,Lucide | Implemented | Real image-retrieval and review application |
| MegaDetector | Evaluated, not selected | Animal/person/vehicle, not tiger species. Tiger-capable SpeciesNet was verified but not installed/timed (~505MB components); compact local YOLOv8s-World ONNX selected instead (MODEL_CARD.md) |
| Live/photo detection | Connected when cache loads | Real open-vocabulary outputs, CPU-only; configured Tiger/Lion/Leopard/Cat/Dog/Person/Animal; scores not accuracy or identity |
| MegaDescriptor | Not connected | Untrained gradient descriptor,not learned re-ID embeddings |
| Supabase | Not configured | Browser-memory session and exports only |
| Tiger identity matching/accuracy | Not validated | No individual labels;identity UNKNOWN,threshold null |
| Tiger photographs from HF | Implemented | Exactly the inspected Tiger-pose subset,no zebra/stock/generated pictures |
| Source transparency | Implemented/tested | Real filenames and available source metadata in comparisons; missing fields omitted; no GPS/EXIF or invented overlays |
| Public/official/Tadoba deployment | Not claimed | Host and deployment approvals remain pending |

No slide file was supplied;unsupported claims above must not be made in unseen slides.

## Short judge explanations

**Detection:** Dataset records retain Tiger-pose annotation crops. `/detect` provides local live-camera/photo YOLOv8s-World v2 inference. Explicit capture re-verifies the chosen non-person box before retrieval; normal Compare uploads remain full-frame unless detect_first/detection_box is explicitly requested. Detection is not identity. Reported people are ignored and block forwarding.

**Descriptor:** The backend represents each crop as512 gradient-histogram numbers. It is an untrained visual descriptor,not MegaDescriptor. There are no learned identity weights or training claims.

**Similarity:** Cosine similarity ranks real reference photos and excludes the same source image for dataset queries. A score is a ranking signal,not identity probability. Adjacent frames/backgrounds can drive similarity.

**Unknown:** The dataset has no individual-tiger labels,so we cannot validate an identity threshold. Threshold is null and identity stays UNKNOWN. A human visual review is recorded separately and does not create a ground-truth tiger ID.

## Judge questions

- **Is this the same tiger?** The photos may look similar,but source identity labels are absent;we cannot certify it.
- **Why no accuracy figure?** No independent labelled identity benchmark exists in this source. Software test success is not identity accuracy.
- **Why always UNKNOWN?** It explicitly communicates absent identity evidence;it is not calibrated unknown-animal rejection.
- **What next?** Find an authorised tiger identity dataset,review a trained model’s licence/training overlap,build encounter-aware held-out known/unknown tests and calibrate only on validation.
- **Does a photo count mean a tiger count?** No. Multiple video frames may show the same individual.

## TODOs / approvals

`src/config/project.ts`: **TODO repositoryUrl,contactEmail,issueUrl**;unset fields are hidden,no dead contacts. Original code licence **pending approval**,MIT proposed;previous approval prompt was skipped. Dataset AGPL-3.0 obligations are separate;full licence and corresponding selected source are provided. **TODO host,region,access,host-level logs,institution/privacy/provenance review** before public deployment.

The prior external site’s frontend/backend URLs and hosting provider were not provided,so no remote-deployment repair is claimed. Current workspace API and same-origin build are tested. Backend respects PORT;README explains separate-host VITE_API_BASE/CORS setup.

Tests/build/audits: TEST_REPORT.md. Basic CI is provided but no remote CI run is claimed.

## Live-camera detector handoff

Source/version/licence/artifact hashes, measured CPU latency and rejected alternatives: MODEL_CARD.md. Local cache is under models/tiger-open-vocabulary; no runtime download. Default cutoff0.25 is a configurable heuristic, not validated. Separate detector120/minute/peer +2/second burst; one bounded inference worker and8s soft timeout. Camera uses getUserMedia only on click, stops tracks on Stop/route/unmount/tab hide, never records audio/GPS/video. Permissions require HTTPS/localhost; embedded policy may require a separate secure tab. Chromium fake-camera tests are explicitly fixtures, not physical-device validation. No labelled detector evaluation has been run. Before field use: licensed independent camera-trap positives/negatives and encounter-aware split, validated detector/cutoff; individual tiger re-ID still requires labelled individuals and a genuine re-ID model. No public AGPL/compliance/hosting approval is granted.

Repeated camera-option request: inspection found the detector/camera implementation already present. Added an explicit Camera detection entry beside Identify upload controls, preserving navigation and upload. Fresh 44 backend/26 frontend/29 browser tests and 13 production detector checks passed; current evidence in TEST_REPORT.md.
