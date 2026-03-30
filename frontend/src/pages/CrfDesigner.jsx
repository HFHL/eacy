import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button, Input, Select, Card, Space, Tag, Typography, Tooltip, Popconfirm, Switch, Divider, message, Empty, Tabs,
  Radio, Checkbox, DatePicker, InputNumber, Table
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, SaveOutlined,
  FolderOutlined, FolderOpenOutlined, FormOutlined, FileTextOutlined, ArrowLeftOutlined,
  EditOutlined, HolderOutlined, AppstoreOutlined, SettingOutlined, BranchesOutlined
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
  { value: 'text',     label: '文本',   color: '#1677ff', bg: '#e6f4ff', icon: '📝' },
  { value: 'number',  label: '数字',   color: '#52c41a', bg: '#f6ffed', icon: '🔢' },
  { value: 'date',    label: '日期',   color: '#faad14', bg: '#fffbe6', icon: '📅' },
  { value: 'radio',   label: '单选',   color: '#eb2f96', bg: '#fff0f6', icon: '🔘' },
  { value: 'checkbox',label: '多选',   color: '#13c2c2', bg: '#e6fffb', icon: '☑️' },
  { value: 'multirow',label: '多行子表',color: '#fa8c16', bg: '#fff7e6', icon: '📋' },
  { value: 'table',   label: '表格',   color: '#722ed1', bg: '#f9f0ff', icon: '📊' },
];

const TYPE_MAP = Object.fromEntries(FIELD_TYPES.map(t => [t.value, t]));

let _uid = Date.now();
const nextId = (prefix) => `${prefix}_${++_uid}`;

/* ─── 左侧：可拖拽的组件库卡片（旧版 .component-item 风格）─── */
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
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: '#fff',
        border: '1px solid #d9d9d9',
        borderRadius: 4,
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        transition: 'border-color 0.2s, box-shadow 0.2s',
        userSelect: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = typeConf.color;
        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#d9d9d9';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      {/* 图标徽章 */}
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 24, height: 24,
        background: typeConf.bg,
        color: typeConf.color,
        borderRadius: 4,
        fontSize: 13, fontWeight: 600,
      }}>
        {typeConf.icon}
      </span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#262626' }}>{typeConf.label}</span>
    </div>
  );
};

/* ─── 中间：可排序字段卡片（旧版 .field-card-preview + .group-card 风格）─── */
const SortableCanvasField = ({ field, isActive, onClick, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
    data: { isCanvasField: true, field }
  });

  const [hovered, setHovered] = useState(false);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto',
  };
  const typeConf = TYPE_MAP[field.type] || { label: field.type, color: '#999', bg: '#f5f5f5', icon: '❓' };

  const renderFieldPreview = () => {
    switch (field.type) {
      case 'text':
        if (field['x-component-props']?.rows) return <Input.TextArea placeholder="多行文本输入预览" rows={2} disabled />;
        return <Input placeholder="文本输入预览" disabled />;
      case 'number':
        return <InputNumber placeholder="数字" style={{ width: '100%' }} disabled />;
      case 'date':
        return <DatePicker style={{ width: '100%' }} disabled />;
      case 'radio':
        const rOpts = field.options?.length > 0 ? field.options : ['选项1', '选项2'];
        return <Radio.Group options={rOpts} disabled />;
      case 'checkbox':
        const cOpts = field.options?.length > 0 ? field.options : ['选项A', '选项B'];
        return <Checkbox.Group options={cOpts} disabled />;
      case 'multirow':
        const subFields = field.sub_fields || [];
        return (
          <div style={{ border: '1px dashed #d9d9d9', borderRadius: 6, padding: 12, background: '#fcfcfc' }}>
            <div style={{ marginBottom: 10, fontWeight: 500, color: '#595959', fontSize: 12 }}>一组数据 (多行子表预览)</div>
            {subFields.length > 0 ? subFields.map((sf, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ width: 90, textAlign: 'right', paddingRight: 10, fontSize: 12, color: '#595959', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {sf.name || `子字段${idx + 1}`}
                </div>
                <div style={{ flex: 1 }}><Input size="small" placeholder="..." disabled /></div>
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
        displayColumns.forEach(c => { mockData[c.dataIndex] = '—'; });
        return (
          <div style={{ overflowX: 'auto' }}>
            <Table size="small" columns={displayColumns} dataSource={[mockData]} pagination={false} />
          </div>
        );
      default:
        return <Input placeholder="输入预览" disabled />;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        background: '#fff',
        marginBottom: 12,
        cursor: 'pointer',
        borderRadius: 8,
        border: isActive ? `2px solid #1890ff` : `1px solid ${hovered ? '#e0e0e0' : '#f0f0f0'}`,
        borderLeft: `4px solid ${typeConf.color}`,
        boxShadow: isDragging
          ? '0 8px 24px rgba(0,0,0,0.12)'
          : hovered
          ? '0 4px 12px rgba(0,0,0,0.10)'
          : '0 1px 3px rgba(0,0,0,0.06)',
        background: isActive ? '#f0f7ff' : '#fff',
        transition: 'all 0.18s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
        onClick={onClick}
      >
        {/* 卡片头 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px 10px',
          borderBottom: `1px solid ${hovered || isActive ? '#f0f0f0' : 'transparent'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            {/* 拖拽把手 */}
            <span
              {...listeners}
              style={{ cursor: 'grab', color: '#c0c0c0', fontSize: 15, flexShrink: 0 }}
              title="拖拽排序"
            >
              <HolderOutlined />
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 10,
              background: typeConf.bg, color: typeConf.color, flexShrink: 0,
            }}>
              {typeConf.icon} {typeConf.label}
            </span>
            <span style={{ fontWeight: 600, fontSize: 14, color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {field.name || '未命名字段'}
              {field.required && <span style={{ color: '#ff4d4f', marginLeft: 4, fontSize: 13 }}>*</span>}
            </span>
          </div>
          <Popconfirm
            title="确认删除该字段？"
            onConfirm={e => { e?.stopPropagation(); onDelete(); }}
            okText="删除" cancelText="取消"
          >
            <Button
              type="text" danger size="small"
              icon={<DeleteOutlined />}
              style={{ opacity: hovered ? 1 : 0, transition: 'opacity 0.2s', flexShrink: 0 }}
              onClick={e => e.stopPropagation()}
            />
          </Popconfirm>
        </div>

        {/* 提示词 */}
        {field.prompt && (
          <div style={{ padding: '6px 16px 0', fontSize: 11, color: '#8c8c8c' }}>
            <span style={{ background: '#f5f5f5', padding: '2px 8px', borderRadius: 4, display: 'inline-block' }}>
              提示词：{field.prompt}
            </span>
          </div>
        )}

        {/* 字段预览 */}
        <div style={{ padding: '10px 16px 14px', pointerEvents: 'none' }}>
          {renderFieldPreview()}
        </div>
      </div>
    </div>
  );
};

/* ─── 分组标签（右侧配置面板 section 分割）─── */
const ConfigSection = ({ title, children }) => (
  <div style={{ marginBottom: 20 }}>
    <div style={{
      fontSize: 12, fontWeight: 600, color: '#8c8c8c',
      textTransform: 'uppercase', letterSpacing: '0.05em',
      marginBottom: 10, paddingBottom: 6,
      borderBottom: '1px solid #f0f0f0',
    }}>
      {title}
    </div>
    {children}
  </div>
);

/* ─── 配置行 ─── */
const ConfigRow = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 12.5, fontWeight: 500, color: '#595959', marginBottom: 6 }}>{label}</div>
    {children}
  </div>
);

/* ─── 左侧：可排序表单卡片 ─── */
const SortableForm = ({ form, categoryId, isActive, onClick, onDelete }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: form.id,
    data: { isForm: true, form, categoryId }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      style={{
        ...style,
        display: 'flex', alignItems: 'center',
        padding: '5px 8px', borderRadius: 4, cursor: 'pointer',
        background: isActive ? '#e6f4ff' : 'transparent',
        color: isActive ? '#1677ff' : '#595959',
        borderLeft: isActive ? '3px solid #1677ff' : '3px solid transparent',
        transition: 'all 0.15s',
        marginTop: 2
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f5f5f5'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      <span {...listeners} {...attributes} style={{ cursor: 'grab', marginRight: 6, color: '#bfbfbf', flexShrink: 0, display: 'flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
         <HolderOutlined />
      </span>
      <FileTextOutlined style={{ marginRight: 6, fontSize: 12 }} />
      <span style={{ flex: 1, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {form.name}
      </span>
      <Popconfirm title="删除表单？" onConfirm={(e) => { e?.stopPropagation(); onDelete(); }} okText="删除" cancelText="取消">
        <Button
          type="text" size="small" danger icon={<DeleteOutlined />} onClick={e => e.stopPropagation()}
          style={{ opacity: 0.5, fontSize: 10, padding: '0 2px' }}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0.5}
        />
      </Popconfirm>
    </div>
  );
};

/* ─── 左侧：可排序分类卡片 ─── */
const SortableCategory = ({ category, isExpanded, onToggleExpand, activeFormId, onSelectForm, onDeleteForm, onAddForm, onRename, onDeleteCategory }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: category.id,
    data: { isCategory: true, category }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div ref={setNodeRef} style={{ ...style, marginBottom: 6 }}>
      {/* 分类行 */}
      <div
        style={{
          display: 'flex', alignItems: 'center',
          padding: '5px 8px', background: '#f0f0f0',
          borderRadius: 4, cursor: 'pointer',
        }}
        onClick={onToggleExpand}
      >
        <span {...listeners} {...attributes} style={{ cursor: 'grab', marginRight: 6, color: '#bfbfbf', flexShrink: 0, display: 'flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
          <HolderOutlined />
        </span>
        <FolderOpenOutlined style={{ color: '#faad14', marginRight: 6, fontSize: 13 }} />
        <span style={{ flex: 1, fontWeight: 600, fontSize: 12.5, color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {category.name}
        </span>
        <Space size={2} onClick={e => e.stopPropagation()}>
          <Tooltip title="添加表单">
            <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => onAddForm(category.id)} style={{ fontSize: 11 }} />
          </Tooltip>
          <Tooltip title="重命名">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onRename(category.id)} style={{ fontSize: 11 }} />
          </Tooltip>
          <Tooltip title="删除分类">
            <Popconfirm title="确认删除整个分类？" onConfirm={() => onDeleteCategory(category.id)} okText="删除" cancelText="取消">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ fontSize: 11 }} />
            </Popconfirm>
          </Tooltip>
        </Space>
      </div>

      {/* 表单列表 */}
      {isExpanded && (
        <div style={{ paddingLeft: 10, marginTop: 2 }}>
          <SortableContext items={category.forms.map(f => f.id)} strategy={verticalListSortingStrategy}>
            {category.forms.map(f => (
              <SortableForm 
                 key={f.id} form={f} categoryId={category.id} 
                 isActive={activeFormId === f.id} 
                 onClick={() => onSelectForm(f.id, category.id)}
                 onDelete={() => onDeleteForm(category.id, f.id)} 
              />
            ))}
          </SortableContext>
          {category.forms.length === 0 && (
            <div style={{ color: '#bfbfbf', fontSize: 12, padding: '4px 8px' }}>暂无表单，点击上方 + 新建</div>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── 主界面 ─── */
const CrfDesigner = () => {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const isEditMode = !!templateId;

  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [templateCategory, setTemplateCategory] = useState('');
  const [categories, setCategories] = useState([]);

  const [activeFormId, setActiveFormId] = useState(null);
  const [activeFieldId, setActiveFieldId] = useState(null);

  const [leftTab, setLeftTab] = useState('tree');
  const [rightTab, setRightTab] = useState('form');

  const [activeDragItem, setActiveDragItem] = useState(null);
  const [saving, setSaving] = useState(false);
  const [, setLoading] = useState(isEditMode);

  // 树节点展开状态
  const [expandedCats, setExpandedCats] = useState({});

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
          if (tpl.schema_json?.categories) {
            const loaded = tpl.schema_json.categories.map(cat => ({
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
            setCategories(loaded);
            // 默认展开所有分类
            const expanded = {};
            loaded.forEach(c => { expanded[c.id] = true; });
            setExpandedCats(expanded);
            if (loaded.length > 0 && loaded[0].forms.length > 0) {
              setActiveFormId(loaded[0].forms[0].id);
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
    updateActiveForm({ fields: form.fields.map(f => f.id === activeFieldId ? { ...f, ...updates } : f) });
  };

  const activeForm = getActiveForm();
  const activeField = activeForm?.fields.find(f => f.id === activeFieldId);

  // ─── 树操作 ───
  const addCategory = () => {
    const name = prompt('分类名称');
    if (!name) return;
    const cat = { id: nextId('cat'), name, forms: [] };
    setCategories(prev => [...prev, cat]);
    setExpandedCats(prev => ({ ...prev, [cat.id]: true }));
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
    setExpandedCats(prev => ({ ...prev, [catId]: true }));
  };
  const deleteForm = (catId, formId) => {
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, forms: c.forms.filter(f => f.id !== formId) } : c));
    if (activeFormId === formId) { setActiveFormId(null); setActiveFieldId(null); setRightTab('form'); }
  };

  // ─── 拖拽 ───
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = (event) => setActiveDragItem(event.active);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveDragItem(null);
    if (!over) return;

    if (active.data.current?.isCategory && over.data.current?.isCategory) {
      if (active.id !== over.id) {
        setCategories(prev => {
          const oldIndex = prev.findIndex(c => c.id === active.id);
          const newIndex = prev.findIndex(c => c.id === over.id);
          return arrayMove(prev, oldIndex, newIndex);
        });
      }
      return;
    }

    if (active.data.current?.isForm && over.data.current?.isForm) {
      if (active.id !== over.id) {
        const activeCatId = active.data.current.categoryId;
        const overCatId = over.data.current.categoryId;
        if (activeCatId === overCatId) {
          setCategories(prev => prev.map(c => {
            if (c.id === activeCatId) {
              const oldIndex = c.forms.findIndex(f => f.id === active.id);
              const newIndex = c.forms.findIndex(f => f.id === over.id);
              return { ...c, forms: arrayMove(c.forms, oldIndex, newIndex) };
            }
            return c;
          }));
        } else {
          // move across categories
          let draggedForm = null;
          setCategories(prev => {
            const newCats = [...prev];
            const sourceCatIdx = newCats.findIndex(c => c.id === activeCatId);
            if (sourceCatIdx === -1) return prev;
            const formIdx = newCats[sourceCatIdx].forms.findIndex(f => f.id === active.id);
            if (formIdx === -1) return prev;
            
            draggedForm = newCats[sourceCatIdx].forms[formIdx];
            newCats[sourceCatIdx] = { ...newCats[sourceCatIdx], forms: newCats[sourceCatIdx].forms.filter(f => f.id !== active.id) };

            const targetCatIdx = newCats.findIndex(c => c.id === overCatId);
            if (targetCatIdx === -1) return newCats;
            
            const targetFormIdx = newCats[targetCatIdx].forms.findIndex(f => f.id === over.id);
            const newForms = [...newCats[targetCatIdx].forms];
            newForms.splice(targetFormIdx >= 0 ? targetFormIdx : newForms.length, 0, draggedForm);
            newCats[targetCatIdx] = { ...newCats[targetCatIdx], forms: newForms };
            return newCats;
          });
        }
      }
      return;
    }

    if (!activeForm) return;

    if (active.data.current?.isNewComponent) {
      const type = active.data.current.type;
      const newField = {
        id: nextId('field'), name: `新建${TYPE_MAP[type].label}字段`, type, required: false,
        prompt: '', options: [], sub_fields: [], table_columns: []
      };
      let newFields = [...activeForm.fields];
      if (over.id === 'canvas-droppable-area') {
        newFields.push(newField);
      } else if (over.data.current?.isCanvasField) {
        const overIndex = activeForm.fields.findIndex(f => f.id === over.id);
        newFields.splice(overIndex >= 0 ? overIndex : newFields.length, 0, newField);
      }
      updateActiveForm({ fields: newFields });
      setActiveFieldId(newField.id);
      setRightTab('field');
      return;
    }

    if (active.data.current?.isCanvasField && over.data.current?.isCanvasField) {
      if (active.id !== over.id) {
        const oldIdx = activeForm.fields.findIndex(f => f.id === active.id);
        const newIdx = activeForm.fields.findIndex(f => f.id === over.id);
        if (oldIdx >= 0 && newIdx >= 0) {
          updateActiveForm({ fields: arrayMove(activeForm.fields, oldIdx, newIdx) });
        }
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
          template_name: templateName, description: templateDesc, category: templateCategory, schema_json: schemaJson,
        });
        if (res?.success) message.success('模版已更新');
      } else {
        const res = await api.post('/crf-templates/', {
          template_name: templateName, description: templateDesc, category: templateCategory, schema_json: schemaJson,
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
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: '#f5f6fa' }}>

      {/* ─── 顶部工具栏（仿旧版 DesignerPageFrame Card）─── */}
      <div style={{
        padding: '10px 20px',
        borderBottom: '1px solid #e8e8e8',
        background: '#fff',
        display: 'flex', alignItems: 'center', gap: 12,
        flexShrink: 0,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/projects')} style={{ borderRadius: 6 }}>
          返回CRF模版
        </Button>
        <Divider type="vertical" style={{ height: 20 }} />
        <Input
          value={templateName}
          onChange={e => setTemplateName(e.target.value)}
          placeholder="未命名 CRF 模版"
          variant="borderless"
          style={{ fontSize: 16, fontWeight: 600, maxWidth: 280, padding: 0, color: '#1f1f1f' }}
        />
        <Tag color={isEditMode ? 'blue' : 'green'} style={{ borderRadius: 12, fontWeight: 500 }}>
          {isEditMode ? '编辑模式' : '新建模式'}
        </Tag>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <Input
            placeholder="分类标签"
            value={templateCategory}
            onChange={e => setTemplateCategory(e.target.value)}
            size="small"
            style={{ width: 120, borderRadius: 6 }}
            prefix={<BranchesOutlined style={{ color: '#bfbfbf' }} />}
          />
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saving}
            onClick={handleSave}
            style={{ borderRadius: 6 }}
          >
            保存模版
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* ─── 主体三栏布局 ─── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* 🟢 左栏：结构树 / 组件库（旧版 left-panel + left-panel-tabs 样式）*/}
          <div style={{
            width: 260,
            background: '#fafafa',
            borderRight: '1px solid #e8e8e8',
            display: 'flex', flexDirection: 'column',
            flexShrink: 0,
          }}>
            {/* 标签切换 */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid #e8e8e8',
              background: '#f5f5f5',
              padding: '0 8px',
              flexShrink: 0,
            }}>
              {[
                { key: 'tree', label: '表单结构', icon: <FolderOpenOutlined /> },
                { key: 'components', label: '组件库', icon: <AppstoreOutlined /> },
              ].map(tab => (
                <div
                  key={tab.key}
                  onClick={() => setLeftTab(tab.key)}
                  style={{
                    flex: 1, padding: '10px 8px', textAlign: 'center',
                    fontSize: 12.5, fontWeight: leftTab === tab.key ? 600 : 400,
                    color: leftTab === tab.key ? '#1677ff' : '#595959',
                    borderBottom: leftTab === tab.key ? '2px solid #1677ff' : '2px solid transparent',
                    cursor: 'pointer', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}
                >
                  {tab.icon} {tab.label}
                </div>
              ))}
            </div>

            {/* 内容区 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
              {leftTab === 'tree' ? (
                <>
                  <Button
                    type="dashed" block icon={<PlusOutlined />}
                    onClick={addCategory}
                    style={{ marginBottom: 12, borderRadius: 6, fontSize: 12.5 }}
                  >
                    新建分类
                  </Button>

                  {categories.length === 0 && (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无分类" style={{ padding: '24px 0' }} />
                  )}

                  <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                    {categories.map(cat => (
                      <SortableCategory
                        key={cat.id}
                        category={cat}
                        isExpanded={expandedCats[cat.id] !== false}
                        onToggleExpand={() => setExpandedCats(prev => ({ ...prev, [cat.id]: !(expandedCats[cat.id] !== false) }))}
                        activeFormId={activeFormId}
                        onSelectForm={(fId, catId) => {
                          setActiveFormId(fId);
                          setActiveFieldId(null);
                          setRightTab('form');
                          setLeftTab('components');
                        }}
                        onDeleteForm={(catId, fId) => deleteForm(catId, fId)}
                        onAddForm={addForm}
                        onRename={renameCategory}
                        onDeleteCategory={deleteCategory}
                      />
                    ))}
                  </SortableContext>
                </>
              ) : (
                /* 组件库 */
                <div>
                  <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    字段类型（拖拽到画布）
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {FIELD_TYPES.map(typeConf => (
                      <DraggableComponent key={typeConf.value} typeConf={typeConf} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 🟡 中栏：画布容器（旧版 .design-canvas + .group-card 风格）*/}
          <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#f5f6fa' }}>
            {!activeForm ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
                <Empty
                  description={
                    <span style={{ color: '#8c8c8c' }}>
                      请在左侧选择或创建一个表单，<br />然后从组件库拖拽字段到画布
                    </span>
                  }
                />
              </div>
            ) : (
              <div style={{ maxWidth: 760, margin: '0 auto' }}>
                {/* 表单头卡片（旧版 .group-card .group-header 风格）*/}
                <div style={{
                  background: '#fff',
                  borderRadius: 8,
                  marginBottom: 16,
                  overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '14px 20px',
                    borderBottom: '2px solid #1890ff',
                    background: 'linear-gradient(to right, #f0f7ff, #fff)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <FormOutlined style={{ color: '#1890ff', fontSize: 18 }} />
                      <span style={{ fontSize: 16, fontWeight: 600, color: '#262626' }}>{activeForm.name}</span>
                      <Tag color={activeForm.row_type === 'multi_row' ? 'orange' : 'blue'} style={{ borderRadius: 10, fontSize: 11 }}>
                        {activeForm.row_type === 'multi_row' ? '可重复' : '不可重复'}
                      </Tag>
                    </div>
                    <span style={{ fontSize: 12, color: '#8c8c8c' }}>
                      {activeForm.fields.length} 个字段
                    </span>
                  </div>
                </div>

                {/* 字段画布 */}
                <div
                  id="canvas-droppable-area"
                  style={{
                    minHeight: 300,
                    padding: 16,
                    background: '#fff',
                    border: '1px dashed #d9d9d9',
                    borderRadius: 8,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  }}
                >
                  <SortableContext items={activeForm.fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
                    {activeForm.fields.length === 0 ? (
                      <div style={{
                        textAlign: 'center', color: '#bfbfbf', padding: '60px 0', fontSize: 14,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
                      }}>
                        <AppstoreOutlined style={{ fontSize: 40, opacity: 0.3 }} />
                        <span>从左侧组件库拖拽字段到此处</span>
                      </div>
                    ) : (
                      activeForm.fields.map(field => (
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
          <div style={{
            width: 300,
            background: '#fafafa',
            borderLeft: '1px solid #e8e8e8',
            display: 'flex', flexDirection: 'column',
            flexShrink: 0,
          }}>
            {/* 标签切换 */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid #e8e8e8',
              background: '#f5f5f5',
              padding: '0 8px',
              flexShrink: 0,
            }}>
              {[
                { key: 'form', label: '表单属性', icon: <SettingOutlined />, disabled: !activeFormId },
                { key: 'field', label: '字段属性', icon: <FormOutlined />, disabled: !activeFieldId },
              ].map(tab => (
                <div
                  key={tab.key}
                  onClick={() => !tab.disabled && setRightTab(tab.key)}
                  style={{
                    flex: 1, padding: '10px 8px', textAlign: 'center',
                    fontSize: 12.5, fontWeight: rightTab === tab.key ? 600 : 400,
                    color: tab.disabled ? '#c0c0c0' : rightTab === tab.key ? '#1677ff' : '#595959',
                    borderBottom: rightTab === tab.key ? '2px solid #1677ff' : '2px solid transparent',
                    cursor: tab.disabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  }}
                >
                  {tab.icon} {tab.label}
                </div>
              ))}
            </div>

            {/* 配置内容区 */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 20px' }}>
              {/* 表单属性 */}
              {rightTab === 'form' && activeForm ? (
                <>
                  <ConfigSection title="基础信息">
                    <ConfigRow label="表单名称">
                      <Input value={activeForm.name} onChange={e => updateActiveForm({ name: e.target.value })} size="small" style={{ borderRadius: 6 }} />
                    </ConfigRow>
                    <ConfigRow label="提取提示词 (Prompt)">
                      <Input.TextArea
                        rows={4} value={activeForm.prompt}
                        onChange={e => updateActiveForm({ prompt: e.target.value })}
                        placeholder="指导 AI 如何从病历中提取整表数据"
                        size="small"
                        style={{ borderRadius: 6, fontSize: 12.5 }}
                      />
                    </ConfigRow>
                  </ConfigSection>

                  <ConfigSection title="行为配置">
                    <ConfigRow label="表单重复类型">
                      <Select
                        value={activeForm.row_type}
                        onChange={v => updateActiveForm({ row_type: v })}
                        style={{ width: '100%' }} size="small"
                        options={[{ value: 'single_row', label: '不可重复' }, { value: 'multi_row', label: '可重复' }]}
                      />
                    </ConfigRow>
                    <ConfigRow label="冲突合并策略">
                      <Select
                        value={activeForm.conflict_strategy}
                        onChange={v => updateActiveForm({ conflict_strategy: v })}
                        style={{ width: '100%' }} size="small"
                        options={[
                          { value: 'fill_blank', label: '填空不覆盖' },
                          { value: 'latest_wins', label: '新值覆盖旧值' },
                          { value: 'manual', label: '人工处理冲突' }
                        ]}
                      />
                    </ConfigRow>
                    {activeForm.row_type === 'multi_row' && (
                      <ConfigRow label="锚点字段 (去重主键)">
                        <Select
                          mode="multiple" value={activeForm.anchor_fields}
                          onChange={v => updateActiveForm({ anchor_fields: v })}
                          style={{ width: '100%' }} size="small"
                          placeholder="选择用于判断是否为同一记录的字段"
                          options={activeForm.fields.map(f => ({ value: f.name, label: f.name }))}
                        />
                      </ConfigRow>
                    )}
                  </ConfigSection>
                </>
              ) : rightTab === 'form' && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#bfbfbf', fontSize: 13 }}>
                  <SettingOutlined style={{ fontSize: 32, marginBottom: 12, display: 'block' }} />
                  请先选择一个表单
                </div>
              )}

              {/* 字段属性 */}
              {rightTab === 'field' && activeField ? (
                <>
                  <ConfigSection title="字段信息">
                    <ConfigRow label="字段标题">
                      <Input value={activeField.name} onChange={e => updateActiveField({ name: e.target.value })} size="small" style={{ borderRadius: 6 }} />
                    </ConfigRow>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: '#595959' }}>是否必填</span>
                      <Switch checked={activeField.required} onChange={v => updateActiveField({ required: v })} size="small" />
                    </div>
                    <ConfigRow label="字段类型">
                      <Select
                        value={activeField.type} disabled
                        style={{ width: '100%' }} size="small"
                      />
                    </ConfigRow>
                  </ConfigSection>

                  <ConfigSection title="提取配置">
                    <ConfigRow label="字段提取指导 (Prompt)">
                      <Input.TextArea
                        rows={3} value={activeField.prompt}
                        onChange={e => updateActiveField({ prompt: e.target.value })}
                        placeholder="指导 AI 提取此字段的规则"
                        size="small" style={{ borderRadius: 6, fontSize: 12.5 }}
                      />
                    </ConfigRow>
                  </ConfigSection>

                  {/* 类型专属配置 */}
                  {(activeField.type === 'radio' || activeField.type === 'checkbox') && (
                    <ConfigSection title="选项配置">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(activeField.options || []).map((opt, i) => (
                          <Input
                            key={i} size="small" value={opt}
                            onChange={e => { const no = [...activeField.options]; no[i] = e.target.value; updateActiveField({ options: no }); }}
                            style={{ borderRadius: 6 }}
                            suffix={
                              <DeleteOutlined
                                style={{ color: '#ff4d4f', cursor: 'pointer', fontSize: 11 }}
                                onClick={() => { const no = [...activeField.options]; no.splice(i, 1); updateActiveField({ options: no }); }}
                              />
                            }
                          />
                        ))}
                        <Button type="dashed" size="small" icon={<PlusOutlined />} style={{ borderRadius: 6 }}
                          onClick={() => updateActiveField({ options: [...(activeField.options || []), `选项${(activeField.options || []).length + 1}`] })}>
                          添加选项
                        </Button>
                      </div>
                    </ConfigSection>
                  )}

                  {activeField.type === 'multirow' && (
                    <ConfigSection title="多行子字段">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(activeField.sub_fields || []).map((sf, i) => (
                          <div key={i} style={{ display: 'flex', gap: 4 }}>
                            <Input size="small" value={sf.name} style={{ borderRadius: 6 }}
                              onChange={e => { const n = [...activeField.sub_fields]; n[i].name = e.target.value; updateActiveField({ sub_fields: n }); }}
                              placeholder="子字段名" />
                            <Select size="small" value={sf.type || 'text'} style={{ width: 80 }}
                              onChange={v => { const n = [...activeField.sub_fields]; n[i].type = v; updateActiveField({ sub_fields: n }); }}
                              options={[{ value: 'text', label: '文本' }, { value: 'number', label: '数字' }, { value: 'date', label: '日期' }]} />
                            <Button size="small" danger type="text" icon={<DeleteOutlined />}
                              onClick={() => { const n = [...activeField.sub_fields]; n.splice(i, 1); updateActiveField({ sub_fields: n }); }} />
                          </div>
                        ))}
                        <Button type="dashed" size="small" icon={<PlusOutlined />} style={{ borderRadius: 6 }}
                          onClick={() => updateActiveField({ sub_fields: [...(activeField.sub_fields || []), { name: '', type: 'text' }] })}>
                          添加子字段
                        </Button>
                      </div>
                    </ConfigSection>
                  )}

                  {activeField.type === 'table' && (
                    <ConfigSection title="表格列定义">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(activeField.table_columns || []).map((col, i) => (
                          <div key={i} style={{ display: 'flex', gap: 4 }}>
                            <Input size="small" value={col.name} style={{ borderRadius: 6 }}
                              onChange={e => { const n = [...activeField.table_columns]; n[i].name = e.target.value; updateActiveField({ table_columns: n }); }}
                              placeholder="列名" />
                            <Select size="small" value={col.type || 'text'} style={{ width: 80 }}
                              onChange={v => { const n = [...activeField.table_columns]; n[i].type = v; updateActiveField({ table_columns: n }); }}
                              options={[{ value: 'text', label: '文本' }, { value: 'number', label: '数字' }, { value: 'date', label: '日期' }]} />
                            <Button size="small" danger type="text" icon={<DeleteOutlined />}
                              onClick={() => { const n = [...activeField.table_columns]; n.splice(i, 1); updateActiveField({ table_columns: n }); }} />
                          </div>
                        ))}
                        <Button type="dashed" size="small" icon={<PlusOutlined />} style={{ borderRadius: 6 }}
                          onClick={() => updateActiveField({ table_columns: [...(activeField.table_columns || []), { name: '', type: 'text' }] })}>
                          添加列
                        </Button>
                      </div>
                    </ConfigSection>
                  )}
                </>
              ) : rightTab === 'field' && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#bfbfbf', fontSize: 13 }}>
                  <FormOutlined style={{ fontSize: 32, marginBottom: 12, display: 'block' }} />
                  点击画布中的字段查看属性
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 拖拽浮层 */}
        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
          {activeDragItem ? (
            activeDragItem.data.current?.isNewComponent ? (
              <div style={{
                padding: '8px 14px', background: '#fff',
                border: `1.5px solid ${TYPE_MAP[activeDragItem.data.current.type]?.color || '#1677ff'}`,
                color: TYPE_MAP[activeDragItem.data.current.type]?.color, borderRadius: 6,
                opacity: 0.92, boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 500,
              }}>
                <span style={{ fontSize: 16 }}>{TYPE_MAP[activeDragItem.data.current.type]?.icon}</span>
                {TYPE_MAP[activeDragItem.data.current.type]?.label}
              </div>
            ) : activeDragItem.data.current?.isCanvasField ? (
              <div style={{
                padding: '10px 16px', background: '#fff', borderRadius: 8,
                boxShadow: '0 12px 28px rgba(0,0,0,0.18)', opacity: 0.9,
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <HolderOutlined style={{ color: '#bfbfbf' }} />
                <span style={{ fontWeight: 600 }}>{activeDragItem.data.current.field.name || '未命名字段'}</span>
              </div>
            ) : activeDragItem.data.current?.isCategory ? (
              <div style={{
                padding: '5px 8px', background: '#f0f0f0', borderRadius: 4, 
                display: 'flex', alignItems: 'center', opacity: 0.9, boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}>
                <FolderOpenOutlined style={{ color: '#faad14', marginRight: 6, fontSize: 13 }} />
                <span style={{ fontWeight: 600, fontSize: 12.5, color: '#262626' }}>{activeDragItem.data.current.category.name}</span>
              </div>
            ) : activeDragItem.data.current?.isForm ? (
              <div style={{
                padding: '5px 8px', background: '#fff', borderRadius: 4, 
                display: 'flex', alignItems: 'center', opacity: 0.9, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                borderLeft: '3px solid #1677ff', color: '#1677ff'
              }}>
                <FileTextOutlined style={{ marginRight: 6, fontSize: 12 }} />
                <span style={{ fontSize: 12.5 }}>{activeDragItem.data.current.form.name}</span>
              </div>
            ) : null
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default CrfDesigner;
