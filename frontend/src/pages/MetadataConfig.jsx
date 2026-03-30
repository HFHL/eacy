import React, { useState, useEffect } from 'react';
import {
  Table, Button, Modal, Form, Input, Select, Switch, InputNumber,
  Space, Tag, message, Popconfirm, Typography, Tabs, Card, Collapse, Spin, Alert
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, EyeOutlined
} from '@ant-design/icons';
import {
  getMetadataFields, createMetadataField, updateMetadataField, deleteMetadataField,
  getDocTypeCategories, createDocTypeCategory, updateDocTypeCategory, deleteDocTypeCategory,
  createSubtype, updateSubtype, deleteSubtype
} from '../api/document';
import api from '../api/document';

const { Text } = Typography;
const { TextArea } = Input;

// ─── 元数据字段管理 ────────────────────────────────────
const FieldsManager = () => {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();

  const fetchFields = async () => {
    setLoading(true);
    try {
      const res = await getMetadataFields();
      setFields(res.data || []);
    } catch (e) {
      message.error('获取字段配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFields(); }, []);

  const handleAdd = () => { setEditingRecord(null); form.resetFields(); setModalOpen(true); };
  const handleEdit = (record) => {
    setEditingRecord(record);
    form.setFieldsValue({ ...record, enum_values: record.enum_values ? record.enum_values.join('\n') : '' });
    setModalOpen(true);
  };
  const handleDelete = async (id) => {
    try { await deleteMetadataField(id); message.success('已删除'); fetchFields(); } catch (e) { message.error('删除失败'); }
  };
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (values.enum_values && typeof values.enum_values === 'string') {
        values.enum_values = values.enum_values.split('\n').map(s => s.trim()).filter(Boolean);
      } else { values.enum_values = null; }
      if (editingRecord) { await updateMetadataField(editingRecord.id, values); message.success('已更新'); }
      else { await createMetadataField(values); message.success('已创建'); }
      setModalOpen(false); fetchFields();
    } catch (e) { if (e.errorFields) return; message.error('操作失败'); }
  };

  const columns = [
    { title: '排序', dataIndex: 'sort_order', width: 60, render: v => <Text type="secondary">{v}</Text> },
    { title: '字段名', dataIndex: 'field_name', width: 120, render: v => <Text strong>{v}</Text> },
    { title: '键名', dataIndex: 'field_key', width: 130, render: v => <code style={{ fontSize: 12, color: '#8c8c8c' }}>{v}</code> },
    { title: '类型', dataIndex: 'field_type', width: 90, render: v => <Tag>{v}</Tag> },
    { title: '必填', dataIndex: 'required', width: 60, render: v => v ? <Tag color="error">必填</Tag> : <Text type="secondary">否</Text> },
    { title: '枚举值', dataIndex: 'enum_values', width: 200, ellipsis: true, render: v => v ? v.map((e, i) => <Tag key={i} style={{ marginBottom: 2 }}>{e}</Tag>) : '—' },
    { title: '说明', dataIndex: 'description', ellipsis: true, render: v => <Text type="secondary" style={{ fontSize: 12 }}>{v || '—'}</Text> },
    { title: '启用', dataIndex: 'is_active', width: 60, render: v => v ? <Tag color="success">是</Tag> : <Tag>否</Tag> },
    { title: '操作', width: 100, fixed: 'right', render: (_, record) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text strong style={{ fontSize: 15 }}>元数据字段定义</Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchFields}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>新增字段</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={fields} rowKey="id" loading={loading} size="small" bordered pagination={false} scroll={{ x: 1000 }} />
      <Modal title={editingRecord ? '编辑字段' : '新增字段'} open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleSubmit} width={560} destroyOnHidden>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="field_name" label="字段名（中文）" rules={[{ required: true }]}><Input placeholder="如：患者姓名" /></Form.Item>
          <Form.Item name="field_key" label="英文键名" rules={[{ required: true }]}><Input placeholder="如：patient_name" /></Form.Item>
          <Space size={16} style={{ display: 'flex' }}>
            <Form.Item name="field_type" label="字段类型" initialValue="string" rules={[{ required: true }]}>
              <Select style={{ width: 140 }} options={[{ value: 'string', label: 'string' }, { value: 'integer', label: 'integer' }, { value: 'array', label: 'array' }, { value: 'object', label: 'object' }]} />
            </Form.Item>
            <Form.Item name="required" label="是否必填" valuePropName="checked" initialValue={false}><Switch /></Form.Item>
            <Form.Item name="is_active" label="是否启用" valuePropName="checked" initialValue={true}><Switch /></Form.Item>
            <Form.Item name="sort_order" label="排序" initialValue={0}><InputNumber min={0} style={{ width: 80 }} /></Form.Item>
          </Space>
          <Form.Item name="enum_values" label="枚举值（每行一个，留空表示无枚举）"><TextArea rows={3} placeholder={"男\n女\n不详"} /></Form.Item>
          <Form.Item name="description" label="字段说明 / LLM 提示词"><TextArea rows={3} placeholder="对该字段的说明，会作为 LLM prompt 的一部分" /></Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// ─── 文档类型管理 ─────────────────────────────────────
const DocTypesManager = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [subtypeModalOpen, setSubtypeModalOpen] = useState(false);
  const [editingSubtype, setEditingSubtype] = useState(null);
  const [activeCatId, setActiveCatId] = useState(null);
  const [catForm] = Form.useForm();
  const [subtypeForm] = Form.useForm();

  const fetchCategories = async () => {
    setLoading(true);
    try { const res = await getDocTypeCategories(); setCategories(res.data || []); }
    catch (e) { message.error('获取文档类型失败'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchCategories(); }, []);

  const handleAddCat = () => { setEditingCat(null); catForm.resetFields(); setCatModalOpen(true); };
  const handleEditCat = (cat) => { setEditingCat(cat); catForm.setFieldsValue(cat); setCatModalOpen(true); };
  const handleDeleteCat = async (id) => {
    try { await deleteDocTypeCategory(id); message.success('已删除'); fetchCategories(); } catch (e) { message.error('删除失败'); }
  };
  const handleCatSubmit = async () => {
    try {
      const values = await catForm.validateFields();
      if (editingCat) { await updateDocTypeCategory(editingCat.id, values); message.success('已更新'); }
      else { await createDocTypeCategory(values); message.success('已创建'); }
      setCatModalOpen(false); fetchCategories();
    } catch (e) { if (e.errorFields) return; message.error('操作失败'); }
  };
  const handleAddSubtype = (catId) => { setActiveCatId(catId); setEditingSubtype(null); subtypeForm.resetFields(); setSubtypeModalOpen(true); };
  const handleEditSubtype = (st) => { setEditingSubtype(st); subtypeForm.setFieldsValue(st); setSubtypeModalOpen(true); };
  const handleDeleteSubtype = async (id) => {
    try { await deleteSubtype(id); message.success('已删除子类型'); fetchCategories(); } catch (e) { message.error('删除失败'); }
  };
  const handleSubtypeSubmit = async () => {
    try {
      const values = await subtypeForm.validateFields();
      if (editingSubtype) { await updateSubtype(editingSubtype.id, values); message.success('已更新'); }
      else { await createSubtype(activeCatId, values); message.success('已创建'); }
      setSubtypeModalOpen(false); fetchCategories();
    } catch (e) { if (e.errorFields) return; message.error('操作失败'); }
  };

  const subtypeColumns = [
    { title: '序号', dataIndex: 'sort_order', width: 60, render: v => <Text type="secondary">{v}</Text> },
    { title: '子类型名称', dataIndex: 'name', width: 180, render: v => <Text strong>{v}</Text> },
    { title: '分类提示词（Prompt）', dataIndex: 'prompt', ellipsis: true, render: v => <Text type="secondary" style={{ fontSize: 12 }}>{v || '—'}</Text> },
    { title: '操作', width: 100, render: (_, record) => (
        <Space size={4}>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditSubtype(record)} />
          <Popconfirm title="确定删除？" onConfirm={() => handleDeleteSubtype(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    },
  ];

  const collapseItems = categories.map(cat => ({
    key: String(cat.id),
    label: (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
        <Text strong>{cat.name}</Text>
        <Tag color="blue" style={{ marginLeft: 4 }}>{cat.subtypes?.length || 0} 子类型</Tag>
        <Text type="secondary" style={{ fontSize: 12, flex: 1 }}>{cat.description || ''}</Text>
      </div>
    ),
    extra: (
      <Space size={4} onClick={e => e.stopPropagation()}>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditCat(cat)} />
        <Popconfirm title={`删除「${cat.name}」及所有子类型？`} onConfirm={() => handleDeleteCat(cat.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
    children: (
      <div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
          <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={() => handleAddSubtype(cat.id)}>新增子类型</Button>
        </div>
        <Table columns={subtypeColumns} dataSource={cat.subtypes || []} rowKey="id" size="small" pagination={false} bordered />
      </div>
    ),
  }));

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Text strong style={{ fontSize: 15 }}>文档分类体系</Text>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchCategories}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCat}>新增主类型</Button>
        </Space>
      </div>
      <Collapse items={collapseItems} defaultActiveKey={[]} style={{ background: '#fafafa' }} />
      <Modal title={editingCat ? '编辑主类型' : '新增主类型'} open={catModalOpen} onCancel={() => setCatModalOpen(false)} onOk={handleCatSubmit} width={480} destroyOnHidden>
        <Form form={catForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="主类型名称" rules={[{ required: true }]}><Input placeholder="如：病历记录" /></Form.Item>
          <Form.Item name="description" label="说明"><Input placeholder="类型说明" /></Form.Item>
          <Form.Item name="default_subtype" label="默认子类型"><Input placeholder="留空则无默认" /></Form.Item>
          <Form.Item name="sort_order" label="排序" initialValue={0}><InputNumber min={0} style={{ width: 120 }} /></Form.Item>
        </Form>
      </Modal>
      <Modal title={editingSubtype ? '编辑子类型' : '新增子类型'} open={subtypeModalOpen} onCancel={() => setSubtypeModalOpen(false)} onOk={handleSubtypeSubmit} width={560} destroyOnHidden>
        <Form form={subtypeForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="子类型名称" rules={[{ required: true }]}><Input placeholder="如：门诊病历" /></Form.Item>
          <Form.Item name="prompt" label="分类提示词（Prompt）">
            <TextArea rows={4} placeholder="用于 LLM 分类判断的提示信息" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序" initialValue={0}><InputNumber min={0} style={{ width: 120 }} /></Form.Item>
        </Form>
      </Modal>
    </>
  );
};

// ─── Prompt 组装预览 + 规则编辑 ────────────────────────
const RULE_LABELS = {
  system_role: '系统角色定义',
  null_policy: 'Null 规则',
  classification_rules: '分类规则',
  date_rules: '日期规则',
  forbidden_actions: '禁止操作',
  output_format: '输出格式',
};

const PromptPreview = () => {
  const [loading, setLoading] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [userTemplate, setUserTemplate] = useState('');
  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchPreview = async () => {
    setLoading(true);
    try {
      const res = await api.get('/metadata/prompt-preview');
      if (res?.data) {
        setSystemPrompt(res.data.system_prompt || '');
        setUserTemplate(res.data.user_prompt_template || '');
      }
    } catch (e) { message.error('获取 Prompt 预览失败'); }
    finally { setLoading(false); }
  };

  const fetchRules = async () => {
    setRulesLoading(true);
    try {
      const res = await api.get('/metadata/extraction-rules');
      setRules(res?.data || []);
    } catch (e) { message.error('获取抽取规则失败'); }
    finally { setRulesLoading(false); }
  };

  useEffect(() => { fetchPreview(); fetchRules(); }, []);

  const handleEditRule = (rule) => {
    setEditingRule(rule);
    setEditValue(typeof rule.rule_value === 'string' ? rule.rule_value : JSON.stringify(rule.rule_value, null, 2));
  };

  const handleSaveRule = async () => {
    if (!editingRule) return;
    setSaving(true);
    try {
      await api.put(`/metadata/extraction-rules/${editingRule.id}`, { rule_value: editValue });
      message.success('规则已保存');
      setEditingRule(null);
      fetchRules();
      fetchPreview(); // 刷新 prompt 预览
    } catch (e) {
      if (e instanceof SyntaxError) message.error('JSON 格式错误，请检查');
      else message.error('保存失败');
    } finally { setSaving(false); }
  };

  const ruleColumns = [
    { title: '规则', dataIndex: 'rule_key', width: 180,
      render: (v) => (
        <div>
          <Text strong>{RULE_LABELS[v] || v}</Text>
          <br /><code style={{ fontSize: 11, color: '#8c8c8c' }}>{v}</code>
        </div>
      )
    },
    { title: '当前值', dataIndex: 'rule_value',
      render: (v) => {
        const display = typeof v === 'string' ? v : String(v);
        return (
          <pre style={{
            margin: 0, fontSize: 11, lineHeight: 1.5, maxHeight: 100, overflow: 'auto',
            background: '#f6f6f6', padding: '6px 10px', borderRadius: 6, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {display.length > 300 ? display.substring(0, 300) + '...' : display}
          </pre>
        );
      }
    },
    { title: '操作', width: 80, render: (_, record) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEditRule(record)}>编辑</Button>
      )
    },
  ];

  return (
    <div>
      {/* 抽取规则编辑区 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text strong style={{ fontSize: 15 }}>📋 抽取规则配置</Text>
          <Button icon={<ReloadOutlined />} onClick={fetchRules} loading={rulesLoading} size="small">刷新</Button>
        </div>
        <Table
          columns={ruleColumns}
          dataSource={rules}
          rowKey="id"
          size="small"
          bordered
          pagination={false}
          loading={rulesLoading}
        />
      </div>

      {/* 规则编辑弹窗 */}
      <Modal
        title={`编辑规则 — ${editingRule ? (RULE_LABELS[editingRule.rule_key] || editingRule.rule_key) : ''}`}
        open={!!editingRule}
        onCancel={() => setEditingRule(null)}
        onOk={handleSaveRule}
        confirmLoading={saving}
        width={700}
        destroyOnHidden
        okText="保存"
      >
        {editingRule && (
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 8 }}>
              <Tag>纯文本</Tag>
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                key: <code>{editingRule.rule_key}</code>
              </Text>
            </div>
            <TextArea
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              rows={8}
              style={{
                fontFamily: '"SF Mono", "Fira Code", "Consolas", monospace',
                fontSize: 12,
              }}
            />
            <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
              保存后 Prompt 预览会自动刷新，下次抽取将使用新规则
            </Text>
          </div>
        )}
      </Modal>

      {/* Prompt 组装逻辑说明 */}
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Prompt 组装逻辑"
        description={
          <div style={{ fontSize: 13, lineHeight: 1.8 }}>
            System Prompt 由上方规则 + 字段定义 + 文档类型<strong>自动组装</strong>：
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Tag color="blue">① 抽取规则（上方可编辑）</Tag><span>→</span>
              <Tag color="purple">② 字段定义 Tab</Tag><span>→</span>
              <Tag color="green">③ 文档类型 Tab</Tag><span>→</span>
              <Tag color="orange">④ 输出 JSON 格式模板</Tag>
            </div>
          </div>
        }
      />

      {/* Prompt 预览 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong style={{ fontSize: 15 }}>🔧 System Prompt（实时预览）</Text>
        <Button icon={<ReloadOutlined />} onClick={fetchPreview} loading={loading}>刷新预览</Button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : (
        <>
          <div style={{
            background: '#1a1a2e', borderRadius: 8, padding: '16px 20px',
            maxHeight: 500, overflow: 'auto', border: '1px solid #2d2d44', marginBottom: 24,
          }}>
            <pre style={{
              margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
              fontFamily: '"SF Mono", "Fira Code", "Consolas", monospace',
              fontSize: 12, lineHeight: 1.7, color: '#e4e4e7',
            }}>
              {systemPrompt || '（未生成）'}
            </pre>
          </div>

          <Text strong style={{ fontSize: 15 }}>💬 User Prompt 模板</Text>
          <div style={{ marginTop: 8 }}>
            <Alert
              type="warning"
              showIcon
              message={
                <span style={{ fontSize: 13 }}>
                  固定模板：<code>请从以下医疗文档OCR文本中提取元数据：{'\n\n'}{'{ocr_text}'}</code>
                  <br />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    其中 <code>{'{ocr_text}'}</code> 在运行时替换为实际的 OCR 识别全文
                  </Text>
                </span>
              }
            />
          </div>
        </>
      )}
    </div>
  );
};

// ─── 主组件 ───────────────────────────────────────────
const MetadataConfig = () => {
  const tabItems = [
    { key: 'fields', label: '字段定义', children: <FieldsManager /> },
    { key: 'doctypes', label: '文档类型', children: <DocTypesManager /> },
    { key: 'prompt', label: '⚡ Prompt 组装预览', children: <PromptPreview /> },
  ];

  return (
    <div style={{ padding: '16px 0' }}>
      <Tabs items={tabItems} size="small" />
    </div>
  );
};

export default MetadataConfig;
