"""
Celery 异步任务：OCR 识别管道

当文档上传完成后，由 Flask 回调接口触发此任务。
任务流程：
  1. 从 OSS 公网 URL 调用 TextIn OCR API
  2. 解析返回结果，提取纯文本和置信度
  3. 写入 ocr_results 表
  4. 更新 documents 表的状态流转
"""
import os
import time
import traceback
from app.extensions import celery_app, db
from app.models.document import Document
from app.models.ocr_result import OcrResult
from app.services.textin_client import TextInClient


@celery_app.task(bind=True, name='tasks.ocr_recognize', max_retries=3, default_retry_delay=10)
def ocr_recognize(self, document_id: str, oss_url: str, trigger_form_extract: dict = None):
    """
    对指定文档执行 OCR 识别。
    
    Args:
        document_id: 文档 UUID
        oss_url: 文档在 OSS 上的公网可访问 URL
    """
    from app import create_app
    app = create_app()

    with app.app_context():
        # 1. 更新文档状态为「OCR 识别中」
        doc = Document.query.get(document_id)
        if not doc:
            print(f"[OCR] Document {document_id} not found, aborting.")
            return {"status": "error", "message": "Document not found"}

        doc.status = Document.STATUS_METADATA_EXTRACTING
        db.session.commit()

        # 2. 创建 OCR 结果记录（状态=PROCESSING）
        ocr_record = OcrResult(
            document_id=document_id,
            provider='textin',
            status=OcrResult.STATUS_PROCESSING
        )
        db.session.add(ocr_record)
        db.session.commit()

        start_time = time.time()

        try:
            # 3. 通过 STS 获取临时凭证，再生成带签名的 OSS 下载链接
            import oss2
            from alibabacloud_sts20150401.client import Client as StsClient
            from alibabacloud_sts20150401 import models as sts_models
            from alibabacloud_tea_openapi import models as open_api_models

            oss_access_key_id = os.environ.get("OSS_ACCESS_KEY_ID")
            oss_access_key_secret = os.environ.get("OSS_ACCESS_KEY_SECRET")
            oss_endpoint = os.environ.get("OSS_ENDPOINT")
            oss_bucket_name = os.environ.get("OSS_BUCKET_NAME")
            oss_role_arn = os.environ.get("OSS_ROLE_ARN")

            # Step A: 调用 STS AssumeRole 拿临时凭证
            sts_config = open_api_models.Config(
                access_key_id=oss_access_key_id,
                access_key_secret=oss_access_key_secret,
                endpoint='sts.cn-shanghai.aliyuncs.com'
            )
            sts_client = StsClient(sts_config)
            sts_request = sts_models.AssumeRoleRequest(
                duration_seconds=900,
                role_arn=oss_role_arn,
                role_session_name="eacy-ocr-download-session"
            )
            sts_response = sts_client.assume_role(sts_request)
            creds = sts_response.body.credentials

            # Step B: 用临时凭证签名 OSS 下载 URL
            sts_auth = oss2.StsAuth(
                creds.access_key_id,
                creds.access_key_secret,
                creds.security_token
            )
            bucket = oss2.Bucket(sts_auth, f"https://{oss_endpoint}", oss_bucket_name)
            
            # 从 oss_url 提取 object key
            # oss_url 格式: eacy.cn-beijing.aliyuncs.com/documents/xxx.jpg
            if '/' in oss_url:
                object_key = oss_url.split('/', 1)[1] if '.' in oss_url.split('/')[0] else oss_url
            else:
                object_key = oss_url
            
            # 生成 30 分钟有效的签名 URL
            signed_url = bucket.sign_url('GET', object_key, 1800)
            
            # 4. 调用 TextIn API
            client = TextInClient()
            print(f"[OCR] Starting recognition for doc={document_id}, object_key={object_key}")
            api_response = client.recognize_by_url(signed_url)

            duration_ms = int((time.time() - start_time) * 1000)

            # 4. 检查 API 响应
            if api_response.get("code") != 200:
                error_msg = f"TextIn API error: code={api_response.get('code')}, msg={api_response.get('message')}"
                print(f"[OCR] {error_msg}")
                
                ocr_record.status = OcrResult.STATUS_FAILED
                ocr_record.error_msg = error_msg
                ocr_record.duration_ms = duration_ms
                
                doc.status = Document.STATUS_METADATA_FAILED
                db.session.commit()
                return {"status": "failed", "error": error_msg}

            # 5. 提取结构化数据
            ocr_text = client.extract_text(api_response)
            confidence = client.extract_confidence(api_response)
            total_pages = client.extract_page_count(api_response)

            # 6. 更新 OCR 结果记录
            ocr_record.ocr_raw_json = api_response
            ocr_record.ocr_text = ocr_text
            ocr_record.confidence_avg = confidence
            ocr_record.total_pages = total_pages
            ocr_record.duration_ms = duration_ms
            ocr_record.status = OcrResult.STATUS_SUCCESS

            # 7. 更新文档状态 -> OCR 完成
            doc.status = Document.STATUS_COMPLETED
            db.session.commit()

            print(f"[OCR] ✅ Success for doc={document_id}: {total_pages} pages, "
                  f"confidence={confidence:.2f}, {len(ocr_text)} chars, {duration_ms}ms")

            # 8. 自动触发元数据抽取（管道串联）
            from app.tasks.metadata_tasks import extract_metadata
            extract_metadata.delay(document_id, trigger_form_extract=trigger_form_extract)
            print(f"[OCR] ⏩ Chained metadata extraction for doc={document_id}")

            return {
                "status": "success",
                "document_id": document_id,
                "total_pages": total_pages,
                "text_length": len(ocr_text),
                "confidence": confidence,
                "duration_ms": duration_ms
            }

        except Exception as exc:
            duration_ms = int((time.time() - start_time) * 1000)
            error_msg = f"{type(exc).__name__}: {str(exc)}\n{traceback.format_exc()}"
            print(f"[OCR] ❌ Failed for doc={document_id}: {error_msg}")

            # 更新失败状态
            ocr_record.status = OcrResult.STATUS_FAILED
            ocr_record.error_msg = str(exc)[:2000]
            ocr_record.duration_ms = duration_ms
            
            doc.status = Document.STATUS_METADATA_FAILED
            db.session.commit()

            # 自动重试（最多 3 次）
            raise self.retry(exc=exc)
