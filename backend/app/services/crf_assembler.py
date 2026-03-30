"""
CRF 视图组装器

从 CrfFieldExtraction 表实时组装患者的 CRF 当前视图。
替代原来的 ProjectPatient.crf_data 可变快照。

规则:
  1. 对每个 (form_name, field_name)，优先取 is_adopted=True 的记录
  2. 如无 adopted，取 created_at 最新的一条
  3. 返回与原 crf_data 完全相同的结构: {"表单": {"字段": {"value": ..., "source_blocks": [...]}, ...}, ...}
"""
from sqlalchemy import func, case, desc
from ..extensions import db
from ..models.crf_field_extraction import CrfFieldExtraction


def _extract_row_display(row):
    """从表格行中提取纯显示值 dict（去掉 source_blocks）"""
    if not isinstance(row, dict):
        return {}
    display = {}
    for k, v in row.items():
        if isinstance(v, dict) and "value" in v:
            display[k] = str(v["value"]).strip()
        else:
            display[k] = str(v).strip()
    return display


def _extract_row_key(row):
    """从表格行中提取用于去重的 key（只取 value，忽略 source_blocks）"""
    display = _extract_row_display(row)
    return "|".join(f"{k}={v}" for k, v in sorted(display.items()))


def _remove_subset_rows(rows):
    """
    移除「不完整行」: 如果某行的显示值是另一行的子集，则丢弃。
    例如 {患者姓名: "胡世涛"} 是 {身份ID: "524074", 患者姓名: "胡世涛"} 的子集。
    """
    displays = [_extract_row_display(r) for r in rows]
    keep = []
    for i, d_i in enumerate(displays):
        is_subset = False
        for j, d_j in enumerate(displays):
            if i == j or len(d_j) <= len(d_i):
                continue
            # d_i 的每个 kv 都在 d_j 中
            if all(d_j.get(k) == v for k, v in d_i.items()):
                is_subset = True
                break
        if not is_subset:
            keep.append(rows[i])
    return keep


def assemble_crf_view(project_id: str, patient_id: str, template_schema: dict = None) -> dict:
    """
    从 CrfFieldExtraction 实时组装 CRF 当前视图。

    标量/multirow 字段: adopted 优先，否则取最新一条。
    table 字段: 合并所有记录的行，按 display value 去重，移除子集行。

    Returns:
        dict: {"表单名": {"字段名": {"value": ..., "source_blocks": [...]}, ...}, ...}
    """
    # 构建字段类型索引: (form_name, field_name) -> type
    field_type_map = {}
    if template_schema:
        for cat in template_schema.get("categories", []):
            for form in cat.get("forms", []):
                fn = form.get("name", "")
                for field in form.get("fields", []):
                    field_type_map[(fn, field.get("name", ""))] = field.get("type", "text")

    records = CrfFieldExtraction.query.filter_by(
        project_id=project_id,
        patient_id=patient_id
    ).order_by(
        CrfFieldExtraction.form_name,
        CrfFieldExtraction.field_name,
        CrfFieldExtraction.is_adopted.desc(),
        CrfFieldExtraction.created_at.desc()
    ).all()

    from collections import defaultdict
    grouped = defaultdict(list)
    for r in records:
        grouped[(r.form_name, r.field_name)].append(r)

    crf_view = {}
    for (form_name, field_name), recs in grouped.items():
        if form_name not in crf_view:
            crf_view[form_name] = {}

        # adopted 优先
        adopted = next((r for r in recs if r.is_adopted), None)
        if adopted:
            crf_view[form_name][field_name] = {
                "value": adopted.extracted_value,
                "source_blocks": adopted.source_blocks or [],
            }
            continue

        first_val = recs[0].extracted_value
        field_type = field_type_map.get((form_name, field_name), "")

        # 只有 table 类型才跨文档合并行
        if isinstance(first_val, list) and field_type == "table":
            merged_rows = []
            merged_blocks = []
            seen_keys = set()
            for r in recs:
                if not isinstance(r.extracted_value, list):
                    continue
                for row in r.extracted_value:
                    row_key = _extract_row_key(row)
                    if row_key not in seen_keys:
                        seen_keys.add(row_key)
                        merged_rows.append(row)
                if r.source_blocks:
                    for sb in r.source_blocks:
                        if isinstance(sb, dict) and sb.get("bbox"):
                            merged_blocks.append(sb)

            crf_view[form_name][field_name] = {
                "value": _remove_subset_rows(merged_rows),
                "source_blocks": merged_blocks or (recs[0].source_blocks or []),
            }
        else:
            # 标量 / multirow: 取最新一条
            latest = recs[0]
            crf_view[form_name][field_name] = {
                "value": latest.extracted_value,
                "source_blocks": latest.source_blocks or [],
            }

    return crf_view


def assemble_crf_view_light(project_id: str, patient_id: str, template_schema: dict = None) -> dict:
    """
    轻量版: 只返回 value，不返回 source_blocks，用于列表展示。

    Returns:
        dict: {"表单名": {"字段名": value, ...}, ...}
    """
    full = assemble_crf_view(project_id, patient_id, template_schema)
    light = {}
    for form_name, fields in full.items():
        light[form_name] = {}
        for field_name, entry in fields.items():
            light[form_name][field_name] = entry.get("value")
    return light


def compute_extraction_status(project_id: str, patient_id: str, template_schema: dict) -> dict:
    """
    计算抽取完成度 — 从 CrfFieldExtraction 表统计。

    Returns:
        dict: {"total_fields": int, "filled_fields": int, "progress": float}
    """
    total_fields = 0
    filled_field_keys = set()

    # 统计模版中的总字段数
    for cat in template_schema.get("categories", []):
        for form in cat.get("forms", []):
            form_name = form.get("name", "")
            for field in form.get("fields", []):
                total_fields += 1

    # 统计已有记录的字段数（去重）
    existing = db.session.query(
        CrfFieldExtraction.form_name,
        CrfFieldExtraction.field_name
    ).filter_by(
        project_id=project_id,
        patient_id=patient_id
    ).distinct().all()

    filled_fields = len(existing)

    return {
        "total_fields": total_fields,
        "filled_fields": filled_fields,
        "progress": round(filled_fields / total_fields, 2) if total_fields > 0 else 0,
    }
