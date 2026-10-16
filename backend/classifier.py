"""Local species classifier. Never invents scores. Weights are operator-cached only."""
from __future__ import annotations
import hashlib, json, logging, os
from pathlib import Path
from typing import Protocol
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DIR = ROOT / "models" / "species-classifier"


class SpeciesClassifier(Protocol):
    name: str
    version: str
    labels: list[str]
    cutoff: float
    vocabulary: list

    def classify(self, crop: Image.Image) -> dict: ...


class OnnxCropClassifier:
    """ONNX crop classifier. Loaded only when model.onnx verifies against the manifest."""

    def __init__(self, directory: Path):
        import onnxruntime as ort
        from backend.taxonomy import parse_speciesnet_labels

        self.directory = directory
        manifest_path = directory / "manifest.json"
        if not manifest_path.is_file():
            raise FileNotFoundError("classifier manifest missing")
        info = json.loads(manifest_path.read_text(encoding="utf-8"))
        model_path = directory / info.get("model_file", "model.onnx")
        expected = (info.get("sha256") or {}).get(model_path.name)
        if not model_path.is_file():
            raise FileNotFoundError("classifier weights missing")
        digest = hashlib.sha256(model_path.read_bytes()).hexdigest()
        if expected and digest != expected:
            raise ValueError("Classifier artifact integrity check failed")
        self.name = info.get("name", "Species classifier")
        self.version = info.get("version", "unknown")
        labels_file = directory / info.get("labels_file", "speciesnet.labels.txt")
        self.vocabulary = parse_speciesnet_labels(labels_file)
        self.labels = [l.scientific or l.common for l in self.vocabulary]
        self.cutoff = float(os.getenv("CLASSIFIER_SCORE_CUTOFF", info.get("cutoff", "0.25")))
        if not 0 < self.cutoff < 1:
            raise ValueError("CLASSIFIER_SCORE_CUTOFF must be between zero and one")
        intra = max(1, int(os.getenv("ONNX_INTRA_OP_THREADS", "2")))
        inter = max(1, int(os.getenv("ONNX_INTER_OP_THREADS", "1")))
        options = ort.SessionOptions()
        options.intra_op_num_threads = intra
        options.inter_op_num_threads = inter
        self.session = ort.InferenceSession(
            str(model_path), sess_options=options, providers=["CPUExecutionProvider"]
        )
        self.input_name = self.session.get_inputs()[0].name
        shape = self.session.get_inputs()[0].shape
        self.side = 224
        if isinstance(shape, (list, tuple)) and len(shape) >= 4:
            try:
                self.side = int(shape[-1])
            except (TypeError, ValueError):
                self.side = 224

    def classify(self, crop: Image.Image) -> dict:
        im = crop.convert("RGB").resize((self.side, self.side), Image.Resampling.BILINEAR)
        tensor = np.asarray(im, dtype=np.float32).transpose(2, 0, 1)[None] / 255.0
        out = self.session.run(None, {self.input_name: tensor})[0]
        vec = np.asarray(out).reshape(-1)
        if not np.isfinite(vec).all() or vec.size == 0:
            raise ValueError("Invalid classifier output")
        # Softmax only if values are not already in (0,1] summing ~1
        if vec.min() < 0 or vec.max() > 1.0001:
            e = np.exp(vec - vec.max())
            vec = e / e.sum()
        k = min(5, vec.size)
        order = np.argsort(-vec, kind="stable")[:k]
        top = []
        for i in order:
            if i >= len(self.vocabulary):
                break
            lab = self.vocabulary[int(i)]
            top.append(
                {
                    "label": lab.common or lab.scientific,
                    "scientific_name": lab.scientific or None,
                    "rank": lab.rank,
                    "score": float(vec[int(i)]),
                }
            )
        if not top or top[0]["score"] < self.cutoff:
            return {
                "label": None,
                "scientific_name": None,
                "rank": "undetermined",
                "score": float(top[0]["score"]) if top else 0.0,
                "top_k": top,
            }
        best = top[0]
        return {
            "label": best["label"],
            "scientific_name": best["scientific_name"],
            "rank": best["rank"],
            "score": best["score"],
            "top_k": top,
        }


class VocabularyOnly:
    """Label space on disk without weights. classify() is never called."""

    def __init__(self, directory: Path):
        from backend.taxonomy import parse_speciesnet_labels

        labels_file = directory / "speciesnet.labels.txt"
        self.vocabulary = parse_speciesnet_labels(labels_file)
        self.labels = [l.scientific or l.common for l in self.vocabulary]
        self.name = "SpeciesNet label space (weights not loaded)"
        self.version = "labels-only"
        self.cutoff = float(os.getenv("CLASSIFIER_SCORE_CUTOFF", "0.25"))

    def classify(self, crop: Image.Image) -> dict:
        raise RuntimeError("Classifier weights are not loaded")


def load_classifier() -> tuple[SpeciesClassifier | None, VocabularyOnly | None]:
    log = logging.getLogger("wildid")
    directory = Path(os.getenv("CLASSIFIER_DIR", str(DEFAULT_DIR)))
    vocab = None
    try:
        if (directory / "speciesnet.labels.txt").is_file():
            vocab = VocabularyOnly(directory)
    except Exception:
        vocab = None
    if os.getenv("WILDID_CLASSIFIER", "onnx") == "none":
        log.info(json.dumps({"event": "classifier_disabled"}))
        return None, vocab
    try:
        model = OnnxCropClassifier(directory)
        log.info(json.dumps({"event": "classifier_loaded", "name": model.name, "version": model.version}))
        return model, vocab
    except Exception as e:
        log.warning(
            json.dumps(
                {
                    "event": "classifier_unavailable",
                    "error_type": type(e).__name__,
                    "action": "Run python scripts/setup_species_model.py when weights are licensed and reachable; restart API",
                }
            )
        )
        return None, vocab
