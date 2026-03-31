"""
CRF 视图组装器

从 CrfFieldExtraction 表实时组装患者的 CRF 当前视图。
替代原来的 ProjectPatient.crf_data 可变快照。

规则:
  1. 对不可重复表单（anchor_fields=[]）: 按 (form_name, field_name) 分组
     - 优先取 is_adopted=True 的记录，否则取最新一条
  2. 对可重复表单（anchor_fields 非空）: 按 (form_name, anchor_value) 分别实例化
     - 每个实例的 display key 为 "form_name__anchor_value"
     - 无锚点值的记录（LLM 未能提取锚点）退化为 form_name 单实例
  3. table 字段: 跨记录合并行（去重 + 移除子集行）
  4. 返回结构: {"表单key": {"字段": {"value": ..., "source_blocks": [...]}, ...}, ...}
     附加: {"_anchor_meta": {"表单名": [{"anchor_value": "...", "display_key": "..."}]}}
"""
from collections import defaultdict
from sqlalchemy import desc
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


def _build_schema_indexes(template_schema):
    """从模板 schema 构建两个索引。

    Returns:
        anchor_form_map: {form_name: [anchor_field_name, ...]}
        field_type_map:  {(form_name, field_name): field_type}
    """
    anchor_form_map = {}
    field_type_map = {}
    if not template_schema:
        return anchor_form_map, field_type_map

    for cat in template_schema.get("categories", []):
        for form in cat.get("forms", []):
            fn = form.get("name", "")
            af = form.get("anchor_fields", [])
            if af:
                anchor_form_map[fn] = af
            for field in form.get("fields", []):
                field_type_map[(fn, field.get("name", ""))] = field.get("type", "text")

    return anchor_form_map, field_type_map


def assemble_crf_view(project_id: str, patient_id: str, template_schema: dict = None) -> dict:
    """
    从 CrfFieldExtraction 实时组装 CRF 当前视图。

    不可重复表单: adopted 优先，否则取最新一条。
    可重复表单: 按 anchor_value 分组为独立实例，display_key = "form_name__anchor_value"。
    table 字段: 合并所有记录的行，按 display value 去重，移除子集行。

    Returns:
        dict: {
            "表单名": {"字段名": {"value": ..., "source_blocks": [...]}, ...},
            "表单名__锚点值": {...},
            "_anchor_meta": {
                "表单名": [{"anchor_value": "锚点值", "display_key": "表单名__锚点值"}, ...]
            }
        }
    """
    anchor_form_map, field_type_map = _build_schema_indexes(template_schema)

    records = CrfFieldExtraction.query.filter_by(
        project_id=project_id,
        patient_id=patient_id
    ).order_by(
        CrfFieldExtraction.form_name,
        CrfFieldExtraction.field_name,
        CrfFieldExtraction.is_adopted.desc(),
        CrfFieldExtraction.created_at.desc()
    ).all()

    # 分组: (form_name, anchor_value, field_name) -> [records]
    grouped = defaultdict(list)
    for r in records:
        grouped[(r.form_name, r.anchor_value, r.field_name)].append(r)

    crf_view = {}
    anchor_meta = {}  # form_name -> list of {"anchor_value": ..., "display_key": ...}

    for (form_name, anchor_value, field_name), recs in grouped.items():
        # 计算 display_key：有锚点则以 __ 分隔，否则用 form_name 本身
        if anchor_value and form_name in anchor_form_map:
            display_key = f"{form_name}__{anchor_value}"
            # 汇总锚点元数据
            if form_name not in anchor_meta:
                anchor_meta[form_name] = []
            entry = {"anchor_value": anchor_value, "display_key": display_key}
            if entry not in anchor_meta[form_name]:
                anchor_meta[form_name].append(entry)
        else:
            display_key = form_name

        if display_key not in crf_view:
            crf_view[display_key] = {}

        # adopted 优先
        adopted = next((r for r in recs if r.is_adopted), None)
        if adopted:
            crf_view[display_key][field_name] = {
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

            crf_view[display_key][field_name] = {
                "value": _remove_subset_rows(merged_rows),
                "source_blocks": merged_blocks or (recs[0].source_blocks or []),
            }
        else:
            # 标量 / multirow: 取最新一条
            latest = recs[0]
            crf_view[display_key][field_name] = {
                "value": latest.extracted_value,
                "source_blocks": latest.source_blocks or [],
            }

    # 对 anchor_meta 中的实例按锚点值排序（方便前端按时间顺序展示）
    for form_name in anchor_meta:
        anchor_meta[form_name].sort(key=lambda x: x["anchor_value"])

    crf_view["_anchor_meta"] = anchor_meta
    return crf_view


def assemble_crf_view_light(project_id: str, patient_id: str, template_schema: dict = None) -> dict:
    """
    轻量版: 只返回 value，不返回 source_blocks，用于列表展示。

    Returns:
        dict: {
            "表单名": {"字段名": value, ...},
            "表单名__锚点值": {...},
            "_anchor_meta": {...}
        }
    """
    full = assemble_crf_view(project_id, patient_id, template_schema)
    anchor_meta = full.pop("_anchor_meta", {})
    light = {}
    for form_key, fields in full.items():
        light[form_key] = {}
        for field_name, entry in fields.items():
            light[form_key][field_name] = entry.get("value")
    light["_anchor_meta"] = anchor_meta
    return light


def compute_extraction_status(project_id: str, patient_id: str, template_schema: dict) -> dict:
    """
    计算抽取完成度 — 从 CrfFieldExtraction 表统计。

    对不可重复表单按字段数统计；
    对可重复表单只统计「是否有至少一个实例」（不因实例数膨胀分母）。

    Returns:
        dict: {"total_fields": int, "filled_fields": int, "progress": float}
    """
    total_fields = 0
    filled_field_keys = set()

    # 统计模版中的总字段数（以模板字段数为基准，不因实例数翻倍）
    for cat in template_schema.get("categories", []):
        for form in cat.get("forms", []):
            form_name = form.get("name", "")
            for field in form.get("fields", []):
                total_fields += 1

    # 统计已有记录的 (form_name, field_name) 组合（去重，忽略 anchor_value）
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
