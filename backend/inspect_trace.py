from app import create_app
from app.models.pipeline_trace import PipelineTrace
from app.models.ocr_result import OcrResult
import json

app = create_app()

with app.app_context():
    trace = PipelineTrace.query.filter(PipelineTrace.stage == 'CRF_EXTRACTION').order_by(PipelineTrace.created_at.desc()).first()
    document_id = trace.document_id
    
    ocr = OcrResult.query.filter_by(document_id=document_id, status='SUCCESS').order_by(OcrResult.created_at.desc()).first()
    if ocr and ocr.ocr_raw_json:
        raw = ocr.ocr_raw_json
        
        # Check image_process
        img_proc = raw.get('image_process')
        print("image_process:", json.dumps(img_proc, ensure_ascii=False) if img_proc else 'N/A')
        
        result = raw.get('result', {})
        detail = result.get('detail', [])
        if detail:
            d0 = detail[0]
            pos = d0.get('position')
            print("\nDetail[0].position:", json.dumps(pos, ensure_ascii=False) if pos else 'N/A')
        
        # Also check if image size info is in ocr_raw_json directly
        print("\nTop-level ocr_raw_json non-result keys:")
        for k in raw:
            if k != 'result':
                print(f"  {k}: {str(raw[k])[:200]}")
        
        # Check ocr_blocks in trace to understand max bounding box
        blocks = trace.llm_payload.get('ocr_blocks', [])
        xs = [b['bbox']['x'] + b['bbox']['w'] for b in blocks if 'bbox' in b]
        ys = [b['bbox']['y'] + b['bbox']['h'] for b in blocks if 'bbox' in b]
        if xs:
            print(f"\nMax X+W in OCR blocks: {max(xs)}")
            print(f"Max Y+H in OCR blocks: {max(ys)}")
