"""
Celery 异步任务：元数据抽取管道

从 OCR 文本 + 配置表构建 prompt → 调用 LLM → 解析 JSON → 写入 metadata_results
"""
import json
import os
import re
import time
import traceback

from app.extensions import celery_app, db
from app.models.document import Document
from app.models.ocr_result import OcrResult
from app.models.metadata_result import MetadataResult
from app.models.metadata_config import MetadataField, DocTypeCategory, DocTypeSubtype, ExtractionRule


def _build_system_prompt():
    """从配置表动态构建 System Prompt"""

    # 1. 读取所有抽取规则（纯文本）
    rules = {}
    rule_descriptions = {}
    for rule in ExtractionRule.query.all():
        # rule_value 可能是旧 JSON 或纯文本，统一转为字符串
        val = rule.rule_value
        if isinstance(val, (dict, list)):
            val = json.dumps(val, ensure_ascii=False, indent=2)
        rules[rule.rule_key] = str(val) if val else ''
        rule_descriptions[rule.rule_key] = rule.description or rule.rule_key

    system_role = rules.pop('system_role', '你是专业的医疗文档结构化专家，负责从医疗文档的OCR文本中提取结构化元数据。')

    # 2. 将每条规则拼装为 ## 标题 + 内容
    rule_sections = []
    for key, text in rules.items():
        if text.strip():
            title = rule_descriptions.get(key, key)
            rule_sections.append(f"## {title}\n{text}")

    # 3. 构建文档分类体系
    classification_lines = ["## 文档分类依据（两步：先选主类型，再选子类型）\n"]
    categories = DocTypeCategory.query.order_by(DocTypeCategory.sort_order).all()
    for cat in categories:
        classification_lines.append(f"\n### {cat.name}")
        subtypes = DocTypeSubtype.query.filter_by(category_id=cat.id).order_by(DocTypeSubtype.sort_order).all()
        for st in subtypes:
            classification_lines.append(f"  - **{st.name}**：{st.prompt or ''}")

    # 4. 构建输出格式（从字段表动态生成）
    fields = MetadataField.query.filter_by(is_active=True).order_by(MetadataField.sort_order).all()
    output_example = {}
    for f in fields:
        if f.field_type == 'integer':
            output_example[f.field_name] = "数字或null"
        elif f.field_type == 'array':
            output_example[f.field_name] = "[...]"
        elif f.enum_values:
            output_example[f.field_name] = "|".join(f.enum_values) + "|null"
        else:
            output_example[f.field_name] = "...或null"

    field_desc_lines = ["## 字段说明"]
    for f in fields:
        req_mark = "【必填】" if f.required else ""
        field_desc_lines.append(f"- **{f.field_name}**{req_mark}（{f.field_type}）：{f.description or ''}")

    output_format = "## 输出格式\n直接返回 JSON，不要 Markdown 代码块：\n" + json.dumps(output_example, ensure_ascii=False, indent=2)

    return "\n\n".join(filter(None, [
        system_role,
        *rule_sections,
        "\n".join(field_desc_lines),
        "\n".join(classification_lines),
        output_format,
    ]))


@celery_app.task(bind=True, name='tasks.extract_metadata', max_retries=2, default_retry_delay=10)
def extract_metadata(self, document_id: str, ocr_result_id: str = None, trigger_form_extract: dict = None):
    """
    对指定文档执行元数据抽取。

    Args:
        document_id: 文档 UUID
        ocr_result_id: 指定使用的 OCR 记录 ID（可选，默认取最新）
    """
    from app import create_app
    app = create_app()

    with app.app_context():
        # 1. 查文档
        doc = Document.query.get(document_id)
        if not doc:
            print(f"[META] Document {document_id} not found, aborting.")
            return {"status": "error", "message": "Document not found"}

        # 2. 获取 OCR 文本
        if ocr_result_id:
            ocr_record = OcrResult.query.get(ocr_result_id)
        else:
            ocr_record = OcrResult.query.filter_by(
                document_id=document_id, status=OcrResult.STATUS_SUCCESS
            ).order_by(OcrResult.created_at.desc()).first()

        if not ocr_record or not ocr_record.ocr_text:
            print(f"[META] No OCR text for doc={document_id}, aborting.")
            return {"status": "error", "message": "No OCR text available"}

        # 3. 更新文档状态
        doc.status = Document.STATUS_EXTRACTING_METADATA
        db.session.commit()

        # 4. 创建元数据抽取记录
        meta_record = MetadataResult(
            document_id=document_id,
            ocr_result_id=ocr_record.id,
            status=MetadataResult.STATUS_PROCESSING
        )
        db.session.add(meta_record)
        db.session.commit()

        start_time = time.time()

        try:
            # 5. 构建 Prompt
            system_prompt = _build_system_prompt()

            # 6. 调用 LLM
            from openai import OpenAI
            client = OpenAI(
                api_key=os.environ.get("OPENAI_API_KEY"),
                base_url=os.environ.get("OPENAI_API_BASE_URL"),
            )
            model = os.environ.get("OPENAI_MODEL", "MiniMax-M2.7")
            user_message = f"请从以下医疗文档OCR文本中提取元数据：\n\n{ocr_record.ocr_text}"

            print(f"[META] Calling {model} for doc={document_id}, prompt_len={len(system_prompt)}, text_len={len(ocr_record.ocr_text)}")

            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                response_format={"type": "json_object"},
                temperature=0,
            )

            duration_ms = int((time.time() - start_time) * 1000)
            raw_output = response.choices[0].message.content
            usage = response.usage

            # 7. 解析 JSON
            try:
                result = json.loads(raw_output)
            except json.JSONDecodeError:
                m = re.search(r'\{.*\}', raw_output, re.DOTALL)
                result = json.loads(m.group()) if m else {}

            # 8. 写入结果
            meta_record.result_json = result
            meta_record.llm_model = model
            meta_record.system_prompt = system_prompt
            meta_record.user_prompt = user_message
            meta_record.llm_raw_response = raw_output
            meta_record.prompt_tokens = usage.prompt_tokens if usage else None
            meta_record.completion_tokens = usage.completion_tokens if usage else None
            meta_record.duration_ms = duration_ms
            meta_record.status = MetadataResult.STATUS_SUCCESS

            doc.status = Document.STATUS_EXTRACT_DONE
            db.session.commit()

            print(f"[META] ✅ Success for doc={document_id}: {len(result)} fields, {duration_ms}ms")
            
            if trigger_form_extract:
                from app.tasks.crf_tasks import extract_crf_by_form
                from app.models.patient import PatientDocument
                
                project_id = trigger_form_extract.get("project_id")
                patient_id = trigger_form_extract.get("patient_id")
                form_name = trigger_form_extract.get("form_name")
                
                # 构建简易 documents_meta，因为是强制提取，所以不需要精确的 Metadata
                pd = PatientDocument.query.filter_by(document_id=document_id).first()
                documents_meta = [{
                    "doc_id": document_id,
                    "title": pd.doc_title if pd else (doc.filename or "上传的文档"),
                    "type": pd.doc_type if pd else "自动检测",
                    "subtype": pd.doc_subtype if pd else "",
                    "filename": doc.filename or "自动检测",
                }]
                
                extract_crf_by_form.delay(
                    project_id=project_id,
                    patient_id=patient_id,
                    form_name=form_name,
                    documents_meta=documents_meta,
                    target_document_ids=[document_id]
                )
                print(f"[META] ⏩ Chained targeted CRF form extraction for doc={document_id}, form={form_name}")

            return {
                "status": "success",
                "document_id": document_id,
                "metadata_result_id": meta_record.id,
                "fields_count": len(result),
                "duration_ms": duration_ms
            }

        except Exception as exc:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = f"{type(exc).__name__}: {str(exc)}"
            print(f"[META] ❌ Failed for doc={document_id}: {error_msg}")
            print(traceback.format_exc())

            meta_record.status = MetadataResult.STATUS_FAILED
            meta_record.error_msg = str(exc)[:2000]
            meta_record.duration_ms = duration_ms

            doc.status = Document.STATUS_EXTRACT_FAILED
            db.session.commit()

            raise self.retry(exc=exc)
