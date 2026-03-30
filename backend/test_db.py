from app import create_app
from app.extensions import db
from app.models.pipeline_trace import PipelineTrace
import json

app = create_app()
with app.app_context():
    traces = PipelineTrace.query.filter_by(stage='CRF_EXTRACTION').order_by(PipelineTrace.created_at.desc()).limit(3).all()
    out = []
    for t in traces:
        p = t.llm_payload or {}
        out.append({
            "id": t.id, 
            "doc_id": t.document_id,
            "pipeline": p.get("pipeline"),
            "doc_name": t.document_name
        })
    print(json.dumps(out, indent=2))
