/**
 * 患者 CRF 抽取详情页 — 3 面板布局
 * 左: CRF 模板表单树  |  中: 提取结果  |  右: 溯源面板
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Breadcrumb, Tree, Tag, Spin, Empty, Tooltip, Badge, message, Timeline, Button, Modal, Table, Input, Select, Space
} from 'antd';
import {
  ArrowLeftOutlined, FileTextOutlined, CheckCircleOutlined,
  CloseCircleOutlined, BranchesOutlined, FileSearchOutlined,
  ZoomInOutlined, ZoomOutOutlined, ExpandOutlined, CopyOutlined, QuestionCircleOutlined, DownloadOutlined
} from '@ant-design/icons';
import PdfViewer from '../components/PdfViewer';
import api, { extractFromDocument } from '../api/document';

/* ─── Color Tokens ──────────────────────────── */
const C = {
  bg: '#f5f6fa',
  panelBg: '#fff',
  border: '#e8e8ec',
  primary: '#4f46e5',
  accent: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  textPrimary: '#1f2937',
  textSecondary: '#6b7280',
  textDim: '#9ca3af',
  codeBg: '#f8f9fc',
  highlight: '#eef2ff',
};

/* ─── Left Panel: Form Tree ────────────────── */
const FormTree = ({ schema, crfData, selectedForm, onSelect, activeField, setActiveField }) => {
  const treeData = useMemo(() => {
    const categories = schema?.categories || [];
    return categories.map((cat, ci) => ({
      key: `cat-${ci}`,
      title: (
        <span style={{ fontWeight: 600, fontSize: 13, color: C.textPrimary }}>
          {cat.name || `分类 ${ci + 1}`}
        </span>
      ),
      selectable: false,
      children: (cat.forms || []).map((form, fi) => {
        const formData = crfData?.[form.name] || {};
        const totalFields = (form.fields || []).length;
        const filledFields = (form.fields || []).filter(f => {
          const valRaw = formData[f.name];
          const val = valRaw && typeof valRaw === 'object' && 'value' in valRaw ? valRaw.value : valRaw;
          return val !== undefined && val !== null && String(val).trim() !== '';
        }).length;
        const pct = totalFields > 0 ? Math.round(filledFields / totalFields * 100) : 0;
        
        return {
          key: `form-${ci}-${fi}`,
          formName: form.name,
          title: (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
              <span style={{ flex: 1, fontSize: 12.5, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {form.name}
              </span>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10,
                background: pct === 100 ? '#dcfce7' : pct > 0 ? '#fef3c7' : '#f3f4f6',
                color: pct === 100 ? '#16a34a' : pct > 0 ? '#d97706' : '#9ca3af',
              }}>
                {pct}%
              </span>
            </div>
          ),
        };
      }),
    }));
  }, [schema, crfData]);

  const allFormKeys = treeData.flatMap(cat => (cat.children || []).map(c => c.key));
  const defaultExpanded = treeData.map(cat => cat.key);

  return (
    <div style={{ padding: '12px 0' }}>
      <Tree
        treeData={treeData}
        defaultExpandedKeys={defaultExpanded}
        selectedKeys={selectedForm ? [selectedForm.key] : (allFormKeys.length > 0 ? [allFormKeys[0]] : [])}
        onSelect={(keys, info) => {
          if (info.node.formName) {
            onSelect({ key: info.node.key, name: info.node.formName });
            if (activeField) {
              setActiveField(null); // Clear active field when switching forms
            }
          }
        }}
        style={{ fontSize: 12.5 }}
        blockNode
      />
    </div>
  );
};

/* ─── Document Select Modal Content ───────── */
const DocSelectContent = ({ documents, selectedFormName, onSelect }) => {
  const [sortMode, setSortMode] = React.useState('date');
  const [sortOrder, setSortOrder] = React.useState('desc');

  const sortedDocs = React.useMemo(() => {
    if (!documents || documents.length === 0) return [];
    const docs = [...documents];
    if (sortMode === 'date') {
      docs.sort((a, b) => {
        const da = a.doc_date || '';
        const db_ = b.doc_date || '';
        return sortOrder === 'desc' ? db_.localeCompare(da) : da.localeCompare(db_);
      });
    } else if (sortMode === 'type') {
      docs.sort((a, b) => {
        const ta = a.doc_type || '未分类';
        const tb = b.doc_type || '未分类';
        return sortOrder === 'asc' ? ta.localeCompare(tb) : tb.localeCompare(ta);
      });
    }
    return docs;
  }, [documents, sortMode, sortOrder]);

  const groups = React.useMemo(() => {
    if (sortMode === 'type') {
      const map = {};
      sortedDocs.forEach(doc => {
        const key = doc.doc_type || '未分类';
        if (!map[key]) map[key] = [];
        map[key].push(doc);
      });
      return Object.entries(map).map(([key, docs]) => ({ key, label: key, docs, count: docs.length }));
    }
    const map = {};
    sortedDocs.forEach(doc => {
      const key = doc.doc_date || '日期未知';
      if (!map[key]) map[key] = [];
      map[key].push(doc);
    });
    return Object.entries(map).map(([key, docs]) => ({ key, label: key, docs, count: docs.length }));
  }, [sortedDocs, sortMode]);

  return (
    <>
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
        从该患者的已有文档中选择一份，针对 <strong>{selectedFormName}</strong> 表单进行靶向抽取。
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
        padding: '8px 12px', background: '#f8fafc', borderRadius: 8,
        border: '1px solid #f0f0f0',
      }}>
        <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0 }}>分组方式：</span>
        <Select
          value={sortMode}
          onChange={v => setSortMode(v)}
          size="small"
          style={{ width: 140 }}
          options={[
            { value: 'date', label: '📅 按生效日期' },
            { value: 'type', label: '📂 按文档类型' },
          ]}
        />
        <span style={{ fontSize: 12, color: '#6b7280', flexShrink: 0, marginLeft: 8 }}>排序：</span>
        <Select
          value={sortOrder}
          onChange={v => setSortOrder(v)}
          size="small"
          style={{ width: 110 }}
          options={sortMode === 'date'
            ? [{ value: 'desc', label: '由近到远' }, { value: 'asc', label: '由远到近' }]
            : [{ value: 'asc', label: 'A → Z' }, { value: 'desc', label: 'Z → A' }]
          }
        />
        <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>
          共 {documents?.length || 0} 份文档
        </span>
      </div>
      {(!documents || documents.length === 0) ? (
        <Empty description="该患者暂无文档" />
      ) : (
        <div style={{ maxHeight: 420, overflow: 'auto' }}>
          {groups.map(group => (
            <div key={group.key} style={{ marginBottom: 12 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 10px', marginBottom: 6,
                background: '#f3f4f6', borderRadius: 6,
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{group.label}</span>
                <Tag style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 6px' }}>{group.count}</Tag>
              </div>
              {group.docs.map(doc => (
                <div
                  key={doc.document_id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', marginBottom: 4, marginLeft: 8,
                    border: `1px solid ${C.border}`, borderRadius: 8,
                    cursor: 'pointer', transition: 'all 0.2s',
                    background: '#fff',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f0f5ff'; e.currentTarget.style.borderColor = '#91caff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = C.border; }}
                  onClick={() => onSelect(doc.document_id)}
                >
                  <FileTextOutlined style={{ fontSize: 18, color: C.primary, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.file_name || doc.original_filename || doc.document_id.slice(0, 12)}
                    </div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                      {doc.doc_type && <Tag color="blue" bordered={false} style={{ margin: 0, fontSize: 10, lineHeight: '16px', padding: '0 4px' }}>{doc.doc_type}</Tag>}
                      {doc.doc_date && <span>{doc.doc_date}</span>}
                      {doc.original_filename && doc.original_filename !== doc.file_name && <span style={{ color: '#d1d5db' }}>·</span>}
                      {doc.original_filename && doc.original_filename !== doc.file_name && <span>{doc.original_filename}</span>}
                    </div>
                  </div>
                  {doc.trace?.status === 'SUCCESS' && <Tag color="green" style={{ margin: 0, fontSize: 10 }}>已抽取</Tag>}
                  {doc.trace?.status === 'RUNNING' && <Tag color="blue" style={{ margin: 0, fontSize: 10 }}>抽取中</Tag>}
                  {doc.trace?.status === 'FAILED' && <Tag color="red" style={{ margin: 0, fontSize: 10 }}>失败</Tag>}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </>
  );
};

/* ─── Center Panel: Field Table ────────────── */
const FieldTable = ({ projectId, patientId, schema, crfData, selectedFormName, activeField, setActiveField, loading, documents, onSaveForm, reloadCurrentForm }) => {
  const [editingData, setEditingData] = React.useState({});
  const [saving, setSaving] = React.useState(false);
  const [isDirty, setIsDirty] = React.useState(false);
  const [docSelectOpen, setDocSelectOpen] = React.useState(false);
  const [extracting, setExtracting] = React.useState(false);

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

  const saveTimeoutRef = React.useRef(null);

  const handleManualSave = async () => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    if (!isDirty) return;
    setSaving(true);
    try {
      await onSaveForm(editingData);
      setIsDirty(false);
      message.success('保存成功');
    } catch (e) {
      message.error('保存失败: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExtractFromDoc = async (documentId) => {
    try {
      message.loading({ content: '正在触发靶向抽取...', key: 'extractDoc', duration: 0 });
      setExtracting(true);
      setDocSelectOpen(false);

      const res = await extractFromDocument(projectId, patientId, selectedFormName, documentId);

      if (res?.success) {
        message.success({ content: `已触发 ${selectedFormName} 表单靶向抽取，稍后自动刷新。`, key: 'extractDoc', duration: 4 });
        // 阶梯轮询
        const pollTimers = [8000, 16000, 25000, 40000];
        pollTimers.forEach(timeout => {
          setTimeout(() => reloadCurrentForm(), timeout);
        });
      } else {
        message.error({ content: res?.message || '抽取任务创建失败', key: 'extractDoc', duration: 3 });
      }
    } catch (e) {
      console.error('Extract Error:', e);
      message.error({ content: '抽取异常: ' + (e.message || '网络错误'), key: 'extractDoc', duration: 4 });
    } finally {
      setExtracting(false);
    }
  };

  React.useEffect(() => {
    if (isDirty) {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          await onSaveForm(editingData);
          setIsDirty(false);
        } catch (e) {
          message.error('自动保存失败: ' + e.message);
        } finally {
          setSaving(false);
        }
      }, 3000);
    }
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [editingData, isDirty, onSaveForm]);

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
              const vRaw = editingData[f.name];
              const v = vRaw && typeof vRaw === 'object' && 'value' in vRaw ? vRaw.value : vRaw;
              return v !== undefined && v !== null && String(v).trim() !== '';
            }).length} / {fields.length} 字段已填
          </span>
          <div style={{ width: 1, height: 14, background: C.border }} />
          {saving ? (
            <span style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Spin size="small" /> 保存中...
            </span>
          ) : isDirty ? (
            <span style={{ color: C.textDim }}>未保存</span>
          ) : (
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircleOutlined /> 已保存
            </span>
          )}
          <Button 
            type="primary" 
            size="small" 
            disabled={!isDirty && !saving}
            loading={saving}
            onClick={handleManualSave}
            style={{ borderRadius: 4 }}
          >
            保存
          </Button>
          <Button 
            size="small" 
            icon={extracting ? <Spin size="small" /> : <FileSearchOutlined />} 
            style={{ borderRadius: 4 }}
            disabled={extracting}
            onClick={() => setDocSelectOpen(true)}
          >
            靶向抽取
          </Button>
          <Modal
            title="选择文档进行靶向抽取"
            open={docSelectOpen}
            onCancel={() => setDocSelectOpen(false)}
            footer={null}
            width={600}
            destroyOnClose
          >
            <DocSelectContent
              documents={documents}
              selectedFormName={selectedFormName}
              onSelect={handleExtractFromDoc}
            />
          </Modal>
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
              </div>
              <div style={{ flex: 1 }}>
                {filled ? (
                  <>
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
                  </>
                ) : (
                  <span style={{ color: C.textDim, fontSize: 12, fontStyle: 'italic' }}>—— 未提取</span>
                )}
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

/* ─── Right Panel: Trace Provenance ────────── */
const DocumentImageViewer = ({ docUrl, extractedBlocks, docName, mimeType, originalFilename, ocrPageSizes }) => {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0); 
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  const isPdf = 
    mimeType?.includes('pdf') || 
    originalFilename?.toLowerCase().endsWith('.pdf') || 
    (docName && docName.toLowerCase().endsWith('.pdf'));

  const handleImageLoad = (e) => {
    const nw = e.target.naturalWidth;
    const nh = e.target.naturalHeight;
    setImgSize({ w: nw, h: nh });

    // 宽度和父组件一样宽 (Width strictly matches container width)
    if (containerRef.current && nw > 0) {
      const cw = containerRef.current.clientWidth;
      setScale(cw / nw);
    } else {
      setScale(0.5);
    }
  };

  const drawScale = scale || (isPdf ? 1.0 : 0.5);

  return (
    <div style={{ marginBottom: 12, border: `1px solid ${C.border}`, borderRadius: 6, overflow: 'hidden', background: '#e5e7eb', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '6px 10px', background: '#f3f4f6', display: 'flex', gap: 10, alignItems: 'center', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: C.textSecondary }}>视图缩放</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div onClick={() => setScale(s => Math.max(0.1, s - 0.1))} style={{ cursor: 'pointer', color: C.textDim, padding: 2 }}><ZoomOutOutlined /></div>
          <span style={{ fontSize: 11, color: C.textPrimary, minWidth: 36, textAlign: 'center' }}>{Math.round(drawScale * 100)}%</span>
          <div onClick={() => setScale(s => Math.min(2.0, s + 0.1))} style={{ cursor: 'pointer', color: C.textDim, padding: 2 }}><ZoomInOutlined /></div>
          
          <Tag 
            color="blue" 
            style={{ fontSize: 10, cursor: 'pointer', marginLeft: 6, border: 'none' }} 
            onClick={() => {
              if (containerRef.current) {
                if (isPdf) {
                  setScale(0); // Trigger PdfViewer zero-state to force recalculate fit width
                } else if (imgSize.w) {
                  setScale(containerRef.current.clientWidth / imgSize.w);
                }
              }
            }}
          >
            使适应宽度
          </Tag>
        </div>
      </div>
      
      <div ref={containerRef} style={{ width: '100%', position: 'relative', overflow: isPdf ? 'hidden' : 'auto', height: 600 }}>
        {isPdf ? (
          <PdfViewer 
            url={docUrl} 
            scale={scale === 0 ? 0 : drawScale} 
            extractedBlocks={extractedBlocks} 
            ocrPageSizes={ocrPageSizes}
            onInitScale={(s) => setScale(s)}
          />
        ) : (
          <div style={{ 
            position: 'relative', 
            width: imgSize.w ? imgSize.w * drawScale : '100%', 
            height: imgSize.h ? imgSize.h * drawScale : 'auto',
            transformOrigin: 'top left'
          }}>
            <img 
              src={docUrl} 
              alt="Source Document"
              onLoad={handleImageLoad}
              style={{ width: '100%', height: '100%', display: 'block' }}
              crossOrigin="anonymous"
            />
            
            {/* 绘制 Bounding Boxes — normalize OCR pixel coords to image display coords */}
            {imgSize.w > 0 && extractedBlocks && extractedBlocks.map((b, bi) => {
              if (!b.bbox) return null;
              // OCR engine upscales images before processing; we must scale OCR coords
              // back down to the original image dimensions, then apply display scale.
              const ocrW = ocrPageSizes?.['1']?.w || imgSize.w;
              const bboxScale = drawScale * (imgSize.w / ocrW);
              return (
                <div key={bi} style={{
                  position: 'absolute',
                  left: b.bbox.x * bboxScale,
                  top: b.bbox.y * bboxScale,
                  width: b.bbox.w * bboxScale,
                  height: b.bbox.h * bboxScale,
                  border: '2px solid rgba(239, 68, 68, 0.8)',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  pointerEvents: 'none',
                }}>
                  <div style={{
                    position: 'absolute', top: -16, left: -2, background: '#ef4444', color: '#fff',
                    fontSize: 9, padding: '0 4px', borderRadius: '4px 4px 4px 0', whiteSpace: 'nowrap'
                  }}>
                    {b.block_id || 'Extract'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const TracePanel = ({ projectId, patientId, documents, selectedFormName, activeField, onAdoptSuccess }) => {
  const [activeHistoryIdx, setActiveHistoryIdx] = React.useState(null);
  const [fieldHistory, setFieldHistory] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  // 当选中的字段改变时，重置时间轴到最新的那个节点，并拉取单独这个字段的历史记录。
  React.useEffect(() => {
    setActiveHistoryIdx(null);
    if (!activeField || !selectedFormName) {
      setFieldHistory([]);
      return;
    }

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/projects/${projectId}/patients/${patientId}/crf-field-history`, {
          params: { form: selectedFormName, field: activeField.name }
        });
        if (res?.success && Array.isArray(res.data)) {
          const history = [];
          const isLegacy = res._legacy === true;
          
          res.data.forEach(item => {
            let docId, actionLabel, actionColor, rawBlocks, value, createdAt;
            
            if (isLegacy) {
              // ── 旧格式：从 PipelineTrace 考古 ──
              const { document_id, field_data, log_entry, trace_created_at } = item;
              docId = document_id;
              createdAt = trace_created_at;
              actionLabel = '提取'; actionColor = '#2563eb';
              if (log_entry) {
                if (log_entry.action === 'filled') { actionLabel = '新增'; actionColor = '#16a34a'; }
                else if (log_entry.action === 'conflict') { actionLabel = '冲突'; actionColor = '#d97706'; }
                else if (log_entry.action === 'same') { actionLabel = '一致'; actionColor = '#6b7280'; }
              }
              rawBlocks = log_entry?.source_blocks || field_data?.source_blocks || [];
              value = field_data?.value || log_entry?.value || log_entry?.new_value || '';
            } else {
              // ── 新格式：CrfFieldExtraction.to_dict() ──
              docId = item.document_id;
              createdAt = item.created_at;
              value = item.extracted_value ?? '';
              rawBlocks = item.source_blocks || [];
              const action = item.merge_action || 'filled';
              if (action === 'filled') { actionLabel = '新增'; actionColor = '#16a34a'; }
              else if (action === 'conflict') { actionLabel = '冲突'; actionColor = '#d97706'; }
              else if (action === 'same') { actionLabel = '一致'; actionColor = '#6b7280'; }
              else { actionLabel = '提取'; actionColor = '#2563eb'; }
            }
            
            const blocks = (rawBlocks || []).map(b => {
              const blk = typeof b === 'string' ? { block_id: b } : { ...b };
              if (!blk.document_id) blk.document_id = docId;
              return blk;
            });
            
            const sourceDocId = blocks.find(b => b.document_id)?.document_id || docId;
            const doc = (documents || []).find(d => d.document_id === sourceDocId);

            history.push({
              docId: sourceDocId,
              docName: doc?.file_name || (sourceDocId || '').slice(0, 8),
              mimeType: doc?.mime_type,
              originalFilename: doc?.original_filename,
              ocrPageSizes: doc?.ocr_page_sizes,
              docUrl: sourceDocId ? `/api/documents/${sourceDocId}/preview` : '',
              createdAt: createdAt || doc?.doc_date || '',
              actionLabel,
              actionColor,
              value,
              blocks,
              isAdopted: item.is_adopted || false,
              extractionId: item.id || null,
            });
          });

          history.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

          // 始终将当前 `activeField` 作为一条“当前生效值”悬浮在时间线最顶端
          if (activeField.value !== undefined && activeField.value !== null && String(activeField.value) !== '') {
            const firstBlock = (activeField.sourceBlocks || []).find(b => b.document_id);
            const docId = firstBlock ? firstBlock.document_id : (history[0]?.docId || '');
            const matchDoc = (documents || []).find(d => d.document_id === docId);
            
            history.unshift({
              isCurrentMark: true, // 标识这是当前系统使用的真实值
              docId: docId,
              docName: matchDoc?.file_name || (docId ? docId.slice(0, 8) : '最终结果'),
              mimeType: matchDoc?.mime_type,
              originalFilename: matchDoc?.original_filename,
              ocrPageSizes: matchDoc?.ocr_page_sizes,
              docUrl: docId ? `/api/documents/${docId}/preview` : '',
              createdAt: '当前状态',
              actionLabel: '当前值',
              actionColor: '#10b981',
              value: activeField.value,
              blocks: activeField.sourceBlocks || [],
            });
          }

          setFieldHistory(history);
        }
      } catch {
        // silent fetch error fallback to empty display
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
// eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeField, selectedFormName, projectId, patientId]);

  if (!documents || documents.length === 0) {
    return <Empty description="暂无文档溯源" style={{ marginTop: 80 }} />;
  }

  if (!activeField) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <BranchesOutlined style={{ fontSize: 48, color: '#e5e7eb', marginBottom: 16 }} />
        <div style={{ color: C.textSecondary, fontSize: 13 }}>请在中间表单点击某个字段，查看溯源详情</div>
      </div>
    );
  }
  
  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center' }}><Spin /></div>;
  }

  if (fieldHistory.length === 0) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <Empty description={`无字段 "${activeField.name}" 的合并溯源记录`} />
      </div>
    );
  }

  // 默认选中最新的节点（最新在第0项）
  const currentIdx = activeHistoryIdx !== null ? activeHistoryIdx : 0;
  const selectedNode = fieldHistory[currentIdx];
  const isLatestNode = currentIdx === 0;

  // 提取需要高亮的 Block。
  let blocksToRender = selectedNode.blocks;
  const hasValidBbox = blocksToRender && blocksToRender.some(b => b.bbox);
  if (!hasValidBbox && isLatestNode && activeField.sourceBlocks?.length > 0) {
    blocksToRender = activeField.sourceBlocks;
  }

  // 去重和重组需要高亮的红框 Block（只保留有 bbox 的）
  const currentFieldBlocksMap = {};
  if (Array.isArray(blocksToRender)) {
    blocksToRender.forEach(b => {
      if (b.block_id && b.bbox) {
        currentFieldBlocksMap[b.block_id] = b;
      }
    });
  }
  const currentFieldBlocks = Object.values(currentFieldBlocksMap);

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        fontSize: 13, fontWeight: 600, color: C.textPrimary,
        padding: '0 4px 10px', borderBottom: `1px solid ${C.border}`, marginBottom: 16,
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0
      }}>
        <BranchesOutlined style={{ color: C.accent }} />
        字段溯源 - <span style={{ color: C.accent }}>{activeField.name}</span>
      </div>

      {/* 上半部分：原文档画板 */}
      <div style={{ flex: '0 0 auto', marginBottom: 16 }}>
        {selectedNode.docUrl ? (
          <DocumentImageViewer 
            docUrl={selectedNode.docUrl} 
            extractedBlocks={currentFieldBlocks} 
            docName={selectedNode.docName}
            mimeType={selectedNode.mimeType}
            originalFilename={selectedNode.originalFilename}
            ocrPageSizes={selectedNode.ocrPageSizes}
          />
        ) : (
          <div style={{ padding: 20, textAlign: 'center', color: C.textDim, fontSize: 12, background: '#f9fafb', borderRadius: 6 }}>
            无原文档预览图
          </div>
        )}
      </div>

      {/* 下半部分：溯源历史时间轴 */}
      <div style={{ flex: 1, overflow: 'auto', background: '#fff', borderRadius: 8, padding: '16px 20px', border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.textSecondary, marginBottom: 16, borderBottom: `1px solid #f3f4f6`, paddingBottom: 8 }}>
          提取变更历史
        </div>
        <Timeline
          mode="left"
          items={fieldHistory.map((node, i) => ({
            color: i === currentIdx ? '#3b82f6' : '#d1d5db',
            children: (
              <div 
                onClick={() => setActiveHistoryIdx(i)}
                style={{
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: i === currentIdx ? '#eff6ff' : 'transparent',
                  border: i === currentIdx ? `1px solid #bfdbfe` : '1px solid transparent',
                  transition: 'background 0.2s',
                  marginLeft: -10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Tag color={node.actionColor} style={{ fontSize: 10, margin: 0, lineHeight: '16px' }}>{node.actionLabel}</Tag>
                  <span style={{ fontSize: 10, color: '#9ca3af', fontFamily: 'monospace' }}>{node.createdAt}</span>
                  {i === currentIdx && node.actionLabel !== '当前值' && (
                    <Button 
                      type="primary" 
                      size="small" 
                      style={{ marginLeft: 'auto', fontSize: 10, height: 22, padding: '0 8px' }}
                      onClick={async (e) => {
                        e.stopPropagation();
                        Modal.confirm({
                          title: '采用此值确认',
                          content: '确定要将当前字段的值替换为该历史记录的值吗？',
                          okText: '确定',
                          cancelText: '取消',
                          onOk: async () => {
                            try {
                              const res = await api.put(`/projects/${projectId}/patients/${patientId}/crf-field`, {
                                form: selectedFormName,
                                field: activeField.name,
                                value: node.value,
                                source_blocks: node.blocks
                              });
                              if (res?.success) {
                                message.success('已采用该历史值');
                                if (onAdoptSuccess) onAdoptSuccess({ 
                                  name: activeField.name, 
                                  value: node.value,
                                  sourceBlocks: node.blocks 
                                });
                              } else {
                                message.error(res?.message || '更新失败');
                              }
                            } catch {
                              message.error('网络错误');
                            }
                          }
                        });
                      }}
                    >
                      采用此值
                    </Button>
                  )}
                </div>
                <div style={{ fontSize: 12, color: C.textPrimary, fontWeight: i === currentIdx ? 600 : 400, wordBreak: 'break-all', marginBottom: 6 }}>
                  {(() => {
                    const val = node.value;
                    // 辅助函数：从嵌套子字段中提取纯值（去掉 source_blocks）
                    const extractDisplayValue = (v) => {
                      if (Array.isArray(v)) {
                        return v.map(row => {
                          if (typeof row === 'object' && row !== null) {
                            const clean = {};
                            Object.entries(row).forEach(([k, cell]) => {
                              if (cell && typeof cell === 'object' && 'value' in cell) {
                                clean[k] = cell.value;
                              } else {
                                clean[k] = cell;
                              }
                            });
                            return clean;
                          }
                          return row;
                        });
                      }
                      if (typeof v === 'object' && v !== null && 'value' in v) {
                        return v.value;
                      }
                      return v;
                    };

                    if (typeof val === 'object' && val !== null) {
                      const displayVal = extractDisplayValue(val);
                      // 数组类型渲染为紧凑的 key: value 行
                      if (Array.isArray(displayVal)) {
                        return (
                          <div style={{ fontSize: 11, background: '#f8fafc', padding: 8, borderRadius: 4, border: '1px solid #e2e8f0', margin: '4px 0' }}>
                            {displayVal.map((row, ri) => (
                              <div key={ri} style={{ marginBottom: ri < displayVal.length - 1 ? 6 : 0 }}>
                                {typeof row === 'object' && row !== null
                                  ? Object.entries(row).map(([k, v]) => (
                                      <div key={k} style={{ display: 'flex', gap: 6, lineHeight: '20px' }}>
                                        <span style={{ color: '#6b7280', flexShrink: 0 }}>{k}:</span>
                                        <span style={{ fontWeight: 500 }}>{String(v ?? '')}</span>
                                      </div>
                                    ))
                                  : <span>{String(row)}</span>
                                }
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return <pre style={{ fontSize: 11, background: '#f8fafc', padding: 8, borderRadius: 4, overflowX: 'auto', whiteSpace: 'pre-wrap', border: '1px solid #e2e8f0', margin: '4px 0' }}>{JSON.stringify(displayVal, null, 2)}</pre>;
                    }
                    if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
                      try {
                        const fixedStr = val.replace(/'/g, '"');
                        const obj = JSON.parse(fixedStr);
                        const displayVal = extractDisplayValue(obj);
                        return <pre style={{ fontSize: 11, background: '#f8fafc', padding: 8, borderRadius: 4, overflowX: 'auto', whiteSpace: 'pre-wrap', border: '1px solid #e2e8f0', margin: '4px 0' }}>{JSON.stringify(displayVal, null, 2)}</pre>;
                      } catch {
                        return <div style={{ fontSize: 11, background: '#f8fafc', padding: 8, borderRadius: 4, wordBreak: 'break-all', border: '1px solid #e2e8f0', margin: '4px 0' }}>{val}</div>;
                      }
                    }
                    return String(val);
                  })()}
                </div>
                <div style={{ fontSize: 11, color: C.textDim, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <FileSearchOutlined style={{ color: i === currentIdx ? '#2563eb' : 'inherit' }} /> {node.docName}
                </div>
              </div>
            )
          }))}
        />
      </div>
    </div>
  );
};

/* ═══════════ Main Page ═══════════════════════ */
const ProjectPatientDetail = () => {
  const { id: projectId, patientId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [selectedForm, setSelectedForm] = useState(null);
  const [activeField, setActiveField] = useState(null);
  
  // Lazy-load forms dictionary { [formName]: full_json_data }
  const [fullFormsJson, setFullFormsJson] = useState({});
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    api.get(`/projects/${projectId}/patients/${patientId}/crf-detail`)
      .then(res => {
        if (res?.success && res?.data) {
          setData(res.data);
          // Auto-select first form
          const cats = res.data.template_schema?.categories || [];
          if (cats.length > 0 && cats[0].forms?.length > 0) {
            setSelectedForm({ key: 'form-0-0', name: cats[0].forms[0].name });
          }
        } else {
          message.error(res?.message || '获取 CRF 详情失败');
        }
      })
      .catch(() => message.error('获取 CRF 详情网络错误'))
      .finally(() => setLoading(false));
 
  }, [projectId, patientId]);

  const reloadCurrentForm = () => {
    if (!selectedForm?.name) return;
    setFormLoading(true);
    api.get(`/projects/${projectId}/patients/${patientId}/crf-form?form=${encodeURIComponent(selectedForm.name)}`)
      .then(res => {
        if (res?.success) {
          setFullFormsJson(prev => ({ ...prev, [selectedForm.name]: res.data || {} }));
        }
      })
      .finally(() => setFormLoading(false));
  };

  // When selected form changes, lazily fetch its heavy JSON payload if missing
  useEffect(() => {
    if (!selectedForm?.name || fullFormsJson[selectedForm.name]) return;
    reloadCurrentForm();
// eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedForm?.name, projectId, patientId]);

  const meta = data?.patient_meta || {};
  const patientLabel = meta['患者姓名'] || meta['姓名'] || patientId?.slice(0, 8);
  const patientCode = meta['患者编号'] || '';

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><Spin size="large" /></div>;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: C.bg, overflow: 'hidden' }}>
      {/* Top Bar */}
      <div style={{
        padding: '10px 20px', background: '#fff',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div
          onClick={() => navigate(`/projects/${projectId}`)}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: C.textSecondary, fontSize: 13 }}
        >
          <ArrowLeftOutlined /> 返回项目
        </div>
        <div style={{ width: 1, height: 20, background: C.border }} />
        <Breadcrumb items={[
          { title: '研究项目' },
          { title: <a onClick={() => navigate(`/projects/${projectId}`)}>项目详情</a> },
          { title: `${patientLabel} ${patientCode ? `(${patientCode})` : ''}` },
        ]} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {data?.enrollment_date && (
            <span style={{ fontSize: 12, color: C.textDim }}>
              入组: {data.enrollment_date}
            </span>
          )}
          <Tag color="blue">
            {Object.keys(data?.crf_data || {}).length} 表单已填
          </Tag>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ width: 240, background: '#fff', borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#4b5563' }}><FileTextOutlined style={{ marginRight: 6 }} />CRF 表单模板</span>
          </div>
          <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
            <FormTree
              schema={data?.template_schema}
              crfData={data?.crf_data}
              selectedForm={selectedForm}
              onSelect={(form) => {
                setSelectedForm(form);
                setActiveField(null); // Reset active field on form switch
              }}
              activeField={activeField}
              setActiveField={setActiveField}
            />
          </div>
        </div>

        {/* Center: Field Extract Results */}
        <div style={{ flex: 1, background: '#fff', borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <FieldTable
              projectId={projectId}
              patientId={patientId}
              schema={data?.template_schema}
              crfData={fullFormsJson}
              selectedFormName={selectedForm?.name}
              activeField={activeField}
              setActiveField={setActiveField}
              loading={formLoading}
              documents={data?.documents || []}
              reloadCurrentForm={reloadCurrentForm}
              onSaveForm={async (editedData) => {
                const res = await api.post(`/projects/${projectId}/patients/${patientId}/crf-form/save`, {
                  form_name: selectedForm?.name,
                  data: editedData,
                });
                if (res?.success) {
                  reloadCurrentForm();
                } else {
                  throw new Error(res?.message || '未知错误');
                }
              }}
            />
          </div>
        </div>

        {/* Right: Provenance Tray */}
        <div style={{ width: 560, background: '#fafafd', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: 'auto' }}>
            <TracePanel
              projectId={projectId}
              patientId={patientId}
              documents={data?.documents || []}
              selectedFormName={selectedForm?.name}
              activeField={activeField}
              onAdoptSuccess={(newActiveField) => {
                setActiveField(newActiveField);
                reloadCurrentForm();
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectPatientDetail;
