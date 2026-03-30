"""
Form → Documents 智能匹配器

根据表单定义（名称、字段、prompt），从候选文档列表中匹配最相关的文档。
使用 LLM 做语义匹配，支持 topK 截取。
"""
import json
import os
from typing import Optional


def generate_default_form_prompt(form_schema: dict) -> str:
    """根据表单名+字段名自动生成默认的描述提示词"""
    name = form_schema.get("name", "")
    fields = [f.get("name", "") for f in form_schema.get("fields", [])]
    return f"该表单【{name}】需要提取以下信息: {', '.join(fields)}。请从最相关的医疗文档中获取。"


def match_documents_for_form(
    form_schema: dict,
    documents_meta: list[dict],
    topK: Optional[int] = None,
) -> tuple[list[str], dict]:
    """
    用 LLM 判断: 给定表单定义 + 所有文档元数据 → 返回排序后的候选文档ID列表以及调用历史(trace_dict)

    Args:
        form_schema: {"name": "血型", "prompt": "...", "fields": [...]}
        documents_meta: [{"doc_id": "xxx", "title": "化验报告", "type": "检验", "subtype": "...", "filename": "..."}]
        topK: 最多返回几份 (None=不限)
    
    Returns:
        list[str]: 按相关度降序排列的 document_id 列表
    """
    if not documents_meta:
        return [], {}
    
    form_name = form_schema.get("name", "未命名表单")
    form_prompt = form_schema.get("prompt") or generate_default_form_prompt(form_schema)
    
    # 构建字段信息摘要
    fields_desc = []
    for f in form_schema.get("fields", []):
        field_type = f.get("type", "text")
        fields_desc.append(f"  - {f.get('name', '?')} ({field_type})")
    fields_str = "\n".join(fields_desc) if fields_desc else "  (无字段)"
    
    # 构建文档列表
    docs_desc = []
    for i, dm in enumerate(documents_meta):
        label = f"{i+1}. [{dm.get('type', '未知')}] {dm.get('title', dm.get('filename', '未知'))}"
        if dm.get("subtype"):
            label += f" ({dm['subtype']})"
        docs_desc.append(label)
    docs_str = "\n".join(docs_desc)
    
    sys_prompt = "你是医疗文档匹配专家。请判断哪些候选文档最可能包含指定 CRF 表单所需的数据。你只能输出纯 JSON 格式的数据，不要包含任何多余文字和 Markdown 代码块。如果没有任何文档符合，输出 {\"matched_doc_indices\": []}"
    
    prompt = f"""## 当前 CRF 表单
名称: {form_name}
描述: {form_prompt}
字段列表:
{fields_str}

## 候选文档列表
{docs_str}

## 任务
请判断哪些文档最可能包含上述表单字段所需的数据。按相关度从高到低排序。
如果没有文档包含相关数据，返回空数组。

## 输出格式
只输出纯 JSON，内容格式如下:
{{"matched_doc_indices": [3, 1, 5], "reasoning": "简要说明匹配原因"}}

注意: matched_doc_indices 中的数字对应文档列表中的编号（从1开始）。一定要输出纯 JSON。"""

    try:
        import litellm
        model_name = os.getenv("OPENAI_MODEL", "MiniMax-M2.7")
        api_base = os.getenv("OPENAI_API_BASE_URL", "https://api.minimaxi.com/v1")
        api_key = os.getenv("OPENAI_API_KEY", "")
        
        response = litellm.completion(
            model=f"openai/{model_name}",
            api_base=api_base,
            api_key=api_key,
            messages=[
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1,
            max_tokens=1000,
        )
        
        result_text = response.choices[0].message.content or ""
        print(f"[form_document_matcher] Form '{form_name}' LLM raw output: {result_text}")
        
        # 解析 JSON
        import re
        # Try direct parse
        try:
            result = json.loads(result_text.strip())
        except json.JSONDecodeError:
            match = re.search(r'\{.*\}', result_text, re.DOTALL)
            result = json.loads(match.group(0)) if match else {}
        
        indices = result.get("matched_doc_indices", [])
        print(f"[form_document_matcher] Form '{form_name}' extracted indices: {indices}")
        
        # 转换索引为 doc_id (1-based → 0-based)
        matched_ids = []
        for idx in indices:
            real_idx = int(idx) - 1
            if 0 <= real_idx < len(documents_meta):
                matched_ids.append(documents_meta[real_idx]["doc_id"])
        
        # 应用 topK
        if topK and topK > 0:
            matched_ids = matched_ids[:topK]
            
        print(f"[form_document_matcher] Form '{form_name}' final matched doc IDs (topK={topK}): {matched_ids}")
        trace_dict = {
            "agent": "triage_agent",
            "system_prompt": sys_prompt,
            "user_prompt": prompt,
            "output_raw": result_text,
        }
        return matched_ids, trace_dict
        
    except Exception as e:
        import traceback
        print(f"[form_document_matcher] LLM match error: {e}")
        traceback.print_exc()
        # Fallback: 返回所有文档
        matched_ids = [dm["doc_id"] for dm in documents_meta]
        trace_dict = {
            "agent": "triage_agent",
            "system_prompt": sys_prompt,
            "user_prompt": prompt,
            "output_raw": f"LLM Match Error: {e}",
        }
        return matched_ids, trace_dict


def determine_topK(form_schema: dict) -> Optional[int]:
    """
    根据表单 schema 决定 topK。
    
    规则:
      - 如果表单 schema 中显式指定了 topK，使用它
      - 如果表单所有字段都是 table，topK=None（不限，跨文档合并）
      - 否则默认 topK=2（取最相关的 2 份文档，因为有些信息分散在入院+出院记录中）
    """
    explicit = form_schema.get("topK")
    if explicit is not None:
        return int(explicit) if explicit > 0 else None
    
    fields = form_schema.get("fields", [])
    if not fields:
        return 1
    
    all_table = all(f.get("type") == "table" for f in fields)
    if all_table:
        return None  # 不限
    
    return 2  # 默认取 top-2 最相关文档
