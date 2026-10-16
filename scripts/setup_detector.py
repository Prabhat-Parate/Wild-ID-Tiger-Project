"""Explicit, operator-run network setup; NEVER called during application startup/inference.
Only Hugging Face weights/text artifacts; no wildlife frames leave the host.
"""
import hashlib,json,sys
from pathlib import Path
import requests,numpy as np,onnxruntime as ort
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'models/tiger-open-vocabulary';CACHE=ROOT/'.cache/detector-setup'
MODEL_REPO='Instemic/yolo-world-onnx';MODEL_REV='7e1d02c9467c32b141df81890737490764776785'
TEXT_REPO='Xenova/clip-vit-base-patch32';TEXT_REV='d15189d7028b43f1d3e65039190477f6af591c2a'
LABELS=['Tiger','Lion','Leopard','Cat','Dog','Person','Animal']
EXPECTED={'model.onnx':'381ced485b23ed8f06de3e82bb2745e1420c181c64f0a176784c34a959d550a1','text.onnx':'73baab855d406190da9faa498cfedf65f15cf309f4cc7385b7b032e6d08e5c3a','vocab.json':'5047b556ce86ccaf6aa22b3ffccfc52d391ea4accdab9c2f2407da5b742d4363'}
def download(repo,revision,name,path):
    path.parent.mkdir(parents=True,exist_ok=True)
    expected=EXPECTED.get(path.name)
    if path.exists():
        if expected is None or hashlib.sha256(path.read_bytes()).hexdigest()==expected:return
        path.unlink() # explicit operator setup restores only these generated cache artifacts
    with requests.get(f'https://huggingface.co/{repo}/resolve/{revision}/{name}',stream=True,timeout=90) as r:
        r.raise_for_status();temp=path.with_suffix(path.suffix+'.partial')
        with temp.open('wb') as f:
            for chunk in r.iter_content(1024*1024):f.write(chunk)
        if expected and hashlib.sha256(temp.read_bytes()).hexdigest()!=expected:
            temp.unlink();raise ValueError('Pinned setup artifact integrity check failed')
        temp.replace(path)
def main():
    OUT.mkdir(parents=True,exist_ok=True);CACHE.mkdir(parents=True,exist_ok=True)
    download(MODEL_REPO,MODEL_REV,'yolov8s-worldv2.onnx',OUT/'model.onnx')
    download(MODEL_REPO,MODEL_REV,'README.md',OUT/'SOURCE_CARD.md')
    download(TEXT_REPO,TEXT_REV,'onnx/text_model_quantized.onnx',CACHE/'text.onnx')
    download(TEXT_REPO,TEXT_REV,'vocab.json',CACHE/'vocab.json')
    vocab=json.loads((CACHE/'vocab.json').read_text());ids=np.zeros((len(LABELS),77),dtype=np.int64)
    # All these words are individual CLIP BPE vocabulary entries. No approximate/custom text vectors.
    for i,label in enumerate(LABELS):
        words=['a','photo','of','a',label.lower()]
        sequence=[vocab['<|startoftext|>']]+[vocab[w+'</w>'] for w in words]+[vocab['<|endoftext|>']]
        ids[i,:len(sequence)]=sequence
    opts=ort.SessionOptions();opts.intra_op_num_threads=2;opts.inter_op_num_threads=1
    session=ort.InferenceSession(str(CACHE/'text.onnx'),sess_options=opts,providers=['CPUExecutionProvider'])
    features=session.run(['text_embeds'],{'input_ids':ids})[0];features/=np.linalg.norm(features,axis=-1,keepdims=True)
    np.save(OUT/'text_features.npy',features[None].astype(np.float32))
    info={'model_repo':MODEL_REPO,'model_commit':MODEL_REV,'model_file':'yolov8s-worldv2.onnx','model_license':'AGPL-3.0','labels':LABELS,'prompts':['a photo of a '+x.lower() for x in LABELS],'text_repo':TEXT_REPO,'text_commit':TEXT_REV,'text_source':'openai/clip-vit-base-patch32 (OpenAI CLIP, MIT)','text_onnx_bytes':(CACHE/'text.onnx').stat().st_size,'model_bytes':(OUT/'model.onnx').stat().st_size,'onnxruntime':ort.__version__,'sha256':{name:hashlib.sha256((OUT/name).read_bytes()).hexdigest() for name in ['model.onnx','text_features.npy']}}
    (OUT/'manifest.json').write_text(json.dumps(info,indent=2)+'\n',encoding='utf-8');print(json.dumps(info,indent=2))
if __name__=='__main__':main()
