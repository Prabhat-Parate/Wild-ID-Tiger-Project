# Data sources — Tadoba reference registry

This file documents `data/tadoba-species.json`. It is a **literature reference list**, not a claim that Wild-ID is deployed at Tadoba, has reserve data, or has been validated there.

Published mammal totals for the reserve disagree (41, 62, 80 appear in secondary sources). This project states only the **number of registry entries in the file**, never a total fauna count as fact.

## Sources requested

| Source | Status in this checkout |
|---|---|
| ZSI *Fauna of Tadoba-Andhari Tiger Reserve* https://zsi.gov.in/PDFVolumes/cas/025/index.pdf | Not fully retrieved here; URL recorded. |
| NTCA / Project Tiger reserve brief | Not fully retrieved; URL recorded. |
| BirdLife / KBA factsheet | Not fully retrieved; URL recorded. |
| Maharashtra Forest Department checklist | Not fully retrieved. |

Scientific names use standard taxonomy. `verification_status`:

- `literature_standard` — widely used scientific name; Tadoba occurrence treated as the operator-supplied Tier A list, **not** re-verified against the ZSI PDF in this environment.
- `unconfirmed_for_tadoba` — Tier B taxa commonly reported for central Indian forests; **not** confirmed here for Tadoba. Shown as such in the UI.
- Detector-only labels that are not on the list are flagged **Not on the Tadoba reference list**.

Rare species (e.g. Indian pangolin) have **no site-specific location notes**.

Realistic camera detection in this app covers larger vertebrates. Birds, reptiles, amphibians, fish, and insects may be listed without being named by the detector.

The detector vocabulary is **not** this list. It is read from the loaded model manifest at runtime (`/api/health` `detector_labels`, `/api/species` `detector_labels`).

## SpeciesNet label space (Apache-2.0)

File `models/species-classifier/speciesnet.labels.txt` from [google/cameratrapai](https://github.com/google/cameratrapai) (2498 labels). **Weights were not downloaded.** Support flags in `/api/species` are computed by scientific-name match against this file (`backend/taxonomy.py`), not typed by hand.

Documented synonyms: `Muntiacus muntjak`/`Muntiacus vaginalis`; `Urva edwardsii`/`Herpestes edwardsii`; `Urva smithii`/`Herpestes smithii`; `Icthyophaga ichthyaetus`/`Haliaeetus ichthyaetus`.

Coverage vs this label file is in `docs/speciesnet-coverage.json`. That is **vocabulary coverage**, not accuracy on Tadoba images.

No labelled evaluation set was collected (Kaggle/LILA/iNaturalist hosts are not available here). `scripts/evaluate_species.py` records that fact.
