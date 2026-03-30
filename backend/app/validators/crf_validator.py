"""
CRF 表单抽取结果结构验证器

纯 Python 硬编码规则，基于 CRF Template Schema 校验 LLM 输出。
不依赖任何 LLM 调用，保证判定规则的确定性。
"""


def validate_form_output(form_schema: dict, form_output: dict) -> tuple:
    """
    校验单个表单的 LLM 输出是否符合 Schema 约束。

    Args:
        form_schema: CRF 模版中某个 form 的 schema 定义
                     e.g. {"name": "住院病案首页", "fields": [{...}, ...]}
        form_output: LLM 返回的该表单的提取结果 (dict)

    Returns:
        (is_valid: bool, errors: list[str])
    """
    if not isinstance(form_output, dict):
        return False, [f"输出必须是 JSON 对象(dict)，实际类型: {type(form_output).__name__}"]

    errors = []
    fields = form_schema.get("fields", [])
    field_map = {f["name"]: f for f in fields}
    valid_keys = set(field_map.keys())

    # ────────── 规则 1: 根键合法性 ──────────
    for key in form_output.keys():
        if key not in valid_keys:
            errors.append(
                f"非法根键 \"{key}\"：不在 Schema 定义的字段列表中。"
                f"合法字段: {list(valid_keys)}"
            )

    # ────────── 逐字段校验 ──────────
    for key, val in form_output.items():
        if key not in field_map:
            continue  # 已在规则 1 报错
        field_def = field_map[key]
        field_type = field_def.get("type", "string")
        display = field_def.get("x-display", "text")
        enum_values = field_def.get("enum")

        # 判断是否为表格/多行子表
        is_table = (
            field_type in ("array", "table", "multirow")
            or display in ("table", "multirow")
            or field_def.get("x-row-constraint") == "multi_row"
        )

        if is_table:
            _validate_table_field(key, val, field_def, errors)
        else:
            _validate_scalar_field(key, val, field_def, errors)

    return (len(errors) == 0, errors)


def _validate_scalar_field(key: str, val, field_def: dict, errors: list):
    """
    校验标量字段（text, number, radio, date, textarea, checkbox 单值等）。
    期望格式: {"value": ..., "source_blocks": ["B1", ...]}
    """
    # 允许跳过空值
    if val is None or val == "" or val == []:
        return

    # ────────── 规则 2: 标量字段必须包裹在 {value, source_blocks} 中 ──────────
    if not isinstance(val, dict):
        errors.append(
            f"字段 \"{key}\" 格式错误：标量字段必须为 "
            f"{{\"value\": ..., \"source_blocks\": [...]}}，"
            f"实际类型: {type(val).__name__}，值: {str(val)[:100]}"
        )
        return

    if "value" not in val:
        errors.append(
            f"字段 \"{key}\" 缺少 \"value\" 键。"
            f"标量字段必须为 {{\"value\": ..., \"source_blocks\": [...]}}。"
            f"实际 keys: {list(val.keys())}"
        )
        return

    # ────────── 规则 3: source_blocks 必须是字符串数组 ──────────
    sb = val.get("source_blocks")
    if sb is not None:
        if not isinstance(sb, list):
            errors.append(
                f"字段 \"{key}\" 的 source_blocks 类型错误："
                f"期望 list，实际 {type(sb).__name__}"
            )
        else:
            for i, item in enumerate(sb):
                if not isinstance(item, str):
                    errors.append(
                        f"字段 \"{key}\" 的 source_blocks[{i}] 类型错误："
                        f"期望 string (如 \"B1\")，实际 {type(item).__name__}: {str(item)[:80]}"
                    )

    # ────────── 规则 4: enum 值域检查 ──────────
    enum_values = field_def.get("enum")
    if enum_values and val.get("value"):
        actual_val = val["value"]
        display = field_def.get("x-display", "")

        if display in ("checkbox", "multiselect"):
            # 多选：value 应为数组
            if isinstance(actual_val, list):
                for v in actual_val:
                    if str(v) not in [str(e) for e in enum_values]:
                        errors.append(
                            f"字段 \"{key}\" 的值 \"{v}\" 不在允许的 enum 范围内。"
                            f"允许值: {enum_values}"
                        )
            else:
                errors.append(
                    f"字段 \"{key}\" 是多选类型，value 应为数组，"
                    f"实际类型: {type(actual_val).__name__}"
                )
        else:
            # 单选：value 应是 enum 值之一
            if str(actual_val) not in [str(e) for e in enum_values]:
                errors.append(
                    f"字段 \"{key}\" 的值 \"{actual_val}\" 不在允许的 enum 范围内。"
                    f"允许值: {enum_values}"
                )


def _validate_table_field(key: str, val, field_def: dict, errors: list):
    """
    校验表格/多行子表字段。
    期望格式: [ {"子字段1": {"value": ..., "source_blocks": [...]}, ...}, ...]
    """
    # 允许空数组（表示未提取到）
    if val is None or val == []:
        return

    # ────────── 规则 5: 表格类型必须为 Array ──────────
    if not isinstance(val, list):
        errors.append(
            f"字段 \"{key}\" 是表格/多行类型，必须返回数组(list)，"
            f"实际类型: {type(val).__name__}。"
            f"如无数据请返回空数组 []"
        )
        return

    # 获取子字段定义
    sub_fields = {}
    items = field_def.get("items", {})
    if isinstance(items, dict):
        for sf in items.get("fields", []):
            sub_fields[sf["name"]] = sf
        # 兼容 JSON Schema 风格的 properties
        for prop_name, prop_def in items.get("properties", {}).items():
            if prop_name not in sub_fields:
                sub_fields[prop_name] = prop_def

    for row_idx, row in enumerate(val):
        if not isinstance(row, dict):
            errors.append(
                f"字段 \"{key}\" 第 {row_idx + 1} 行必须是对象(dict)，"
                f"实际类型: {type(row).__name__}"
            )
            continue

        # ────────── 规则 6: 禁止全空占位行 ──────────
        all_empty = True
        for sub_key, sub_val in row.items():
            if sub_val is None or sub_val == "":
                continue
            if isinstance(sub_val, dict):
                inner = sub_val.get("value")
                if inner is not None and str(inner).strip() != "":
                    all_empty = False
                    break
            else:
                if str(sub_val).strip() != "":
                    all_empty = False
                    break

        if all_empty and len(row) > 0:
            errors.append(
                f"字段 \"{key}\" 第 {row_idx + 1} 行是全空占位结构，"
                f"应该移除该行或不返回。禁止 [{{\"a\": \"\", \"b\": \"\"}}] 形式"
            )
            continue

        # 校验每行内部的子字段格式
        for sub_key, sub_val in row.items():
            if sub_key in sub_fields:
                _validate_scalar_field(
                    f"{key}[{row_idx}].{sub_key}",
                    sub_val,
                    sub_fields[sub_key],
                    errors
                )
