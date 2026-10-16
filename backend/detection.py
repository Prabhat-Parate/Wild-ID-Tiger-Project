"""Local-only open-vocabulary detector. No frame persistence or network inference."""
from __future__ import annotations
import hashlib,json,logging,os
from pathlib import Path
from typing import Protocol
import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
os.environ.setdefault('OMP_NUM_THREADS', os.getenv('ONNX_INTRA_OP_THREADS','2'))
os.environ.setdefault('OPENBLAS_NUM_THREADS','1')
try:
    import numpy as _np
    _np.seterr(all='ignore')
except Exception:
    pass
class Detector(Protocol):
    name:str
    version:str
    labels:list[str]
    cutoff:float
    def detect(self,image:Image.Image)->list[dict]: ...

class OnnxWorldDetector:
    name='YOLOv8s-World v2 (ONNX, configured prompts)'
    def __init__(self,directory:Path):
        import onnxruntime as ort
        info=json.loads((directory/'manifest.json').read_text(encoding='utf-8'))
        for name,digest in info['sha256'].items():
            if hashlib.sha256((directory/name).read_bytes()).hexdigest()!=digest:raise ValueError('Detector artifact integrity check failed')
        self.version=info['model_commit'];self.labels=info['labels']
        self.cutoff=float(os.getenv('DETECTION_SCORE_CUTOFF','0.25'))
        if not 0<self.cutoff<1:raise ValueError('DETECTION_SCORE_CUTOFF must be between zero and one')
        self.features=np.load(directory/'text_features.npy',allow_pickle=False)
        if self.features.shape!=(1,len(self.labels),512) or not np.isfinite(self.features).all():raise ValueError('Invalid text features')
        intra=max(1,int(os.getenv('ONNX_INTRA_OP_THREADS','2')));inter=max(1,int(os.getenv('ONNX_INTER_OP_THREADS','1')))
        options=ort.SessionOptions();options.intra_op_num_threads=intra;options.inter_op_num_threads=inter
        self.session=ort.InferenceSession(str(directory/'model.onnx'),sess_options=options,providers=['CPUExecutionProvider'])
    def detect(self,image:Image.Image)->list[dict]:
        orig_w,orig_h=image.size
        max_side=max(320,int(os.getenv('DETECTION_MAX_SIDE','1280')))
        if max(orig_w,orig_h)>max_side:
            s=max_side/max(orig_w,orig_h)
            image=image.resize((max(1,round(orig_w*s)),max(1,round(orig_h*s))),Image.Resampling.BILINEAR)
        w,h=image.size;scale=min(640/w,640/h);nw,nh=round(w*scale),round(h*scale);left,top=(640-nw)//2,(640-nh)//2
        padded=Image.new('RGB',(640,640),(114,114,114));padded.paste(image.resize((nw,nh),Image.Resampling.BILINEAR),(left,top))
        tensor=np.asarray(padded,dtype=np.float32).transpose(2,0,1)[None]/255.0
        out=self.session.run(None,{'images':tensor,'txt_feats':self.features})[0][0]
        # The actual ONNX graph already ends its class branch in Sigmoid. Do NOT sigmoid again.
        if out.shape[0]!=4+len(self.labels) or not np.isfinite(out).all():raise ValueError('Invalid detector output')
        scores=out[4:];classes=scores.argmax(axis=0);best=scores.max(axis=0)
        indices=np.flatnonzero((best>=self.cutoff)&(best<=1))
        indices=indices[np.argsort(-best[indices],kind='stable')][:300]
        results=[]
        for i in indices:
            cx,cy,bw,bh=out[:4,i];box=np.clip([(cx-bw/2-left)/scale/w,(cy-bh/2-top)/scale/h,(cx+bw/2-left)/scale/w,(cy+bh/2-top)/scale/h],0,1).astype(float).tolist()
            if box[2]<=box[0] or box[3]<=box[1]:continue
            label=self.labels[int(classes[i])]
            # Competing animal prompts share NMS; a reported person is never suppressed by an animal.
            if any((label=='Person')==(d['label']=='Person') and box_iou(box,d['bbox'])>0.45 for d in results):continue
            results.append({'label':label,'score':float(best[i]),'bbox':box,'image_width':orig_w,'image_height':orig_h})
            if len(results)>=20:break
        return results

def box_iou(a,b):
    intersection=max(0,min(a[2],b[2])-max(a[0],b[0]))*max(0,min(a[3],b[3])-max(a[1],b[1]))
    union=(a[2]-a[0])*(a[3]-a[1])+(b[2]-b[0])*(b[3]-b[1])-intersection
    return intersection/union if union>0 else 0

def load_detector()->Detector|None:
    try:
        if os.getenv('WILDID_DETECTOR','onnx-world')=='none':raise ValueError('Detector disabled by configuration')
        model=OnnxWorldDetector(Path(os.getenv('DETECTOR_DIR',str(ROOT/'models/tiger-open-vocabulary'))))
        logging.getLogger('wildid').info(json.dumps({'event':'detector_loaded','name':model.name,'version':model.version}))
        return model
    except Exception as e:
        # No frames, paths, filenames or potentially sensitive exception payloads in logs.
        logging.getLogger('wildid').warning(json.dumps({'event':'detector_unavailable','error_type':type(e).__name__,'action':'Install requirements and run scripts/setup_detector.py; restart API'}))
        return None
