import io,json
import numpy as np
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from backend.main import app,buckets,validate_image,records,vectors,retrieve,report,DATA
from backend.retrieval import describe
@pytest.fixture(autouse=True)
def reset_limits():buckets.clear()
@pytest.fixture
def client():return TestClient(app)
def picture(fmt='JPEG',size=(120,80),exif=None):
    b=io.BytesIO();kwargs={'exif':exif} if exif else {};Image.new('RGB',size,'gray').save(b,format=fmt,**kwargs);return b.getvalue()
def query():return next(r for r in records if r['split']=='demo')
def test_health(client):
    r=client.get('/api/health');assert r.status_code==200;assert r.json()['dataset']['records']==32;assert not r.json()['model_loaded'];assert r.headers['x-content-type-options']=='nosniff'
def test_safe_dataset(client):
    r=client.get('/api/dataset');assert len(r.json()['records'])==32
    assert not any(k in r.text.lower() for k in ['latitude','longitude','gps_lat','gps_lon'])
def test_real_analysis(client):
    r=client.post('/api/analyze',data={'record_id':query()['id']});assert r.status_code==200;r=r.json();assert len(r['candidates'])==5;assert r['status']=='UNKNOWN';assert all(c['image_uuid']!=query()['image_uuid'] for c in r['candidates']);assert r['method']=='image retrieval'
@pytest.mark.parametrize('fmt,ext,mime',[('JPEG','jpg','image/jpeg'),('JPEG','jpeg','image/jpeg'),('PNG','png','image/png')])
def test_valid_uploads(client,fmt,ext,mime):
    r=client.post('/api/analyze',files={'file':('photo.'+ext,picture(fmt),mime)});assert r.status_code==200;assert r.json()['detection'] is None
@pytest.mark.parametrize('name,raw,mime',[('a.jpg',b'hello','image/jpeg'),('a.png',picture(),'image/png'),('a.jpg',picture(),'application/octet-stream'),('a.svg',b'<svg/>','image/svg+xml'),('a.jpg',b'\xff\xd8\xffbad','image/jpeg')])
def test_invalid_uploads(client,name,raw,mime):assert client.post('/api/analyze',files={'file':(name,raw,mime)}).status_code in [415,422]
def test_oversize(client):assert client.post('/api/analyze',files={'file':('x.jpg',b'x'*(8388608+1),'image/jpeg')}).status_code==413
def test_dimension_limit(client):assert client.post('/api/analyze',files={'file':('x.png',picture('PNG',(10001,2)),'image/png')}).status_code==413
def test_strip_exif():
    exif=Image.Exif();exif[270]='private test';im=validate_image(picture(exif=exif),'x.jpg','image/jpeg');assert not im.getexif();assert not im.info

def test_invalid_record(client):assert client.post('/api/analyze',data={'record_id':'missing'}).status_code==404

def test_only_one_input(client):assert client.post('/api/analyze',data={'record_id':query()['id']},files={'file':('x.jpg',picture(),'image/jpeg')}).status_code==422

def test_rate_limit(client):
    for _ in range(12):assert client.post('/api/analyze',data={'record_id':'missing'}).status_code==404
    assert client.post('/api/analyze',data={'record_id':'missing'}).status_code==429

def test_cors(client):
    r=client.options('/api/analyze',headers={'Origin':'https://evil.example','Access-Control-Request-Method':'POST'});assert r.status_code==400;assert 'access-control-allow-origin' not in r.headers

def test_media(client):
    r=client.get(query()['image_url']);assert r.status_code==200;im=Image.open(io.BytesIO(r.content));assert not im.getexif();assert max(im.size)<=1280
    assert client.get('/api/media/secrets.jpg').status_code==404

def test_no_pretend_persistence(client):assert client.post('/api/reviews',json={}).status_code==501

def test_cache_reproduces():
    for i,r in enumerate(records):assert np.allclose(describe(Image.open(DATA/'media'/f"{r['id']}-crop.jpg")),vectors[i],atol=1e-6)

def test_no_invented_identities_or_threshold(client):
    assert len({r['image_uuid'] for r in records})==32
    assert all(r['species']=='Tiger' and r['individual_id'] is None for r in records)
    assert report['threshold'] is None
    assert report['validation']==[] and report['test']==[]
    assert client.get('/api/individuals').json()==[]
    result=client.post('/api/analyze',data={'record_id':query()['id']}).json()
    assert result['threshold'] is None and result['status']=='UNKNOWN'
    assert all(c['individual_id'] is None for c in result['candidates'])

def test_empty_references(monkeypatch):
    import backend.main as m
    monkeypatch.setattr(m,'records',[]);r=retrieve(vectors[0],'uploaded',None);assert r['status']=='UNKNOWN';assert r['candidates']==[]

def test_bounded_multipart_does_not_spool_to_disk(client,monkeypatch):
    import starlette.formparsers as fp
    original=fp.SpooledTemporaryFile;created=[]
    def tracked(*args,**kwargs):
        f=original(*args,**kwargs);created.append(f);return f
    monkeypatch.setattr(fp,'SpooledTemporaryFile',tracked)
    rng=np.random.default_rng(0);im=Image.fromarray(rng.integers(0,255,(900,900,3),dtype=np.uint8));b=io.BytesIO();im.save(b,format='PNG');assert len(b.getvalue())>1024*1024
    response=client.post('/api/analyze',files={'file':('query.png',b.getvalue(),'image/png')})
    assert response.status_code==200;assert created;assert all(not f._rolled for f in created)

def test_body_cap(client):
    response=client.post('/api/analyze',content=b'x'*(9*1024*1024+1),headers={'Content-Type':'application/octet-stream'})
    assert response.status_code==413

def test_invalid_length(client):
    assert client.get('/api/health',headers={'Content-Length':'not-a-number'}).status_code==400

def test_production_security_headers(client):
    if not (DATA.parents[1]/'dist/index.html').exists():pytest.skip('Run npm run build to check production serving')
    response=client.get('/identify');assert response.status_code==200
    assert "script-src 'self'" in response.headers['content-security-policy'];assert response.headers['referrer-policy']=='no-referrer'
    assert client.get('/api/nonexistent').status_code==404

def test_dataset_information_counted_from_files_and_copied_card(client):
    from backend.main import ROOT
    from pathlib import Path
    source=ROOT/'data/source/tiger';data=client.get('/api/dataset').json();info=data['information']
    assert info['source_url']=='https://huggingface.co/datasets/Ultralytics/Tiger-pose'
    assert info['included_image_count']==len([r for r in records if (DATA/'media'/f"{r['id']}.jpg").is_file()])==32
    assert info['original_image_file_count']==len(list((source/'originals').glob('*.jpg')))==32
    assert info['crop_file_count']==32
    assert info['source_train_image_count']==100 and info['source_validation_image_count']==53
    assert info['card_license_declaration']=='license: agpl-3.0'
    assert info['card_license_declaration'] in (source/'README.md').read_text()
    assert info['attribution_text']=='Ultralytics Tiger-pose is a specialized dataset aimed at the pose estimation of tigers.'
    for record in data['records']:
        assert record['source_filename']==Path(record['source_path']).name
        assert record['source_split'] in ['train','val']
        assert record['source_annotation_path'].endswith('.txt')
        assert record['individual_id'] is None
    candidate=client.post('/api/analyze',data={'record_id':query()['id']}).json()['candidates'][0]
    assert candidate['source_filename']==Path(candidate['source_path']).name
    assert candidate['source_annotation_path']
