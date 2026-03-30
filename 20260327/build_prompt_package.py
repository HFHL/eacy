from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict, List, Optional


CONFIG_DIR = Path(__file__).resolve().parent


def load_json(file_name: str) -> Dict[str, Any]:
    return json.loads((CONFIG_DIR / file_name).read_text(encoding="utf-8"))


def compact_field_definition(field: Dict[str, Any]) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "name": field["name"],
        "type": field["type"],
        "required": field["required"],
        "description": field["description"],
    }
    for key in ("enum", "format", "minimum", "maximum"):
        if key in field:
            result[key] = field[key]
    if "items" in field:
        result["items"] = compact_items_definition(field["items"])
    return result


def compact_items_definition(items: Dict[str, Any]) -> Dict[str, Any]:
    result: Dict[str, Any] = {"type": items["type"]}
    if "description" in items:
        result["description"] = items["description"]
    if "properties" in items:
        properties: Dict[str, Any] = {}
        for name, value in items["properties"].items():
            item_field: Dict[str, Any] = {"type": value["type"]}
            for key in ("description", "enum", "format", "minimum", "maximum"):
                if key in value:
                    item_field[key] = value[key]
            if "items" in value:
                item_field["items"] = compact_items_definition(value["items"])
            properties[name] = item_field
        result["properties"] = properties
    return result


def compact_document_types(document_types: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "classification_basis": document_types["classification_basis"],
        "doc_types": [
            {
                "name": item["name"],
                "description": item["description"],
                "default_subtype": item.get("default_subtype"),
                "subtypes": [
                    {
                        "name": subtype["name"],
                        "guidance": subtype["guidance"],
                    }
                    for subtype in item.get("subtypes", [])
                ],
            }
            for item in document_types["doc_types"]
        ],
    }


def build_system_prompt(
    extraction_rules: Dict[str, Any],
    output_format: Dict[str, Any],
) -> str:
    top_level_required = output_format["top_level_contract"]["required_keys"]
    minimum_audit_keys = output_format["audit_policy"]["minimum_item_keys"]
    recommended_audit_keys = output_format["audit_policy"]["recommended_item_keys"]

    sections: List[str] = [
        extraction_rules["system_role"],
        "",
        "你将收到一个结构化任务载荷，其中包含当前任务字段列表、可选的分类指导信息、输出结构模式以及待抽取文档内容。",
        "你必须严格遵守字段列表完成抽取，不得把示例字段、占位符字段或未定义字段写入结果。",
        "",
        "【核心原则】",
    ]

    sections.extend(
        f"{index}. {rule}"
        for index, rule in enumerate(extraction_rules["core_principles"], start=1)
    )

    sections.extend(["", "【禁止事项】"])
    sections.extend(
        f"{index}. {rule}"
        for index, rule in enumerate(extraction_rules["forbidden_actions"], start=1)
    )

    sections.extend(["", "【缺失值策略】"])
    sections.extend(
        f"{index}. {rule}"
        for index, rule in enumerate(
            extraction_rules["missing_value_policy"]["rules"], start=1
        )
    )

    sections.extend(["", "【证据与审计】"])
    sections.extend(
        f"{index}. {rule}"
        for index, rule in enumerate(extraction_rules["evidence_policy"]["rules"], start=1)
    )

    sections.extend(["", "【规范化规则】"])
    sections.extend(
        f"{index}. {rule}"
        for index, rule in enumerate(
            extraction_rules["normalization_policy"]["rules"], start=1
        )
    )

    sections.extend(["", "【医疗安全要求】"])
    sections.extend(
        f"{index}. {rule}"
        for index, rule in enumerate(
            extraction_rules["medical_safety_policy"]["rules"], start=1
        )
    )

    sections.extend(
        [
            "",
            "【输出契约】",
            f"1. 顶层必须只包含：{', '.join(top_level_required)}",
            "2. result 仅输出当前任务字段列表定义的字段与对应值。",
            "3. audit 默认使用 audit.fields 保存字段级审计项。",
            f"4. 每个 audit 项至少包含：{', '.join(minimum_audit_keys)}",
            f"5. 推荐额外输出：{', '.join(recommended_audit_keys)}",
            "6. 仅输出纯 JSON，不要输出 Markdown 代码块或解释文字。",
            "",
            "【关于示例】",
            "任务载荷中的输出示例仅用于说明结构模式，不代表固定业务字段集合；最终输出字段始终以当前任务传入的字段列表为准。",
        ]
    )

    return "\n".join(sections)


def build_user_payload(
    metadata_fields: Dict[str, Any],
    document_types: Dict[str, Any],
    output_format: Dict[str, Any],
    document_text: Optional[str],
    document_chunks: Optional[List[Dict[str, Any]]],
) -> Dict[str, Any]:
    fields = [compact_field_definition(field) for field in metadata_fields["fields"]]
    field_names = {field["name"] for field in metadata_fields["fields"]}

    payload: Dict[str, Any] = {
        "task": {
            "task_name": "medical_structured_extraction",
            "task_scope": "仅根据当前任务字段列表完成结构化抽取",
            "field_definitions": fields,
        },
        "output_format": {
            "top_level_contract": output_format["top_level_contract"],
            "result_policy": output_format["result_policy"],
            "audit_policy": output_format["audit_policy"],
            "canonical_example": output_format["canonical_example"],
            "pattern_examples": output_format["pattern_examples"],
        },
        "document_input": build_document_input(document_text, document_chunks),
    }

    if {"文档类型", "文档子类型"} & field_names:
        payload["classification_reference"] = compact_document_types(document_types)

    return payload


def build_document_input(
    document_text: Optional[str],
    document_chunks: Optional[List[Dict[str, Any]]],
) -> Dict[str, Any]:
    if document_chunks:
        return {
            "input_mode": "chunked",
            "chunks": document_chunks,
        }
    return {
        "input_mode": "plain_text",
        "text": document_text if document_text is not None else "<待注入文档文本>",
    }


def build_prompt_package(
    document_text: Optional[str] = None,
    document_chunks: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    metadata_fields = load_json("metadata_fields.json")
    document_types = load_json("document_types.json")
    extraction_rules = load_json("extraction_rules.json")
    output_format = load_json("output_format.json")

    system_prompt = build_system_prompt(extraction_rules, output_format)
    user_payload = build_user_payload(
        metadata_fields=metadata_fields,
        document_types=document_types,
        output_format=output_format,
        document_text=document_text,
        document_chunks=document_chunks,
    )
    user_content = json.dumps(user_payload, ensure_ascii=False, indent=2)

    return {
        "config_version": "20260327",
        "config_dir": str(CONFIG_DIR),
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ],
        "system_prompt": system_prompt,
        "user_payload": user_payload,
    }


def parse_chunks(chunks_file: Optional[str]) -> Optional[List[Dict[str, Any]]]:
    if not chunks_file:
        return None
    data = json.loads(Path(chunks_file).read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError("chunks_file 必须是 JSON 数组")
    return data


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--document-file", type=str, default=None)
    parser.add_argument("--chunks-file", type=str, default=None)
    parser.add_argument("--output", type=str, default=None)
    args = parser.parse_args()

    document_text = None
    if args.document_file:
        document_text = Path(args.document_file).read_text(encoding="utf-8")

    prompt_package = build_prompt_package(
        document_text=document_text,
        document_chunks=parse_chunks(args.chunks_file),
    )
    output_text = json.dumps(prompt_package, ensure_ascii=False, indent=2)

    if args.output:
        Path(args.output).write_text(output_text, encoding="utf-8")
    else:
        print(output_text)


if __name__ == "__main__":
    main()
