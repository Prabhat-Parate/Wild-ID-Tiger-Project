"""Localize then classify animal crops. People and vehicles are never cropped."""
from __future__ import annotations
import os, time
from PIL import Image
from backend.species import annotate_detection
from backend.taxonomy import match_scientific

PERSON_LABELS = {"person", "human"}
VEHICLE_LABELS = {"vehicle", "car", "truck"}


def crop_box(image: Image.Image, bbox: list[float], margin: float, min_side: int) -> Image.Image | None:
    w, h = image.size
    x1, y1, x2, y2 = bbox
    bw, bh = x2 - x1, y2 - y1
    x1 = max(0.0, x1 - margin * bw)
    y1 = max(0.0, y1 - margin * bh)
    x2 = min(1.0, x2 + margin * bw)
    y2 = min(1.0, y2 + margin * bh)
    left, top = int(x1 * w), int(y1 * h)
    right, bottom = min(w, int(round(x2 * w))), min(h, int(round(y2 * h)))
    if right - left < min_side or bottom - top < min_side:
        return None
    return image.crop((left, top, right, bottom))


def run_pipeline(image: Image.Image, detector, classifier, registry) -> tuple[list[dict], dict]:
    t0 = time.perf_counter()
    boxes = detector.detect(image)
    localizer_ms = (time.perf_counter() - t0) * 1000
    cap = max(1, int(os.getenv("CLASSIFY_MAX_CROPS", "4")))
    margin = float(os.getenv("CLASSIFY_CROP_MARGIN", "0.08"))
    min_side = max(16, int(os.getenv("CLASSIFY_MIN_CROP", "32")))
    live = os.getenv("CLASSIFY_ON_LIVE", "0") == "1"
    # Caller sets WILDID_CLASSIFY_THIS_FRAME=1 for capture/upload; live video defaults off.
    this_frame = os.getenv("WILDID_CLASSIFY_THIS_FRAME", "1" if live else "1") != "0"
    classifier_ms = 0.0
    detector_labels = detector.labels if detector else []
    classified = 0
    eligible = []
    for d in boxes:
        lab = (d.get("label") or "").lower()
        if lab in PERSON_LABELS or d.get("label") == "Person":
            meta = annotate_detection("Person", registry, detector_labels, None)
            d.update(meta)
            d["rank"] = "undetermined"
            d["localizer_score"] = d.get("score")
            d["classifier_score"] = None
            d["scientific_name"] = None
            continue
        if lab in VEHICLE_LABELS:
            d.update(
                {
                    "display_label": "Vehicle detected, ignored",
                    "species_status": "undetermined",
                    "ignored": True,
                    "rank": "undetermined",
                    "localizer_score": d.get("score"),
                    "classifier_score": None,
                }
            )
            continue
        eligible.append(d)
    eligible.sort(key=lambda x: -float(x.get("score") or 0))
    for d in eligible:
        meta = annotate_detection(d.get("label") or "Animal", registry, detector_labels, None)
        d.update(meta)
        d["rank"] = "undetermined" if d.get("species_status") != "named" else "species"
        d["localizer_score"] = d.get("score")
        d["classifier_score"] = None
        d["scientific_name"] = d.get("scientific_name")
        d["top_k"] = None
        if classifier is None or classified >= cap or not this_frame:
            continue
        crop = crop_box(image, d["bbox"], margin, min_side)
        if crop is None:
            continue
        t1 = time.perf_counter()
        result = classifier.classify(crop)
        classifier_ms += (time.perf_counter() - t1) * 1000
        classified += 1
        d["classifier_score"] = result.get("score")
        d["top_k"] = result.get("top_k")
        d["classifier_name"] = classifier.name
        d["classifier_version"] = classifier.version
        sci = result.get("scientific_name")
        rank = result.get("rank") or "undetermined"
        d["rank"] = rank
        if result.get("label") and rank == "species" and sci:
            match = match_scientific(sci, getattr(classifier, "vocabulary", []) or [])
            if match.get("level") == "species":
                from backend.taxonomy import SYNONYMS, _norm
                on_ref = None
                for s in (registry or {}).get("species") or []:
                    ref = _norm(s.get("scientific_name") or "")
                    if ref == _norm(sci) or _norm(sci) in SYNONYMS.get(ref, []) or ref in SYNONYMS.get(_norm(sci), []):
                        on_ref = s
                        break
                if on_ref:
                    d["label"] = result["label"]
                    d["display_label"] = on_ref["common_name"]
                    d["scientific_name"] = on_ref["scientific_name"]
                    d["species_status"] = "named"
                    d["rank"] = "species"
                else:
                    d["label"] = result["label"]
                    d["display_label"] = result["label"]
                    d["scientific_name"] = sci
                    d["species_status"] = "not_on_reference_list"
                    d["rank"] = "species"
            elif match.get("level") in {"genus", "family"}:
                d["display_label"] = f"{match.get('matched_label')} ({match.get('rank')} not determined to species)"
                d["scientific_name"] = match.get("scientific_name")
                d["species_status"] = "higher_rank_only"
                d["rank"] = match.get("rank")
            else:
                d["display_label"] = "Animal (species not determined)"
                d["species_status"] = "undetermined"
                d["rank"] = "undetermined"
        elif result.get("label") and rank in {"genus", "family"}:
            d["display_label"] = f"{result['label']}, {rank} (species not determined)"
            d["scientific_name"] = sci
            d["species_status"] = "higher_rank_only"
            d["rank"] = rank
        else:
            if d.get("species_status") != "named":
                d["display_label"] = "Animal (species not determined)"
                d["species_status"] = "undetermined"
    timings = {
        "localizer_ms": round(localizer_ms, 2),
        "classifier_ms": round(classifier_ms, 2),
        "total_ms": round(localizer_ms + classifier_ms, 2),
        "crops_classified": classified,
    }
    return boxes, timings
