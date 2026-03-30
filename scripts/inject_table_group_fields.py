import subprocess, json, sys

result = subprocess.run(
    ['psql', 'postgresql://localhost:5432/eacy_db', '--no-align', '-t',
     '-c', "SELECT schema_json::text FROM crf_templates WHERE id = '1abec460-c166-4fae-84a5-172f7d2bb145'"],
    capture_output=True, text=True
)
if result.returncode != 0:
    sys.exit("DB read error: " + result.stderr)

schema = json.loads(result.stdout.strip())

# ── 要嵌入 table/group 字段的补丁 ──────────────────────────────────
# 每个 patch 指定：分类名、表单名、以及要追加的新 fields

# table 字段结构：{ uid, name, type="table", multiRow=True, prompt, children=[列字段] }
# group 字段结构：{ uid, name, type="group", repeatable=True, prompt, children=[子字段] }

PATCHES = {
    # ── 血常规：在末尾插入"完整血项明细"多行子表 ──────────────────────
    "血常规": [
        {
            "uid": "f_cbc_detail",
            "name": "血项明细",
            "type": "table",
            "multiRow": True,
            "description": "血常规各项检验结果明细，每行一个指标",
            "prompt": (
                "请以表格形式提取血常规报告中每一个检验项目，"
                "返回数组，每元素含：检验项目名称、结果值（纯数字）、"
                "单位（如 g/L / 10^9/L / %）、参考范围（原文）、"
                "是否异常（偏高/偏低/正常，依原文 ↑↓ 判断）。"
            ),
            "children": [
                {"uid": "f_cbc_d_name",  "name": "检验项目名称", "type": "text",   "description": "如白细胞、红细胞、血红蛋白等"},
                {"uid": "f_cbc_d_val",   "name": "结果值",       "type": "number", "description": "纯数字结果"},
                {"uid": "f_cbc_d_unit",  "name": "单位",         "type": "text",   "description": "如 g/L / 10^9/L / %"},
                {"uid": "f_cbc_d_ref",   "name": "参考范围",     "type": "text",   "description": "原文参考区间"},
                {"uid": "f_cbc_d_flag",  "name": "是否异常",     "type": "radio",
                 "enum": ["正常", "偏高", "偏低"],               "description": "↑偏高 / ↓偏低"},
            ]
        }
    ],

    # ── 生化指标：插入"生化明细"子表 ──────────────────────────────────
    "生化指标": [
        {
            "uid": "f_bio_detail",
            "name": "生化明细",
            "type": "table",
            "multiRow": True,
            "description": "生化检验各项结果明细，每行一个指标",
            "prompt": (
                "请以表格形式提取生化检验报告中每一个检验项目，"
                "返回数组，每元素含：检验项目名称、结果值（纯数字）、"
                "单位、参考范围（原文）、是否异常（偏高/偏低/正常）。"
            ),
            "children": [
                {"uid": "f_bio_d_name",  "name": "检验项目名称", "type": "text",   "description": "如钾、钠、肌酐、ALT等"},
                {"uid": "f_bio_d_val",   "name": "结果值",       "type": "number", "description": "纯数字结果"},
                {"uid": "f_bio_d_unit",  "name": "单位",         "type": "text",   "description": "如 mmol/L / U/L / g/L"},
                {"uid": "f_bio_d_ref",   "name": "参考范围",     "type": "text",   "description": "原文参考区间"},
                {"uid": "f_bio_d_flag",  "name": "是否异常",     "type": "radio",
                 "enum": ["正常", "偏高", "偏低"],               "description": "↑偏高 / ↓偏低"},
            ]
        }
    ],

    # ── 凝血指标：插入"凝血明细"子表 ──────────────────────────────────
    "凝血指标": [
        {
            "uid": "f_coag_detail",
            "name": "凝血明细",
            "type": "table",
            "multiRow": True,
            "description": "凝血各项检验结果明细，每行一个指标",
            "prompt": (
                "请以表格形式提取凝血功能报告中每一个检验项目，"
                "返回数组，每元素含：检验项目名称、结果值（纯数字）、"
                "单位、参考范围（原文）、是否异常（偏高/偏低/正常）。"
            ),
            "children": [
                {"uid": "f_coag_d_name",  "name": "检验项目名称", "type": "text",   "description": "如凝血酶原时间、D-二聚体等"},
                {"uid": "f_coag_d_val",   "name": "结果值",       "type": "number", "description": "纯数字结果"},
                {"uid": "f_coag_d_unit",  "name": "单位",         "type": "text",   "description": "如 s / mg/L / g/L"},
                {"uid": "f_coag_d_ref",   "name": "参考范围",     "type": "text",   "description": "原文参考区间"},
                {"uid": "f_coag_d_flag",  "name": "是否异常",     "type": "radio",
                 "enum": ["正常", "偏高", "偏低"],               "description": "↑偏高 / ↓偏低"},
            ]
        }
    ],

    # ── 放射诊断报告：插入"病灶列表" group(repeatable) ────────────────
    "放射诊断报告": [
        {
            "uid": "f_rad_lesions",
            "name": "病灶列表",
            "type": "group",
            "repeatable": True,
            "description": "影像报告中描述的每个病灶，每行一个病灶",
            "prompt": (
                "请逐一提取影像报告中所有描述的病灶，返回数组，"
                "每个病灶含：病灶部位（解剖部位原文）、病灶性质（密度/信号描述）、"
                "最大径_cm（数字如 2.2，无则留空）、次径_cm（如 1.7）、"
                "SUVmax（PET-CT专用，其余留空）、是否强化（是/否/未描述）、"
                "备注（边界/囊变/钙化等补充）。"
            ),
            "children": [
                {"uid": "f_rad_l_loc",   "name": "病灶部位",   "type": "text",   "description": "解剖部位原文"},
                {"uid": "f_rad_l_nat",   "name": "病灶性质",   "type": "text",   "description": "密度/信号/形态描述"},
                {"uid": "f_rad_l_max",   "name": "最大径(cm)", "type": "number", "description": "最大径，单位cm"},
                {"uid": "f_rad_l_min",   "name": "次径(cm)",   "type": "number", "description": "次径，单位cm"},
                {"uid": "f_rad_l_suv",   "name": "SUVmax",     "type": "number", "description": "PET-CT摄取值"},
                {"uid": "f_rad_l_enh",   "name": "是否强化",   "type": "radio",
                 "enum": ["是", "否", "未描述"],                "description": "增强扫描强化情况"},
                {"uid": "f_rad_l_note",  "name": "备注",       "type": "text",   "description": "囊变/钙化/边界等"},
            ]
        }
    ],

    # ── 彩色超声检查报告单：插入"超声病灶列表" group(repeatable) ──────
    "彩色超声检查报告单": [
        {
            "uid": "f_us_lesions",
            "name": "超声病灶列表",
            "type": "group",
            "repeatable": True,
            "description": "超声报告中描述的每个病灶，每行一个",
            "prompt": (
                "请逐一提取超声报告中所有描述的病灶，返回数组，"
                "每个病灶含：病灶部位（器官+位置原文）、回声性质（低/等/高/无回声）、"
                "最大径_cm、次径_cm、血流信号（丰富/少量/无/未描述）、备注。"
            ),
            "children": [
                {"uid": "f_us_l_loc",    "name": "病灶部位",       "type": "text",   "description": "器官+位置原文"},
                {"uid": "f_us_l_echo",   "name": "回声性质",       "type": "radio",
                 "enum": ["低回声", "等回声", "高回声", "无回声", "混合回声"],
                 "description": "超声回声特征"},
                {"uid": "f_us_l_max",    "name": "最大径(cm)",     "type": "number", "description": "最大径"},
                {"uid": "f_us_l_min",    "name": "次径(cm)",       "type": "number", "description": "次径"},
                {"uid": "f_us_l_flow",   "name": "血流信号",       "type": "radio",
                 "enum": ["丰富", "少量", "无", "未描述"],          "description": "彩色多普勒血流"},
                {"uid": "f_us_l_note",   "name": "备注",           "type": "text",   "description": "形态/边界/钙化等"},
            ]
        }
    ],

    # ── 出院记录：插入"出院带药" group(repeatable) ─────────────────────
    "出院记录": [
        {
            "uid": "f_dc_meds",
            "name": "出院带药",
            "type": "group",
            "repeatable": True,
            "description": "出院时带走的药品清单，每行一种药",
            "prompt": (
                "请提取出院小结中的所有出院带药，返回数组，"
                "每种药含：药品名称（原文）、单次剂量（如 1粒/250mg）、"
                "给药频次（如 每日2次/bid）、给药途径（口服/静脉/外用）、"
                "总天数（数字，如有）、备注（特殊说明）。"
            ),
            "children": [
                {"uid": "f_dc_m_name",  "name": "药品名称",   "type": "text",   "description": "通用名或商品名"},
                {"uid": "f_dc_m_dose",  "name": "单次剂量",   "type": "text",   "description": "如 1片 / 2粒"},
                {"uid": "f_dc_m_freq",  "name": "给药频次",   "type": "text",   "description": "如 每日2次 / bid"},
                {"uid": "f_dc_m_route", "name": "给药途径",   "type": "radio",
                 "enum": ["口服", "静脉", "外用", "皮下", "其他"],
                 "description": "用药途径"},
                {"uid": "f_dc_m_days",  "name": "总天数",     "type": "number", "description": "连续用药天数"},
                {"uid": "f_dc_m_note",  "name": "备注",       "type": "text",   "description": "特殊说明"},
            ]
        }
    ],

    # ── 手术记录：插入"手术诊断" group(repeatable) ─────────────────────
    "手术记录": [
        {
            "uid": "f_op_dx",
            "name": "手术诊断",
            "type": "group",
            "repeatable": True,
            "description": "手术相关诊断列表，每行一条",
            "prompt": (
                "请提取手术记录中所有诊断条目（术前诊断/术后诊断），"
                "返回数组，每条含：诊断类型（术前/术后）、序号、诊断名称（原文）。"
            ),
            "children": [
                {"uid": "f_op_dx_type",  "name": "诊断类型", "type": "radio",
                 "enum": ["术前诊断", "术后诊断"],             "description": "诊断类别"},
                {"uid": "f_op_dx_seq",   "name": "序号",     "type": "text",   "description": "如 1/2/3"},
                {"uid": "f_op_dx_name",  "name": "诊断名称", "type": "text",   "description": "诊断全文原文"},
            ]
        }
    ],

    # ── 医嘱：插入"医嘱明细" table(multiRow) ──────────────────────────
    "医嘱": [
        {
            "uid": "f_order_detail",
            "name": "医嘱明细",
            "type": "table",
            "multiRow": True,
            "description": "医嘱单各条目，每行一条医嘱",
            "prompt": (
                "请从医嘱单中提取所有医嘱条目，返回数组，"
                "每条含：医嘱类型（长期/临时/出院）、药品或处置名称（原文）、"
                "剂量/规格（如 0.5g / bid）、给药途径、开具时间（YYYY-MM-DD）、备注。"
            ),
            "children": [
                {"uid": "f_ord_d_type",  "name": "医嘱类型", "type": "radio",
                 "enum": ["长期医嘱", "临时医嘱", "出院医嘱"], "description": "医嘱分类"},
                {"uid": "f_ord_d_name",  "name": "药品/处置名称", "type": "text", "description": "药品名或操作名原文"},
                {"uid": "f_ord_d_dose",  "name": "剂量/规格",     "type": "text", "description": "如 0.5g bid，iv gtt"},
                {"uid": "f_ord_d_route", "name": "给药途径",      "type": "text", "description": "如 口服/静脉滴注"},
                {"uid": "f_ord_d_date",  "name": "开具时间",      "type": "date", "description": "YYYY-MM-DD"},
                {"uid": "f_ord_d_note",  "name": "备注",          "type": "text", "description": "特殊说明"},
            ]
        }
    ],
}

# ── 遍历所有分类下所有表单，应用补丁 ──────────────────────────────────

patched_forms = []
skipped_forms = []

for cat in schema.get("categories", []):
    cat_name = cat.get("name", "")
    for form in cat.get("forms", []):
        form_name = form.get("name", "")
        if form_name in PATCHES:
            existing_uids = {f.get("uid") for f in form.get("fields", [])}
            added = []
            for new_field in PATCHES[form_name]:
                if new_field["uid"] not in existing_uids:
                    form["fields"].append(new_field)
                    added.append(new_field["name"])
                else:
                    skipped_forms.append(f"{form_name}.{new_field['name']} (already exists)")
            if added:
                patched_forms.append(f"[{cat_name}] {form_name}: +{added}")

print("PATCHED:")
for p in patched_forms: print(" ", p)
if skipped_forms:
    print("SKIPPED:")
    for s in skipped_forms: print(" ", s)

# ── 写回数据库 ──────────────────────────────────────────────────────
new_json = json.dumps(schema, ensure_ascii=False)
sql = ("UPDATE crf_templates SET schema_json = $j$"
       + new_json
       + "$j$, updated_at = NOW() WHERE id = '1abec460-c166-4fae-84a5-172f7d2bb145';")
update = subprocess.run(
    ["psql", "postgresql://localhost:5432/eacy_db", "--no-align", "-t", "-c", sql],
    capture_output=True, text=True
)
print("\nUPDATE:", update.stdout.strip() or "(no output)")
if update.stderr:
    print("STDERR:", update.stderr[:500])

# ── 验证：回读 table/group 类型字段 ──────────────────────────────────
verify = subprocess.run(
    ["psql", "postgresql://localhost:5432/eacy_db", "--no-align", "-t",
     "-c", """
SELECT f->>'name' AS form_name, field->>'name' AS field_name, field->>'type' AS field_type
FROM crf_templates t,
     jsonb_array_elements(schema_json->'categories') AS cat,
     jsonb_array_elements(cat->'forms') AS f,
     jsonb_array_elements(f->'fields') AS field
WHERE t.id = '1abec460-c166-4fae-84a5-172f7d2bb145'
  AND field->>'type' IN ('table', 'group')
ORDER BY 1, 2;
"""],
    capture_output=True, text=True
)
print("\n── table/group 字段验证 ──")
print(verify.stdout if verify.stdout.strip() else "(none found)")
