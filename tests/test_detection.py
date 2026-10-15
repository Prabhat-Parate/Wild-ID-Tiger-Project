"""Real inference tests plus explicitly labelled test doubles for failure/control paths."""
import io,json,time,asyncio,threading
from pathlib import Path
import numpy as np,pytest
from PIL import Image
from fastapi.testclient import TestClient
import backend.main as m
from backend.detection import box_iou,load_detector
REAL=m.detector
@pytest.fixture(autouse=True)
def isolated(monkeypatch):
    m.buckets.clear();m.detect_buckets.clear();monkeypatch.setattr(m,'detector',REAL);monkeypatch.setattr(m,'detector_lock',threading.BoundedSemaphore(1))
@pytest.fixture
def client():return TestClient(m.app)
def picture(fmt='JPEG',size=(120,80)):
    b=io.BytesIO();Image.new('RGB',size,'white').save(b,format=fmt);return b.getvalue()
def upload(client,raw=None,name='frame.jpg',mime='image/jpeg'):
    return client.post('/api/detect',files={'file':(name,picture() if raw is None else raw,mime)})
@pytest.mark.parametrize('name,mime,raw',[('frame.svg','image/svg+xml',b'<svg/>'),('frame.jpg','image/png',picture()),('frame.png','image/jpeg',picture()),('frame.jpg','image/jpeg',b'not an image'),('frame.jpg','image/jpeg',b'\xff\xd8\xffbroken')])
def test_validation(client,name,mime,raw):assert upload(client,raw,name,mime).status_code in [415,422]
def test_oversized_and_dimensions(client):
    assert upload(client,b'x'*(8388608+1)).status_code==413
    assert upload(client,picture('PNG',(10001,2)),'frame.png','image/png').status_code==413

def test_real_detector_empty_and_real_tiger(client):
    assert REAL is not None,'Run scripts/setup_detector.py before real-detector tests; not a skipped check'
    empty=upload(client);assert empty.status_code==200;assert empty.json()['detections']==[] # synthetic white sanity fixture, NOT evaluation negatives
    record=m.records[0];raw=(m.ROOT/'data/source/tiger/originals'/f"{record['id']}.jpg").read_bytes()
    response=upload(client,raw);assert response.status_code==200;body=response.json()
    assert body['detector']==REAL.name and body['detector_version']==REAL.version
    assert any(d['label']=='Tiger' for d in body['detections'])
    assert body['latency_ms']>0 and body['cutoff_basis']=='configurable heuristic, not validated'
    assert all(len(d['bbox'])==4 and 0<=min(d['bbox'])<=max(d['bbox'])<=1 for d in body['detections'])

def test_unavailable_health_and_503(client,monkeypatch):
    monkeypatch.setattr(m,'detector',None);health=client.get('/api/health').json()
    assert not health['detector_loaded'] and health['detector_labels']==[]
    assert upload(client).status_code==503
    # Full-frame upload retrieval still works when detection is unavailable.
    assert client.post('/api/analyze',files={'file':('frame.jpg',picture(),'image/jpeg')}).status_code==200

class EmptyFixture:
    name='TEST FIXTURE ONLY';version='test';labels=['Animal'];cutoff=.25
    def detect(self,image):return []
def test_independent_rate_limit(client,monkeypatch):
    monkeypatch.setattr(m,'detector',EmptyFixture())
    for _ in range(2):assert upload(client).status_code==200
    third=upload(client);assert third.status_code==429;assert third.headers['Retry-After']=='1'
    assert client.post('/api/analyze',data={'record_id':m.records[0]['id']}).status_code==200
    assert len(m.buckets)==1

def test_minute_detection_cap(client,monkeypatch):
    monkeypatch.setattr(m,'detector',EmptyFixture());assert upload(client).status_code==200
    key=next(iter(m.detect_buckets));now=time.monotonic();m.detect_buckets[key].clear();m.detect_buckets[key].extend(now-59+i*.48 for i in range(120))
    assert upload(client).status_code==429

def test_never_saves_or_spools_frames(client,monkeypatch):
    import starlette.formparsers as fp
    created=[];original=fp.SpooledTemporaryFile
    def tracked(*args,**kwargs):
        f=original(*args,**kwargs);created.append(f);return f
    rng=np.random.default_rng(2);image=Image.fromarray(rng.integers(0,255,(900,900,3),dtype=np.uint8));buffer=io.BytesIO();image.save(buffer,format='PNG')
    monkeypatch.setattr(fp,'SpooledTemporaryFile',tracked)
    monkeypatch.setattr(m,'detector',EmptyFixture())
    def no_save(*a,**k):raise AssertionError('Backend must not save a frame')
    monkeypatch.setattr(Image.Image,'save',no_save)
    assert upload(client,buffer.getvalue(),'frame.png','image/png').status_code==200
    assert created and all(not f._rolled for f in created)

def test_real_detection_crop_preserves_unknown_and_rankings(client):
    raw=(m.ROOT/'data/source/tiger/originals'/f"{m.records[0]['id']}.jpg").read_bytes()
    detected=upload(client,raw).json()['detections'][0]
    response=client.post('/api/analyze',files={'file':('frame.jpg',raw,'image/jpeg')},data={'detect_first':'true','detection_box':json.dumps(detected['bbox'])})
    assert response.status_code==200;body=response.json();assert body['status']=='UNKNOWN' and body['threshold'] is None;assert len(body['candidates'])==5
    evidence=body['detection'];assert evidence['source']==REAL.name and evidence['crop_url'] is None and evidence['label']=='Tiger';assert evidence['detector_score']==pytest.approx(detected['score'])
    clean=m.validate_image(raw,'frame.jpg','image/jpeg');x,y,w,h=evidence['bbox'];crop=clean.crop((x,y,x+w,y+h));expected=m.retrieve(m.describe(crop),'uploaded',None)
    assert [c['score'] for c in body['candidates']]==pytest.approx([c['score'] for c in expected['candidates']])
    full=client.post('/api/analyze',files={'file':('frame.jpg',raw,'image/jpeg')}).json();assert full['detection'] is None
    dataset=client.post('/api/analyze',data={'record_id':m.records[0]['id']}).json();assert dataset['detection']['source']=='Tiger-pose annotation (not a live detector)'

def test_person_never_forwarded_and_box_validated(client,monkeypatch):
    class PersonFixture(EmptyFixture):
        def detect(self,image):return [{'label':'Person','score':.8,'bbox':[.1,.1,.8,.8],'image_width':image.width,'image_height':image.height}]
    monkeypatch.setattr(m,'detector',PersonFixture());body={'detect_first':'true'}
    response=client.post('/api/analyze',files={'file':('frame.jpg',picture(),'image/jpeg')},data=body);assert response.status_code==422;assert 'Person detected, ignored' in response.text
    monkeypatch.setattr(m,'detector',REAL)
    raw=(m.ROOT/'data/source/tiger/originals'/f"{m.records[0]['id']}.jpg").read_bytes()
    for box in ['not json','[0,0,2,2]','[0.9,0.9,1,1]']:
        response=client.post('/api/analyze',files={'file':('frame.jpg',raw,'image/jpeg')},data={'detection_box':box});assert response.status_code==422

def test_busy_timeout_and_inference_failure(client,monkeypatch):
    assert m.detector_lock.acquire(False)
    try:assert upload(client).status_code==429
    finally:m.detector_lock.release()
    class SlowFixture(EmptyFixture):
        def detect(self,image):time.sleep(.08);return []
    monkeypatch.setattr(m,'detector',SlowFixture());monkeypatch.setattr(m,'DETECT_TIMEOUT',.01)
    async def check():
        with pytest.raises(m.HTTPException) as e:await m.detect_image(Image.new('RGB',(20,20)))
        assert e.value.status_code==504
        assert not m.detector_lock.acquire(False) # timed-out thread still owns the bound, not another queued frame
        await asyncio.sleep(.12)
        assert m.detector_lock.acquire(False);m.detector_lock.release()
    asyncio.run(check())
    class BrokenFixture(EmptyFixture):
        def detect(self,image):raise RuntimeError('test-only failure')
    m.detect_buckets.clear();monkeypatch.setattr(m,'DETECT_TIMEOUT',8);monkeypatch.setattr(m,'detector',BrokenFixture())
    assert upload(client).status_code==503
    assert not client.get('/api/health').json()['detector_loaded']

def test_startup_failure_is_honest(monkeypatch,caplog):
    monkeypatch.setenv('DETECTOR_DIR','/path-that-does-not-exist-test-only');assert load_detector() is None
    assert 'detector_unavailable' in caplog.text and '/path-that-does-not-exist' not in caplog.text

def test_exactly_one_frame(client):
    assert client.post('/api/detect',files=[('file',('one.jpg',picture(),'image/jpeg')),('file',('two.jpg',picture(),'image/jpeg'))]).status_code==422
