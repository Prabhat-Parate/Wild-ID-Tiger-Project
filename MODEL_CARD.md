# Tiger image retrieval — model/method card (0.2.0)

## Connected method

**Spatial gradient histogram v1 (untrained)**, backend/retrieval.py. Method label: image retrieval / image similarity. There are no trained weights or training data. Crop -> grayscale128×128 -> spatial magnitude-weighted unsigned gradient histogram (8×8 cells,8 orientation bins) -> per-cell and whole-vector L2 normalisation. Output:512 dimensions. Rank by cosine similarity over real tiger reference crops. Cache in data/tiger-subset/features.npz; all vectors recomputed in tests.

Dataset animal crops use published Tiger-pose bounding boxes. MegaDetector is not loaded. Local open-vocabulary detection is now a separate module; normal Compare uploads remain EXIF-oriented full-frame unless the user explicitly requests a detector crop. Camera/photo detection never creates an identity embedding. No learned identity embedding or MegaDescriptor is connected. No external inference or model upload is used. The previously inspected MegaDescriptor model is CC BY-NC4.0 and is still not incorporated; do not claim it is trained/validated on these tigers.

## Identity logic — no fake threshold

Ultralytics/Tiger-pose has pose/class labels, **not individual animal IDs**. We cannot calibrate a tiger identity threshold. Therefore the API uses threshold=null and identity status UNKNOWN for every result. This is an explicit inability to establish identity, **not** a claim that an animal is absent/new or a calibrated unknown-rejection method. No prior zebra threshold or result is reused.

A visual-review confirmation means “these photographs appear visually similar,” not “same tiger proven.” Records carry review_scope=visual_similarity_only; candidate/ground-truth identity values are null. Scores are actual cosine similarities, never probability or accuracy. Same source photo is excluded for dataset queries; uploaded copies cannot reliably be linked and may trivially self-match.

## Evaluation actually performed

Software tests cover real descriptor computation, reference ranking, crop/upload validation, no invented identities/threshold, duplicate/source exclusion and UNKNOWN. **No identity benchmark, accuracy, true/false identity-match rate, calibrated unknown rate or field validation is reported.** Source train/val are pose partitions. Adjacent frames/near-duplicates may remain, multiple images may show one individual, and enclosure imagery does not establish camera-trap generalisation. Manual condition observations begin empty and are not converted into accuracy metrics.

## Intended use and limits

Tiger photograph browsing, visual pattern comparison, transparent research workflow and reviewer observations. Not for enforcement/legal evidence, automated wildlife decisions, population counts, Tadoba/deployed monitoring claims or verified re-identification. Pose/background/lighting/blur/occlusion affect the simple descriptor. A trained re-ID model, authorised individual-identity labels, independent encounter-aware splits, hard negatives and validation-only threshold calibration are required before genuine matching claims.

## Versions / permissions

Dataset source https://huggingface.co/datasets/Ultralytics/Tiger-pose, commit81e28ddc5ce42e30671a261e0aa9b20fec81b065, repository-statedAGPL-3.0. Full licence, card, selected original photographs/annotations and modifications are included. Original project-code licence pending team approval; do not assume a proposed MIT licence overrides third-party obligations. Dependencies pinned in npm/Python locks; dataset notes in DATASET.md.

## Targeted comparison / evaluation safeguards

The retrieval algorithm, 512-dimensional untrained descriptor, cosine scoring and null threshold are unchanged. Query and up to five actual reference photographs are inspectable/enlargeable, with real filenames and available source metadata. Every displayed similarity value has the exact warning: “Similarity indicates visual resemblance, not verified individual identity.” Scores are relative ranking values, not probabilities.

No reliable match established: this descriptor has not been validated for individual tiger re-identification, and this source has no individual-level ground truth. Evaluation keeps recorded ranks/scores separate from null identity ground truth/source and human review decisions. No individual-level ground truth available. Re-identification accuracy cannot be computed. The labelled illustrative sample is not a performed experiment, provides no numerical score, and is excluded from recorded results/exports. Software-test success is not identity accuracy.

## Two-stage classifier decision — 2026-10-16

Measured in this environment: **no Hugging Face, Kaggle, or GCS downloads**. PyTorch was not installed (ONNX Runtime already in requirements; SpeciesNet PyTorch stack was rejected as too large for this CPU image without weights).

| Candidate | Licence (verified) | Result |
|---|---|---|
| SpeciesNet labels + EfficientNet V2 M | Code Apache-2.0 on GitHub; weights on Kaggle (terms not fetched) | **Labels cached** (2498). **Weights not loaded.** Coverage of Tier A mammals is species-level in the label file except Sarus crane (genus *Antigone* only) and grey-headed fish eagle (absent). |
| MegaDetector | Typically Community Data License / MD terms on GitHub | Not downloaded. YOLO-World remains localizer. |
| BioCLIP | Open data / model cards on HF | Not downloaded (HF blocked). CPU cost not measured. |

**Runtime:** stage 1 YOLO-World if present; stage 2 ONNX crop classifier only if `model.onnx` hashes. `WILDID_CLASSIFIER=none` disables stage 2. Live video: `CLASSIFY_ON_LIVE=0` (classify on detect requests still runs if weights exist; without weights, boxes only). Latency of two-stage inference **not measured** (no classifier weights, no localizer weights in this sandbox).

No labelled species evaluation: see `docs/species-evaluation.json`.

## Detector decision record — 2026-10-16 (multi-species / Tadoba reference)

Options evaluated; **no new weights were downloaded in this pass** (operator setup is explicit; this environment has no Hugging Face access for MegaDetector/SpeciesNet).

1. **Two-stage MegaDetector + SpeciesNet** — Rejected for this checkout: weights are not in the tree, licences and Indian-fauna coverage were not verified on-device, and runtime download is forbidden. Camera-trap localizer + species classifier remains the preferred *future* path once an operator caches licensed weights.
2. **Extend YOLO-World prompts** to every Tadoba registry name — Rejected without a labelled test: the current model already confuses tiger and leopard. Adding more look-alike prompts without evaluation would name species it cannot support honestly.
3. **Fine-tune** — Rejected: no licensed Tadoba camera-trap set and no Forest Department permission.

**Kept:** existing YOLOv8s-World v2 ONNX (`models/tiger-open-vocabulary`, AGPL-3.0, commit `7e1d02c9467c32b141df81890737490764776785`). Labels from the manifest: Tiger, Lion, Leopard, Cat, Dog, Person, Animal. Fallback remains the `Detector` protocol. Unnamed boxes: “Animal detected (species not determined)”. Score cutoff remains a configurable heuristic.

No labelled per-species evaluation has been run. **No labelled evaluation has been run for these species.**

## Detector decision record — 2026-10-15

### Chosen, actually loaded and run

**YOLOv8s-World v2 ONNX with genuine cached CLIP text embeddings**, `backend/detection.py` (a pluggable `Detector` protocol with explicit unavailable fallback). This is an open-vocabulary object detector, not a trained tiger-specific species classifier or identity model. We chose a ~49 MiB detector because this sandbox has Python3.13.16,2 CPU vCPUs,about1.9GiB RAM and no exposed NVIDIA GPU. Network access was verified for explicit setup; judging/runtime does not download weights or send frames externally.

| Artifact | Verified source/version | Licence / size |
|---|---|---|
| Detector ONNX | https://huggingface.co/Instemic/yolo-world-onnx, commit `7e1d02c9467c32b141df81890737490764776785`, `yolov8s-worldv2.onnx`; card says exported from Ultralytics8.4.37 | Repository-stated **AGPL-3.0**;51,142,204bytes (48.77MiB). SHA-256 `381ced485b23ed8f06de3e82bb2745e1420c181c64f0a176784c34a959d550a1` |
| Text embeddings | https://huggingface.co/Xenova/clip-vit-base-patch32, commit `d15189d7028b43f1d3e65039190477f6af591c2a`; OpenAI CLIP ViT-B/32 text encoder | Upstream CLIP **MIT** (https://github.com/openai/CLIP); setup-only quantized text ONNX64,504,507bytes; cached runtime feature array14,464bytes. Source OpenAI HF commit `3d74acf9a28c67741b2f4f2ea7635f0aaf6f0268`; OpenAI code licence at commit `d05afc436d78f1c48dc0dbf8e5980a9d471f35f6` |
| Runtime | `onnxruntime==1.31.0`, CPUExecutionProvider,2 intra-op /1 inter-op threads | MIT; pins in requirements/lock. New transitive pins flatbuffers25.12.19 (Apache-2.0), protobuf7.36.2 (BSD-3-Clause). No PyTorch/transformers/Ultralytics Python runtime added. |

Prompt/label order is fixed: **Tiger,Lion,Leopard,Cat,Dog,Person,Animal**, with corresponding text `a photo of a tiger`, `a photo of a lion`, etc. Exact prompt text (including `a photo of a animal` for the generic class), model/text commits and checksums are recorded in `models/tiger-open-vocabulary/manifest.json`. `scripts/setup_detector.py` encodes actual CLIP vocabulary sequences and produces normalized text embeddings, not hand-designed/random vectors. Only the detector and those small cached features load during inference. The setup encoder/vocabulary live in excluded `.cache/detector-setup/`, not the judging runtime. Operator setup verifies fixed SHA-256 values for model, encoder and vocabulary before reuse/download completion. No species check is delegated to a third party.

The model emits scores for these configured prompts. The highest-scoring prompt per anchor determines the class; the app does not force a Tiger label. Other animal predictions are displayed as **Animal detected (species not determined)**, with the raw unverified model label available. Person outputs are ignored and block forwarding the entire frame. Identity remains UNKNOWN in every case.

Preprocessing: decoded/EXIF-oriented RGB,640×640 letterbox with114 padding; bilinear resize; float32 RGB/[255]. Postprocessing: native decoded xywh boxes, class outputs already sigmoid-transformed, heuristic cutoff0.25, greedy animal-class-agnostic NMS IoU0.45 (person NMS separate), at most20 returned boxes; invert padding/scale and clamp normalized `[x1,y1,x2,y2]` to[0,1]. Neither cutoff nor NMS parameter is scientifically validated. The score cutoff is configurable via `DETECTION_SCORE_CUTOFF`.

**Verified source-card discrepancy:** the exporter card says the class channels are logits and to apply sigmoid. Inspection of the actual downloaded ONNX graph using ONNX1.23.2 showed output `Concat(node_cat_20)` fed by `Sigmoid(node_sigmoid_4)` for class scores, consistent with upstream Ultralytics8.4.37 detection-head inference. Applying sigmoid again would spuriously promote tiny background scores toward0.5. We use the native output, not a second sigmoid. ONNX graph inspection was an operator check, not an added runtime dependency.

### Other real options evaluated, not claimed to be benchmarked

| Option | Verified facts, licence/runtime and reason not selected |
|---|---|
| MegaDetector | Official [MegaDetector](https://microsoft.github.io/MegaDetector/) / https://github.com/microsoft/MegaDetector has animal/person/vehicle classes, **not tiger species**. Repository code MIT; V6 model licences vary (MIT/Apache-2.0/AGPL-3.0 by variant), so the code licence must not be assumed for every weight. Needs a separately verified tiger classifier to meet tiger-specific labeling. It was not loaded or timed here; no paired compact tiger classifier was established for this option. [1](https://microsoft.github.io/MegaDetector/) |
| Camera-trap detector plus species classifier | **SpeciesNet exists and includes tiger.** Verified https://github.com/google/cameratrapai commit `20c5c33cfd23e5ae2ec93f2cc04177e7ef2050fc` (Apache-2.0 code); HF mirror https://huggingface.co/earthtoolsmaker/speciesnet commit `8fb0eeea863afe62e442305bf41112316bf59709` declares Apache-2.0. Its4.0.1a label file includes `mammalia;carnivora;felidae;panthera;tigris;tiger`. Classifier224,393,837bytes plus bundled MegaDetector280,766,885bytes (~505MB), PyTorch stack and separate component-licence review exceed the intended small shipping budget here; not installed or timed. A third-party ONNX classifier mirror is223,998,606bytes and declares MIT, which is not assumed to override upstream/component terms. PyTorch-Wildlife's Amazon/Serengeti classifier source lists were also inspected: neither includes a tiger species class. |
| Larger open-vocabulary / zero-shot | https://huggingface.co/google/owlv2-base-patch16 commit `2a1560802f8cf3c408fec9b809d705f56a2f7146` exists, card Apache-2.0, safetensors619,918,824bytes before runtime/activations. Rejected for the intended CPU/memory/shipping budget, not because a latency test failed; not downloaded or benchmarked. The chosen51MB YOLO-World graph provides open-vocabulary detection without runtime text encoding. A CLIP classifier alone cannot provide bounding boxes. |
| Tiger-pose fine-tuning of YOLO | Actual HF Tiger-pose data is AGPL-3.0, as is Ultralytics code/weights. Common COCO class sets have **no tiger class**; a pretrained COCO detector cannot honestly be renamed Tiger. Only32 bundled tiger photographs, correlated adjacent frames and no verified negative set are available here. We did not train a tiny leaky detector or invent a held-out result. This option requires a broader authorized dataset, negatives and encounter-aware splits. |

Repositories named wildlife-tiger found during inspection were Stable Diffusion/text-to-image assets, not detectors; they were rejected. No claim is made that all alternate weights were downloaded, inference-tested or incompatible in every environment.

### Measured latency and qualitative check — not accuracy

Run: `python scripts/evaluate_detector.py`. Machine:2 CPU vCPUs,no exposed GPU,Python3.13.16,ONNX Runtime CPU provider. Current committed `docs/detector-qualitative.json` reports **32 source images run**, **32 with at least one animal detection**, **8 with a Tiger output and24 with a Leopard output**. These are raw output counts, **not an accuracy/detection-rate percentage, precision or recall**. The substantial species confusion is a real limitation, not hidden by relabelling Leopard as Tiger.

Latest run: first image171.23ms, median156.22ms, range142.77–213.09ms, including image preprocessing/inference/postprocessing but excluding HTTP/browser/network time. Earlier exploratory timings were about145ms median; CPU contention changes latency. The UI serializes requests with800ms after completion (around1fps here), not an asserted2fps guarantee. Browser camera/encoding/transport cost adds latency; slower clients and concurrent users back off rather than queue frames. Only one detector worker runs at once.

**No labelled detector evaluation has been run.** All32 bundled source photos were selection/demo material; nearby frames can show the same encounter. No training-overlap audit or independent licensed tiger-absent natural-image set exists here. There is **no held-out test split, validated threshold, precision, recall, IoU benchmark or detector accuracy**. The synthetic empty frame and intercepted model responses in tests are explicitly software-test fixtures, not invented benchmark negatives. A valid field evaluation must keep all frames from the same encounter/video/camera-location grouping in one split, check near-duplicates, acquire authorized labelled positives/negatives with verified licences, reserve an untouched test set and tune only on a separate validation set.

### Operational, privacy and licence limits

- Startup loads only local hashed artifacts. Missing/disabled/corrupt weights or inference failure reports Detector unavailable; `/api/detect` returns503, no simulated boxes. Setup: install pinned requirements, `python scripts/setup_detector.py` **before judging**, restart API, check health. Set `WILDID_DETECTOR=none` to exercise explicit unavailability; original retrieval still works.
- The default0.25 cutoff is a **configurable heuristic, not validated**. Detections are image-space boxes, class labels and raw scores, not individual identity or verified live-animal presence. Scores are not a probability or measure of accuracy. Toys, domestic cats, other big cats, printed/screen tigers, stripes, low light, motion, distance and occlusion cause false positives/negatives. Species output confusion was observed; do not deploy this as an automatic tiger alert, privacy filter or safety/enforcement system.
- Camera access requires explicit click/permission and HTTPS/localhost; no audio/GPS. Tracks stop on stop/route/unmount/tab hide/page exit. Frames processed in bounded backend memory, never logged/saved; one in-flight browser job and one bounded worker, separate120/minute/peer and2/second burst limit,8s soft inference timeout. Cancellation/timeouts do not kill a running native inference; the worker stays occupied until it finishes, without starting another. Host-level memory/access/logging still require review.
- Display smoothing targets expiry1.2s from capture, scheduled with a timeout; browser scheduling can delay UI work. A negative frame may briefly retain the previous positive until expiry; late positives are discarded, errors/unavailability clear boxes. This is not tracking. Explicit user capture stops video, selects one returned animal box, blocks reported people, re-runs the detector to verify the requested box and performs retrieval on that crop. No uploaded crop is stored/served: `crop_url=null`, pixel/normalized box and provenance are returned, browser renders the transient crop.
- AGPL-3.0 applies to chosen model weights; Tiger-pose data also states AGPL-3.0. Preserve licence/attribution and obtain review of applicable corresponding-source and network-service obligations before public hosting/distribution. Custom ONNX export-source completeness has not been independently certified; obtain the export source/build instructions from its publisher if required. Original project-code licence remains pending team approval, not silently changed to MIT/AGPL here. No chosen non-commercial-only model or remote inference service is incorporated. Full AGPL and CLIP MIT texts, source card, manifest/checksums and wrapper/setup code are included; notices do not constitute legal clearance.
