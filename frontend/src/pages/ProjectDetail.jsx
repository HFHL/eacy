import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Typography, Table, Button, Space, Tag, Progress, Row, Col, Breadcrumb, message, Select, Spin, Modal, Tooltip } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined, DownloadOutlined, UserAddOutlined, ReloadOutlined, SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined, ApartmentOutlined } from '@ant-design/icons';
import api from '../api/document';
import CrfTraceCanvas from '../components/CrfTraceCanvas';

const { Title, Text } = Typography;
const { Option } = Select;

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [projectLoading, setProjectLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [templates, setTemplates] = useState([]);
  const [bindingTemplate, setBindingTemplate] = useState(false);
  const [addPatientModalVisible, setAddPatientModalVisible] = useState(false);
  const [allPatients, setAllPatients] = useState([]);
  const [allPatientsLoading, setAllPatientsLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [addingPatients, setAddingPatients] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [extractionStats, setExtractionStats] = useState(null);
  const [pollingActive, setPollingActive] = useState(false);
  const [fieldModal, setFieldModal] = useState({ open: false, data: null, title: '', loading: false });
  const [traceTarget, setTraceTarget] = useState(null); // { documentId, fileName }

  const [selectedMainRowKeys, setSelectedMainRowKeys] = useState([]);
  const [removingPatients, setRemovingPatients] = useState(false);

  const fetchProject = async () => {
    setProjectLoading(true);
    try {
      const res = await api.get(`/projects/${id}`);
      if (res?.success) {
        setProject(res.data);
        if (!res.data.crf_template_id) {
          fetchTemplates();
        }
      } else {
        message.error(res?.message || '获取项目详情失败');
      }
    } catch (e) {
      message.error('获取项目网络错误');
    } finally {
      setProjectLoading(false);
    }
  };

  const fetchPatients = async (page = 1, size = pagination.pageSize) => {
    setLoading(true);
    try {
      const res = await api.get(`/projects/${id}/patients`, { params: { page, size } });
      if (res?.success) {
        setPatients(res.data.list);
        setPagination({ current: res.data.page, pageSize: res.data.size, total: res.data.total });
      }
    } catch (e) {
      message.error('获取患者列表网络错误');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await api.get('/crf-templates/');
      if (res?.success) {
        setTemplates(res.data);
      }
    } catch (e) {
      // Slient fail for templates fetch
    }
  };

  const bindTemplate = async (templateId) => {
    setBindingTemplate(true);
    try {
      const res = await api.put(`/projects/${id}`, { crf_template_id: templateId });
      if (res?.success) {
        message.success('模版绑定成功');
        fetchProject();
      } else {
        message.error(res?.message || '模版绑定失败');
      }
    } catch (e) {
      message.error('模版绑定网络错误');
    } finally {
      setBindingTemplate(false);
    }
  };

  const showAddPatientModal = async () => {
    setAddPatientModalVisible(true);
    setAllPatientsLoading(true);
    try {
      // Fetch ALL patients (currently size=100 for simplicity)
      const res = await api.get('/patients/', { params: { size: 100 } });
      if (res?.success) {
        // Filter out patients that are already in the project
        const existingIds = patients.map(p => p.id);
        const available = res.data.list.filter(p => !existingIds.includes(p.id));
        setAllPatients(available);
      }
    } catch (e) {
      message.error('加载系统患者列表失败');
    } finally {
      setAllPatientsLoading(false);
    }
  };

  const handleAddPatients = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请至少选择一位患者');
      return;
    }
    setAddingPatients(true);
    try {
      const res = await api.post(`/projects/${id}/patients`, { patient_ids: selectedRowKeys });
      if (res?.success) {
        message.success('受试者入组成功');
        setAddPatientModalVisible(false);
        setSelectedRowKeys([]);
        fetchPatients(1);
        fetchProject(); // To update total count
      } else {
        message.error(res?.message || '受试者入组失败');
      }
    } catch (e) {
      message.error('受试者入组网络错误');
    } finally {
      setAddingPatients(false);
    }
  };

  const handleRemovePatients = async () => {
    if (selectedMainRowKeys.length === 0) {
      message.warning('请至少选择一位患者进行移除');
      return;
    }
    setRemovingPatients(true);
    try {
      const res = await api.delete(`/projects/${id}/patients`, { data: { patient_ids: selectedMainRowKeys } });
      if (res?.success) {
        message.success('已成功从项目中移除所选受试者');
        setSelectedMainRowKeys([]);
        fetchPatients(1);
        fetchProject();
      } else {
        message.error(res?.message || '移除受试者失败');
      }
    } catch (e) {
      message.error('网络错误，无法移除受试者');
    } finally {
      setRemovingPatients(false);
    }
  };

  const handleBatchExtract = async (force = false) => {
    setExtracting(true);
    try {
      const res = await api.post(`/projects/${id}/extract`, { force });
      if (res?.success || res?.status === 'success') {
        if (res.dispatched_patients === 0 && !force) {
          message.info('当前没有需要抽取的空表单，所有患者的表单已全部完成填报。');
        } else {
          message.success(res?.message || '批量抽取任务下发成功');
          setPollingActive(true);
          fetchPatients(pagination.current);
        }
      } else {
        message.error(res?.error || res?.message || '触发批量抽取失败');
      }
    } catch (e) {
      message.error('触发抽取网络错误');
    } finally {
      setExtracting(false);
    }
  };

  useEffect(() => {
    fetchProject();
    fetchPatients();
    // 检查是否有正在运行的抽取任务，自动启动轮询
    checkAndStartPolling();
  }, [id]);

  const checkAndStartPolling = async () => {
    try {
      const res = await api.get(`/projects/${id}/extraction-status`);
      if (res?.success) {
        setExtractionStats(res.data);
        if (res.data.extracting > 0) {
          setPollingActive(true);
        }
      }
    } catch (e) { /* silent */ }
  };

  // 轮询逻辑
  useEffect(() => {
    if (!pollingActive) return;
    const interval = setInterval(async () => {
      try {
        const res = await api.get(`/projects/${id}/extraction-status`);
        if (res?.success) {
          setExtractionStats(res.data);
          // 如果没有正在运行的任务了，停止轮询并刷新患者列表
          if (res.data.extracting === 0) {
            setPollingActive(false);
            fetchPatients(pagination.current);
          }
        }
      } catch (e) { /* silent */ }
    }, 3000);
    return () => clearInterval(interval);
  }, [pollingActive, id, pagination.current]);

  const handleCellClick = async (record, formName, fieldName, cellVal) => {
    if (cellVal === null || cellVal === undefined || cellVal === '') return;
    
    setFieldModal({ open: true, title: `${record.name} - ${formName} / ${fieldName}`, loading: true, data: null });
    try {
      const res = await api.get(`/projects/${id}/patients/${record.id}/crf-field?form=${encodeURIComponent(formName)}&field=${encodeURIComponent(fieldName)}`);
      if (res?.success) {
         setFieldModal(prev => ({ ...prev, loading: false, data: res.data }));
      } else {
         message.error('加载字段详情失败');
         setFieldModal({ open: false, data: null, title: '', loading: false });
      }
    } catch (e) {
      message.error('加载字段网络错误');
      setFieldModal({ open: false, data: null, title: '', loading: false });
    }
  };

  const renderCrfCell = (val) => {
    if (val == null) return <Text type="secondary">-</Text>;
    
    // Extract real value from {"value": ..., "source_blocks": ...} format
    let realVal = val;
    if (typeof val === 'object' && !Array.isArray(val) && val !== null) {
      if ('value' in val) {
        realVal = val.value;
      }
    }

    if (realVal === null || realVal === undefined || realVal === '') {
      return <Text type="secondary">-</Text>;
    }

    // Handle arrays (e.g., multiple choice or table rows)
    if (Array.isArray(realVal)) {
      return (
        <Space wrap size={2}>
          {realVal.map((v, i) => {
            const displayV = typeof v === 'object' && v !== null ? (v.value || JSON.stringify(v)) : String(v);
            return <Tag key={i} color="blue">{displayV}</Tag>;
          })}
        </Space>
      );
    }

    // Handle strings/numbers
    const strVal = String(realVal);
    if (strVal.length > 30) {
      return (
        <Tooltip title={<div style={{maxHeight: 400, overflow: 'auto'}}>{strVal}</div>} overlayInnerStyle={{ width: 400 }}>
          <span style={{ cursor: 'pointer', borderBottom: '1px dashed #d9d9d9', display: 'inline-block', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {strVal}
          </span>
        </Tooltip>
      );
    }

    // Handle nested objects (like table rows represented as dicts) fallback
    if (typeof realVal === 'object') {
      return (
        <Tooltip title={<pre style={{maxHeight: 400, overflow: 'auto'}}>{JSON.stringify(realVal, null, 2)}</pre>} overlayInnerStyle={{ width: 400 }}>
          <Tag color="purple" style={{cursor: 'pointer'}}>查看复杂格式</Tag>
        </Tooltip>
      );
    }

    return <Text>{strVal}</Text>;
  };

  const buildPatientColumns = () => {
    // Fixed left columns
    const fixedLeftColumns = [
      { title: '受试者编号', dataIndex: 'patient_code', key: 'patient_code', width: 120, fixed: 'left',
        render: (code, record) => (
          <a onClick={() => navigate(`/projects/${id}/patient/${record.id}`)}
            style={{ color: '#4f46e5', fontWeight: 500, cursor: 'pointer' }}
          >{code || record.id?.slice(0, 8)}</a>
        )
      },
      { title: '姓名', dataIndex: 'name', key: 'name', width: 100, fixed: 'left' },
      { title: '性别', dataIndex: 'gender', key: 'gender', width: 80, fixed: 'left' },
      { title: '年龄', dataIndex: 'age', key: 'age', width: 80, render: val => val ? `${val}岁` : '-', fixed: 'left' },
      {
        title: '诊断',
        dataIndex: 'diagnosis',
        key: 'diagnosis',
        width: 150,
        render: (diagnoses) => {
          if (!diagnoses || !Array.isArray(diagnoses)) return '-';
          return (
            <Space wrap size={4}>
              {diagnoses.map((d, i) => <Tag key={i} size="small">{d}</Tag>)}
            </Space>
          )
        }
      },
      {
        title: '抽取状态',
        dataIndex: 'extractionStatus',
        key: 'extractionStatus',
        width: 110,
        render: (status, record) => {
          const config = {
            done: { color: 'green', text: '抽取完成', icon: <CheckCircleOutlined /> },
            partial: { color: 'orange', text: '部分完成', icon: <CloseCircleOutlined /> },
            extracting: { color: 'processing', text: '抽取中', icon: <SyncOutlined spin /> },
            error: { color: 'error', text: '抽取失败', icon: <CloseCircleOutlined /> },
            pending: { color: 'default', text: '未抽取', icon: null }
          }[status || 'pending'] || { color: 'default', text: '未知', icon: null };
          return (
            <Tooltip title={record.total_docs > 0 ? `${record.success_docs}/${record.total_docs} 文档已处理` : '无关联文档'}>
              <Tag color={config.color} icon={config.icon}>{config.text}</Tag>
            </Tooltip>
          );
        }
      },
      {
        title: '完整度',
        dataIndex: 'completeness',
        key: 'completeness',
        width: 110,
        render: (val) => (
          <Space>
            <Progress percent={val || 0} size="small" style={{ width: 60 }} />
          </Space>
        )
      },
    ];

    // Dynamic CRF Columns (Penetrating View)
    let crfColumns = [];
    if (project?.crf_template_schema?.categories) {
      project.crf_template_schema.categories.forEach(category => {
        const categoryColumn = {
          title: category.name,
          children: []
        };
        
        (category.forms || []).forEach(form => {
          const formColumn = {
            title: form.name,
            children: []
          };
          
          (form.fields || []).forEach(field => {
            formColumn.children.push({
              title: field.name,
              key: `crf_${form.name}_${field.name}`,
              width: 160,
              render: (_, record) => {
                const crfData = record.crf_data || {};
                const formData = crfData[form.name] || {};
                const val = formData[field.name];
                return (
                  <div 
                    onClick={() => handleCellClick(record, form.name, field.name, val)}
                    style={{ cursor: val != null && val !== '' ? 'pointer' : 'default', minHeight: 22 }}
                  >
                    {renderCrfCell(val)}
                  </div>
                );
              }
            });
          });
          
          if (formColumn.children.length > 0) {
            categoryColumn.children.push(formColumn);
          }
        });
        
        if (categoryColumn.children.length > 0) {
          crfColumns.push(categoryColumn);
        }
      });
    }

    // Fixed right columns
    const fixedRightColumns = [
      {
        title: '操作',
        key: 'action',
        width: 180,
        fixed: 'right',
        render: (_, record) => (
          <Space size={4}>
            <Button type="link" size="small" onClick={() => navigate(`/projects/${id}/patient/${record.id}`)}>
              数据录入
            </Button>
            {record.total_docs > 0 && record.extractionStatus !== 'pending' && (
              <Button
                type="link" size="small"
                icon={<ApartmentOutlined />}
                style={{ color: '#8b5cf6' }}
                onClick={() => {
                  const docIds = record.document_ids || [];
                  if (docIds.length > 0) {
                    setTraceTarget({ documentId: docIds[0], fileName: `文档 ${record.name || record.patient_code || ''}` });
                  } else {
                    message.warning('暂无抽取记录可查看');
                  }
                }}
              >
                查看链路
              </Button>
            )}
          </Space>
        )
      }
    ];

    return [...fixedLeftColumns, ...crfColumns, ...fixedRightColumns];
  };

  const dynamicColumns = buildPatientColumns();

  if (projectLoading) {
    return (
      <div style={{ padding: 50, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ padding: 50, textAlign: 'center' }}>
        <Text type="danger">加载项目失败或项目不存在</Text>
      </div>
    );
  }

  return (
    <div className="page-container fade-in" style={{ padding: 24 }}>
      {/* 顶部导航与操作区 */}
      <div style={{ marginBottom: 16 }}>
        <Breadcrumb items={[
          { title: <a onClick={() => navigate('/projects')}>研究项目</a> },
          { title: '项目详情' },
        ]} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: '0 0 8px 0' }}>{project.project_name}</Title>
          <Space size="large" style={{ marginTop: 8 }}>
            <Text type="secondary">项目ID: {id}</Text>
            <Tag color={project.status === 'active' ? 'green' : 'default'}>
              {project.status === 'active' ? '进行中' : '已归档'}
            </Tag>
            {project.crf_template_id ? (
              <Text type="secondary">CRF模版 已绑定 ID: {project.crf_template_id}</Text>
            ) : (
              <Space>
                <Text type="warning">未绑定模版</Text>
                <Select
                  placeholder="选择CRF表单模版"
                  style={{ width: 200 }}
                  loading={bindingTemplate}
                  onChange={(val) => bindTemplate(val)}
                  dropdownMatchSelectWidth={false}
                >
                  {templates.map(t => (
                    <Option key={t.id} value={t.id}>{t.template_name} ({t.version})</Option>
                  ))}
                </Select>
              </Space>
            )}
          </Space>
        </div>
        <Space>
          <Button 
            type="primary" 
            icon={<PlayCircleOutlined />} 
            disabled={!project.crf_template_id}
            loading={extracting}
            onClick={() => handleBatchExtract(false)}
          >
            抽取空表单
          </Button>
          <Button 
            icon={<ReloadOutlined />} 
            disabled={!project.crf_template_id}
            loading={extracting}
            onClick={() => {
              Modal.confirm({
                title: '危险操作：清空并强制重新抽取',
                content: '强制重抽将删除目前各患者表单内已抽取的结构化数据及校验痕迹，完全重新进行 AI 解析。确定要对整批文档执行吗？',
                okText: '确认强制重抽',
                cancelText: '取消',
                okButtonProps: { danger: true },
                onOk: () => handleBatchExtract(true),
              });
            }}
          >
            强制重新抽
          </Button>
          <Button icon={<DownloadOutlined />}>导出科研数据集</Button>
        </Space>
      </div>

      {project.description && (
        <div style={{ marginBottom: 24 }}>
          <Text type="secondary">{project.description}</Text>
        </div>
      )}

      {/* 统计卡片区 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={6}>
          <Card bordered={false} styles={{ body: { padding: 20 } }}>
            <Text type="secondary">入组受试者</Text>
            <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8 }}>
               {project.patient_count || 0}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false} styles={{ body: { padding: 20 } }}>
            <Text type="secondary">已完成抽取</Text>
            <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8, color: '#52c41a' }}>
              {extractionStats?.completed ?? 0}
              {pollingActive && <SyncOutlined spin style={{ fontSize: 14, marginLeft: 8, color: '#1890ff' }} />}
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false} styles={{ body: { padding: 20 } }}>
            <Text type="secondary">平均填报完整度</Text>
            <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8, color: '#1890ff' }}>
              {extractionStats?.avg_completeness ?? 0}%
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card bordered={false} styles={{ body: { padding: 20 } }}>
            <Text type="secondary">质控报错</Text>
            <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 8, color: '#ff4d4f' }}>
              {extractionStats?.error ?? 0}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 受试者列表区 */}
      <Card
        title="受试者列表 (Patient Cohort)"
        bordered={false}
        extra={
          <Space>
            {selectedMainRowKeys.length > 0 && (
              <Button 
                danger 
                loading={removingPatients} 
                onClick={() => {
                  Modal.confirm({
                    title: '移除受试者',
                    content: `确定要从当前项目中移除选中的 ${selectedMainRowKeys.length} 名受试者吗？这不会删除他们的原始档案，你可以随时将他们重新添加入组。`,
                    onOk: handleRemovePatients,
                    okButtonProps: { danger: true },
                    okText: '确认移除',
                    cancelText: '取消'
                  });
                }}
              >
                移除选中 ({selectedMainRowKeys.length})
              </Button>
            )}
            <Button icon={<UserAddOutlined />} type="primary" onClick={showAddPatientModal}>添加受试者</Button>
            <Button icon={<ReloadOutlined />} type="text" onClick={() => fetchPatients(pagination.current)} />
          </Space>
        }
      >
        <Table
          rowSelection={{
            selectedRowKeys: selectedMainRowKeys,
            onChange: setSelectedMainRowKeys,
          }}
          columns={dynamicColumns}
          dataSource={patients}
          rowKey="id"
          loading={loading}
          pagination={{ ...pagination, onChange: fetchPatients }}
          scroll={{ x: 'max-content', y: 600 }}
          bordered
          size="middle"
        />
      </Card>

      {/* 添加入组患者弹窗 */}
      <Modal
        title="添加入组受试者"
        open={addPatientModalVisible}
        onOk={handleAddPatients}
        confirmLoading={addingPatients}
        onCancel={() => {
          setAddPatientModalVisible(false);
          setSelectedRowKeys([]);
        }}
        width={800}
      >
        <Table
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          columns={[
            { title: '患者编号', dataIndex: ['metadata_json', '患者编号'] },
            { title: '姓名', dataIndex: ['metadata_json', '患者姓名'] },
            { title: '性别', dataIndex: ['metadata_json', '患者性别'] },
            { title: '年龄', dataIndex: ['metadata_json', '患者年龄'] },
            { 
              title: '诊断', 
              dataIndex: ['metadata_json', '临床诊断'],
              render: (diagnoses) => (Array.isArray(diagnoses) && diagnoses.length > 0) ? (
                <Space wrap>
                  {diagnoses.map((d, i) => <Tag key={i} size="small">{d}</Tag>)}
                </Space>
              ) : '-'
            }
          ]}
          dataSource={allPatients}
          rowKey="id"
          loading={allPatientsLoading}
          pagination={{ pageSize: 5 }}
          scroll={{ y: 300 }}
        />
      </Modal>

      {/* CRF 抽取链路追踪画布 */}
      <CrfTraceCanvas
        open={!!traceTarget}
        documentId={traceTarget?.documentId}
        fileName={traceTarget?.fileName}
        onClose={() => setTraceTarget(null)}
      />

      {/* 字段详情 JSON 弹窗 */}
      <Modal
        title={fieldModal.title}
        open={fieldModal.open}
        footer={null}
        onCancel={() => setFieldModal(prev => ({ ...prev, open: false }))}
        width={640}
        centered
      >
        {fieldModal.loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : (
          <pre style={{ 
            background: '#f8f9fa', 
            padding: 16, 
            borderRadius: 6, 
            maxHeight: 500, 
            overflow: 'auto',
            fontSize: 13,
            fontFamily: '"SF Mono", monospace',
            border: '1px solid #e5e7eb'
          }}>
            {fieldModal.data ? JSON.stringify(fieldModal.data, null, 2) : '暂无详细数据'}
          </pre>
        )}
      </Modal>
    </div>
  );
};

export default ProjectDetail;
