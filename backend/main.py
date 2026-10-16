import threading
import asyncio, collections, hashlib, io, json, logging, logging.handlers, os, re, secrets, time, uuid, warnings
from pathlib import Path
import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.concurrency import run_in_threadpool
from starlette.formparsers import MultiPartParser
from backend.retrieval import describe, MODEL, METHOD
from backend.schemas import Analysis, Health, Dataset, DetectionResponse
from backend.detection import load_detector, box_iou
from backend.species import load_registry, annotate_species, registry_with_support
from backend.classifier import load_classifier
from backend.pipeline import run_pipeline

ROOT=Path(__file__).resolve().parents[1]; DATA=ROOT/'data/tiger-subset'
MAX_BYTES=int(os.getenv('MAX_UPLOAD_BYTES','8388608')); MAX_PIXELS=24_000_000
MultiPartParser.spool_max_size=MAX_BYTES+1048576  # bounded request stays in RAM; never spool uploads to disk
Image.MAX_IMAGE_PIXELS=MAX_PIXELS
warnings.simplefilter('error', Image.DecompressionBombWarning)
app=FastAPI(title='Wild-ID Research API', version='0.2.0', docs_url=None, redoc_url=None)
app.add_middleware(CORSMiddleware,allow_origins=[s.strip() for s in os.getenv('ALLOWED_ORIGINS','http://localhost:5173').split(',') if s.strip()],allow_credentials=False,allow_methods=['GET','POST'],allow_headers=['Content-Type'])
logger=logging.getLogger('wildid');logging.basicConfig(level=logging.INFO,format='%(message)s')
INFERENCE_WORKERS=max(1,int(os.getenv('INFERENCE_WORKERS','1')))
INFERENCE_QUEUE=max(0,int(os.getenv('INFERENCE_QUEUE','2')))
INFERENCE_SLOTS=INFERENCE_WORKERS+INFERENCE_QUEUE
RATE_BUCKET_CAP=max(16,int(os.getenv('RATE_BUCKET_CAP','256')))
try:
    manifest=json.loads((DATA/'manifest.json').read_text(encoding='utf-8')) if (DATA/'manifest.json').exists() else None
    report=json.loads((DATA/'evaluation.json').read_text(encoding='utf-8')) if manifest else None
    records=manifest['records'] if manifest else []
    cache=np.load(DATA/'features.npz',allow_pickle=False) if records else None
    vectors=cache['features'] if cache is not None else None
    if cache is not None:
        if cache['ids'].tolist()!=[r['id'] for r in records] or vectors.shape!=(len(records),512) or not np.isfinite(vectors).all():
            raise ValueError('Feature cache does not match manifest')
        if report['dataset_commit']!=manifest['commit'] or (report['threshold'] is not None and not np.isfinite(report['threshold'])):
            raise ValueError('Evaluation cache does not match dataset')
except (OSError, ValueError, KeyError):
    logger.warning(json.dumps({'event':'dataset_cache_unavailable','action':'Run scripts/load_dataset.py'}))
    manifest=None;report=None;records=[];cache=None;vectors=None
for record in records:
    if record.get('source_path'):
        record['source_filename']=Path(record['source_path']).name
lookup={r['id']:r for r in records}
salt=secrets.token_bytes(32);buckets={};detect_buckets={}
try:
    species_registry=load_registry()
except Exception:
    species_registry={'species':[],'disclaimer':'Registry failed to load'}
detector=load_detector()
classifier,classifier_vocab_holder=load_classifier()
detector_lock=threading.BoundedSemaphore(INFERENCE_SLOTS)
inflight=0;rejected=0;inflight_lock=threading.Lock()
DETECT_TIMEOUT=min(20,max(1,float(os.getenv('DETECTION_TIMEOUT_SECONDS','8'))))
log_dir=ROOT/'logs';log_dir.mkdir(exist_ok=True)
_handler=logging.handlers.RotatingFileHandler(log_dir/'wildid.log',maxBytes=1_000_000,backupCount=3,encoding='utf-8')
logger.addHandler(_handler)


class RequestTooLarge(Exception): pass
class LimitBody:
    def __init__(self,app): self.app=app
    async def __call__(self,scope,receive,send):
        if scope['type']!='http': return await self.app(scope,receive,send)
        n=0
        async def limited():
            nonlocal n
            msg=await receive();n+=len(msg.get('body',b''))
            if n>MAX_BYTES+1048576: raise RequestTooLarge()
            return msg
        try: await self.app(scope,limited,send)
        except RequestTooLarge:
            await JSONResponse({'detail':'Request exceeds size limit'},status_code=413)(scope,receive,send)
app.add_middleware(LimitBody)

@app.middleware('http')
async def security(request: Request, call_next):
    start=time.monotonic()
    try: length=int(request.headers.get('content-length','0') or '0')
    except ValueError: return JSONResponse({'detail':'Invalid Content-Length'},status_code=400)
    if length>MAX_BYTES+1048576:
        return JSONResponse({'detail':'Request exceeds size limit'},status_code=413)
    if request.url.path in ['/api/analyze','/api/detect']:
        detection_route=request.url.path=='/api/detect'
        store=detect_buckets if detection_route else buckets
        now=time.monotonic()
        for k in list(store):
            while store[k] and store[k][0]<now-60:store[k].popleft()
            if not store[k]:del store[k]
        while len(store)>RATE_BUCKET_CAP:
            store.pop(next(iter(store)))
        key=hashlib.sha256(salt+(request.client.host if request.client else 'local').encode()).hexdigest()
        q=store.setdefault(key,collections.deque())
        if len(q)>=(120 if detection_route else 12) or (detection_route and sum(t>now-1 for t in q)>=2):
            response=JSONResponse({'detail':'Detection rate limit reached' if detection_route else 'Rate limit reached; retry after one minute'},status_code=429,headers={'Retry-After':'1' if detection_route else '60'})
            response.headers['Cache-Control']='no-store';response.headers['X-Content-Type-Options']='nosniff';response.headers['Referrer-Policy']='no-referrer'
            return response
        q.append(now)
    try: response=await asyncio.wait_for(call_next(request),timeout=25)
    except asyncio.TimeoutError: response=JSONResponse({'detail':'Analysis timed out'},status_code=504)
    response.headers['X-Content-Type-Options']='nosniff';response.headers['Referrer-Policy']='no-referrer'
    response.headers['Cache-Control']='no-store'
    logger.info(json.dumps({'event':'request','method':request.method,'route':request.scope.get('route').path if request.scope.get('route') else 'unmatched','status':response.status_code,'duration_ms':round((time.monotonic()-start)*1000)}))
    return response

@app.get('/api/health',response_model=Health)
def health():
    return {'status':'ok' if manifest else 'dataset_missing','model_loaded':False,'model':MODEL,'method':METHOD,'version':'0.2.0','dataset':{'commit':manifest['commit'] if manifest else None,'records':len(records),'images':len({r['image_uuid'] for r in records}),'individuals':len({r['individual_id'] for r in records if r['individual_id']}),'reference_records':sum(r['split']=='demo' and r['role']=='reference' for r in records)},'threshold':report['threshold'] if report else None,'calibration':report['calibration'] if report else None,'detector_loaded':detector is not None,'detector_name':detector.name if detector else None,'detector_version':detector.version if detector else None,'detector_labels':detector.labels if detector else [],'detector_score_cutoff':detector.cutoff if detector else None,'classifier_loaded':classifier is not None,'classifier_name':classifier.name if classifier else (classifier_vocab_holder.name if classifier_vocab_holder else None),'classifier_version':classifier.version if classifier else None,'classifier_labels':len(getattr(classifier or classifier_vocab_holder,'labels',[]) or [])}

@app.get('/api/ready')
def ready():
    with inflight_lock:
        current=inflight;rej=rejected
    return {
        'ready':detector is not None or bool(records),
        'detector_loaded':detector is not None,
        'dataset_loaded':bool(records),
        'queue_capacity':INFERENCE_SLOTS,
        'in_flight':current,
        'rejected':rej,
        'inference_workers':INFERENCE_WORKERS,
        'classifier_loaded':classifier is not None,
        'localizer_ms_last':None,
    }

@app.get('/api/species')
def species():
    labels=detector.labels if detector else []
    vocab=getattr(classifier or classifier_vocab_holder,'vocabulary',None)
    return registry_with_support(species_registry, labels, vocab, classifier is not None)
@app.get('/api/dataset',response_model=Dataset)
def dataset():
    if not manifest: raise HTTPException(503,'Run python scripts/load_dataset.py')
    source=ROOT/'data/source/tiger'
    card=(source/'README.md').read_text(encoding='utf-8') if (source/'README.md').exists() else ''
    inventory=json.loads((source/'inventory.json').read_text(encoding='utf-8')) if (source/'inventory.json').exists() else {}
    title=next((line[2:] for line in card.splitlines() if line.startswith('# ')), 'Tiger-pose')
    licence=next((line for line in card.splitlines() if line.startswith('license:')), None)
    paragraph=next((line for line in card.splitlines() if line.startswith('[Ultralytics]')), '')
    excerpt=re.sub(r'\[([^]]+)\]\([^)]+\)',r'\1',paragraph).split('. It consists')[0]
    if excerpt and not excerpt.endswith('.'): excerpt+='.'
    information={'name':title,'source_url':manifest['source'],'card_license_declaration':licence,'attribution_text':excerpt or None,
        'included_image_count':sum((DATA/'media'/f"{r['id']}.jpg").is_file() for r in records),
        'original_image_file_count':len(list((source/'originals').glob('*.jpg'))),
        'crop_file_count':sum((DATA/'media'/f"{r['id']}-crop.jpg").is_file() for r in records),
        'source_train_image_count':len(inventory.get('train/images',[])),
        'source_validation_image_count':len(inventory.get('val/images',[]))}
    return {**manifest,'records':[r for r in records if r['split']=='demo'],'information':information}
@app.get('/api/individuals')
def individuals():
    # Pose annotations do not provide individual-animal identity labels.
    return []
@app.get('/api/evaluation-report')
def evaluation_report():
    if not report: raise HTTPException(503,'Evaluation cache missing')
    return report
@app.get('/api/media/{filename}')
def media(filename:str):
    allowed={f"{r['id']}{suffix}.jpg" for r in records for suffix in ['', '-crop']}
    if filename not in allowed: raise HTTPException(404,'Image not in subset')
    path=DATA/'media'/filename
    if not path.exists():raise HTTPException(404,'Cached image missing; reload subset')
    return FileResponse(path,media_type='image/jpeg')

def validate_image(raw:bytes,filename:str,mime:str):
    if len(raw)>MAX_BYTES: raise HTTPException(413,'Maximum upload size is 8 MiB')
    ext=Path(filename).suffix.lower()
    magic='JPEG' if raw.startswith(b'\xff\xd8\xff') else 'PNG' if raw.startswith(b'\x89PNG\r\n\x1a\n') else None
    if not magic or (magic=='JPEG' and (ext not in ['.jpg','.jpeg'] or mime!='image/jpeg')) or (magic=='PNG' and (ext!='.png' or mime!='image/png')):
        raise HTTPException(415,'Extension, MIME type and image contents must agree: JPG/JPEG/PNG only')
    try:
        with Image.open(io.BytesIO(raw)) as im:
            if im.width*im.height>MAX_PIXELS or max(im.size)>10000:raise HTTPException(413,'Image exceeds pixel or dimension limit')
            if im.format!=magic:raise HTTPException(415,'Image encoding mismatch')
            im.verify()
        with Image.open(io.BytesIO(raw)) as im:
            im=ImageOps.exif_transpose(im).convert('RGB');im.load()
            clean=Image.new('RGB',im.size);clean.paste(im)
            return clean
    except (Image.DecompressionBombError, Image.DecompressionBombWarning):raise HTTPException(413,'Unsafe image dimensions')
    except (UnidentifiedImageError, OSError, ValueError):raise HTTPException(422,'Image is corrupt or cannot be decoded')

def retrieve(vector, query_id, detection):
    refs=[i for i,r in enumerate(records) if r['split']=='demo' and r['role']=='reference' and r['image_uuid']!=lookup.get(query_id,{}).get('image_uuid')]
    scores=vectors[refs]@vector if refs else np.array([])
    order=np.argsort(-scores,kind='stable')[:5];candidates=[{**records[refs[j]],'rank':k+1,'score':float(scores[j])} for k,j in enumerate(order)]
    # No identity-labelled tiger validation set exists: never accept an identity.
    accepted=False
    return {'request_id':str(uuid.uuid4()),'timestamp':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'query_id':query_id,'method':METHOD,'model':MODEL,'dataset_version':manifest['commit'],'status':'CANDIDATE' if accepted else 'UNKNOWN','threshold':report['threshold'],'criterion':report['calibration'],'detection':detection,'candidates':candidates,'explanation':'Ranked by cosine similarity of untrained gradient histograms. These are visually similar tiger photographs, not identified individuals. The source has no individual-tiger labels, so identity acceptance is unavailable and remains UNKNOWN. Same source photograph is excluded. Uploads use the full frame unless the user explicitly requests a verified local detector crop; detection is separate from individual identity.'}
async def detect_image(image):
    global detector,inflight,rejected
    if os.getenv('WILDID_DETECTOR','onnx-world')=='none' or detector is None:
        raise HTTPException(503,'Detector unavailable. Install requirements, run python scripts/setup_detector.py, then restart the backend.')
    if not detector_lock.acquire(blocking=False):
        with inflight_lock:
            rejected+=1
        raise HTTPException(503,'Detector busy; skip this frame and retry later',headers={'Retry-After':'1'})
    with inflight_lock:
        inflight+=1
    def work():
        global inflight
        try:return run_pipeline(image,detector,classifier,species_registry)
        finally:
            detector_lock.release()
            with inflight_lock:
                inflight=max(0,inflight-1)
    try:return await asyncio.wait_for(asyncio.to_thread(work),timeout=DETECT_TIMEOUT)
    except asyncio.TimeoutError:raise HTTPException(504,'Detection timed out; skip this frame. The worker remains bounded until it finishes.')
    except HTTPException:raise
    except Exception as e:
        detector=None
        logger.warning(json.dumps({'event':'detector_inference_failed','error_type':type(e).__name__}))
        raise HTTPException(503,'Detector unavailable after an inference error. Retry or ask the operator to check the local model.')

@app.post('/api/detect',response_model=DetectionResponse)
async def detect(request:Request,file:UploadFile=File(...)):
    start=time.perf_counter()
    try:
        form=await request.form()
        if len(form.getlist('file'))!=1 or any(hasattr(v,'filename') and k!='file' for k,v in form.multi_items()):raise HTTPException(422,'Supply exactly one frame in the file field')
        raw=await file.read(MAX_BYTES+1)
        image=await run_in_threadpool(validate_image,raw,file.filename or '',file.content_type or '')
        found,timings=await detect_image(image)
        named=[]
        for d in found:
            d={**d,'model_name':detector.name,'model_version':detector.version,'score':d.get('localizer_score',d.get('score',0))}
            named.append(d)
        mode='two_stage' if classifier is not None else 'localizer_only'
        return {'detections':named,'detector':detector.name,'detector_version':detector.version,'timestamp':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'latency_ms':round((time.perf_counter()-start)*1000,2),'request_id':str(uuid.uuid4()),'score_cutoff':detector.cutoff,'classifier':classifier.name if classifier else None,'classifier_version':classifier.version if classifier else None,'stage_latency':timings,'classify_mode':mode}
    finally:await file.close()

@app.post('/api/analyze',response_model=Analysis)
async def analyze(record_id:str|None=Form(None),file:UploadFile|None=File(None),detect_first:bool=Form(False),detection_box:str|None=Form(None)):
    if not records:raise HTTPException(503,'Dataset subset unavailable')
    if bool(record_id)==bool(file):raise HTTPException(422,'Supply exactly one dataset record or upload')
    if record_id:
        if detect_first or detection_box:raise HTTPException(422,'Detector options apply to uploads only; dataset records use published annotations')
        if record_id not in lookup or lookup[record_id]['split']!='demo':raise HTTPException(404,'Unknown demo annotation')
        r=lookup[record_id];idx=next(i for i,v in enumerate(records) if v['id']==record_id)
        return await run_in_threadpool(retrieve,vectors[idx],record_id,{'source':'Tiger-pose annotation (not a live detector)','bbox':r['bbox'],'crop_url':r['crop_url']})
    try:
        raw=await file.read(MAX_BYTES+1)
        image=await run_in_threadpool(validate_image,raw,file.filename or '',file.content_type or '')
        evidence=None
        if detect_first or detection_box:
            detections,timings=await detect_image(image)
            if any(d['label']=='Person' for d in detections):raise HTTPException(422,'Person detected, ignored. This frame cannot be forwarded for similarity; choose a person-free frame.')
            eligible=[d for d in detections if d['label']!='Person']
            if not eligible:raise HTTPException(422,'No animal detection available for a crop. Full-frame comparison remains a separate explicit option.')
            if detection_box:
                try:
                    box=json.loads(detection_box)
                    if not isinstance(box,list) or len(box)!=4 or not all(type(n) in [int,float] and np.isfinite(n) and 0<=n<=1 for n in box) or box[0]>=box[2] or box[1]>=box[3]:raise ValueError()
                except (ValueError,TypeError):raise HTTPException(422,'detection_box must be normalized [x1,y1,x2,y2]')
                chosen=max(eligible,key=lambda d:box_iou(box,d['bbox']))
                if box_iou(box,chosen['bbox'])<0.8:raise HTTPException(422,'Chosen box does not agree with a current non-person detector result')
            else:chosen=eligible[0]
            x1,y1,x2,y2=chosen['bbox'];w,h=image.size
            # Integer crop and returned pixel xywh agree exactly; no uploaded crop is stored/served.
            left,top,right,bottom=int(x1*w),int(y1*h),min(w,int(np.ceil(x2*w))),min(h,int(np.ceil(y2*h)))
            evidence={'source':detector.name,'bbox':[left,top,right-left,bottom-top],'crop_url':None,'normalized_bbox':chosen['bbox'],'label':chosen['label'],'detector_score':chosen['score'],'detector_version':detector.version}
            image=image.crop((left,top,right,bottom))
        vec=await run_in_threadpool(describe,image)
        return await run_in_threadpool(retrieve,vec,'upload-'+str(uuid.uuid4()),evidence)
    finally:await file.close()
@app.get('/api/sightings')
def sightings():return []
@app.get('/api/evaluations')
def evaluations():return []
@app.post('/api/reviews',status_code=501)
def reviews():raise HTTPException(501,'Reviews are temporary browser-memory records; export before closing')

# Optional same-origin production serving after `npm run build`.
@app.get('/{path:path}', include_in_schema=False)
def frontend(path:str):
    if path.startswith('api/') or path=='api':raise HTTPException(404,'API endpoint not found')
    root=(ROOT/'dist').resolve();target=(root/path).resolve()
    if root not in target.parents and target!=root:raise HTTPException(404,'Not found')
    if not root.exists():raise HTTPException(404,'Frontend build missing. Use Vite on port 5173 or npm run build.')
    result=FileResponse(target if target.is_file() else root/'index.html')
    result.headers['Content-Security-Policy']="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; font-src 'self'; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'"
    return result
