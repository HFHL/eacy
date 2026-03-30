import csv
import uuid
import json
from app import create_app, db
from app.models.crf_template import CrfTemplate, CrfTemplateVersion

def generate_uid(prefix="f_"):
    return f"{prefix}{uuid.uuid4().hex[:8]}"

app = create_app()
with app.app_context():
    schema = {
        "version": "1.0",
        "categories": []
    }
    category_map = {}

    with open('../converted_schema.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            cat_name = row.get("父类", "").strip()
            form_name = row.get("所属表单", "").strip()
            field_name = row.get("字段名称", "").strip()

            if not cat_name or not form_name or not field_name:
                continue

            if cat_name not in category_map:
                category_map[cat_name] = {
                    "id": generate_uid("cat_"),
                    "name": cat_name,
                    "forms": []
                }
                schema["categories"].append(category_map[cat_name])

            category = category_map[cat_name]
            form = next((f for f in category["forms"] if f["name"] == form_name), None)
            
            if not form:
                form = {
                    "id": generate_uid("form_"),
                    "name": form_name,
                    "row_type": "single_row",
                    "conflict_strategy": "fill_blank",
                    "fields": []
                }
                category["forms"].append(form)

            display_type = row.get("展示类型", "").strip()
            
            # Map type
            mapped_type = "text"
            if display_type == "表格": mapped_type = "table"
            elif display_type == "分组": mapped_type = "multirow"
            elif display_type == "单选": mapped_type = "radio"
            elif display_type == "下拉单选": mapped_type = "radio"
            elif display_type == "文本": mapped_type = "text"
            elif display_type == "日期": mapped_type = "date"
            
            field_obj = {
                "id": generate_uid("field_"),
                "name": field_name,
                "type": mapped_type,
                "description": row.get("字段描述", ""),
                "prompt": row.get("prompt提示词", ""),
                "required": row.get("是否必填", "") == "是"
            }

            if mapped_type in ["table", "multirow"]:
                children_key = "table_columns" if mapped_type == "table" else "sub_fields"
                field_obj[children_key] = []
                
                # Extract child fields from 字段1_名称, 字段2_名称
                idx = 1
                while True:
                    child_name = row.get(f"字段{idx}_名称", "").strip()
                    if not child_name:
                        break
                        
                    child_disp = row.get(f"字段{idx}_控件类型", "").strip()
                    c_mapped = "text"
                    if child_disp == "单选": c_mapped = "radio"
                    elif child_disp == "下拉单选": c_mapped = "radio"
                    elif child_disp == "日期": c_mapped = "date"
                    
                    child_obj = {
                        "id": generate_uid("field_"),
                        "name": child_name,
                        "type": c_mapped,
                        "required": row.get(f"字段{idx}_必填", "") == "是"
                    }
                    field_obj[children_key].append(child_obj)
                    idx += 1

            form["fields"].append(field_obj)
            
    # Find existing template to update or create new
    template = CrfTemplate.query.filter_by(template_name="patient_ehr_schema_V2").first()
    if template:
        template.schema_json = schema
    else:
        template = CrfTemplate(
            template_name="patient_ehr_schema_V2",
            description="基于 JSON Schema 转换的超大型系统模版",
            category="系统通用",
            schema_json=schema,
            creator_id=None,
        )
        db.session.add(template)
        
    db.session.flush()

    v1 = CrfTemplateVersion(
        template_id=template.id,
        version='v1',
        schema_json=schema,
        change_notes='Fix Empty Schema Import',
    )
    db.session.add(v1)
    db.session.commit()
    print("SUCCESS: 模版导入成功！Categories:", len(schema["categories"]))
