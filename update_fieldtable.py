import re

with open('frontend/src/pages/ProjectPatientDetail.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

# We will replace the FieldTable component. 
# It starts at: const FieldTable = ({ schema, crfData
# It ends right before: /* ─── Right Panel: Trace Provenance ────────── */

start_marker = "const FieldTable = ({ schema,"
end_marker = "/* ─── Right Panel: Trace Provenance ────────── */"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print("Could not find markers")
    exit(1)

new_fieldtable = """const FieldTable = ({ schema, crfData, selectedFormName, activeField, setActiveField, loading, documents, onSaveForm }) => {
  const [editingData, setEditingData] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);

  React.useEffect(() => {
    setEditingData(JSON.parse(JSON.stringify(crfData?.[selectedFormName] || {})));
    setIsDirty(false);
  }, [selectedFormName, crfData]);

  const updateCellValue = (fieldName, rowIndex, colName, newVal) => {
    setEditingData(prev => {
      const nd = { ...prev };
      let fieldVal = nd[fieldName];
      
      if (rowIndex === undefined) {
         if (fieldVal && typeof fieldVal === 'object' && 'value' in fieldVal) {
             nd[fieldName] = { ...fieldVal, value: newVal };
         } else {
             nd[fieldName] = newVal;
         }
      } else {
         let arr = fieldVal && typeof fieldVal === 'object' && 'value' in fieldVal ? fieldVal.value : fieldVal;
         if (!Array.isArray(arr)) arr = [];
         arr = [...arr];
         
         if (!arr[rowIndex]) arr[rowIndex] = {};
         else arr[rowIndex] = { ...arr[rowIndex] };
         
         let cell = arr[rowIndex][colName];
         if (cell && typeof cell === 'object' && 'value' in cell) {
             arr[rowIndex][colName] = { ...cell, value: newVal };
         } else {
             arr[rowIndex][colName] = newVal;
         }
         
         if (fieldVal && typeof fieldVal === 'object' && 'value' in fieldVal) {
             nd[fieldName] = { ...fieldVal, value: arr };
         } else {
             nd[fieldName] = arr;
         }
      }
      return nd;
    });
    setIsDirty(true);
  };

  if (!selectedFormName) return <Empty description="请从左侧选择表单" style={{ marginTop: 80 }} />;
  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}><Spin /></div>;

  const categories = schema?.categories || [];
  let formSchema = null;
  for (const cat of categories) {
    for (const form of (cat.forms || [])) {
      if (form.name === selectedFormName) { formSchema = form; break; }
    }
    if (formSchema) break;
  }

  if (!formSchema) return <Empty description="选中的表单不存在" />;

  const formData = crfData?.[selectedFormName] || {};
  const fields = formSchema.fields || [];

  return (
    <div>
      <div style={{
        padding: '14px 20px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 10,
        background: C.highlight,
      }}>
        <FileTextOutlined style={{ color: C.primary, fontSize: 16 }} />
        <span style={{ fontWeight: 600, fontSize: 14, color: C.textPrimary }}>{selectedFormName}</span>
        <span style={{ color: C.textSecondary, fontSize: 12, marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span>
            {fields.filter(f => {
              const vRaw = formData[f.name];
              const v = vRaw && typeof vRaw === 'object' && 'value' in vRaw ? vRaw.value : vRaw;
              return v !== undefined && v !== null && String(v).trim() !== '';
            }).length} / {fields.length} 字段已填
          </span>
          {isDirty && (
            <Space>
              <Button size="small" onClick={() => {
                setEditingData(JSON.parse(JSON.stringify(crfData?.[selectedFormName] || {})));
                setIsDirty(false);
              }}>取消修改</Button>
              <Button size="small" type="primary" loading={saving} onClick={async () => {
                setSaving(true);
                try {
                  await onSaveForm(editingData);
                  setIsDirty(false);
                } catch(e) {
                  message.error('保存失败: ' + e.message);
                } finally {
                  setSaving(false);
                }
              }}>保存修改</Button>
            </Space>
          )}
        </span>
      </div>
      <div style={{ padding: '8px 0' }}>
        {fields.map((field, idx) => {
          const valObj = editingData[field.name];
          const isObj = valObj && typeof valObj === 'object' && 'value' in valObj;
          const val = isObj ? valObj.value : valObj;
          let sourceBlocks = isObj ? (valObj.source_blocks || []) : [];
          
          if (Array.isArray(val)) {
            val.forEach(row => {
              if (row && typeof row === 'object') {
                Object.values(row).forEach(cell => {
                  if (cell && typeof cell === 'object' && Array.isArray(cell.source_blocks)) {
                    sourceBlocks.push(...cell.source_blocks);
                  }
                });
              }
            });
          } else if (val && typeof val === 'object') {
            Object.values(val).forEach(cell => {
              if (cell && typeof cell === 'object' && Array.isArray(cell.source_blocks)) {
                sourceBlocks.push(...cell.source_blocks);
              }
            });
          }
          sourceBlocks = sourceBlocks.filter((b, i, self) => 
            b && b.block_id && self.findIndex(sb => sb && sb.block_id === b.block_id) === i
          );

          const filled = val !== undefined && val !== null && String(val).trim() !== '';
          
          return (
            <div 
              key={idx} 
              onClick={() => {
                const docGroups = {};
                (sourceBlocks || []).forEach(b => {
                  const did = b.document_id || 'unknown';
                  if (!docGroups[did]) docGroups[did] = [];
                  docGroups[did].push(b);
                });
                const docIds = Object.keys(docGroups);
                const firstDocBlocks = docIds.length > 0 ? docGroups[docIds[0]] : sourceBlocks;
                setActiveField({ name: field.name, sourceBlocks: firstDocBlocks, value: val, _docIdx: 0 });
              }}
              style={{
                display: 'flex', alignItems: 'flex-start',
                padding: '10px 20px',
                borderBottom: `1px solid ${C.border}`,
                background: activeField?.name === field.name ? '#eef2ff' : (idx % 2 === 0 ? '#fff' : '#fafbfd'),
                transition: 'background 0.2s',
              }}
            >
              <div style={{ width: 180, flexShrink: 0, paddingRight: 12 }}>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: C.textPrimary }}>
                  {field.name}
                  {field.required && <span style={{ color: '#ef4444', marginLeft: 2 }}>*</span>}
                </div>
                <div style={{ fontSize: 11, color: C.textDim, marginTop: 2 }}>
                  {field.type || 'text'}
                  {field.enum && ` · ${field.enum.length} 选项`}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {field.type === 'table' ? (
                  <div style={{ marginBottom: 8, overflowX: 'auto' }}>
                    <Table
                      size="small"
                      columns={(field.table_columns || field.sub_fields || []).map((col, i) => ({
                        title: col.name, 
                        dataIndex: col.name, 
                        key: i,
                        render: (cellVal, record, rowIndex) => {
                          const strVal = cellVal && typeof cellVal === 'object' && 'value' in cellVal ? cellVal.value : cellVal;
                          return (
                            <Input.TextArea 
                              bordered={false}
                              autoSize={{ minRows: 1 }}
                              style={{ padding: 0, margin: 0, fontSize: 12.5, minHeight: 22, color: C.textPrimary }}
                              value={strVal !== undefined && strVal !== null ? String(strVal) : ''} 
                              onChange={e => updateCellValue(field.name, rowIndex, col.name, e.target.value)}
                              placeholder={`输入 ${col.name}`}
                            />
                          )
                        }
                      }))}
                      dataSource={(Array.isArray(val) && val.length > 0 ? val : [{}]).map((row, i) => ({...row, key: i}))}
                      pagination={false}
                      bordered
                    />
                  </div>
                ) : field.type === 'multirow' ? (
                  <div style={{ marginBottom: 8 }}>
                    {(Array.isArray(val) && val.length > 0 ? val : [{}]).map((row, ri, arr) => (
                      <div key={ri} style={{ 
                        padding: '8px 4px', 
                        borderBottom: ri < arr.length - 1 ? `1px dashed ${C.border}` : 'none',
                        marginBottom: ri < arr.length - 1 ? 4 : 0,
                      }}>
                        {(field.sub_fields || Object.keys(row || {})).map(col => {
                          const k = typeof col === 'string' ? col : col.name;
                          const currentCell = row ? row[k] : undefined;
                          const cellVal = currentCell && typeof currentCell === 'object' && 'value' in currentCell ? currentCell.value : currentCell;
                          
                          return (
                            <div key={k} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6, paddingRight: 32 }}>
                              <span style={{ fontSize: 11, color: '#6b7280', flexShrink: 0, minWidth: 70, textAlign: 'right', paddingTop: 2 }}>{k}:</span>
                              <Input.TextArea 
                                bordered={false}
                                autoSize={{ minRows: 1 }}
                                style={{ padding: 0, margin: 0, fontSize: 12.5, color: C.textPrimary }}
                                value={cellVal !== undefined && cellVal !== null ? String(cellVal) : ''}
                                onChange={e => updateCellValue(field.name, ri, k, e.target.value)}
                                placeholder={`输入 ${k}`}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ) : field.type === 'enum' ? (
                  <div style={{ marginBottom: 8 }}>
                    <Select 
                      bordered={false}
                      value={val !== undefined && val !== null ? String(val) : undefined} 
                      style={{ width: '100%', fontSize: 12.5 }} 
                      onChange={v => updateCellValue(field.name, undefined, undefined, v)}
                      options={(field.enum || []).map(o => ({label: o, value: o}))}
                      allowClear
                      placeholder="请选择"
                    />
                  </div>
                ) : (
                  <div style={{ marginBottom: 8 }}>
                    <Input.TextArea 
                      bordered={false}
                      autoSize={{minRows: 1, maxRows: 6}}
                      style={{ padding: 0, margin: 0, fontSize: 12.5, color: C.textPrimary }}
                      value={val !== undefined && val !== null ? String(val) : ''}
                      onChange={e => updateCellValue(field.name, undefined, undefined, e.target.value)}
                      placeholder="输入内容"
                    />
                  </div>
                )}
                {(() => {
                  const docGroups = {};
                  (sourceBlocks || []).forEach(b => {
                    const did = b.document_id || 'unknown';
                    if (!docGroups[did]) docGroups[did] = [];
                    docGroups[did].push(b);
                  });
                  const docIds = Object.keys(docGroups);
                  if (docIds.length === 0) return null;
                  
                  const curDocIdx = activeField?.name === field.name && activeField?._docIdx != null 
                    ? Math.min(activeField._docIdx, docIds.length - 1) : 0;
                  const activeDocId = docIds[curDocIdx];
                  const activeBlocks = docGroups[activeDocId] || [];
                  const doc = (documents || []).find(d => d.document_id === activeDocId);

                  return (
                    <div style={{ marginTop: 4 }}>
                      {docIds.length > 1 && (
                        <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 10, color: '#9ca3af' }}>来源文档:</span>
                          {docIds.map((did, di) => {
                            const d = (documents || []).find(dd => dd.document_id === did);
                            return (
                              <Tag 
                                key={did}
                                color={di === curDocIdx ? 'blue' : 'default'}
                                style={{ fontSize: 10, padding: '0 6px', lineHeight: '18px', margin: 0, cursor: 'pointer' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveField({ name: field.name, sourceBlocks: docGroups[docIds[di]], value: val, _docIdx: di });
                                }}
                              >
                                {d?.file_name || did.slice(0, 8)} ({docGroups[did].length})
                              </Tag>
                            );
                          })}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {activeBlocks.map((b, bi) => (
                          <Tag key={bi} color="blue" bordered={false} style={{ fontSize: 10, padding: '0 4px', lineHeight: '16px', margin: 0 }}>
                            🔗 {b.block_id || 'Pos'}
                          </Tag>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div style={{ width: 28, flexShrink: 0, textAlign: 'center' }}>
                {filled
                  ? <CheckCircleOutlined style={{ color: C.success, fontSize: 14 }} />
                  : <CloseCircleOutlined style={{ color: '#d1d5db', fontSize: 14 }} />
                }
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
"""

new_content = content[:start_idx] + new_fieldtable + "\n" + content[end_idx:]

with open('frontend/src/pages/ProjectPatientDetail.jsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("SUCCESSFULLY REPLACED FIELDTABLE")
