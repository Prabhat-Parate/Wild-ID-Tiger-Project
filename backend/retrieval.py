"""Deterministic, untrained gradient-histogram retrieval. Not a re-ID model."""
import numpy as np
from PIL import Image, ImageOps
METHOD = 'image retrieval'
MODEL = 'Spatial gradient histogram v1 (untrained)'

def describe(image: Image.Image) -> np.ndarray:
    gray = np.asarray(ImageOps.grayscale(image).resize((128, 128)), dtype=np.float32) / 255.0
    gy, gx = np.gradient(gray)
    mag = np.sqrt(gx*gx + gy*gy)
    bins = ((np.arctan2(gy, gx) % np.pi) / np.pi * 8).astype(int).clip(0, 7)
    parts = []
    for y in range(0, 128, 16):
        for x in range(0, 128, 16):
            h = np.bincount(bins[y:y+16,x:x+16].ravel(), weights=mag[y:y+16,x:x+16].ravel(), minlength=8)
            parts.extend(h / (np.linalg.norm(h) + 1e-8))
    v = np.array(parts, dtype=np.float32)
    return v / (np.linalg.norm(v) + 1e-8)
