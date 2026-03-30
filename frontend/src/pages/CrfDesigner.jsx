import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button, Input, Select, Card, Space, Tag, Typography, Tooltip, Popconfirm, Switch, Divider, message, Empty, Tabs,
  Radio, Checkbox, DatePicker, InputNumber, Table
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SaveOutlined,
  FolderOpenOutlined, FormOutlined, FileTextOutlined, ArrowLeftOutlined,
  EditOutlined, HolderOutlined, AppstoreOutlined, SettingOutlined
} from '@ant-design/icons';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDraggable } from '@dnd-kit/core';
import api from '../api/document';

const { Title, Text } = Typography;

// ─── 核心配置 ──────────────────────────────────
const FIELD_TYPES = [
  { value: 'text', label: '文本', color: '#1677ff', icon: '📝' },
  { value: 'number', label: '数字', color: '#52c41a', icon: '🔢' },
  { value: 'date', label: '日期', color: '#faad14', icon: '📅' },
  { value: 'radio', label: '单选', color: '#eb2f96', icon: '🔘' },
  { value: 'checkbox', label: '多选', color: '#13c2c2', icon: '☑️' },
  { value: 'multirow', label: '多行子表', color: '#fa8c16', icon: '📋' },
  { value: 'table', label: '表格', color: '#722ed1', icon: '📊' },
];

const TYPE_MAP = Object.fromEntries(FIELD_TYPES.map(t => [t.value, t]));

let _uid = Date.now();
const nextId = (prefix) => `${prefix}_${++_uid}`;

// ─── 左侧：可拖拽的组件库卡片 ───────────────────────
const DraggableComponent = ({ typeConf }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `new-component-${typeConf.value}`,
    data: { isNewComponent: true, type: typeConf.value }
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        padding: '8px 12px',
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: 6,
        cursor: 'grab',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        opacity: isDragging ? 0.4 : 1,
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = typeConf.color; e.currentTarget.style.color = typeConf.color; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#f0f0f0'; e.currentTarget.style.color = 'inherit'; }}
    >
      <span style={{ fontSize: 16 }}>{typeConf.icon}</span>
      <span style={{ fontSize: 13, fontWeight: 500 }}>{typeConf.label}</span>
    </div>
  );
};

// ─── 中间：可排序字段卡片 (预览态) ──────────────────
const SortableCanvasField = ({ field, isActive, onClick, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
    data: { isCanvasField: true, field }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };
  const typeConf = TYPE_MAP[field.type] || { label: field.type, color: '#999', icon: '❓' };

  const renderFieldPreview = () => {
    switch (field.type) {
      case 'text':
        if (field['x-component-props']?.rows) {
          return <Input.TextArea placeholder="多行文本输入预览" rows={2} disabled />;
        }
        return <Input placeholder="文本输入预览" disabled />;
      case 'number':
        return <InputNumber placeholder="数字" style={{ width: '100%' }} disabled />;
      case 'date':
        return <DatePicker style={{ width: '100%' }} disabled />;
      case 'radio':
        const rOpts = field.options && field.options.length > 0 ? field.options : ['选项1', '选项2'];
        return <Radio.Group options={rOpts} disabled />;
      case 'checkbox':
        const cOpts = field.options && field.options.length > 0 ? field.options : ['选项A', '选项B'];
        return <Checkbox.Group options={cOpts} disabled />;
      case 'multirow':
        const subFields = field.sub_fields || [];
        return (
          <div style={{ border: '1px dashed #d9d9d9', borderRadius: 6, padding: 12, background: '#fcfcfc' }}>
            <div style={{ marginBottom: 12, fontWeight: 500, color: '#595959', fontSize: 13 }}>一组数据 (多行子表预览)</div>
            {subFields.length > 0 ? subFields.map((sf, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ width: 100, textAlign: 'right', paddingRight: 12, fontSize: 13, color: '#595959', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sf.name || `子字段${idx + 1}`}
                </div>
                <div style={{ flex: 1 }}>
                  <Input size="small" placeholder="..." disabled />
                </div>
              </div>
            )) : <div style={{ color: '#bfbfbf', textAlign: 'center', fontSize: 12 }}>暂无子字段定义</div>}
            <Button size="small" type="dashed" block style={{ marginTop: 8 }} disabled>+ 添加一行</Button>
          </div>
        );
      case 'table':
        const columnsData = field.table_columns || [];
        const displayColumns = columnsData.length > 0 
          ? columnsData.map((col, idx) => ({ title: col.name || `列${idx + 1}`, dataIndex: `col${idx}` }))
          : [{ title: '列1', dataIndex: 'col1' }, { title: '列2', dataIndex: 'col2' }];
        
        const mockData = { key: 1 };
        displayColumns.forEach(c => { mockData[c.dataIndex] = '...' });

        return (
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 8, background: '#fafafa', overflowX: 'auto' }}>
            <Table 
              size="small" 
              columns={displayColumns}
              dataSource={[mockData]}
              pagination={false}
            />
          </div>
        );
      default:
        return <Input placeholder="输入预览" disabled />;
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card
        size="small"
        onClick={onClick}
        style={{
          borderRadius: 8,
          marginBottom: 12,
          cursor: 'pointer',
          border: isActive ? '1.5px solid #7c6fcd' : '1px solid transparent',
          borderLeft: `4px solid ${typeConf.color}`,
          background: isActive ? '#faf8ff' : '#fff',
          boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,.12)' : '0 1px 4px rgba(0,0,0,.04)',
          position: 'relative'
        }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <span {...listeners} style={{ cursor: 'grab', color: '#bfbfbf', fontSize: 16, marginTop: 4 }}>
            <HolderOutlined />
          </span>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                {field.name || '未命名字段'}
                {field.required && <span style={{ color: '#ff4d4f', marginLeft: 4 }}>*</span>}
              </span>
              <Tag color={typeConf.color} style={{ borderRadius: 12, fontSize: 10, margin: 0, padding: '0 6px' }}>
                {typeConf.icon} {typeConf.label}
              </Tag>
            </div>
            {field.prompt && (
              <div style={{ fontSize: 12, color: '#8c8c8c', background: '#f5f5f5', padding: '4px 8px', borderRadius: 4, marginBottom: 8 }}>
                提示词：{field.prompt}
              </div>
            )}
            
            <div style={{ marginTop: 4, pointerEvents: 'none' /* Disable interaction since it is a preview */ }}>
              {renderFieldPreview()}
            </div>
          </div>

          <Popconfirm title="删除此字段？" onConfirm={(e) => { e.stopPropagation(); onDelete(); }} okText="删除" cancelText="取消">
            <Button type="text" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
          </Popconfirm>
        </div>
      </Card>
    </div>
  );
};

// ─── 主界面 ──────────────────────────────────
const CrfDesigner = () => {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const isEditMode = !!templateId;

  // ─── 状态管理 ───
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [templateCategory, setTemplateCategory] = useState('');
  const [categories, setCategories] = useState([]);

  // 选中状态
  const [activeFormId, setActiveFormId] = useState(null);
  const [activeFieldId, setActiveFieldId] = useState(null);

  // Tab 状态
  const [leftTab, setLeftTab] = useState('tree'); // tree | components
  const [rightTab, setRightTab] = useState('form'); // form | field

  // 拖拽 overlay 状态
  const [activeDragItem, setActiveDragItem] = useState(null);

  const [saving, setSaving] = useState(false);
  const [, setLoading] = useState(isEditMode);

  // ─── 加载数据 ───
  useEffect(() => {
    const fetchTemplate = async () => {
      if (!isEditMode) return;
      try {
        const res = await api.get(`/crf-templates/${templateId}`);
        if (res?.success && res.data) {
          const tpl = res.data;
          setTemplateName(tpl.template_name || '');
          setTemplateDesc(tpl.description || '');
          setTemplateCategory(tpl.category || '');

          if (tpl.schema_json && tpl.schema_json.categories) {
            const loadedCats = tpl.schema_json.categories.map(cat => ({
              id: nextId('cat'), name: cat.name,
              forms: cat.forms.map(f => ({
                id: nextId('form'), name: f.name, prompt: f.prompt || '',
                row_type: f.row_type || 'single_row', conflict_strategy: f.conflict_strategy || 'fill_blank',
                anchor_fields: f.anchor_fields || [],
                fields: f.fields.map(field => ({
                  id: nextId('field'), name: field.name, type: field.type || 'text',
                  required: field.required || false, prompt: field.prompt || '',
                  options: field.options || [], sub_fields: field.sub_fields || [], table_columns: field.table_columns || [],
                }))
              }))
            }));
            setCategories(loadedCats);
            if (loadedCats.length > 0 && loadedCats[0].forms.length > 0) {
              setActiveFormId(loadedCats[0].forms[0].id);
            }
          }
        }
      } catch (error) {
        message.error(`加载模板失败: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchTemplate();
  }, [templateId, isEditMode]);

  // ─── 工具函数 ───
  const getActiveForm = useCallback(() => {
    if (!activeFormId) return null;
    for (const cat of categories) {
      const form = cat.forms.find(f => f.id === activeFormId);
      if (form) return form;
    }
    return null;
  }, [activeFormId, categories]);

  const updateActiveForm = (updates) => {
    setCategories(prev => prev.map(cat => ({
      ...cat,
      forms: cat.forms.map(f => f.id === activeFormId ? { ...f, ...updates } : f)
    })));
  };

  const updateActiveField = (updates) => {
    const form = getActiveForm();
    if (!form || !activeFieldId) return;
    updateActiveForm({
      fields: form.fields.map(f => f.id === activeFieldId ? { ...f, ...updates } : f)
    });
  };

  const activeForm = getActiveForm();
  const activeField = activeForm?.fields.find(f => f.id === activeFieldId);

  // ─── 树结构操作 ───
  const addCategory = () => {
    const name = prompt('分类名称');
    if (!name) return;
    setCategories(prev => [...prev, { id: nextId('cat'), name, forms: [] }]);
  };
  const renameCategory = (catId) => {
    const cat = categories.find(c => c.id === catId);
    const name = prompt('修改分类名称', cat?.name);
    if (!name) return;
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, name } : c));
  };
  const deleteCategory = (catId) => {
    setCategories(prev => prev.filter(c => c.id !== catId));
    setActiveFormId(null);
    setRightTab('form');
  };
  const addForm = (catId) => {
    const name = prompt('表单名称');
    if (!name) return;
    const newForm = {
      id: nextId('form'), name, prompt: '', row_type: 'single_row',
      conflict_strategy: 'fill_blank', anchor_fields: [], fields: []
    };
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, forms: [...c.forms, newForm] } : c));
    setActiveFormId(newForm.id);
    setActiveFieldId(null);
    setRightTab('form');
  };
  const deleteForm = (catId, formId) => {
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, forms: c.forms.filter(f => f.id !== formId) } : c));
    if (activeFormId === formId) {
      setActiveFormId(null);
      setActiveFieldId(null);
      setRightTab('form');
    }
  };

  // ─── 拖拽事件处理 (@dnd-kit) ───
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event) => {
    const { active } = event;
    setActiveDragItem(active);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveDragItem(null);

    if (!over || !activeForm) return;

    // 1. 从组件库拖入新组件到画布
    if (active.data.current?.isNewComponent) {
      const type = active.data.current.type;
      const newField = {
        id: nextId('field'), name: `新建${TYPE_MAP[type].label}字段`, type, required: false,
        prompt: '', options: [], sub_fields: [], table_columns: []
      };

      let newFields = [...activeForm.fields];

      if (over.id === 'canvas-droppable-area') {
        // 拖到空白区域末尾
        newFields.push(newField);
      } else {
        // 拖到某个现有字段上方/下方
        const overIndex = activeForm.fields.findIndex(f => f.id === over.id);
        if (overIndex >= 0) {
          // 简单处理：插入到目标位置
          newFields.splice(overIndex, 0, newField);
        } else {
          newFields.push(newField);
        }
      }

      updateActiveForm({ fields: newFields });
      setActiveFieldId(newField.id);
      setRightTab('field'); // 自动切换到字段配置
      return;
    }

    // 2. 画布内部排序
    if (active.id !== over.id) {
      const oldIdx = activeForm.fields.findIndex(f => f.id === active.id);
      const newIdx = activeForm.fields.findIndex(f => f.id === over.id);
      if (oldIdx >= 0 && newIdx >= 0) {
        updateActiveForm({ fields: arrayMove(activeForm.fields, oldIdx, newIdx) });
      }
    }
  };

  // ─── 保存 ───
  const handleSave = async () => {
    if (!templateName.trim()) { message.error('请输入模版名称'); return; }
    setSaving(true);
    try {
      const schemaJson = {
        version: '1.0',
        categories: categories.map(cat => ({
          name: cat.name,
          forms: cat.forms.map(f => ({
            name: f.name, prompt: f.prompt || '', row_type: f.row_type,
            conflict_strategy: f.conflict_strategy || 'fill_blank',
            anchor_fields: f.anchor_fields || [],
            fields: f.fields.map(field => ({
              name: field.name, type: field.type, required: field.required || false,
              prompt: field.prompt || '', options: field.options || [],
              sub_fields: field.sub_fields || [], table_columns: field.table_columns || [],
            }))
          }))
        }))
      };

      if (isEditMode) {
        const res = await api.put(`/crf-templates/${templateId}`, {
          template_name: templateName, description: templateDesc,
          category: templateCategory, schema_json: schemaJson,
        });
        if (res?.success) message.success('模版已更新');
      } else {
        const res = await api.post('/crf-templates/', {
          template_name: templateName, description: templateDesc,
          category: templateCategory, schema_json: schemaJson,
        });
        if (res?.success) { message.success('模版创建成功'); navigate('/projects'); }
        else message.error(res?.message || '创建失败');
      }
    } catch (err) {
      message.error('保存失败: ' + (err.message || ''));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column' }}>
      {/* ─── 顶部工具栏 ─── */}
      <div style={{
        padding: '12px 24px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 16,
        background: '#fff'
      }}>
        <Button icon={<ArrowLeftOutlined />} type="text" onClick={() => navigate('/projects')}>返回</Button>
        <Divider type="vertical" />
        <Input
          value={templateName} onChange={(e) => setTemplateName(e.target.value)}
          placeholder="未命名 CRF 模版" variant="borderless"
          style={{ fontSize: 18, fontWeight: 600, maxWidth: 300, padding: 0 }}
        />
        <Tag color="purple" style={{ borderRadius: 12 }}>{isEditMode ? '编辑模式' : '新建模式'}</Tag>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          <Input placeholder="分类标签" value={templateCategory} onChange={(e) => setTemplateCategory(e.target.value)} size="small" style={{ width: 120 }} />
          <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave} style={{ borderRadius: 6 }}>
            保存模版
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* ─── 主体三栏布局 ─── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#f5f5f5' }}>

          {/* 🟢 左栏：树组 / 组件库 */}
          <div style={{ width: 280, background: '#fff', borderRight: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column' }}>
            <Tabs
              activeKey={leftTab} onChange={setLeftTab}
              centered
              items={[
                { key: 'tree', label: <span><FolderOpenOutlined /> 表单结构</span> },
                { key: 'components', label: <span><AppstoreOutlined /> 组件库</span> }
              ]}
              style={{ padding: '0 16px' }}
            />

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
              {leftTab === 'tree' ? (
                <>
                  <Button type="dashed" block icon={<PlusOutlined />} onClick={addCategory} style={{ marginBottom: 16 }}>新建分类</Button>
                  {categories.map(cat => (
                    <div key={cat.id} style={{ marginBottom: 12 }}>
                      {/* 分类头 */}
                      <div style={{ display: 'flex', alignItems: 'center', padding: '6px 8px', background: '#fafbfc', borderRadius: 4 }}>
                        <FolderOpenOutlined style={{ color: '#faad14', marginRight: 8 }} />
                        <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{cat.name}</span>
                        <Space size={2}>
                          <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => addForm(cat.id)} title="添加表单" />
                          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => renameCategory(cat.id)} title="重命名" />
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => deleteCategory(cat.id)} title="删除" />
                        </Space>
                      </div>
                      {/* 表单列表 */}
                      <div style={{ paddingLeft: 12, marginTop: 4 }}>
                        {cat.forms.map(f => (
                          <div
                            key={f.id}
                            onClick={() => { setActiveFormId(f.id); setActiveFieldId(null); setRightTab('form'); setLeftTab('components'); }}
                            style={{
                              display: 'flex', alignItems: 'center', padding: '6px 8px', cursor: 'pointer', borderRadius: 4,
                              background: activeFormId === f.id ? '#e6f4ff' : 'transparent',
                              color: activeFormId === f.id ? '#1677ff' : '#595959',
                              transition: 'all 0.2s'
                            }}
                          >
                            <FileTextOutlined style={{ marginRight: 8 }} />
                            <span style={{ flex: 1, fontSize: 13 }}>{f.name}</span>
                            <Popconfirm title="确定删除表单？" onConfirm={(e) => { e.stopPropagation(); deleteForm(cat.id, f.id); }}>
                              <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()} />
                            </Popconfirm>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {FIELD_TYPES.map(typeConf => (
                    <DraggableComponent key={typeConf.value} typeConf={typeConf} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 🟡 中栏：画布容器 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', justifyContent: 'center' }}>
            {!activeForm ? (
              <Empty
                description="请在左侧选择或创建一个表单"
                style={{ marginTop: 100 }}
              />
            ) : (
              <div style={{ width: '100%', maxWidth: 700 }}>
                <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Title level={4} style={{ margin: 0, color: '#262626' }}>{activeForm.name}</Title>
                  <Tag color="cyan">{activeForm.row_type === 'single_row' ? '不可重复' : '可重复'}</Tag>
                </div>

                <div
                  id="canvas-droppable-area"
                  style={{
                    minHeight: 400,
                    padding: '16px',
                    background: '#fafafa',
                    border: '1px dashed #d9d9d9',
                    borderRadius: 8,
                  }}
                >
                  <SortableContext items={activeForm.fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                    {activeForm.fields.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#bfbfbf', padding: '60px 0' }}>
                        从左侧组件库拖拽组件到此处
                      </div>
                    ) : (
                      activeForm.fields.map((field) => (
                        <SortableCanvasField
                          key={field.id}
                          field={field}
                          isActive={field.id === activeFieldId}
                          onClick={() => { setActiveFieldId(field.id); setRightTab('field'); }}
                          onDelete={() => {
                            updateActiveForm({ fields: activeForm.fields.filter(f => f.id !== field.id) });
                            if (activeFieldId === field.id) setActiveFieldId(null);
                          }}
                        />
                      ))
                    )}
                  </SortableContext>
                </div>
              </div>
            )}
          </div>

          {/* 🔴 右栏：属性配置面板 */}
          <div style={{ width: 320, background: '#fff', borderLeft: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column' }}>
            <Tabs
              activeKey={rightTab} onChange={setRightTab}
              centered
              items={[
                { key: 'form', label: <span><SettingOutlined /> 表单属性</span>, disabled: !activeFormId },
                { key: 'field', label: <span><FormOutlined /> 字段属性</span>, disabled: !activeFieldId }
              ]}
              style={{ padding: '0 16px' }}
            />

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
              {rightTab === 'form' && activeForm && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <Text strong style={{ fontSize: 13 }}>表单名称</Text>
                    <Input value={activeForm.name} onChange={e => updateActiveForm({ name: e.target.value })} style={{ marginTop: 8 }} />
                  </div>
                  <div>
                    <Text strong style={{ fontSize: 13 }}>提取提示词 (Prompt)</Text>
                    <Input.TextArea rows={4} value={activeForm.prompt} onChange={e => updateActiveForm({ prompt: e.target.value })}
                      placeholder="指导 AI 如何从病历中提取整表数据" style={{ marginTop: 8 }} />
                  </div>
                  <div>
                    <Text strong style={{ fontSize: 13 }}>表单重复类型</Text>
                    <Select value={activeForm.row_type} onChange={v => updateActiveForm({ row_type: v })} style={{ width: '100%', marginTop: 8 }}
                      options={[{ value: 'single_row', label: '不可重复' }, { value: 'multi_row', label: '可重复' }]} />
                  </div>
                  <div>
                    <Text strong style={{ fontSize: 13 }}>冲突合并策略</Text>
                    <Select value={activeForm.conflict_strategy} onChange={v => updateActiveForm({ conflict_strategy: v })} style={{ width: '100%', marginTop: 8 }}
                      options={[{ value: 'fill_blank', label: '填空不覆盖' }, { value: 'latest_wins', label: '新值覆盖旧值' }, { value: 'manual', label: '抛出冲突人工处理' }]} />
                  </div>
                  {activeForm.row_type === 'multi_row' && (
                    <div>
                      <Text strong style={{ fontSize: 13 }}>锚点字段 (去重主键)</Text>
                      <Select mode="multiple" value={activeForm.anchor_fields} onChange={v => updateActiveForm({ anchor_fields: v })}
                        style={{ width: '100%', marginTop: 8 }} placeholder="选择用于判断是否为同一条记录的字段"
                        options={activeForm.fields.map(f => ({ value: f.name, label: f.name }))} />
                    </div>
                  )}
                </div>
              )}

              {rightTab === 'field' && activeField && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <Text strong style={{ fontSize: 13 }}>字段标题</Text>
                    <Input value={activeField.name} onChange={e => updateActiveField({ name: e.target.value })} style={{ marginTop: 8 }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text strong style={{ fontSize: 13 }}>是否必填</Text>
                    <Switch checked={activeField.required} onChange={v => updateActiveField({ required: v })} />
                  </div>

                  <div>
                    <Text strong style={{ fontSize: 13 }}>字段类型</Text>
                    <Select value={activeField.type} disabled style={{ width: '100%', marginTop: 8 }} />
                  </div>

                  <div>
                    <Text strong style={{ fontSize: 13 }}>字段提取指导 (Prompt)</Text>
                    <Input.TextArea rows={3} value={activeField.prompt} onChange={e => updateActiveField({ prompt: e.target.value })}
                      placeholder="指导 AI 提取此字段的规则" style={{ marginTop: 8 }} />
                  </div>

                  {/* 针对特定类型的扩展配置 */}
                  {(activeField.type === 'radio' || activeField.type === 'checkbox') && (
                    <div>
                      <Text strong style={{ fontSize: 13 }}>选项列表</Text>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                        {(activeField.options || []).map((opt, i) => (
                          <Input key={i} size="small" value={opt}
                            onChange={(e) => { const no = [...activeField.options]; no[i] = e.target.value; updateActiveField({ options: no }); }}
                            addonAfter={<DeleteOutlined style={{ color: '#ff4d4f', cursor: 'pointer' }} onClick={() => {
                              const no = [...activeField.options]; no.splice(i, 1); updateActiveField({ options: no });
                            }} />}
                          />
                        ))}
                        <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => updateActiveField({ options: [...(activeField.options || []), `选项${(activeField.options || []).length + 1}`] })}>添加选项</Button>
                      </div>
                    </div>
                  )}

                  {activeField.type === 'multirow' && (
                    <div>
                      <Text strong style={{ fontSize: 13 }}>多行子字段</Text>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                        {(activeField.sub_fields || []).map((sf, i) => (
                          <div key={i} style={{ display: 'flex', gap: 4 }}>
                            <Input size="small" value={sf.name} onChange={e => { const n = [...activeField.sub_fields]; n[i].name = e.target.value; updateActiveField({ sub_fields: n }); }} placeholder="子字段名" />
                            <Select size="small" value={sf.type || 'text'} onChange={v => { const n = [...activeField.sub_fields]; n[i].type = v; updateActiveField({ sub_fields: n }); }} style={{ width: 100 }}
                              options={[{ value: 'text', label: '文本' }, { value: 'number', label: '数字' }, { value: 'date', label: '日期' }]} />
                            <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={() => { const n = [...activeField.sub_fields]; n.splice(i, 1); updateActiveField({ sub_fields: n }); }} />
                          </div>
                        ))}
                        <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => updateActiveField({ sub_fields: [...(activeField.sub_fields || []), { name: '', type: 'text' }] })}>添加子字段</Button>
                      </div>
                    </div>
                  )}

                  {activeField.type === 'table' && (
                    <div>
                      <Text strong style={{ fontSize: 13 }}>表格列定义</Text>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                        {(activeField.table_columns || []).map((col, i) => (
                          <div key={i} style={{ display: 'flex', gap: 4 }}>
                            <Input size="small" value={col.name} onChange={e => { const n = [...activeField.table_columns]; n[i].name = e.target.value; updateActiveField({ table_columns: n }); }} placeholder="列名" />
                            <Select size="small" value={col.type || 'text'} onChange={v => { const n = [...activeField.table_columns]; n[i].type = v; updateActiveField({ table_columns: n }); }} style={{ width: 100 }}
                              options={[{ value: 'text', label: '文本' }, { value: 'number', label: '数字' }, { value: 'date', label: '日期' }]} />
                            <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={() => { const n = [...activeField.table_columns]; n.splice(i, 1); updateActiveField({ table_columns: n }); }} />
                          </div>
                        ))}
                        <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => updateActiveField({ table_columns: [...(activeField.table_columns || []), { name: '', type: 'text' }] })}>添加列</Button>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          </div>
        </div>

        {/* 拖拽浮层 (用于显示正在拖拽的组件/卡片) */}
        <DragOverlay dropAnimation={{ duration: 250, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
          {activeDragItem ? (
            activeDragItem.data.current?.isNewComponent ? (
              <div style={{
                padding: '8px 12px', background: '#fff', border: `1px solid ${TYPE_MAP[activeDragItem.data.current.type].color}`,
                color: TYPE_MAP[activeDragItem.data.current.type].color, borderRadius: 6, opacity: 0.9, boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
              }}>
                <span style={{ fontSize: 16, marginRight: 8 }}>{TYPE_MAP[activeDragItem.data.current.type].icon}</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{TYPE_MAP[activeDragItem.data.current.type].label}</span>
              </div>
            ) : activeDragItem.data.current?.isCanvasField ? (
              <Card size="small" style={{ borderRadius: 8, boxShadow: '0 12px 24px rgba(0,0,0,0.15)', opacity: 0.9 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HolderOutlined style={{ color: '#bfbfbf' }} />
                  <span style={{ fontWeight: 600 }}>{activeDragItem.data.current.field.name || '未命名字段'}</span>
                </div>
              </Card>
            ) : null
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default CrfDesigner;
