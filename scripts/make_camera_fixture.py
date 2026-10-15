"""Fake-camera TEST FIXTURE from a real bundled photo; never app output or test-set negative.
Write an uncompressed YUV4MPEG2 clip with Pillow; ffmpeg is not required.
"""
from pathlib import Path
import json
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
r=json.loads((ROOT/'data/tiger-subset/manifest.json').read_text())['records'][0]
image=Image.open(ROOT/'data/source/tiger/originals'/f"{r['id']}.jpg").convert('RGB').resize((640,360),Image.Resampling.LANCZOS)
y,u,v=image.convert('YCbCr').split();frame=y.tobytes()+u.resize((320,180),Image.Resampling.BOX).tobytes()+v.resize((320,180),Image.Resampling.BOX).tobytes()
folder=ROOT/'tests/fixtures';folder.mkdir(exist_ok=True)
(folder/'tiger-camera.y4m').write_bytes(b'YUV4MPEG2 W640 H360 F5:1 Ip A1:1 C420jpeg XCOLORRANGE=FULL\n'+(b'FRAME\n'+frame)*5)
(folder/'README.md').write_text('Chromium FAKE CAMERA TEST FIXTURE ONLY, not a live wildlife recording. tiger-camera.y4m is a one-second 5fps conversion of the bundled Hugging Face Tiger-pose '+r['source_path']+'. Same repository-stated AGPL-3.0; corresponding original/label/licence retained. No evaluation independence claimed. Regenerate: python scripts/make_camera_fixture.py.\n')
