import subprocess, json, sys

result = subprocess.run(
    ['psql', 'postgresql://localhost:5432/eacy_db', '--no-align', '-t',
     '-c', "SELECT schema_json::text FROM crf_templates WHERE id = '1abec460-c166-4fae-84a5-172f7d2bb145'"],
    capture_output=True, text=True
)
if result.returncode != 0:
    sys.exit("DB read error: " + result.stderr)

schema = json.loads(result.stdout.strip())

p_lab = (
    "请从以下医疗文档中提取所有检验单的每一个检验项目，返回一个 JSON 数组，"
    "每个元素代表一行检验结果，包含：报告日期（YYYY-MM-DD）、"
    "检验项目名称（原文）、检验结果（数值不含单位）、单位、"
    "参考范围（原文）、是否异常（偏高/偏低/正常，依据原文箭头符号判断）、"
    "样本编号（如有）。只提取检验值可读的项目，忽略无数据行。"
)

p_img = (
    "请从影像诊断报告（CT、MRI、PET-CT、超声等）中提取所有病灶信息，"
    "返回 JSON 数组，每条病灶一行，字段：报告日期（YYYY-MM-DD）、"
    "检查类型（CT/MRI/PET-CT/超声/放射）、病灶部位（解剖部位原文）、"
    "病灶性质（密度/信号描述原文）、最大径_cm（数值）、次径_cm（数值）、"
    "SUVmax（PET-CT专用，其余留空）、是否强化（是/否/未描述）、"
    "备注（边界/囊变/钙化等）。按报告顺序排列，无明确病灶则返回空数组。"
)

p_dx = (
    "请从病历文档中提取所有诊断条目（入院诊断、出院诊断、病理诊断等），"
    "返回 JSON 数组，每条诊断一行，字段：诊断类型（入院诊断/出院诊断/"
    "病理诊断/手术诊断）、序号（原文编号）、诊断名称（完整诊断原文）、"
    "ICD编码（如有）、诊断日期（YYYY-MM-DD，如有）。"
    "入院诊断与出院诊断分别独立列出，勿合并。"
)

p_med = (
    "请从出院记录/出院小结中提取所有出院带药信息，返回 JSON 数组，"
    "每种药品一行，字段：药品名称（通用名或商品名原文）、规格（原文）、"
    "单次剂量（原文）、给药频次（原文）、给药途径（口服/静脉/外用/皮下/其他）、"
    "总天数（数字，如有）、备注（特殊说明）。"
    "若未找到出院带药信息则返回空数组。"
)

NEW_FORMS = [
    {
        "id": "form_lab_detail",
        "name": "检验项目明细",
        "row_type": "multi_row",
        "anchor_fields": ["检验项目名称", "报告日期"],
        "conflict_strategy": "append",
        "prompt": p_lab,
        "fields": [
            {"uid": "f_lab_date",     "name": "报告日期",     "type": "date",   "description": "检验报告出具日期"},
            {"uid": "f_lab_name",     "name": "检验项目名称", "type": "text",   "description": "检验项目原文名称"},
            {"uid": "f_lab_value",    "name": "检验结果",     "type": "text",   "description": "检测数值（不含单位）"},
            {"uid": "f_lab_unit",     "name": "单位",         "type": "text",   "description": "结果单位"},
            {"uid": "f_lab_ref",      "name": "参考范围",     "type": "text",   "description": "参考区间原文"},
            {"uid": "f_lab_flag",     "name": "是否异常",     "type": "radio",  "enum": ["正常", "偏高", "偏低"], "description": "偏高/偏低/正常"},
            {"uid": "f_lab_sampleno", "name": "样本编号",     "type": "text",   "description": "送检样本编号"},
        ]
    },
    {
        "id": "form_imaging_lesion",
        "name": "影像病灶列表",
        "row_type": "multi_row",
        "anchor_fields": ["病灶部位", "报告日期"],
        "conflict_strategy": "append",
        "prompt": p_img,
        "fields": [
            {"uid": "f_img_date",     "name": "报告日期",   "type": "date",   "description": "影像报告日期"},
            {"uid": "f_img_type",     "name": "检查类型",   "type": "text",   "description": "CT/MRI/PET-CT/超声等"},
            {"uid": "f_img_location", "name": "病灶部位",   "type": "text",   "description": "解剖部位原文"},
            {"uid": "f_img_nature",   "name": "病灶性质",   "type": "text",   "description": "密度/信号描述"},
            {"uid": "f_img_max_cm",   "name": "最大径(cm)", "type": "number", "description": "病灶最大径，单位cm"},
            {"uid": "f_img_min_cm",   "name": "次径(cm)",   "type": "number", "description": "次径，单位cm"},
            {"uid": "f_img_suvmax",   "name": "SUVmax",     "type": "number", "description": "PET-CT标准摄取值"},
            {"uid": "f_img_enhance",  "name": "是否强化",   "type": "radio",  "enum": ["是", "否", "未描述"], "description": "增强扫描强化情况"},
            {"uid": "f_img_note",     "name": "备注",       "type": "text",   "description": "囊变/钙化/边界等补充"},
        ]
    },
    {
        "id": "form_diagnosis_list",
        "name": "诊断列表",
        "row_type": "multi_row",
        "anchor_fields": ["诊断类型", "诊断名称"],
        "conflict_strategy": "append",
        "prompt": p_dx,
        "fields": [
            {"uid": "f_dx_type", "name": "诊断类型", "type": "radio", "enum": ["入院诊断", "出院诊断", "病理诊断", "手术诊断"], "description": "诊断类别"},
            {"uid": "f_dx_seq",  "name": "序号",     "type": "text",   "description": "诊断序号（1/2/3）"},
            {"uid": "f_dx_name", "name": "诊断名称", "type": "text",   "description": "诊断全文"},
            {"uid": "f_dx_icd",  "name": "ICD编码",  "type": "text",   "description": "ICD-10/11编码（如有）"},
            {"uid": "f_dx_date", "name": "诊断日期", "type": "date",   "description": "诊断确立时间"},
        ]
    },
    {
        "id": "form_discharge_meds",
        "name": "出院带药清单",
        "row_type": "multi_row",
        "anchor_fields": ["药品名称"],
        "conflict_strategy": "append",
        "prompt": p_med,
        "fields": [
            {"uid": "f_med_name",  "name": "药品名称", "type": "text",   "description": "通用名或商品名"},
            {"uid": "f_med_spec",  "name": "规格",     "type": "text",   "description": "如 0.5g / 250mg"},
            {"uid": "f_med_dose",  "name": "单次剂量", "type": "text",   "description": "如 1片 / 2粒"},
            {"uid": "f_med_freq",  "name": "给药频次", "type": "text",   "description": "如 每日2次 / bid"},
            {"uid": "f_med_route", "name": "给药途径", "type": "radio",  "enum": ["口服", "静脉", "外用", "皮下", "其他"], "description": "用药途径"},
            {"uid": "f_med_days",  "name": "总天数",   "type": "number", "description": "连续用药天数"},
            {"uid": "f_med_note",  "name": "备注",     "type": "text",   "description": "特殊说明"},
        ]
    },
]

target_category_map = {
    "form_lab_detail":      "检验检查",
    "form_imaging_lesion":  "检验检查",
    "form_diagnosis_list":  "诊疗记录",
    "form_discharge_meds":  "出院情况",
}

def get_or_create_category(categories, name):
    for cat in categories:
        if cat["name"] == name:
            return cat
    new_cat = {"name": name, "forms": []}
    categories.append(new_cat)
    return new_cat

categories = schema.get("categories", [])
existing_ids = set()
for cat in categories:
    for form in cat.get("forms", []):
        existing_ids.add(form["id"])

for nf in NEW_FORMS:
    if nf["id"] in existing_ids:
        print("SKIP:", nf["name"])
        continue
    cat_name = target_category_map[nf["id"]]
    cat = get_or_create_category(categories, cat_name)
    cat["forms"].append(nf)
    print("ADDED [multi_row]", cat_name, ">", nf["name"], "(", len(nf["fields"]), "fields )")

schema["categories"] = categories
new_json = json.dumps(schema, ensure_ascii=False)

sql = ("UPDATE crf_templates SET schema_json = $j$"
       + new_json
       + "$j$, updated_at = NOW() WHERE id = '1abec460-c166-4fae-84a5-172f7d2bb145';")
update = subprocess.run(
    ["psql", "postgresql://localhost:5432/eacy_db", "--no-align", "-t", "-c", sql],
    capture_output=True, text=True
)
print("UPDATE:", update.stdout.strip() or "(no output)")
if update.stderr:
    print("STDERR:", update.stderr[:400])

verify = subprocess.run(
    ["psql", "postgresql://localhost:5432/eacy_db", "--no-align", "-t",
     "-c", "SELECT cat->>'name', f->>'name', f->>'row_type' FROM crf_templates t, jsonb_array_elements(schema_json->'categories') AS cat, jsonb_array_elements(cat->'forms') AS f WHERE t.id = '1abec460-c166-4fae-84a5-172f7d2bb145' ORDER BY 1, 2;"],
    capture_output=True, text=True
)
print("\n── 验证回读 ──")
print(verify.stdout)
