"""Tadoba reference registry loader. Separate from detector vocabulary."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = ROOT / "data" / "tadoba-species.json"

GENERIC_LABELS = {"Animal", "Cat", "Dog", "Person"}


def load_registry(path: Path = REGISTRY_PATH) -> dict:
    if not path.is_file():
        return {
            "title": "Tadoba-Andhari reference species registry",
            "disclaimer": "Registry file missing.",
            "entry_count_label": "Registry entries in this file (not a total fauna count for the reserve)",
            "species": [],
        }
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data.get("species"), list):
        raise ValueError("Invalid registry")
    return data


def annotate_species(label: str, registry: dict | None, detector_labels: list[str]) -> dict:
    """Map a detector label to species_status without guessing."""
    labels = set(detector_labels or [])
    if label not in labels and label != "Person":
        return {
            "label": "Animal",
            "display_label": "Animal detected (species not determined)",
            "species_status": "undetermined",
            "ignored": False,
        }
    if label == "Person":
        return {
            "label": "Person",
            "display_label": "Person detected, ignored",
            "species_status": "undetermined",
            "ignored": True,
        }
    species = (registry or {}).get("species") or []
    match = next((s for s in species if s.get("detector_label") == label), None)
    if match:
        return {
            "label": label,
            "display_label": match["common_name"],
            "species_status": "named",
            "ignored": False,
        }
    if label in GENERIC_LABELS:
        return {
            "label": label,
            "display_label": "Animal detected (species not determined)",
            "species_status": "undetermined",
            "ignored": False,
        }
    return {
        "label": label,
        "display_label": label,
        "species_status": "not_on_reference_list",
        "ignored": False,
    }


def registry_with_support(registry: dict, detector_labels: list[str]) -> dict:
    labels = set(detector_labels or [])
    species = []
    for s in registry.get("species") or []:
        item = dict(s)
        supported = bool(item.get("detector_label") and item["detector_label"] in labels)
        item["detector_supported"] = supported
        item["support_flag"] = (
            "Supported" if supported else "Not supported by current detector"
        )
        species.append(item)
    extra = []
    mapped = {s.get("detector_label") for s in species if s.get("detector_label")}
    for lab in detector_labels or []:
        if lab in GENERIC_LABELS:
            continue
        if lab not in mapped:
            extra.append(
                {
                    "common_name": lab,
                    "scientific_name": None,
                    "group": "unknown",
                    "tier": None,
                    "source_urls": [],
                    "notes": "Detector vocabulary only.",
                    "detector_label": lab,
                    "verification_status": "not_on_reference_list",
                    "detector_supported": True,
                    "support_flag": "Not on the Tadoba reference list",
                }
            )
    return {
        **{k: v for k, v in registry.items() if k != "species"},
        "entry_count": len(registry.get("species") or []),
        "species": species,
        "detector_only_labels": extra,
        "detector_labels": list(detector_labels or []),
    }
