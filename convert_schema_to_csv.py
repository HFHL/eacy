import json
import csv
import traceback

with open('patient_ehr-V2.schema(1).json', 'r', encoding='utf-8') as f:
    schema = json.load(f)

categories = schema.get('properties', {})
total_cats = len(categories)
total_forms = 0
total_fields = 0

rows = []
header = [
    "父类", "所属表单", "字段名称", 
    "字段1_名称", "字段1_控件类型", "字段1_数据源", "字段1_数据类型", "字段1_必填",
    "字段2_名称", "字段2_控件类型", "字段2_数据源", "字段2_数据类型", "字段2_必填",
    "展示类型", "可重复", "单多选", "控件类型", "数据类型", 
    "字典", "预设值", "字段描述", "prompt提示词", "是否必填", 
    "是否隐藏", "是否计算字段", "是否搜索条件", "是否唯一", "是否支持查询"
]

def map_display(x_display, x_row_constraint):
    if x_display == 'table' and x_row_constraint == 'multi_row':
        return '表格'
    elif x_display == 'table' and x_row_constraint == 'single_row':
        return '分组'
    elif x_display == 'group':
        if x_row_constraint == 'multi_row': return '表格'
        return '分组'
    elif x_display == 'radio': return '单选'
    elif x_display == 'select': return '下拉单选'
    elif x_display == 'date': return '日期'
    return '文本'

for cat_name, cat_obj in categories.items():
    if not isinstance(cat_obj, dict) or 'properties' not in cat_obj:
        continue
    forms = cat_obj.get('properties', {})
    total_forms += len(forms)
    
    for form_name, form_obj in forms.items():
        if not isinstance(form_obj, dict) or 'properties' not in form_obj:
            continue
        
        def traverse_fields(node, prefix=''):
            global total_fields, rows
            if not isinstance(node, dict) or 'properties' not in node:
                return
            for field_name, field_obj in node['properties'].items():
                real_name = field_name
                
                has_props = 'properties' in field_obj
                is_array_of_objects = field_obj.get('type') == 'array' and 'items' in field_obj and 'properties' in field_obj['items']
                
                if has_props or is_array_of_objects:
                    total_fields += 1
                    child_props = field_obj.get('properties') or field_obj.get('items', {}).get('properties', {})
                    x_disp = field_obj.get('x-display', '')
                    x_row = field_obj.get('x-row-constraint', '')
                    
                    disp_str = map_display(x_disp, x_row)
                    if disp_str not in ['表格', '分组']:
                        disp_str = '分组'
                        
                    row = [""] * len(header)
                    row[0] = cat_name
                    row[1] = form_name
                    row[2] = real_name
                    row[13] = disp_str
                    row[14] = "是" if disp_str == '表格' else "否"
                    row[20] = field_obj.get('description', '')
                    
                    idx = 3
                    for child_name, child_obj in child_props.items():
                        total_fields += 1
                        if idx <= 8:
                            row[idx] = child_name
                            cdisp = child_obj.get('x-display', 'text')
                            row[idx+1] = map_display(cdisp, '')
                            row[idx+3] = "字符串"
                            row[idx+4] = "是" if child_name in (field_obj.get('required') or []) else "否"
                            idx += 5
                    rows.append(row)
                else:
                    total_fields += 1
                    row = [""] * len(header)
                    row[0] = cat_name
                    row[1] = form_name
                    row[2] = prefix + real_name
                    
                    x_disp = field_obj.get('x-display', 'text')
                    x_row = field_obj.get('x-row-constraint', '')
                    row[13] = map_display(x_disp, x_row)
                    row[20] = field_obj.get('description', '')
                    row[21] = field_obj.get('x-extraction-prompt', '')
                    row[22] = "是" if field_name in node.get('required', []) else "否"
                    rows.append(row)

        traverse_fields(form_obj)

print(f'Categories: {total_cats}')
print(f'Forms: {total_forms}')
print(f'Fields: {total_fields}')

with open('converted_schema.csv', 'w', encoding='utf-8', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(header)
    writer.writerows(rows)

print("Saved to converted_schema.csv")
