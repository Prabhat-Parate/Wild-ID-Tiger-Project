---
license: agpl-3.0
tags:
  - object-detection
  - yolo
  - yolo-world
  - open-vocabulary
  - onnx
pipeline_tag: object-detection
---

# YOLOv8-World v2 — ONNX with dynamic text prompts

ONNX exports of Ultralytics YOLOv8-World v2 (`yolov8s-worldv2.pt`, `yolov8l-worldv2.pt`)
with a **dynamic `txt_feats` input** so class prompts can be re-encoded at runtime
(zero-shot open-vocabulary detection), rather than being baked into the graph.

## Files

| File | Size | Params |
|---|---|---|
| `yolov8s-worldv2.onnx` | 48.8 MB | 12.7 M |
| `yolov8l-worldv2.onnx` | 178.8 MB | 46.8 M |

## Input schema

Two named inputs (all axes dynamic):

- `images` — `float32[batch, 3, height, width]`, normalized to `[0, 1]`, RGB, imgsz=640 recommended.
- `txt_feats` — `float32[batch, num_classes, 512]`, CLIP ViT-B/32 text embeddings,
  L2-normalized (though the graph re-normalizes internally).

## Output

- `output0` — `float32[batch, 4 + num_classes, num_anchors]`
  (YOLO head: 4 box regressors + per-class logits; anchors depend on input HxW).

Post-processing: apply sigmoid to the class channels, then standard NMS.

## Text embedding

Use CLIP ViT-B/32 (`openai/clip-vit-base-patch32`) to encode each class prompt
into a 512-dim vector, stack into `(1, N, 512)`.

## Export

Exported from Ultralytics 8.4.37 with a custom `torch.onnx.export` path that
patches `WorldDetect.forward` to use `torch.split` sized from `text.shape[1]`
(so N stays dynamic). Opset 18. Simplified with onnxslim.

## License

AGPL-3.0 (inherits from Ultralytics YOLOv8-World weights).
