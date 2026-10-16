import io
from PIL import Image
from backend.pipeline import run_pipeline, crop_box
from backend.species import load_registry

class Loc:
    name='fix';version='t';labels=['Animal','Person'];cutoff=.25
    def detect(self,image):
        return [{'label':'Animal','score':0.4,'bbox':[0.1,0.1,0.5,0.5],'image_width':100,'image_height':100}]

class PersonLoc(Loc):
    def detect(self,image):
        return [{'label':'Person','score':0.9,'bbox':[0.1,0.1,0.5,0.5],'image_width':100,'image_height':100}]

class Clf:
    name='fix-clf';version='t';labels=['Axis axis'];vocabulary=[]
    def classify(self,crop):
        return {'label':'chital','scientific_name':'Axis axis','rank':'species','score':0.9,'top_k':[{'label':'chital','scientific_name':'Axis axis','rank':'species','score':0.9}]}

def test_person_not_classified():
    boxes,t=run_pipeline(Image.new('RGB',(80,80)),PersonLoc(),Clf(),load_registry())
    assert boxes[0]['label']=='Person'
    assert boxes[0].get('classifier_score') is None

def test_crop_cap(monkeypatch):
    monkeypatch.setenv('CLASSIFY_MAX_CROPS','1')
    class Multi(Loc):
        def detect(self,image):
            return [
                {'label':'Animal','score':0.9,'bbox':[0.0,0.0,0.8,0.8],'image_width':80,'image_height':80},
                {'label':'Animal','score':0.8,'bbox':[0.1,0.1,0.9,0.9],'image_width':80,'image_height':80},
            ]
    n={'c':0}
    class Count(Clf):
        def classify(self,crop):
            n['c']+=1
            return super().classify(crop)
    run_pipeline(Image.new('RGB',(80,80)),Multi(),Count(),load_registry())
    assert n['c']==1

def test_small_crop_skipped():
    im=Image.new('RGB',(80,80))
    assert crop_box(im,[0,0,0.01,0.01],0,32) is None
