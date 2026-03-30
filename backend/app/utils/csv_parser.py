import csv
import uuid
import io
from typing import Dict, Any, List

def generate_uid(prefix="f_"):
    return f"{prefix}{uuid.uuid4().hex[:8]}"

def map_display_type(display_type: str, data_type: str, desc: str) -> str:
    dt = display_type.lower()
    if dt in ["date", "日期"]:
        return "date"
    elif dt in ["radio", "select", "单选", "下拉单选"]:
        return "radio"
    elif dt in ["checkbox", "multi-select", "多选", "下拉多选"]:
        return "checkbox"
    elif dt in ["group", "multirow", "分组", "多行子表"]:
        return "multirow"
    elif dt in ["table", "表格"]:
        return "table"
    elif dt in ["number", "数字"]:
        return "number"
    elif "数字" in data_type or "数字" in desc or "评分" in desc:
        return "number"
    else:
        return "text"

def parse_csv_to_schema(file_stream: bytes) -> Dict[str, Any]:
    """
    Parse the specific 4th hospital CSV format into standard EACY CRF schema.
    """
    decoded = file_stream.decode('utf-8-sig', errors='replace')
    reader = csv.DictReader(io.StringIO(decoded))

    schema: Dict[str, Any] = {
        "version": "1.0",
        "categories": []
    }

    category_map: Dict[str, Any] = {}
    current_parent = None

    for row in reader:
        category_name = row.get("文件（访视层）", "").strip()
        form_name = row.get("层级1（表单层）", "").strip()
        
        if not category_name or not form_name:
            continue

        if category_name not in category_map:
            category_map[category_name] = {
                "id": generate_uid("cat_"),
                "name": category_name,
                "forms": []
            }
            schema["categories"].append(category_map[category_name])
        
        category = category_map[category_name]

        form = next((f for f in category["forms"] if f["name"] == form_name), None)
        if not form:
            is_repeatable = row.get("group是否可重复", "").strip() == "是" or row.get("table是否多行", "").strip() == "是"
            form = {
                "id": generate_uid("form_"),
                "name": form_name,
                "row_type": "multi_row" if is_repeatable else "single_row",
                "conflict_strategy": "fill_blank",
                "fields": []
            }
            category["forms"].append(form)
            current_parent = None

        level2_val = row.get("层级2", "").strip()
        level3_val = row.get("层级3", "").strip()
        
        is_level3 = bool(level3_val)
        field_name = level3_val if is_level3 else level2_val

        if not field_name:
            continue

        display_type = row.get("展示类型", "").strip()
        options_raw = row.get("可选项值", "").strip()
        unit = row.get("数据单位", "").strip()
        prompt = row.get("抽取提示词（示例）", "").strip()
        is_nullable = row.get("字段可否为空（nullable）", "").strip()
        date_anchor = row.get("时间属性字段组绑定", "").strip()
        conflict_rule = row.get("字段冲突处理规则", "").strip()
        description = row.get("提示词- 字段说明", "").strip()
        data_type = row.get("数据类型", "").strip()

        mapped_type = map_display_type(display_type, data_type, description)

        field_obj = {
            "id": generate_uid("field_"),
            "name": field_name,
            "type": mapped_type,
            "description": description,
            "required": (is_nullable == "否")
        }

        if prompt: field_obj["prompt"] = prompt
        if unit: field_obj["x-unit"] = unit
        if date_anchor: field_obj["x-date-anchor"] = date_anchor
        if conflict_rule: field_obj["x-conflict-strategy"] = conflict_rule

        # Handle enums
        if mapped_type in ["radio", "checkbox"] and options_raw:
            field_obj["options"] = [opt.strip() for opt in options_raw.split(",") if opt.strip()]

        if mapped_type == "text" and display_type in ["textarea", "多行文本"]:
            field_obj["x-component-props"] = {"rows": 4}

        # Hierarchy assignment
        if mapped_type in ["table", "multirow"]:
            if mapped_type == "table":
                field_obj["table_columns"] = []
            else:
                field_obj["sub_fields"] = []
            form["fields"].append(field_obj)
            current_parent = field_obj
        elif is_level3 and current_parent:
            if current_parent["type"] == "table":
                current_parent["table_columns"].append(field_obj)
            else:
                current_parent["sub_fields"].append(field_obj)
        else:
            current_parent = None
            form["fields"].append(field_obj)

    return schema
