"""Load only real tiger photographs from the inspected Hugging Face repository.
No tiger identity labels exist in this source. No identity labels are fabricated.
"""
import concurrent.futures
import hashlib
import io
import json
from itertools import zip_longest
from pathlib import Path
import sys
import urllib.request

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.retrieval import describe

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/source/tiger'
OUT = ROOT / 'data/tiger-subset'
MEDIA = OUT / 'media'
for directory in [SOURCE, MEDIA, SOURCE / 'annotations', SOURCE / 'originals']:
    directory.mkdir(parents=True, exist_ok=True)
REPO = 'Ultralytics/Tiger-pose'
SHA = '81e28ddc5ce42e30671a261e0aa9b20fec81b065'
BASE = f'https://huggingface.co/datasets/{REPO}'

def download(path):
    with urllib.request.urlopen(f'{BASE}/resolve/{SHA}/{path}', timeout=40) as response:
        return response.read()

for name in ['README.md', 'LICENSE']:
    (SOURCE / name).write_bytes(download(name))

inventory = {}
for split in ['train', 'val']:
    for kind in ['images', 'labels']:
        with urllib.request.urlopen(f'https://huggingface.co/api/datasets/{REPO}/tree/{SHA}/{split}/{kind}?limit=1000', timeout=30) as response:
            files = json.load(response)
            if response.headers.get('Link'):
                raise RuntimeError('Unexpected pagination: inspect source before changing selection')
        inventory[f'{split}/{kind}'] = files
(SOURCE / 'inventory.json').write_text(json.dumps(inventory, indent=2))

# Interleave every fourth numerically sorted source image from train/val.
# Exact decoded duplicate photos are excluded. These are NOT identity/evaluation splits.
selected_paths = []
sequences = []
for split in ['train', 'val']:
    paths = [f['path'] for f in inventory[f'{split}/images'] if f['path'].lower().endswith('.jpg')]
    paths.sort(key=lambda p: int(Path(p).stem.split('_')[-1]))
    sequences.append(paths[::4])
for pair in zip_longest(*sequences):
    selected_paths.extend(path for path in pair if path)

records = []
seen = set()
for path in selected_paths:
    if len(records) == 32:
        break
    raw = download(path)
    with Image.open(io.BytesIO(raw)) as original:
        image = original.convert('RGB')
    pixel_hash = hashlib.sha256(str(image.size).encode() + image.tobytes()).hexdigest()
    if pixel_hash in seen:
        continue
    seen.add(pixel_hash)
    annotation_path = path.replace('/images/', '/labels/').replace('.jpg', '.txt')
    text = download(annotation_path).decode()
    rows = [[float(v) for v in line.split()] for line in text.splitlines() if line.strip()]
    if not rows or any(len(row) != 29 or row[0] != 0 for row in rows):
        raise RuntimeError('Unexpected pose annotation schema')
    row = max(rows, key=lambda r: r[3] * r[4])
    _, cx, cy, bw, bh, *_ = row
    width, height = image.size
    x = max(0, (cx - bw / 2) * width)
    y = max(0, (cy - bh / 2) * height)
    right = min(width, (cx + bw / 2) * width)
    bottom = min(height, (cy + bh / 2) * height)
    if right <= x or bottom <= y:
        raise RuntimeError('Invalid source bounding box')
    ident = hashlib.sha256(path.encode()).hexdigest()[:24]  # image record ID, NEVER an animal ID
    (SOURCE / 'annotations' / f'{ident}.txt').write_text(text)
    crop = image.crop((int(x), int(y), int(right), int(bottom)))
    crop.thumbnail((960, 720))
    crop.save(MEDIA / f'{ident}-crop.jpg', quality=90)
    image.thumbnail((1280, 960))
    image.save(MEDIA / f'{ident}.jpg', quality=88)
    (SOURCE / 'originals' / f'{ident}.jpg').write_bytes(raw)
    records.append({
        'id': ident, 'image_uuid': pixel_hash, 'individual_id': None,
        'species': 'Tiger', 'source_path': path, 'source_annotation_path': annotation_path,
        'source_split': path.split('/')[0], 'width': width, 'height': height,
        'datetime': None, 'bbox': [x, y, right - x, bottom - y], 'region_bbox': None,
        'viewpoint': None, 'CA_score': None, 'manual': None,
        'split': 'demo', 'role': 'reference', 'withheld_identity': False,
        'image_url': f'/api/media/{ident}.jpg', 'crop_url': f'/api/media/{ident}-crop.jpg'
    })
assert len(records) == 32
features = np.stack([describe(Image.open(MEDIA / f"{r['id']}-crop.jpg")) for r in records])
np.savez_compressed(OUT / 'features.npz', features=features, ids=np.array([r['id'] for r in records]))
image_files = sum(len(inventory[f'{split}/images']) for split in ['train', 'val'])
image_bytes = sum(f['size'] for split in ['train', 'val'] for f in inventory[f'{split}/images'])
manifest = {
    'source': BASE, 'commit': SHA, 'license': 'AGPL-3.0',
    'selection': 'Interleave every fourth numerically sorted train/val source filename; exclude decoded-pixel duplicates; take first 32. Source train/val labels are pose splits, not identity evaluation splits.',
    'source_counts': {'images': image_files, 'annotations': sum(len(inventory[f'{split}/labels']) for split in ['train', 'val']), 'identities': 0, 'identified_annotations': 0, 'image_bytes': image_bytes},
    'identity_labels_available': False, 'records': records
}
report = {
    'threshold': None,
    'calibration': 'Unavailable: this dataset has no individual-tiger identity labels. Identity acceptance is disabled; result remains UNKNOWN.',
    'split_method': 'Source train/val partitions are for pose estimation. No identity-labelled validation/test split, identity threshold or re-identification metrics can be computed.',
    'validation': [], 'test': [], 'demo': [], 'seed': 0,
    'feature_version': 'gradient-histogram-v1', 'dataset_commit': SHA,
    'identity_labels_available': False
}
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2))
(OUT / 'evaluation.json').write_text(json.dumps(report, indent=2))
print(json.dumps({'source': BASE, 'commit': SHA, 'source_image_files': image_files, 'source_image_bytes': image_bytes, 'cached_photographs': len(records), 'identity_labels': 'absent', 'threshold': None}, indent=2))
