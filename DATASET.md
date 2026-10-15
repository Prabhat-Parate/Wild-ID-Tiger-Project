# Tiger dataset inspection and processing — current scope

## Exact source

https://huggingface.co/datasets/Ultralytics/Tiger-pose

Pinned commit: `81e28ddc5ce42e30671a261e0aa9b20fec81b065`. Ungated. Stated licence: **AGPL-3.0** in card metadata and full repository LICENSE. Attribution: **Ultralytics / Tiger-pose**. Full unmodified card and licence are copied into `data/source/tiger/README.md` and `LICENSE`. The card provides no BibTeX citation; none has been invented. Original selected JPEGs/pose labels are included as corresponding source, plus exact source paths and deterministic processing script. Derivative previews/crops are identified as modified. Team/institution must review licence obligations, image provenance and public-hosting permissions; neither a permissive image licence nor a blanket public-deployment approval is claimed.

The user superseded the earlier GZCD requirement: **tigers only, Hugging Face source only**. The latest targeted-improvements request reverses the earlier metadata-hiding preference: actual source filenames and available source metadata are displayed, missing fields omitted. No zebra cache or prior zebra evaluation is used or shipped in this version.

## Repository actually found

- `train/images/`: **100 JPEGs**, 9,477,661 bytes.
- `train/labels/`: **100 text labels**, 39,742 bytes.
- `val/images/`: **53 JPEGs**, 4,705,560 bytes.
- `val/labels/`: **53 text labels**, 20,800 bytes.
- README, LICENSE, .gitattributes.
- Total actual image files **153**, image bytes **14,183,221**. The card says 210 train + 53 validation; the pinned repository contains only 100 train + 53 validation. We use the actual files, never invent the missing ones.

Full paths/sizes from the inspected tree are retained in `data/source/tiger/inventory.json`. Real source photographs and labels were downloaded and decoded; representative tiger imagery was visually inspected. It includes enclosure/captive scenes, not evidence of a wild camera-trap deployment.

## Actual annotation schema

Each nonempty line has **29 numeric fields**:

`class_id center_x center_y width height keypoint1_x keypoint1_y ... keypoint12_x keypoint12_y`

The first five are YOLO-style normalised class/bounding box; 12 2D keypoints follow. Class zero denotes the dataset’s tiger class, **not individual identity**. The card explicitly says no third dimension for keypoint visibility. Selected labels were checked for 29 fields and class zero. For images with several boxes, the largest-area published box is used for this simple one-query crop. There are **no individual-tiger identity labels** in these files or the inspected repository structure. Filenames such as Frame_0 indicate photographs/frames, never tiger IDs. No pose/class/filename is promoted to an identity.

The safe internal manifest uses an image-record ID derived from SHA256(source path), a decoded-pixel hash for duplicate checking, source paths/split, image dimensions, absolute-pixel converted box, species Tiger and media paths. `individual_id`, capture time, viewpoint, CA score, region box and manual-provenance flag are null because not supplied or not applicable. Nulls are not filled with invented values. The internal manifest does not contain locations.

## Subset / duplicates / transformations

Exactly **32 photographs**. Selection: numerically sort filenames in each source partition, take every fourth filename, interleave train/val sequences, skip exact decoded-pixel duplicates and stop at 32. Image duplicate comparison hashes decoded RGB pixels plus dimensions. No randomness; seed 0 is recorded for consistency, but no random sampling occurs. Exact selected source paths/IDs are in `data/tiger-subset/manifest.json`.

This selection is for a comparison demonstration, **not an identity split**. All 32 can be references; a dataset query’s own source photo is excluded. Different frames may show the same individual. No tiger-count statistic or known/unknown identity partition can be inferred. Images that are near-duplicates/adjacent frames may remain; this limits retrieval evidence and would create leakage if misrepresented as an identity benchmark.

Processing: read source JPEG in stored pixel coordinates, convert RGB, use the largest source bbox, clamp to actual dimensions, crop, resize max960×720 and JPEG encode quality90; full preview max1280×960, quality88. All derivatives are encoded without EXIF/GPS. Selected original source JPEGs checked for EXIF GPS before packaging; no GPS was found. Original source files are not served by /api/media. Uploads differ: apply EXIF orientation then process a metadata-free RGB copy, full-frame by default. The separate live/photo detector can produce a selected, re-verified crop only through explicit user action; see MODEL_CARD.md. No uploaded/camera frame or crop is written into this dataset or served from disk.

Comparison figures display actual source filenames and available whitelisted metadata: dimensions, source path, source pose partition, original annotation path and published box. A supplied capture time/viewpoint/manual-review field is displayed only if present; absent fields have no placeholders. Internal record IDs are not substituted for filenames. No GPS/EXIF or invented overlays are exposed. About & Data includes a Dataset Information section with file-counted included photos/originals/crop derivatives, copied card licence declaration and source-description/attribution text, pose-only/no-identity limitations, and a redistribution-review warning.

## Evaluation / threshold

No individual labels → no scientifically valid identity ground truth, threshold calibration, identity-disjoint splits, unknown-individual test or re-ID accuracy. The source train/val folders are pose-estimation partitions only. No train/validation/test animal split is invented. `evaluation.json` has empty identity result lists and a null threshold. Backend always reports identity UNKNOWN with the explicit absence-of-labels reason. Similarity search still computes actual cosine scores, but these are not identity confidence/probability.

Manual observation log starts empty. Entries are visual observations, not automatically completed identity evaluations. Genuine re-ID needs an authorised tiger dataset with independent individual IDs and encounter-aware validation/test protocols, plus a suitable trained model and model-overlap/licence review.

## Reproduce

`python scripts/load_dataset.py`. Only the pinned Hugging Face repository is downloaded; no fabricated URLs or third-party stock images. Files and labels are discovered from repository listings before selection. Source/derived cache and feature NPZ are included for offline judging. Runtime never downloads the whole dataset into the browser and never uploads queries to Hugging Face or a model provider.
