"""
Celery 异步任务：CRF 结构化抽取管道 (Stage 3)

通过 Google ADK 编排 Triage -> Extraction 流程，最后安全合并至 ProjectPatient.crf_data
"""
import os
import json
import time
import asyncio
import traceback

from app.extensions import celery_app, db
from app.models.project import ResearchProject, ProjectPatient
from app.models.document import Document
from app.models.crf_template import CrfTemplate
from app.models.ocr_result import OcrResult
from app.models.pipeline_trace import PipelineTrace

from google.adk.sessions import InMemorySessionService
from google.adk.runners import Runner
from google.genai import types as genai_types

from app.agents.crf_agent import crf_app, _parse_json_from_text, create_form_repair_agent
from app.validators.crf_validator import validate_form_output
from app.models.crf_field_extraction import CrfFieldExtraction

MAX_REPAIR_ATTEMPTS = 3

def normalize_structural_data(val, blocks_index, document_id):
    if isinstance(val, dict):
        cleaned_dict = {}
        for k, v in val.items():
            if k == "source_blocks" and isinstance(v, list):
                new_s_blocks = []
                for bid in v:
                    if isinstance(bid, str):
                        if bid in blocks_index:
                            new_s_blocks.append({**blocks_index[bid], "block_id": bid, "document_id": document_id})
                        else:
                            new_s_blocks.append({"block_id": bid, "document_id": document_id, "page_id": None, "bbox": None})
                    else:
                        new_s_blocks.append(bid)
                cleaned_dict[k] = new_s_blocks
            else:
                cleaned_v = normalize_structural_data(v, blocks_index, document_id)
                if cleaned_v is not None and str(cleaned_v).strip() != "":
                    cleaned_dict[k] = cleaned_v
        
        keys_set = set(cleaned_dict.keys())
        if "value" not in cleaned_dict and "source_blocks" in cleaned_dict and len(keys_set) <= 2:
            return None
            
        return cleaned_dict if cleaned_dict else None

    elif isinstance(val, list):
        cleaned_list = []
        for item in val:
            cleaned_item = normalize_structural_data(item, blocks_index, document_id)
            if cleaned_item is not None and str(cleaned_item).strip() != "":
                cleaned_list.append(cleaned_item)
        return cleaned_list if cleaned_list else None
    else:
        return val if val is not None and str(val).strip() != "" else None


def _serialize_agent_trace(events, llm_state, crf_catalog=None, user_prompt=''):
    """从 ADK events + final state 中序列化出 per-agent trace 列表，包含真实 prompt"""
    import json as _json
    from app.agents.crf_agent import triage_agent
    
    trace_list = []
    seen_agents = set()
    
    for event in events:
        author = event.author or 'unknown'
        if author in seen_agents:
            continue
        seen_agents.add(author)
        
        output_text = ''
        if event.content and event.content.parts:
            for part in event.content.parts:
                if hasattr(part, 'text') and part.text:
                    output_text += part.text
        
        entry = {
            'agent': author,
            'output_raw': output_text[:5000] if output_text else None,
        }
        trace_list.append(entry)
    
    # ── Enrich triage_agent with real prompts ──
    routing_raw = llm_state.get('routing_state')
    if routing_raw:
        routing_parsed = _parse_json_from_text(str(routing_raw)) if not isinstance(routing_raw, dict) else routing_raw
        triage_entry = next((t for t in trace_list if t['agent'] == 'triage_agent'), None)
        if triage_entry:
            triage_entry['parsed_output'] = routing_parsed
            # 真实的 system prompt
            triage_entry['system_prompt'] = triage_agent.instruction if hasattr(triage_agent, 'instruction') else ''
            # 真实的 user prompt（就是提交给 runner 的 input_content）
            triage_entry['user_prompt'] = user_prompt[:3000] if user_prompt else ''
    
    # ── Enrich extraction agents with real prompts ──
    crf_catalog = crf_catalog or {}
    form_idx = 0
    for key, val in llm_state.items():
        if key.startswith('extracted_'):
            form_name = key[len('extracted_'):]
            parsed = _parse_json_from_text(str(val)) if not isinstance(val, dict) else val
            
            # 重建该 form 的 system prompt（与 create_form_extraction_agent 一致）
            form_schema = crf_catalog.get(form_name, {})
            schema_str = _json.dumps(form_schema, ensure_ascii=False, indent=2) if form_schema else '{}'
            system_prompt = f"""你是临床数据结构化定向提取专家。
当前你需要精准填报的子表单是：【{form_name}】。

以下是该表单的严格数据要求（Schema）：
{schema_str}

【严格输出要求】：
你必须且只能输出一个纯 JSON 对象，不要输出任何其他文字或 Markdown 格式标记。
JSON 对象的键为表单字段名，值为从文档中提取的对应数据。"""
            
            # 查找匹配的 event entry 或创建新的
            found = False
            for entry in trace_list:
                if entry['agent'].startswith('extract_form_') and 'form_name' not in entry:
                    entry['form_name'] = form_name
                    entry['parsed_output'] = parsed
                    entry['parallel'] = True
                    entry['system_prompt'] = system_prompt
                    entry['user_prompt'] = '（继承自 Triage Agent 上下文的 OCR 文档原文）'
                    found = True
                    break
            if not found:
                trace_list.append({
                    'agent': f'extract_form_{form_idx}',
                    'form_name': form_name,
                    'parsed_output': parsed,
                    'parallel': True,
                    'system_prompt': system_prompt,
                    'user_prompt': '（继承自 Triage Agent 上下文的 OCR 文档原文）',
                })
            form_idx += 1
    
    return trace_list


async def _run_adk_pipeline(doc_id: str, ocr_blocks: list, crf_catalog: dict):
    """封装 ADK Runner 的异步执行边界——现在使用结构化 JSON 块"""
    session_service = InMemorySessionService()
    await session_service.create_session(
        app_name=crf_app.name, 
        user_id="system", 
        session_id=str(doc_id),
        state={"crf_catalog": crf_catalog}
    )

    runner = Runner(
        app=crf_app, 
        session_service=session_service
    )
    
    # 组装顶层提示词消息 —— 使用结构化 JSON
    forms_list = list(crf_catalog.keys())
    # 简化 blocks，只保留 block_id + text + page_id（减少 token 消耗）
    blocks_for_llm = [{"block_id": b["block_id"], "text": b["text"], "page_id": b["page_id"]} for b in ocr_blocks]
    import json as _json
    input_content = (
        f"【可供选择的 CRF 表单目录】：\n{forms_list}\n\n"
        f"【OCR 结构化文档】：\n{_json.dumps(blocks_for_llm, ensure_ascii=False)}"
    )
    
    events = []
    async for event in runner.run_async(
        user_id="system",
        session_id=str(doc_id),
        new_message=genai_types.Content(role="user", parts=[genai_types.Part.from_text(text=input_content)])
    ):
        events.append(event)
        
    final_session = await session_service.get_session(
        app_name=crf_app.name, 
        user_id="system", 
        session_id=str(doc_id)
    )
    
    return final_session.state, events, input_content


async def _run_repair_agent_async(form_name, form_schema, broken_output, errors, ocr_blocks, doc_id):
    """运行修复 Agent，返回修正后的 form_data dict"""
    repair_agent = create_form_repair_agent(form_name, form_schema, broken_output, errors)
    session_service = InMemorySessionService()
    repair_session_id = f"{doc_id}_repair_{form_name}"
    await session_service.create_session(
        app_name="repair_app",
        user_id="system",
        session_id=repair_session_id,
        state={}
    )
    
    from google.adk.apps.app import App
    repair_app_inst = App(name="repair_app", root_agent=repair_agent)
    runner = Runner(app=repair_app_inst, session_service=session_service)
    
    blocks_for_llm = [{"block_id": b["block_id"], "text": b["text"], "page_id": b["page_id"]} for b in ocr_blocks]
    input_content = f"请修复以下输出。原始 OCR 数据仅供参考：\n{json.dumps(blocks_for_llm, ensure_ascii=False)[:3000]}"
    
    async for _ in runner.run_async(
        user_id="system",
        session_id=repair_session_id,
        new_message=genai_types.Content(role="user", parts=[genai_types.Part.from_text(text=input_content)])
    ):
        pass
    
    final_session = await session_service.get_session(
        app_name="repair_app",
        user_id="system",
        session_id=repair_session_id
    )
    
    repaired_raw = final_session.state.get(f"repaired_{form_name}", {})
    if isinstance(repaired_raw, dict):
        return repaired_raw
    return _parse_json_from_text(str(repaired_raw)) if repaired_raw else {}


@celery_app.task(bind=True, name='tasks.extract_crf_from_document', max_retries=2, default_retry_delay=10)
def extract_crf_from_document(self, project_id: str, patient_id: str, document_id: str):
    """
    为指定患者的指定文档执行基于 ADK 的 CRF 填报
    """
    from app import create_app
    app = create_app()

    with app.app_context():
        # 1. 前置查询核对
        proj = ResearchProject.query.get(project_id)
        if not proj or not proj.crf_template_id:
            return {"status": "error", "message": "Project or bound template not found."}
            
        template = CrfTemplate.query.get(proj.crf_template_id)
        schema_json = template.schema_json if template else {}
        if not schema_json:
            return {"status": "error", "message": "CRF Template schema is empty."}
            
        proj_patient = ProjectPatient.query.filter_by(project_id=project_id, patient_id=patient_id).first()
        if not proj_patient:
            return {"status": "error", "message": "Patient is not in this project."}
            
        # 提取 OCR 结果 —— 同时取纯文本和结构化 JSON
        ocr_record = OcrResult.query.filter_by(
            document_id=document_id, status=OcrResult.STATUS_SUCCESS
        ).order_by(OcrResult.created_at.desc()).first()

        if not ocr_record or not ocr_record.ocr_raw_json:
            return {"status": "error", "message": "No OCR data found for this document."}
            
        # 从 raw JSON 提取结构化块（含坐标）
        from app.services.textin_client import TextInClient
        ocr_blocks = TextInClient.extract_structured_json(ocr_record.ocr_raw_json)
        if not ocr_blocks:
            return {"status": "error", "message": "OCR structured blocks are empty."}
        
        # 构建 block_id -> bbox 索引（前端用于红框绘制）
        blocks_index = {b["block_id"]: {"page_id": b["page_id"], "bbox": b["bbox"]} for b in ocr_blocks}

        # 查询文档名称用于 trace 可读性
        doc_record = Document.query.get(document_id)
        doc_name = doc_record.filename if doc_record and doc_record.filename else document_id

        # 记录 Trace 开始
        trace = PipelineTrace(
            document_id=document_id,
            document_name=doc_name,
            project_id=project_id,
            patient_id=patient_id,
            stage='CRF_EXTRACTION',
            status='RUNNING'
        )
        db.session.add(trace)
        db.session.commit()

        start_time = time.time()
        
        try:
            # 2. 从 Template 解析出 CRF 扁平目录
            crf_catalog = {}
            for cat in schema_json.get("categories", []):
                for form in cat.get("forms", []):
                    crf_catalog[form["name"]] = form
                    
            # 3. 驱动 ADK 引擎（使用结构化 JSON）
            llm_state, adk_events, user_prompt = asyncio.run(_run_adk_pipeline(document_id, ocr_blocks, crf_catalog))
            
            # 4. 序列化 agent trace
            agent_trace = _serialize_agent_trace(adk_events, llm_state, crf_catalog=crf_catalog, user_prompt=user_prompt)
            
            # 5. 路由结果解析
            routing_raw = llm_state.get("routing_state")
            if isinstance(routing_raw, dict):
                routing_data = routing_raw
            else:
                routing_data = _parse_json_from_text(str(routing_raw)) if routing_raw else {}
            matched_forms = routing_data.get("matched_forms", [])
            
            extracted_forms = []
            merge_log = []
            validation_log = []
            
            for form_idx, form_name in enumerate(matched_forms):
                state_key = f"extracted_{form_name}"
                if state_key not in llm_state:
                    continue
                raw_form = llm_state[state_key]
                if isinstance(raw_form, dict):
                    form_data = raw_form
                else:
                    form_data = _parse_json_from_text(str(raw_form)) if raw_form else {}
                if not form_data:
                    continue
                
                # ──── 验证-修复循环 ────
                form_schema = crf_catalog.get(form_name, {})
                is_valid = False
                last_errors = []
                for attempt in range(MAX_REPAIR_ATTEMPTS + 1):
                    is_valid, last_errors = validate_form_output(form_schema, form_data)
                    if is_valid:
                        validation_log.append({"form": form_name, "attempt": attempt, "status": "passed"})
                        break
                    if attempt < MAX_REPAIR_ATTEMPTS:
                        validation_log.append({"form": form_name, "attempt": attempt, "status": "failed", "errors": last_errors})
                        try:
                            form_data = asyncio.run(
                                _run_repair_agent_async(form_name, form_schema, form_data, last_errors, ocr_blocks, document_id)
                            )
                        except Exception as repair_err:
                            validation_log.append({"form": form_name, "attempt": attempt, "status": "repair_error", "error": str(repair_err)[:200]})
                            break
                    else:
                        validation_log.append({"form": form_name, "attempt": attempt, "status": "exhausted", "errors": last_errors})
                
                if not is_valid:
                    continue
                
                # ──── 字段级持久化（不再写 crf_data 快照） ────
                for k, v in form_data.items():
                    if isinstance(v, dict) and "value" in v:
                        actual_val = v["value"]
                        source_blocks_ids = v.get("source_blocks", [])
                        source_coords = []
                        for bid in source_blocks_ids:
                            if bid in blocks_index:
                                source_coords.append({**blocks_index[bid], "block_id": bid, "document_id": document_id})
                            else:
                                source_coords.append({"block_id": bid, "document_id": document_id, "page_id": None, "bbox": None})
                        if not source_coords:
                            source_coords.append({"document_id": document_id, "block_id": None, "page_id": None, "bbox": None})
                    elif isinstance(v, list):
                        actual_val = v
                        # 从表格行的子字段中聚合所有 source_blocks（含 bbox 坐标）
                        source_coords = []
                        for row in v:
                            if isinstance(row, dict):
                                for sub_field_val in row.values():
                                    if isinstance(sub_field_val, dict) and "source_blocks" in sub_field_val:
                                        for sb in sub_field_val["source_blocks"]:
                                            if isinstance(sb, str):
                                                # block_id 字符串，需要解析
                                                if sb in blocks_index:
                                                    source_coords.append({**blocks_index[sb], "block_id": sb, "document_id": document_id})
                                            elif isinstance(sb, dict) and sb not in source_coords:
                                                source_coords.append(sb)
                        if not source_coords:
                            source_coords = [{"document_id": document_id, "block_id": None, "page_id": None, "bbox": None}]
                    else:
                        actual_val = v
                        source_coords = [{"document_id": document_id, "block_id": None, "page_id": None, "bbox": None}]
                    
                    actual_val = normalize_structural_data(actual_val, blocks_index, document_id)
                    if actual_val is None or str(actual_val).strip() == "":
                        continue
                    
                    # 判定 merge_action: 查询该字段是否已有历史记录
                    existing = CrfFieldExtraction.query.filter_by(
                        project_id=project_id, patient_id=patient_id,
                        form_name=form_name, field_name=k
                    ).order_by(CrfFieldExtraction.created_at.desc()).first()
                    
                    if not existing:
                        action = "filled"
                    elif str(existing.extracted_value).strip() == str(actual_val).strip():
                        action = "same"
                    else:
                        action = "conflict"
                    
                    merge_log.append({"form": form_name, "field": k, "action": action, "value": actual_val, "source_blocks": source_coords})
                    
                    field_record = CrfFieldExtraction(
                        project_id=project_id,
                        patient_id=patient_id,
                        document_id=document_id,
                        form_name=form_name,
                        field_name=k,
                        extracted_value=actual_val,
                        source_blocks=source_coords,
                        merge_action=action,
                    )
                    db.session.add(field_record)
                                
                extracted_forms.append(form_name)
            
            duration_ms = int((time.time() - start_time) * 1000)
            
            # 6. 保存溯源记录
            trace.status = 'SUCCESS'
            trace.duration_ms = duration_ms
            trace.llm_payload = {
                "routing_result": routing_data,
                "extracted_forms": extracted_forms,
                "agent_trace": agent_trace,
                "merge_log": merge_log,
                "validation_log": validation_log,
                "input_prompt": user_prompt[:2000] if user_prompt else None,
                "ocr_blocks": ocr_blocks,
            }
            db.session.commit()
            
            return {
                "status": "success",
                "extracted_forms": extracted_forms,
                "duration_ms": duration_ms
            }

        except Exception as exc:
            duration_ms = int((time.time() - start_time) * 1000)
            trace.status = 'FAILED'
            trace.error_msg = str(exc)[:2000]
            trace.duration_ms = duration_ms
            trace.llm_payload = {"error_trace": traceback.format_exc()}
            db.session.commit()

            raise self.retry(exc=exc)


# ===================================================================
# 新管道: Form-Centric 抽取（Form → Documents）
# ===================================================================

async def _run_form_extraction_on_doc(form_name, form_schema, ocr_blocks, doc_id):
    """对单份文档执行表单抽取，返回 (form_data_dict, events, input_content)"""
    from app.agents.crf_agent import create_form_extraction_agent, _parse_json_from_text
    from google.adk.apps.app import App

    agent = create_form_extraction_agent(form_name, form_schema, index=0)
    session_service = InMemorySessionService()
    session_id = f"{doc_id}_form_{form_name}"
    await session_service.create_session(
        app_name="form_extract_app",
        user_id="system",
        session_id=session_id,
        state={}
    )

    app_inst = App(name="form_extract_app", root_agent=agent)
    runner = Runner(app=app_inst, session_service=session_service)

    blocks_for_llm = [{"block_id": b["block_id"], "text": b["text"], "page_id": b["page_id"]} for b in ocr_blocks]
    input_content = json.dumps(blocks_for_llm, ensure_ascii=False)

    events = []
    async for event in runner.run_async(
        user_id="system",
        session_id=session_id,
        new_message=genai_types.Content(role="user", parts=[genai_types.Part.from_text(text=input_content)])
    ):
        events.append(event)

    final_session = await session_service.get_session(
        app_name="form_extract_app",
        user_id="system",
        session_id=session_id
    )

    raw = final_session.state.get(f"extracted_{form_name}", {})
    if isinstance(raw, dict):
        form_data = raw
    else:
        form_data = _parse_json_from_text(str(raw)) if raw else {}

    return form_data, events, input_content


@celery_app.task(bind=True, name='tasks.extract_crf_by_form', max_retries=2, default_retry_delay=10)
def extract_crf_by_form(self, project_id: str, patient_id: str, form_name: str, documents_meta: list, target_document_ids: list = None):
    """
    Form-centric 抽取: 对指定表单，根据给定的 documents_meta 在 worker 内先执行 LLM 匹配，再逐一抽取字段。
    """
    from app import create_app
    app = create_app()

    with app.app_context():
        proj = ResearchProject.query.get(project_id)
        if not proj or not proj.crf_template_id:
            return {"status": "error", "message": "Project or template not found."}

        template = CrfTemplate.query.get(proj.crf_template_id)
        schema_json = template.schema_json if template else {}

        # 找到该表单的 schema
        form_schema = None
        for cat in schema_json.get("categories", []):
            for form in cat.get("forms", []):
                if form["name"] == form_name:
                    form_schema = form
                    break
            if form_schema:
                break

        if not form_schema:
            return {"status": "error", "message": f"Form '{form_name}' not found in template."}

        # 在 Worker 内执行 LLM 的 Form→Documents 智能匹配
        if target_document_ids:
            document_ids = target_document_ids
            routing_trace = {
                "agent": "manual_upload", 
                "status": "forced_match",
                "matched_documents": document_ids,
                "summary": "用户直接指定了匹配文档"
            }
        else:
            from app.services.form_document_matcher import match_documents_for_form, determine_topK
            topK = determine_topK(form_schema)
            import json
            document_ids, routing_trace = match_documents_for_form(form_schema, documents_meta, topK=topK)
        
        if not document_ids:
            # 如果没有匹配到相关文档，直接返回成功并跳过
            return {"status": "skipped", "message": "No relevant documents matched for this form."}

        # 记录 Trace
        trace = PipelineTrace(
            document_id=document_ids[0] if document_ids else None,
            document_name=f"表单抽取: {form_name}",
            project_id=project_id,
            patient_id=patient_id,
            stage='CRF_EXTRACTION',
            status='RUNNING'
        )
        db.session.add(trace)
        db.session.commit()

        start_time = time.time()
        merge_log = []
        validation_log = []
        agent_trace = [routing_trace]
        docs_processed = []

        try:
            for doc_idx, document_id in enumerate(document_ids):
                # 获取 OCR 数据
                ocr_record = OcrResult.query.filter_by(
                    document_id=document_id, status=OcrResult.STATUS_SUCCESS
                ).order_by(OcrResult.created_at.desc()).first()

                if not ocr_record or not ocr_record.ocr_raw_json:
                    continue

                from app.services.textin_client import TextInClient
                ocr_blocks = TextInClient.extract_structured_json(ocr_record.ocr_raw_json)
                if not ocr_blocks:
                    continue

                blocks_index = {b["block_id"]: {"page_id": b["page_id"], "bbox": b["bbox"]} for b in ocr_blocks}

                doc_record = Document.query.get(document_id)
                doc_name = doc_record.filename if doc_record else document_id[:8]

                # 运行 extraction agent
                form_data, events, input_content = asyncio.run(
                    _run_form_extraction_on_doc(form_name, form_schema, ocr_blocks, document_id)
                )

                if not form_data:
                    agent_trace.append({
                        "agent": f"extract_{form_name}_doc{doc_idx}",
                        "document": doc_name,
                        "status": "empty_output"
                    })
                    continue

                # 验证-修复循环
                is_valid = False
                last_errors = []
                for attempt in range(MAX_REPAIR_ATTEMPTS + 1):
                    is_valid, last_errors = validate_form_output(form_schema, form_data)
                    if is_valid:
                        validation_log.append({"form": form_name, "doc": doc_name, "attempt": attempt, "status": "passed"})
                        break
                    if attempt < MAX_REPAIR_ATTEMPTS:
                        validation_log.append({"form": form_name, "doc": doc_name, "attempt": attempt, "status": "failed", "errors": last_errors})
                        try:
                            form_data = asyncio.run(
                                _run_repair_agent_async(form_name, form_schema, form_data, last_errors, ocr_blocks, document_id)
                            )
                        except Exception:
                            break
                    else:
                        validation_log.append({"form": form_name, "doc": doc_name, "attempt": attempt, "status": "exhausted", "errors": last_errors})

                if not is_valid:
                    continue

                # 字段级持久化
                for k, v in form_data.items():
                    if isinstance(v, dict) and "value" in v:
                        actual_val = v["value"]
                        source_blocks_ids = v.get("source_blocks", [])
                        source_coords = []
                        for bid in source_blocks_ids:
                            if bid in blocks_index:
                                source_coords.append({**blocks_index[bid], "block_id": bid, "document_id": document_id})
                            else:
                                source_coords.append({"block_id": bid, "document_id": document_id, "page_id": None, "bbox": None})
                        if not source_coords:
                            source_coords.append({"document_id": document_id, "block_id": None, "page_id": None, "bbox": None})
                    elif isinstance(v, list):
                        actual_val = v
                        source_coords = []
                        for row in v:
                            if isinstance(row, dict):
                                for sub_field_val in row.values():
                                    if isinstance(sub_field_val, dict) and "source_blocks" in sub_field_val:
                                        for sb in sub_field_val["source_blocks"]:
                                            if isinstance(sb, str):
                                                if sb in blocks_index:
                                                    source_coords.append({**blocks_index[sb], "block_id": sb, "document_id": document_id})
                                            elif isinstance(sb, dict) and sb not in source_coords:
                                                source_coords.append(sb)
                        if not source_coords:
                            source_coords = [{"document_id": document_id, "block_id": None, "page_id": None, "bbox": None}]
                    else:
                        actual_val = v
                        source_coords = [{"document_id": document_id, "block_id": None, "page_id": None, "bbox": None}]

                    actual_val = normalize_structural_data(actual_val, blocks_index, document_id)
                    if actual_val is None or str(actual_val).strip() == "":
                        continue

                    # merge_action
                    existing = CrfFieldExtraction.query.filter_by(
                        project_id=project_id, patient_id=patient_id,
                        form_name=form_name, field_name=k
                    ).order_by(CrfFieldExtraction.created_at.desc()).first()

                    if not existing:
                        action = "filled"
                    elif str(existing.extracted_value).strip() == str(actual_val).strip():
                        action = "same"
                    else:
                        action = "conflict"

                    merge_log.append({"form": form_name, "field": k, "action": action, "doc": doc_name})

                    field_record = CrfFieldExtraction(
                        project_id=project_id,
                        patient_id=patient_id,
                        document_id=document_id,
                        form_name=form_name,
                        field_name=k,
                        extracted_value=actual_val,
                        source_blocks=source_coords,
                        merge_action=action,
                    )
                    db.session.add(field_record)

                docs_processed.append(doc_name)
                
                # 从 events 抽取实际的大模型 prompt 和 raw_output
                output_raw = ""
                for ev in events:
                    if hasattr(ev, "new_message") and ev.new_message.role == "assistant":
                        if hasattr(ev.new_message, "parts") and ev.new_message.parts:
                            output_raw = str(ev.new_message.parts[0].text)[:3000]
                            break
                            
                agent_trace.append({
                    "agent": f"extract_{form_name}_doc{doc_idx}",
                    "document": doc_name,
                    "document_id": document_id,
                    "form_name": form_name,
                    "parallel": True,
                    "status": "success",
                    "fields_extracted": len(form_data),
                    "system_prompt": "提取目标: " + str([f["name"] for f in form_schema.get("fields", [])]),
                    "user_prompt": input_content[:3000] if input_content else "",
                    "output_raw": output_raw,
                    "parsed_output": form_data
                })

            duration_ms = int((time.time() - start_time) * 1000)

            trace.status = 'SUCCESS'
            trace.duration_ms = duration_ms
            trace.llm_payload = {
                "pipeline": "form_centric",
                "form_name": form_name,
                "input_prompt": json.dumps(documents_meta, ensure_ascii=False, indent=2),
                "routing_result": {
                    "matched_forms": [form_name] if docs_processed else [],
                    "summary": f"智能路由引擎就绪"
                },
                "extracted_forms": [form_name] if docs_processed else [],
                "sub_tasks": agent_trace,
                "matched_documents": document_ids,
                "docs_processed": docs_processed,
                "agent_trace": agent_trace,
                "merge_log": merge_log,
                "validation_log": validation_log,
            }
            db.session.commit()

            return {
                "status": "success",
                "form_name": form_name,
                "docs_processed": docs_processed,
                "duration_ms": duration_ms
            }

        except Exception as exc:
            duration_ms = int((time.time() - start_time) * 1000)
            trace.status = 'FAILED'
            trace.error_msg = str(exc)[:2000]
            trace.duration_ms = duration_ms
            trace.llm_payload = {"error_trace": traceback.format_exc()}
            db.session.commit()
            raise self.retry(exc=exc)
