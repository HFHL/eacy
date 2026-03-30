import subprocess, json, sys

result = subprocess.run(
    ['psql', 'postgresql://localhost:5432/eacy_db', '--no-align', '-t',
     '-c', "SELECT schema_json::text FROM crf_templates WHERE id = '1abec460-c166-4fae-84a5-172f7d2bb145'"],
    capture_output=True, text=True
)
if result.returncode != 0:
    sys.exit("DB read error: " + result.stderr)
schema = json.loads(result.stdout.strip())

# ─────────────────────────────────────────────────────────────────────
# 每个 patch 值是一个列表，里面是要追加到该表单 fields[] 末尾的新字段
# type="table" → 静态表头, multiRow=True → 多行输入
# type="group" → 可重复分组 (repeatable)
# ─────────────────────────────────────────────────────────────────────
PATCHES = {

    # ── 住院病案首页 ──────────────────────────────────────────────────
    "住院病案首页": [
        {
            "uid": "f_adm_dx_list",
            "name": "入院/出院诊断清单",
            "type": "group",
            "repeatable": True,
            "description": "病案首页中的全部诊断条目（主诊断+其他诊断），每行一条",
            "prompt": "请从住院病案首页中提取全部诊断录入信息，返回数组，每条含：诊断类型（主诊断/其他诊断/入院诊断/出院诊断）、序号（1/2/3…）、诊断名称（原文）、ICD编码（如有）、入院病情（临危/危/重/一般，如有）。",
            "children": [
                {"uid": "f_adm_dx_type",  "name": "诊断类型",   "type": "radio",
                 "enum": ["主诊断", "其他诊断", "入院诊断", "出院诊断"], "description": "诊断类别"},
                {"uid": "f_adm_dx_seq",   "name": "序号",       "type": "text",   "description": "如 1/2/3"},
                {"uid": "f_adm_dx_name",  "name": "诊断名称",   "type": "text",   "description": "诊断全文"},
                {"uid": "f_adm_dx_icd",   "name": "ICD编码",    "type": "text",   "description": "ICD-10编码"},
                {"uid": "f_adm_dx_cond",  "name": "入院病情",   "type": "radio",
                 "enum": ["临危", "危", "重", "一般", "未记录"], "description": "入院时病情级别"},
            ]
        },
        {
            "uid": "f_adm_op_list",
            "name": "手术操作清单",
            "type": "group",
            "repeatable": True,
            "description": "病案首页中记录的全部手术/操作，每行一条",
            "prompt": "请从住院病案首页中提取全部手术/操作记录，返回数组，每条含：序号、手术/操作名称（原文）、手术/操作编码（ICD-9-CM，如有）、手术日期（YYYY-MM-DD）、主刀医生、麻醉方式（全麻/局麻/硬膜外等）。",
            "children": [
                {"uid": "f_adm_op_seq",      "name": "序号",          "type": "text",  "description": "如 1/2/3"},
                {"uid": "f_adm_op_name",     "name": "手术/操作名称", "type": "text",  "description": "原文名称"},
                {"uid": "f_adm_op_code",     "name": "操作编码",      "type": "text",  "description": "ICD-9-CM编码"},
                {"uid": "f_adm_op_date",     "name": "手术日期",      "type": "date",  "description": "YYYY-MM-DD"},
                {"uid": "f_adm_op_surgeon",  "name": "主刀医生",      "type": "text",  "description": "医生姓名"},
                {"uid": "f_adm_op_anesthesia","name": "麻醉方式",     "type": "radio",
                 "enum": ["全麻", "局麻", "硬膜外麻醉", "腰麻", "静脉麻醉", "其他"], "description": "麻醉类型"},
            ]
        },
        {
            "uid": "f_adm_fee_detail",
            "name": "住院费用明细",
            "type": "table",
            "multiRow": True,
            "description": "住院期间各类费用汇总，每行一类",
            "prompt": "请从病案首页费用信息中提取各费用项目，返回数组，每行含：费用类别（如西药费/手术费/检查费等）、金额（元，数字）。",
            "children": [
                {"uid": "f_adm_fee_cat",    "name": "费用类别", "type": "text",   "description": "如西药费/手术费/床位费"},
                {"uid": "f_adm_fee_amount", "name": "金额(元)", "type": "number", "description": "费用金额，单位元"},
            ]
        },
    ],

    # ── 入院记录 ──────────────────────────────────────────────────────
    "入院记录": [
        {
            "uid": "f_adm_pmhx",
            "name": "既往病史",
            "type": "group",
            "repeatable": True,
            "description": "既往患有的疾病列表，每行一种",
            "prompt": "请从入院记录的既往史部分提取所有既往疾病，返回数组，每条含：疾病名称（原文）、患病时间（如描述）、治疗情况（手术/药物/未治疗等，如有）。",
            "children": [
                {"uid": "f_pmhx_name",    "name": "疾病名称",   "type": "text",   "description": "既往疾病原文名称"},
                {"uid": "f_pmhx_time",    "name": "患病时间",   "type": "text",   "description": "如3年前或2019年"},
                {"uid": "f_pmhx_treat",   "name": "治疗情况",   "type": "text",   "description": "手术/药物/未治疗等"},
            ]
        },
        {
            "uid": "f_adm_allergy",
            "name": "过敏史",
            "type": "group",
            "repeatable": True,
            "description": "药物/食物过敏记录，每行一种过敏原",
            "prompt": "请从入院记录的过敏史部分提取所有过敏信息，返回数组，每条含：过敏原名称（药品/食物原文）、过敏反应描述（如皮疹/休克等）、严重程度（轻/中/重，如有记录）。",
            "children": [
                {"uid": "f_allergy_name",    "name": "过敏原",     "type": "text",   "description": "药品或食物名称"},
                {"uid": "f_allergy_react",   "name": "过敏反应",   "type": "text",   "description": "临床表现原文"},
                {"uid": "f_allergy_severity","name": "严重程度",   "type": "radio",
                 "enum": ["轻度", "中度", "重度", "未记录"],        "description": "过敏严重程度"},
            ]
        },
        {
            "uid": "f_adm_meds_before",
            "name": "入院前用药",
            "type": "table",
            "multiRow": True,
            "description": "入院前正在服用的药物，每行一种",
            "prompt": "请从入院记录中提取患者入院前正在服用的全部药物，返回数组，每条含：药品名称（原文）、剂量/规格、给药频次（如每日一次）、用药用途（如降压/止痛等）。",
            "children": [
                {"uid": "f_premeds_name",   "name": "药品名称", "type": "text",   "description": "通用名或商品名"},
                {"uid": "f_premeds_dose",   "name": "剂量/规格","type": "text",   "description": "如 5mg / 0.5g"},
                {"uid": "f_premeds_freq",   "name": "给药频次", "type": "text",   "description": "如 每日一次"},
                {"uid": "f_premeds_use",    "name": "用药用途", "type": "text",   "description": "如降压/止痛"},
            ]
        },
    ],

    # ── 感染指标 ──────────────────────────────────────────────────────
    "感染指标": [
        {
            "uid": "f_inf_detail",
            "name": "感染指标明细",
            "type": "table",
            "multiRow": True,
            "description": "感染相关检验各项结果，每行一个指标",
            "prompt": "请以表格形式提取感染指标报告中每一个检验项目，返回数组，每元素含：检验项目名称、结果值（纯数字）、单位、参考范围（原文）、是否异常（偏高/偏低/正常）。",
            "children": [
                {"uid": "f_inf_d_name",  "name": "检验项目名称", "type": "text",   "description": "如降钙素原/白介素-6等"},
                {"uid": "f_inf_d_val",   "name": "结果值",       "type": "number", "description": "纯数字结果"},
                {"uid": "f_inf_d_unit",  "name": "单位",         "type": "text",   "description": "如 ng/mL / pg/mL"},
                {"uid": "f_inf_d_ref",   "name": "参考范围",     "type": "text",   "description": "原文参考区间"},
                {"uid": "f_inf_d_flag",  "name": "是否异常",     "type": "radio",
                 "enum": ["正常", "偏高", "偏低"],               "description": "↑偏高 / ↓偏低"},
            ]
        }
    ],

    # ── 心衰指标 ──────────────────────────────────────────────────────
    "心衰指标": [
        {
            "uid": "f_hf_detail",
            "name": "心衰指标明细",
            "type": "table",
            "multiRow": True,
            "description": "心衰相关检验各项结果，每行一个指标",
            "prompt": "请以表格形式提取心衰指标报告中每一个检验项目，返回数组，每元素含：检验项目名称、结果值（纯数字）、单位、参考范围（原文）、是否异常（偏高/偏低/正常）。",
            "children": [
                {"uid": "f_hf_d_name",  "name": "检验项目名称", "type": "text",   "description": "如B型钠尿肽等"},
                {"uid": "f_hf_d_val",   "name": "结果值",       "type": "number", "description": "纯数字结果"},
                {"uid": "f_hf_d_unit",  "name": "单位",         "type": "text",   "description": "如 pg/mL"},
                {"uid": "f_hf_d_ref",   "name": "参考范围",     "type": "text",   "description": "原文参考区间"},
                {"uid": "f_hf_d_flag",  "name": "是否异常",     "type": "radio",
                 "enum": ["正常", "偏高", "偏低"],               "description": "↑偏高 / ↓偏低"},
            ]
        }
    ],

    # ── 肿瘤标志物 ────────────────────────────────────────────────────
    "肿瘤标志物": [
        {
            "uid": "f_tumor_detail",
            "name": "肿瘤标志物明细",
            "type": "table",
            "multiRow": True,
            "description": "肿瘤标志物各检验项目结果，每行一个",
            "prompt": "请以表格形式提取肿瘤标志物报告中每一个检验项目，返回数组，每元素含：检验项目名称（如甲胎蛋白AFP/癌胚抗原CEA等）、结果值（纯数字）、单位（如ng/mL / U/mL）、参考范围（原文）、是否异常（偏高/偏低/正常）。",
            "children": [
                {"uid": "f_tmk_d_name",  "name": "检验项目名称", "type": "text",   "description": "如AFP/CEA/CA19-9等"},
                {"uid": "f_tmk_d_val",   "name": "结果值",       "type": "number", "description": "纯数字结果"},
                {"uid": "f_tmk_d_unit",  "name": "单位",         "type": "text",   "description": "如 ng/mL / U/mL"},
                {"uid": "f_tmk_d_ref",   "name": "参考范围",     "type": "text",   "description": "原文参考区间"},
                {"uid": "f_tmk_d_flag",  "name": "是否异常",     "type": "radio",
                 "enum": ["正常", "偏高", "偏低"],               "description": "↑偏高 / ↓偏低"},
            ]
        }
    ],

    # ── 传染病检查 ────────────────────────────────────────────────────
    "传染病检查": [
        {
            "uid": "f_infec_detail",
            "name": "传染病项目明细",
            "type": "table",
            "multiRow": True,
            "description": "传染病各检验项目结果，每行一项",
            "prompt": "请以表格形式提取传染病检查报告中每一个检验项目，返回数组，每元素含：检验项目名称（如乙肝表面抗原HBsAg/丙肝抗体等）、检测结果（阳性/阴性/弱阳性）、定量值（如有，纯数字）、单位（如有）、参考范围（原文）。",
            "children": [
                {"uid": "f_infd_name",   "name": "检验项目名称", "type": "text",   "description": "如HBsAg/抗HCV等"},
                {"uid": "f_infd_result", "name": "定性结果",     "type": "radio",
                 "enum": ["阴性", "阳性", "弱阳性", "疑似"],     "description": "阳/阴/弱阳"},
                {"uid": "f_infd_quant",  "name": "定量值",       "type": "number", "description": "定量检测数值（如有）"},
                {"uid": "f_infd_unit",   "name": "单位",         "type": "text",   "description": "定量结果单位"},
                {"uid": "f_infd_ref",    "name": "参考范围",     "type": "text",   "description": "原文参考区间"},
            ]
        }
    ],

    # ── 微生物检查 ────────────────────────────────────────────────────
    "微生物检查": [
        {
            "uid": "f_micro_detail",
            "name": "微生物培养明细",
            "type": "group",
            "repeatable": True,
            "description": "微生物检查各次培养/药敏结果，每行一条",
            "prompt": "请提取微生物检查报告中的培养结果及药敏信息，返回数组，每条含：标本类型（血液/痰液/引流液等）、检查类型（细菌培养/真菌培养等）、培养结果（阴性/检出菌名）、药敏结果（敏感/耐药，列出主要抗生素）。",
            "children": [
                {"uid": "f_mic_sample",  "name": "标本类型",   "type": "text",   "description": "如血液/痰液/引流液等"},
                {"uid": "f_mic_type",    "name": "检查类型",   "type": "radio",
                 "enum": ["细菌培养", "真菌培养", "结核培养", "药敏试验", "其他"],
                 "description": "微生物检查类别"},
                {"uid": "f_mic_result",  "name": "培养结果",   "type": "text",   "description": "阴性或检出菌种名"},
                {"uid": "f_mic_sens",    "name": "药敏（敏感）","type": "text",  "description": "敏感抗生素列表"},
                {"uid": "f_mic_resist",  "name": "药敏（耐药）","type": "text",  "description": "耐药抗生素列表"},
            ]
        }
    ],

    # ── 病理诊断报告 ──────────────────────────────────────────────────
    "病理诊断报告": [
        {
            "uid": "f_path_specimen",
            "name": "送检标本明细",
            "type": "group",
            "repeatable": True,
            "description": "病理报告中各送检标本及对应诊断，每行一个标本",
            "prompt": "请提取病理报告中所有送检标本的信息，返回数组，每条含：标本编号/部位（原文）、标本类型（切除/活检/穿刺等）、送检质量（满意/不满意）、病理诊断结论（原文）、免疫组化关键指标（如有，列出阳性/阴性项目）。",
            "children": [
                {"uid": "f_path_sp_loc",  "name": "标本部位",     "type": "text",  "description": "送检标本来源部位"},
                {"uid": "f_path_sp_type", "name": "标本类型",     "type": "radio",
                 "enum": ["手术切除", "活检", "穿刺", "细胞学", "其他"],
                 "description": "取材方式"},
                {"uid": "f_path_sp_diag", "name": "病理诊断",     "type": "text",  "description": "诊断结论原文"},
                {"uid": "f_path_sp_ihc",  "name": "免疫组化",     "type": "text",  "description": "关键免疫组化结果原文"},
            ]
        }
    ],

    # ── 麻醉记录单 ────────────────────────────────────────────────────
    "麻醉记录单": [
        {
            "uid": "f_anes_drugs",
            "name": "麻醉用药明细",
            "type": "table",
            "multiRow": True,
            "description": "麻醉过程中使用的全部药物，每行一种",
            "prompt": "请从麻醉记录单中提取全部麻醉用药，返回数组，每条含：药品名称（原文）、给药剂量（含单位，如100mg / 2μg/kg）、给药时间（HH:MM，如有）、给药途径（静脉/吸入/肌注等）。",
            "children": [
                {"uid": "f_anes_d_name",  "name": "药品名称", "type": "text",   "description": "麻醉药物名称"},
                {"uid": "f_anes_d_dose",  "name": "给药剂量", "type": "text",   "description": "含单位的剂量"},
                {"uid": "f_anes_d_time",  "name": "给药时间", "type": "text",   "description": "HH:MM格式"},
                {"uid": "f_anes_d_route", "name": "给药途径", "type": "radio",
                 "enum": ["静脉", "吸入", "肌注", "硬膜外", "蛛网膜下腔", "其他"],
                 "description": "给药途径"},
            ]
        },
        {
            "uid": "f_anes_monitor",
            "name": "术中监测记录",
            "type": "table",
            "multiRow": True,
            "description": "手术中定时记录的生命体征，每行一个时间点",
            "prompt": "请从麻醉记录单中提取术中各时间点的生命体征监测数据，返回数组，每条含：记录时间（HH:MM）、血压收缩压（mmHg）、血压舒张压（mmHg）、心率（次/分）、血氧饱和度SpO2（%）、呼吸频率（次/分，如有）。",
            "children": [
                {"uid": "f_mon_time",   "name": "记录时间",       "type": "text",   "description": "HH:MM"},
                {"uid": "f_mon_sbp",    "name": "收缩压(mmHg)",   "type": "number", "description": "收缩压"},
                {"uid": "f_mon_dbp",    "name": "舒张压(mmHg)",   "type": "number", "description": "舒张压"},
                {"uid": "f_mon_hr",     "name": "心率(次/分)",    "type": "number", "description": "心率"},
                {"uid": "f_mon_spo2",   "name": "SpO2(%)",        "type": "number", "description": "血氧饱和度"},
                {"uid": "f_mon_rr",     "name": "呼吸频率(次/分)","type": "number", "description": "呼吸频率"},
            ]
        },
    ],

    # ── 护理记录单 ────────────────────────────────────────────────────
    "护理记录单": [
        {
            "uid": "f_nurse_records",
            "name": "护理记录明细",
            "type": "table",
            "multiRow": True,
            "description": "护理记录单各时间点观察记录，每行一个时间点",
            "prompt": "请从护理记录单中提取各班次/时间点的观察记录，返回数组，每条含：记录时间（YYYY-MM-DD HH:MM）、体温(℃)、血压（如135/85）、脉搏（次/分）、观察要点（症状/体征描述原文）、处置情况（护理操作原文）。",
            "children": [
                {"uid": "f_nur_time",  "name": "记录时间",   "type": "text",   "description": "YYYY-MM-DD HH:MM"},
                {"uid": "f_nur_temp",  "name": "体温(℃)",   "type": "number", "description": "体温"},
                {"uid": "f_nur_bp",    "name": "血压",       "type": "text",   "description": "如 135/85 mmHg"},
                {"uid": "f_nur_pulse", "name": "脉搏(次/分)","type": "number", "description": "脉搏"},
                {"uid": "f_nur_obs",   "name": "观察要点",   "type": "text",   "description": "症状/体征描述"},
                {"uid": "f_nur_act",   "name": "处置情况",   "type": "text",   "description": "护理操作"},
            ]
        }
    ],

    # ── 手术记录（补充手术步骤）──────────────────────────────────────
    "手术记录": [
        {
            "uid": "f_op_steps",
            "name": "手术步骤",
            "type": "group",
            "repeatable": True,
            "description": "手术记录中描述的关键步骤，每行一步",
            "prompt": "请从手术记录中提取关键手术步骤，返回数组，每条含：步骤序号（1/2/3…）、步骤描述（原文，简洁摘要）、关键发现（如探查所见、切除范围等原文）。",
            "children": [
                {"uid": "f_op_st_seq",   "name": "步骤序号", "type": "text",  "description": "如 1/2/3"},
                {"uid": "f_op_st_desc",  "name": "步骤描述", "type": "text",  "description": "手术操作描述原文"},
                {"uid": "f_op_st_find",  "name": "关键发现", "type": "text",  "description": "探查所见/切除范围"},
            ]
        }
    ],
}

# ── 执行补丁 ──────────────────────────────────────────────────────────
patched = []
skipped = []

for cat in schema.get("categories", []):
    for form in cat.get("forms", []):
        fname = form.get("name", "")
        if fname not in PATCHES:
            continue
        existing_uids = {f.get("uid") for f in form.get("fields", [])}
        for nf in PATCHES[fname]:
            if nf["uid"] in existing_uids:
                skipped.append(f"{fname}.{nf['name']}")
                continue
            form["fields"].append(nf)
            n_cols = len(nf.get("children", []))
            patched.append(f"[{nf['type']}] {fname} > {nf['name']}  ({n_cols} cols)")

print("PATCHED:")
for p in patched: print(" ", p)
if skipped:
    print("SKIPPED (already exist):")
    for s in skipped: print(" ", s)

# ── 写回 DB ──────────────────────────────────────────────────────────
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

# ── 验证：所有 table/group 类型字段 ─────────────────────────────────
verify = subprocess.run(
    ["psql", "postgresql://localhost:5432/eacy_db", "--no-align", "-t", "-c", """
SELECT f->>'name' AS form, field->>'name' AS field, field->>'type' AS ftype,
       jsonb_array_length(field->'children') AS num_cols
FROM crf_templates t,
     jsonb_array_elements(schema_json->'categories') AS cat,
     jsonb_array_elements(cat->'forms') AS f,
     jsonb_array_elements(f->'fields') AS field
WHERE t.id = '1abec460-c166-4fae-84a5-172f7d2bb145'
  AND field->>'type' IN ('table', 'group')
ORDER BY 1, 2;
"""], capture_output=True, text=True
)
print("\n── 所有 table/group 字段（含列数）──")
print(verify.stdout if verify.stdout.strip() else "(none found)")
