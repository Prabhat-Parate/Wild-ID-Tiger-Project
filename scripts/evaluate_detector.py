"""Reproducible QUALITATIVE check, NOT held-out precision/recall/accuracy.
All 32 bundled source photos are selection/demo material, potentially adjacent frames.
There are no licensed, independent negative tiger-absent source photos in this project.
"""
from pathlib import Path
import json,time,statistics,sys
from collections import Counter
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from backend.detection import load_detector
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def main():
    model=load_detector()
    if model is None:raise SystemExit('Detector unavailable; run setup_detector.py first')
    manifest=json.loads((ROOT/'data/tiger-subset/manifest.json').read_text());rows=[]
    for record in manifest['records']:
        image=Image.open(ROOT/'data/source/tiger/originals'/f"{record['id']}.jpg").convert('RGB')
        start=time.perf_counter();detections=model.detect(image);latency=(time.perf_counter()-start)*1000
        rows.append({'source_path':record['source_path'],'latency_ms':round(latency,2),'detections':detections})
    latencies=[r['latency_ms'] for r in rows]
    report={'evaluation_type':'qualitative selection/demo check, NOT accuracy','labelled_evaluation':'No labelled detector evaluation has been run.','detector':model.name,'detector_version':model.version,'score_cutoff':model.cutoff,'cutoff_basis':'configurable heuristic, not validated','images_run':len(rows),'images_with_any_detection':sum(bool(r['detections']) for r in rows),'images_with_tiger_label':sum(any(d['label']=='Tiger' for d in r['detections']) for r in rows),'raw_output_label_counts':dict(Counter(d['label'] for r in rows for d in r['detections'])),'latency_ms':{'first':latencies[0],'median':round(statistics.median(latencies),2),'min':min(latencies),'max':max(latencies)},'hardware':'2 CPU vCPUs, no exposed NVIDIA GPU; ONNX Runtime CPUExecutionProvider, 2 intra-op / 1 inter-op threads','split':'None: all bundled source photos used only for qualitative selection/demo. Adjacent/near-duplicate video frames not separated; no held-out negative set. No precision, recall, detection-rate percentage or accuracy computed.','rows':rows}
    (ROOT/'docs/detector-qualitative.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k!='rows'},indent=2))
if __name__=='__main__':main()
