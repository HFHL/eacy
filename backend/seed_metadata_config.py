"""
Seed 脚本：把 config/ 下的 3 个 JSON 文件导入数据库配置表。
用法: cd eacy/backend && python seed_metadata_config.py
"""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.extensions import db
from app.models.metadata_config import MetadataField, DocTypeCategory, DocTypeSubtype, ExtractionRule

# JSON 文件路径（相对项目根目录）
PROJECT_ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
METADATA_FIELDS_JSON = os.path.join(PROJECT_ROOT, 'config', 'metadata_fields.json')
DOC_TYPES_JSON = os.path.join(PROJECT_ROOT, 'config', 'document_types.json')
EXTRACTION_RULES_JSON = os.path.join(PROJECT_ROOT, 'config', 'extraction_rules.json')

# 中文字段名 → 英文键名映射
FIELD_KEY_MAP = {
    '唯一标识符': 'identifiers',
    '机构名称': 'institution',
    '科室信息': 'department',
    '患者姓名': 'patient_name',
    '患者性别': 'patient_gender',
    '患者年龄': 'patient_age',
    '出生日期': 'birth_date',
    '联系电话': 'contact_phone',
    '诊断': 'diagnosis',
    '文档类型': 'doc_type',
    '文档子类型': 'doc_subtype',
    '文档标题': 'doc_title',
    '文档摘要': 'doc_summary',
    '文档生效日期': 'effective_date',
}


def seed_metadata_fields():
    """导入 metadata_fields.json → metadata_fields 表"""
    with open(METADATA_FIELDS_JSON, encoding='utf-8') as f:
        data = json.load(f)

    count = 0
    for i, field in enumerate(data['fields']):
        name = field['name']
        key = FIELD_KEY_MAP.get(name, name)

        existing = MetadataField.query.filter_by(field_name=name).first()
        if existing:
            continue

        mf = MetadataField(
            field_name=name,
            field_key=key,
            field_type=field.get('type', 'string'),
            required=field.get('required', False),
            enum_values=field.get('enum'),
            description=field.get('description'),
            items_schema=field.get('items'),
            sort_order=i,
            is_active=True,
        )
        db.session.add(mf)
        count += 1

    db.session.commit()
    print(f"  ✓ metadata_fields: 导入 {count} 个字段")


def seed_doc_types():
    """导入 document_types.json → doc_type_categories + doc_type_subtypes"""
    with open(DOC_TYPES_JSON, encoding='utf-8') as f:
        data = json.load(f)

    cat_count = 0
    sub_count = 0

    for i, doc_type in enumerate(data['doc_types']):
        existing = DocTypeCategory.query.filter_by(name=doc_type['name']).first()
        if existing:
            cat = existing
        else:
            cat = DocTypeCategory(
                name=doc_type['name'],
                description=doc_type.get('description'),
                default_subtype=doc_type.get('default_subtype'),
                sort_order=i,
            )
            db.session.add(cat)
            db.session.flush()  # 获取 cat.id
            cat_count += 1

        for j, subtype in enumerate(doc_type.get('subtypes', [])):
            existing_sub = DocTypeSubtype.query.filter_by(
                category_id=cat.id, name=subtype['name']
            ).first()
            if existing_sub:
                continue

            st = DocTypeSubtype(
                category_id=cat.id,
                name=subtype['name'],
                prompt=subtype.get('guidance') or subtype.get('prompt'),
                sort_order=j,
            )
            db.session.add(st)
            sub_count += 1

    db.session.commit()
    print(f"  ✓ doc_type_categories: 导入 {cat_count} 个主类型")
    print(f"  ✓ doc_type_subtypes: 导入 {sub_count} 个子类型")


def seed_extraction_rules():
    """导入 extraction_rules.json → extraction_rules 表"""
    with open(EXTRACTION_RULES_JSON, encoding='utf-8') as f:
        data = json.load(f)

    count = 0
    for key, value in data.items():
        if key in ("$description", ):
            continue
        existing = ExtractionRule.query.filter_by(rule_key=key).first()
        if existing:
            continue
        rule = ExtractionRule(rule_key=key, rule_value=value, description=key)
        db.session.add(rule)
        count += 1

    db.session.commit()
    print(f"  ✓ extraction_rules: 导入 {count} 条规则")


def main():
    app = create_app()
    with app.app_context():
        # 建表
        db.create_all()
        print("✅ 数据库表已创建/更新")

        # 导入数据
        print("\n📦 开始导入配置数据...")
        seed_metadata_fields()
        seed_doc_types()
        seed_extraction_rules()
        print("\n✅ 全部配置数据导入完成")

        # 验证
        print(f"\n📊 验证统计:")
        print(f"   metadata_fields: {MetadataField.query.count()} 条")
        print(f"   doc_type_categories: {DocTypeCategory.query.count()} 条")
        print(f"   doc_type_subtypes: {DocTypeSubtype.query.count()} 条")
        print(f"   extraction_rules: {ExtractionRule.query.count()} 条")


if __name__ == '__main__':
    main()
