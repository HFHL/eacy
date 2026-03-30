from app import create_app
from app.extensions import db
from app.models.pipeline_trace import PipelineTrace

app = create_app()
with app.app_context():
    t = PipelineTrace.query.filter_by(document_name="表单抽取: 人口学情况").order_by(PipelineTrace.created_at.desc()).first()
    if t:
        print("db llm_payload keys:", t.llm_payload.keys())
        print("pipeline value:", t.llm_payload.get("pipeline"))
        print("t.id:", t.id)
        print("doc_id:", t.document_id)
