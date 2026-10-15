from pydantic import BaseModel, Field, model_validator
import math
class RecordImage(BaseModel):
    id:str;image_uuid:str;individual_id:str|None;species:str;source_path:str;width:int;height:int;datetime:str|None;bbox:list[float];region_bbox:list[float]|None;viewpoint:str|None;CA_score:float|None;manual:bool|None;split:str;role:str;withheld_identity:bool;image_url:str;crop_url:str
    source_filename:str|None=None
    source_split:str|None=None
    source_annotation_path:str|None=None
class Candidate(RecordImage):
    rank:int;score:float
class Detection(BaseModel):
    source:str;bbox:list[float];crop_url:str|None
    normalized_bbox:list[float]|None=None
    label:str|None=None
    detector_score:float|None=None
    detector_version:str|None=None
class Analysis(BaseModel):
    request_id:str;timestamp:str;query_id:str;method:str;model:str;dataset_version:str;status:str;threshold:float|None;criterion:str;detection:Detection|None;candidates:list[Candidate];explanation:str
class DatasetStatus(BaseModel):
    commit:str|None;records:int;images:int;individuals:int;reference_records:int
class Health(BaseModel):
    detector_loaded:bool=False
    detector_name:str|None=None
    detector_version:str|None=None
    detector_labels:list[str]=[]
    detector_score_cutoff:float|None=None
    detector_scope:str='Open-vocabulary configured prompts; not validated on field camera-trap footage of tigers.'
    detector_setup:str='Install requirements, run python scripts/setup_detector.py, then restart the backend. No runtime downloads.'

    status:str;model_loaded:bool;model:str;method:str;version:str;dataset:DatasetStatus;threshold:float|None;calibration:str|None
class FrameDetection(BaseModel):
    label:str
    score:float=Field(ge=0,le=1)
    bbox:list[float]
    image_width:int=Field(gt=0)
    image_height:int=Field(gt=0)
    @model_validator(mode='after')
    def valid_box(self):
        b=self.bbox
        if len(b)!=4 or not all(math.isfinite(n) and 0<=n<=1 for n in b) or b[2]<=b[0] or b[3]<=b[1]:raise ValueError('Invalid normalized xyxy box')
        return self
class DetectionResponse(BaseModel):
    detections:list[FrameDetection]
    detector:str
    detector_version:str
    timestamp:str
    latency_ms:float
    request_id:str
    score_cutoff:float
    cutoff_basis:str='configurable heuristic, not validated'
class DatasetInformation(BaseModel):
    name:str
    source_url:str
    card_license_declaration:str|None
    attribution_text:str|None
    included_image_count:int
    original_image_file_count:int
    crop_file_count:int
    source_train_image_count:int
    source_validation_image_count:int
class Dataset(BaseModel):
    source:str;commit:str;license:str;selection:str;source_counts:dict[str,int];records:list[RecordImage]

    information:DatasetInformation|None=None
