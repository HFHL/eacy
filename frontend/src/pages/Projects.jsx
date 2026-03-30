import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Typography, Table, Button, Space, Tag, Tabs, Modal, Form, Input, DatePicker, message, Popconfirm, Upload } from 'antd';
import { EyeOutlined, EditOutlined, DownloadOutlined, DeleteOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import api from '../api/document';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const Projects = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('projects');
  const [projects, setProjects] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm();
  const fileInputRef = React.useRef(null);

  // 加载项目列表
  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await api.get('/projects/');
      if (res?.success) {
        setProjects(res.data || []);
      }
    } catch (err) {
      console.error('加载项目失败:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProjects(); }, []);

  // 加载模版列表
  const fetchTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const res = await api.get('/crf-templates/');
      if (res?.success) {
        setTemplates(res.data || []);
      }
    } catch (err) {
      console.error('加载模版失败:', err);
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, []);

  // 创建项目
  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);
      const payload = {
        project_name: values.project_name,
        description: values.description || '',
        start_date: values.period?.[0]?.format('YYYY-MM-DD') || null,
        end_date: values.period?.[1]?.format('YYYY-MM-DD') || null,
      };
      const res = await api.post('/projects/', payload);
      if (res?.success) {
        message.success('项目创建成功！');
        setCreateVisible(false);
        form.resetFields();
        fetchProjects();
      } else {
        message.error(res?.message || '创建失败');
      }
    } catch (err) {
      if (err.errorFields) return; // 表单校验失败
      message.error('创建失败: ' + (err.message || '未知错误'));
    } finally {
      setCreating(false);
    }
  };

  // 删除项目
  const handleDelete = async (id) => {
    try {
      const res = await api.delete(`/projects/${id}`);
      if (res?.success) {
        message.success('已删除');
        fetchProjects();
      }
    } catch (err) {
      message.error('删除失败');
    }
  };

  // 状态标签
  const statusMap = {
    planning: { color: 'blue', text: '规划中' },
    active: { color: 'green', text: '进行中' },
    paused: { color: 'orange', text: '已暂停' },
    completed: { color: 'default', text: '已完成' },
  };

  // ------------------ 表格列定义 ------------------
  const projectColumns = [
    {
      title: '项目名称',
      dataIndex: 'project_name',
      key: 'project_name',
      render: (text, record) => (
        <div>
          <Button type="link" style={{ padding: 0 }} onClick={() => navigate(`/projects/${record.id}`)}>
            {text}
          </Button>
          {record.description && (
            <>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>
            </>
          )}
        </div>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const conf = statusMap[status] || { color: 'default', text: status };
        return <Tag color={conf.color}>{conf.text}</Tag>;
      }
    },
    {
      title: '入组受试者',
      dataIndex: 'patient_count',
      key: 'patient_count',
      width: 120,
      render: (val) => `${val || 0} 名`
    },
    {
      title: '项目周期',
      key: 'period',
      width: 200,
      render: (_, record) => {
        if (!record.start_date && !record.end_date) return '-';
        return `${record.start_date || '?'} ~ ${record.end_date || '?'}`;
      }
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (val) => val ? val.slice(0, 10) : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/projects/${record.id}`)}>查看</Button>
          <Button type="link" size="small" icon={<DownloadOutlined />}>导出</Button>
          <Popconfirm title="确认删除此项目？" onConfirm={() => handleDelete(record.id)} okText="删除" cancelText="取消">
            <Button type="link" size="small" icon={<DeleteOutlined />} danger>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // 删除模版
  const handleDeleteTemplate = async (id) => {
    try {
      const res = await api.delete(`/crf-templates/${id}`);
      if (res?.success) {
        message.success('已删除');
        fetchTemplates();
      }
    } catch (err) {
      message.error('删除失败');
    }
  };

  const templateColumns = [
    {
      title: '模版名称', dataIndex: 'template_name', key: 'template_name',
      render: (text, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{text} <Tag color="blue">{record.version}</Tag></Text>
          {record.description && <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>}
        </Space>
      )
    },
    { title: '分类', dataIndex: 'category', key: 'category', width: 120, render: (v) => v || '-' },
    { title: '状态', dataIndex: 'status', key: 'status', width: 120, render: (s) => <Tag color={s === 'published' ? 'green' : 'orange'}>{s === 'published' ? '已发布' : '草稿'}</Tag> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 160, render: (v) => v ? v.slice(0, 10) : '-' },
    {
      title: '操作', key: 'action', width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />}>预览</Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/crf-designer/${record.id}`)}>设计</Button>
          <Popconfirm title="确认删除此模版？" onConfirm={() => handleDeleteTemplate(record.id)} okText="删除" cancelText="取消">
            <Button type="link" size="small" icon={<DeleteOutlined />} danger>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div className="page-container fade-in" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>科研组学与项目集</Title>
          <Text type="secondary">管理临床研究项目、受试者队列及CRF表单模版</Text>
        </div>
        <Space>
          {activeTab === 'projects' ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateVisible(true)}>新建项目</Button>
          ) : (
            <Space>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px 15px',
                  fontSize: '14px',
                  borderRadius: '6px',
                  border: '1px solid #d9d9d9',
                  background: '#ffffff',
                  cursor: 'pointer',
                  color: 'rgba(0, 0, 0, 0.88)',
                  boxShadow: '0 2px 0 rgba(0, 0, 0, 0.02)',
                  transition: 'all 0.2s cubic-bezier(0.645, 0.045, 0.355, 1)',
                  height: '32px'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#4096ff'; e.currentTarget.style.borderColor = '#4096ff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(0, 0, 0, 0.88)'; e.currentTarget.style.borderColor = '#d9d9d9'; }}
              >
                <UploadOutlined style={{ marginRight: 8 }} />
                <span>导入系统模版 (CSV)</span>
                <input
                  type="file"
                  accept=".csv,text/csv,application/vnd.ms-excel,application/csv"
                  style={{ display: 'none' }}
                  onClick={(e) => {
                    e.target.value = '';
                  }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (!file.name.toLowerCase().endsWith('.csv')) {
                      message.error('请选择有效的 .csv 格式文件');
                      return;
                    }
                    try {
                      const formData = new FormData();
                      formData.append('file', file);
                      const res = await api.post('/crf-templates/import-system-csv', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                      });
                      if (res?.success) {
                        message.success(`${file.name} 系统模版导入成功`);
                        fetchTemplates();
                      } else {
                        message.error(`${file.name} 导入失败: ${res?.message || '未知错误'}`);
                      }
                    } catch (err) {
                      message.error(`${file.name} 导入失败`);
                    }
                  }}
                />
              </label>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/crf-designer')}>新建模版</Button>
            </Space>
          )}
        </Space>
      </div>

      <Card variant="borderless" styles={{ body: { padding: '0 24px 24px' } }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'projects',
              label: '研究项目',
              children: <Table columns={projectColumns} dataSource={projects} rowKey="id" loading={loading} pagination={false} />
            },
            {
              key: 'templates',
              label: 'CRF表单管理',
              children: <Table columns={templateColumns} dataSource={templates} rowKey="id" loading={templatesLoading} pagination={false} />
            }
          ]}
        />
      </Card>

      {/* 创建项目弹窗 */}
      <Modal
        title="新建科研项目"
        open={createVisible}
        onCancel={() => { setCreateVisible(false); form.resetFields(); }}
        onOk={handleCreate}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
        width={560}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="项目名称" name="project_name" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="例如：肺癌靶向治疗疗效回溯研究" />
          </Form.Item>
          <Form.Item label="项目描述" name="description">
            <Input.TextArea rows={3} placeholder="请描述项目的研究目标和范围" />
          </Form.Item>
          <Form.Item label="项目周期" name="period">
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Projects;
