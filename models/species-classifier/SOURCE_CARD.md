# Species classifier artifacts

- **Label file:** `speciesnet.labels.txt` copied from [google/cameratrapai](https://github.com/google/cameratrapai) `data/model_package/always_crop_99710272_22x8_v12_epoch_00148.labels.txt` (Apache-2.0). SHA-256 `e0c41415d9b29dfd6d2e2494205d1197d28595cc6f69cb129495f9827155547e`.
- **Weights:** not present. SpeciesNet weights are distributed via Kaggle (`google/speciesnet`). They were not downloaded (this environment cannot reach Kaggle/GCS). Runtime never fetches them.
- **MegaDetector:** not installed. YOLO-World remains the localizer fallback.
- **BioCLIP / PyTorch:** not installed; CPU ONNX Runtime is the supported runtime.

Until `model.onnx` is operator-cached and hashed, the app reports **Species classifier unavailable** and does not simulate names.
