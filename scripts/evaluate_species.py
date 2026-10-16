#!/usr/bin/env python3
"""Produce per-species numbers only from a documented licensed split. Does not invent scores."""
from __future__ import annotations
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "species-evaluation.json"


def main() -> None:
    report = {
        "sentence": "No labelled evaluation has been run for these species.",
        "reason": "No openly licensed, per-image-attributed Tadoba or central-Indian camera-trap set was downloaded in this environment. Host allow-list excludes Kaggle, LILA, and iNaturalist. Forest Department data was not used.",
        "minimum_n": 20,
        "split": None,
        "seed": None,
        "species": {},
        "negatives": {},
        "script": "scripts/evaluate_species.py",
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
