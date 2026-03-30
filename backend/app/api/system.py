from flask import Blueprint, jsonify
from ..models.system import SystemConfig

system_bp = Blueprint('system', __name__)

@system_bp.route('/config', methods=['GET'])
def get_configs():
    """获取所有暴露给前端动态生效的系统配置参数"""
    configs = SystemConfig.query.all()
    # 转化为简单的 key-value 字典
    config_dict = { c.key: c.value for c in configs }
    
    # 预留内置默认值，防止数据库空虚
    default_config = {
        "max_concurrent_uploads": "3",  # 默认同时只允许 3 个文件上传
        "oss_part_size_mb": "5"         # 默认切片大小 5MB
    }
    
    # 合并（数据库取出的会覆盖默认值）
    merged_config = {**default_config, **config_dict}
    
    return jsonify({
        "success": True,
        "code": 0,
        "data": merged_config
    })

@system_bp.route('/monitor', methods=['GET'])
def get_monitor_stats():
    from ..extensions import celery_app
    from ..models.document import Document
    import time

    # 初始化 Inspect
    i = celery_app.control.inspect()
    
    # 获取存活节点
    try:
        active_nodes_stats = i.stats() or {}
        active_nodes_tasks = i.active() or {}
    except Exception:
        active_nodes_stats = {}
        active_nodes_tasks = {}

    worker_nodes = []
    
    # 凑节点列表
    if active_nodes_stats:
        for node_name, stats in active_nodes_stats.items():
            active_count = len(active_nodes_tasks.get(node_name, []))
            concurrency = stats.get('pool', {}).get('max-concurrency', 'Unknown')
            
            worker_nodes.append({
                "id": node_name,
                "status": "online",
                "uptime": f"已运行 (PID: {stats.get('pid')})", 
                "memory": "自动调度 (Celery)",
                "concurrency": f"{concurrency} (Prefork)",
                "active_tasks": active_count
            })
    else:
        # 默认返回一个离线节点如果拿不到
        worker_nodes.append({
            "id": "celery@unknown-node",
            "status": "offline",
            "uptime": "-",
            "memory": "-",
            "concurrency": "-",
            "active_tasks": 0
        })

    # 从 OCR Results 表获取真实任务粒度数据
    from app.models.ocr_result import OcrResult
    from app.models.metadata_result import MetadataResult
    from app.models.user import User
    
    ocr_tasks = []
    
    # 1. 查询所有 OCR 任务记录
    ocr_records = OcrResult.query.filter_by(is_deleted=False).order_by(OcrResult.created_at.desc()).limit(30).all()
    
    for ocr in ocr_records:
        doc = Document.query.get(ocr.document_id)
        file_name = doc.filename if doc else "未知文件"
        uploader_name = "未知"
        if doc and doc.uploader_id:
            uploader = User.query.get(doc.uploader_id)
            uploader_name = uploader.email if uploader else f"用户#{doc.uploader_id}"
        
        runtime = "未开始"
        if ocr.duration_ms:
            if ocr.duration_ms >= 60000:
                runtime = f"{ocr.duration_ms // 60000}m {(ocr.duration_ms % 60000) // 1000}s"
            elif ocr.duration_ms >= 1000:
                runtime = f"{ocr.duration_ms / 1000:.1f}s"
            else:
                runtime = f"{ocr.duration_ms}ms"
        
        if ocr.status == OcrResult.STATUS_SUCCESS:
            st = "SUCCESS"
            step = "识别完成"
        elif ocr.status == OcrResult.STATUS_FAILED:
            st = "FAILURE"
            step = "识别失败"
        else:
            st = "PROGRESS"
            step = "OCR 识别中"
            runtime = "正在计算"
        
        ocr_tasks.append({
            "id": ocr.id[:8] + "-...",
            "documentId": ocr.document_id,
            "fileName": file_name,
            "uploaderName": uploader_name,
            "status": st,
            "queueTime": "0s",
            "runtime": runtime,
            "step": step,
            "createdAt": ocr.created_at.isoformat() if ocr.created_at else None
        })
    
    # 2. 补充尚无 OCR 记录但正在处理的文档
    pending_docs = Document.query.filter(
        Document.is_deleted == False,
        Document.status == Document.STATUS_METADATA_EXTRACTING
    ).all()
    existing_doc_ids = {ocr.document_id for ocr in ocr_records if ocr.status == OcrResult.STATUS_PROCESSING}
    for doc in pending_docs:
        if doc.id not in existing_doc_ids:
            uploader = User.query.get(doc.uploader_id) if doc.uploader_id else None
            uploader_name = uploader.email if uploader else f"用户#{doc.uploader_id or '?'}"
            ocr_tasks.insert(0, {
                "id": doc.id[:8] + "-...",
                "documentId": doc.id,
                "fileName": doc.filename,
                "uploaderName": uploader_name,
                "status": "PROGRESS",
                "queueTime": "0s",
                "runtime": "正在计算",
                "step": "OCR 识别中",
                "createdAt": None
            })

    # ─── 元数据抽取管道任务 ─────────────────────────────
    extraction_tasks = []
    meta_records = MetadataResult.query.filter_by(is_deleted=False).order_by(MetadataResult.created_at.desc()).limit(30).all()
    
    for meta in meta_records:
        doc = Document.query.get(meta.document_id)
        file_name = doc.filename if doc else "未知文件"
        uploader_name = "未知"
        if doc and doc.uploader_id:
            uploader = User.query.get(doc.uploader_id)
            uploader_name = uploader.email if uploader else f"用户#{doc.uploader_id}"
        
        runtime = "未开始"
        if meta.duration_ms:
            if meta.duration_ms >= 60000:
                runtime = f"{meta.duration_ms // 60000}m {(meta.duration_ms % 60000) // 1000}s"
            elif meta.duration_ms >= 1000:
                runtime = f"{meta.duration_ms / 1000:.1f}s"
            else:
                runtime = f"{meta.duration_ms}ms"
        
        if meta.status == MetadataResult.STATUS_SUCCESS:
            st = "SUCCESS"
            step = f"抽取完成 ({meta.llm_model or ''})"
        elif meta.status == MetadataResult.STATUS_FAILED:
            st = "FAILURE"
            step = f"抽取失败: {(meta.error_msg or '')[:50]}"
        else:
            st = "PROGRESS"
            step = "LLM 抽取中"
            runtime = "正在计算"
        
        extraction_tasks.append({
            "id": meta.id[:8] + "-...",
            "documentId": meta.document_id,
            "fileName": file_name,
            "uploaderName": uploader_name,
            "status": st,
            "queueTime": "0s",
            "runtime": runtime,
            "step": step,
            "createdAt": meta.created_at.isoformat() if meta.created_at else None
        })

    # ─── CRF 自动推理填充管道任务 ─────────────────────────────
    crf_tasks = []
    from app.models.pipeline_trace import PipelineTrace
    from app.models.project import ResearchProject
    trace_records = PipelineTrace.query.filter_by(stage='CRF_EXTRACTION').order_by(PipelineTrace.created_at.desc()).limit(30).all()
    
    # 缓存项目名称避免重复查询
    _project_cache = {}
    
    for trace in trace_records:
        doc = Document.query.get(trace.document_id)
        file_name = trace.document_name or (doc.filename if doc else "未知文件")
        uploader_name = "未知"
        if doc and doc.uploader_id:
            uploader = User.query.get(doc.uploader_id)
            uploader_name = uploader.email if uploader else f"用户#{doc.uploader_id}"
        
        # 项目名称
        project_name = None
        pid = trace.project_id
        if pid:
            if pid not in _project_cache:
                proj = ResearchProject.query.get(pid)
                _project_cache[pid] = proj.project_name if proj else None
            project_name = _project_cache[pid]
            
        runtime = "未开始"
        if trace.duration_ms:
            if trace.duration_ms >= 60000:
                runtime = f"{trace.duration_ms // 60000}m {(trace.duration_ms % 60000) // 1000}s"
            elif trace.duration_ms >= 1000:
                runtime = f"{trace.duration_ms / 1000:.1f}s"
            else:
                runtime = f"{trace.duration_ms}ms"
                
        if trace.status == 'SUCCESS':
            st = "SUCCESS"
            step = "ADK 取值合并完成"
        elif trace.status == 'FAILED':
            st = "FAILURE"
            step = f"抽取失败: {(trace.error_msg or '')[:50]}"
        else:
            st = "PROGRESS"
            step = "ADK 引擎排队计算中"
            runtime = "正在计算"
            
        crf_tasks.append({
            "id": trace.id[:8] + "-...",
            "documentId": trace.document_id,
            "fileName": file_name,
            "uploaderName": uploader_name,
            "projectId": trace.project_id,
            "projectName": project_name,
            "ossUrl": doc.oss_url if doc else None,
            "mimeType": doc.mime_type if doc else None,
            "status": st,
            "queueTime": "0s",
            "runtime": runtime,
            "step": step,
            "createdAt": trace.created_at.isoformat() if trace.created_at else None
        })

    return jsonify({
        "success": True,
        "code": 0,
        "data": {
            "workerNodes": worker_nodes,
            "ocrTasks": ocr_tasks,
            "extractionTasks": extraction_tasks,
            "crfTasks": crf_tasks
        }
    })

