#!/usr/bin/env python3
"""Operator-only. Cache SpeciesNet label file (GitHub) and attempt classifier weights.
Never called at API startup. UTF-8. Resumable. Hash-verified.
Weights are published on Kaggle/GCS, not GitHub; this sandbox cannot fetch them.
"""
from __future__ import annotations
import hashlib, json, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "models" / "species-classifier"
LABELS_API = "https://api.github.com/repos/google/cameratrapai/contents/data/model_package/always_crop_99710272_22x8_v12_epoch_00148.labels.txt"
LABELS_NAME = "speciesnet.labels.txt"
EXPECTED_LABELS = "e0c41415d9b29dfd6d2e2494205d1197d28595cc6f69cb129495f9827155547e"
# Public pointer only. Not downloaded here (host not in operator allow-list / gated).
WEIGHTS_NOTE = "https://www.kaggle.com/models/google/speciesnet (Apache-2.0 code; confirm weight terms on Kaggle before use)"


def fetch_github_raw(url: str, dest: Path, expected: str | None) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.is_file() and expected and hashlib.sha256(dest.read_bytes()).hexdigest() == expected:
        print("cached", dest)
        return
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github.raw", "User-Agent": "wild-id-setup"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    if expected and hashlib.sha256(data).hexdigest() != expected:
        raise ValueError("Label file hash mismatch")
    dest.write_bytes(data)
    print("wrote", dest, len(data))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    fetch_github_raw(LABELS_API, OUT / LABELS_NAME, EXPECTED_LABELS)
    weights = OUT / "model.onnx"
    info = {
        "name": "SpeciesNet crop classifier (ONNX if present)",
        "version": "always_crop_99710272_22x8_v12_epoch_00148",
        "licence_code": "Apache-2.0 (google/cameratrapai)",
        "labels_file": LABELS_NAME,
        "labels_sha256": EXPECTED_LABELS,
        "model_file": "model.onnx",
        "weights_present": weights.is_file(),
        "weights_source": WEIGHTS_NOTE,
        "runtime": "onnxruntime CPU",
        "note": "This script does not download Kaggle/GCS weights. Place a verified ONNX export at models/species-classifier/model.onnx and record sha256 in manifest.json.",
    }
    (OUT / "manifest.json").write_text(json.dumps(info, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(info, indent=2))
    if not weights.is_file():
        print("Classifier weights absent. Pipeline will localize only.", file=sys.stderr)


if __name__ == "__main__":
    main()
