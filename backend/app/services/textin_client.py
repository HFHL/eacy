"""
TextIn OCR 客户端 - 封装对 TextIn API 的调用逻辑。
支持从 OSS URL 直传或本地二进制流两种模式。
"""
import os
import json
import requests
import time


class TextInClient:
    """TextIn 文档解析 API 客户端"""

    # 默认解析参数
    DEFAULT_OPTIONS = {
        "dpi": 144,
        "get_image": "none",
        "markdown_details": 1,
        "page_count": 50,
        "parse_mode": "auto",
        "table_flavor": "html",
        "page_details": 0,
        "raw_ocr": 1,
        "char_details": 0,
    }

    def __init__(self, app_id=None, secret_code=None, api_url=None):
        self.app_id = app_id or os.environ.get("TEXTIN_APP_ID")
        self.secret_code = secret_code or os.environ.get("TEXTIN_SECRET_CODE")
        self.api_url = api_url or os.environ.get("TEXTIN_API_URL")

        if not self.app_id or not self.secret_code:
            raise ValueError("TextIn credentials not configured (TEXTIN_APP_ID / TEXTIN_SECRET_CODE)")

    def recognize_by_url(self, file_url: str, options: dict = None) -> dict:
        """通过公网 URL 发送文件给 TextIn 解析"""
        opts = {**self.DEFAULT_OPTIONS, **(options or {})}
        params = {key: str(value) for key, value in opts.items()}

        headers = {
            "x-ti-app-id": self.app_id,
            "x-ti-secret-code": self.secret_code,
            "Content-Type": "text/plain",
        }

        response = requests.post(
            self.api_url,
            params=params,
            headers=headers,
            data=file_url,
            timeout=120,
        )
        response.raise_for_status()
        return response.json()

    def recognize_by_bytes(self, file_content: bytes, options: dict = None) -> dict:
        """通过二进制流发送文件给 TextIn 解析"""
        opts = {**self.DEFAULT_OPTIONS, **(options or {})}
        params = {key: str(value) for key, value in opts.items()}

        headers = {
            "x-ti-app-id": self.app_id,
            "x-ti-secret-code": self.secret_code,
            "Content-Type": "application/octet-stream",
        }

        response = requests.post(
            self.api_url,
            params=params,
            headers=headers,
            data=file_content,
            timeout=120,
        )
        response.raise_for_status()
        return response.json()

    @staticmethod
    def extract_text(api_response: dict) -> str:
        """从 TextIn 响应中提取纯文本（markdown 格式）"""
        result = api_response.get("result", {})
        # 优先取 markdown 全文
        if result.get("markdown"):
            return result["markdown"]
        # 降级：拼接 detail 中的文本
        detail = result.get("detail", [])
        lines = []
        for item in detail:
            if isinstance(item, dict) and item.get("text"):
                lines.append(item["text"])
        return "\n".join(lines)

    @staticmethod
    def extract_confidence(api_response: dict) -> float:
        """从 TextIn 响应中计算平均置信度"""
        result = api_response.get("result", {})
        detail = result.get("detail", [])
        if not detail:
            return 0.0
        scores = []
        for item in detail:
            if isinstance(item, dict) and "score" in item:
                scores.append(item["score"])
        return sum(scores) / len(scores) if scores else 0.0

    @staticmethod
    def extract_page_count(api_response: dict) -> int:
        """从 TextIn 响应中获取总页数"""
        result = api_response.get("result", {})
        return result.get("total_page_number", 1)

    @staticmethod
    def extract_structured_json(api_response: dict) -> list:
        """
        从 TextIn 响应中提取结构化 JSON，每个块携带文本和位置坐标。
        返回: [{ block_id, text, page_id, bbox: {x, y, w, h}, type, paragraph_id }]
        position 是 8 个坐标 [x1,y1, x2,y2, x3,y3, x4,y4] — 四角多边形，
        转换为简化 bbox {x, y, w, h}。
        """
        result = api_response.get("result", {})
        detail = result.get("detail", [])
        blocks = []
        for idx, item in enumerate(detail):
            if not isinstance(item, dict):
                continue
            text = item.get("text", "").strip()
            if not text:
                continue
            
            # 解析 position [x1,y1, x2,y2, x3,y3, x4,y4] -> bbox
            pos = item.get("position", [])
            bbox = None
            if len(pos) >= 8:
                xs = [pos[i] for i in range(0, 8, 2)]
                ys = [pos[i] for i in range(1, 8, 2)]
                x_min, y_min = min(xs), min(ys)
                bbox = {
                    "x": x_min,
                    "y": y_min,
                    "w": max(xs) - x_min,
                    "h": max(ys) - y_min,
                }
            
            blocks.append({
                "block_id": f"B{idx}",
                "text": text,
                "page_id": item.get("page_id", 1),
                "bbox": bbox,
                "type": item.get("sub_type") or item.get("type", "text"),
                "paragraph_id": item.get("paragraph_id"),
            })
        return blocks
