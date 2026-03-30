import React, { useState, useEffect } from 'react';
import { 
  Row, 
  Col, 
  Card, 
  Statistic, 
  Table, 
  Tag, 
  Tabs, 
  Badge, 
  Progress, 
  Button,
  Tooltip,
  Avatar,
  Modal,
  Spin,
  Descriptions,
  message,
  Popconfirm,
  Space as AntSpace
} from 'antd';
import { 
  NodeIndexOutlined, 
  CodeSandboxOutlined, 
  BugOutlined, 
  ThunderboltOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  UserOutlined,
  ClockCircleOutlined,
  FileSearchOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { getMonitorStats, getOcrResult, reOcrDocument } from '../api/document';
import api from '../api/document';
import PipelineTraceModal from '../components/PipelineTraceModal';
import CrfTraceCanvas from '../components/CrfTraceCanvas';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PdfViewer from '../components/PdfViewer';

const MonitorDashboard = () => {
  const [activeTab, setActiveTab] = useState('ocr');

  // ============== Real Data State ==============
  const [workerNodes, setWorkerNodes] = useState([]);
  const [ocrTasks, setOcrTasks] = useState([]);
  const [extractionTasks, setExtractionTasks] = useState([]);
  const [crfTasks, setCrfTasks] = useState([]);
  const [loading, setLoading] = useState(false);

  // OCR Modal State
  const [ocrModalOpen, setOcrModalOpen] = useState(false);
  const [ocrData, setOcrData] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrFileName, setOcrFileName] = useState('');
  const [ocrViewTab, setOcrViewTab] = useState('markdown');

  // Metadata Result Modal State
  const [traceModalOpen, setTraceModalOpen] = useState(false);
  const [traceDocId, setTraceDocId] = useState(null);
  const [traceFileName, setTraceFileName] = useState('');

  // Document Preview Modal State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDocId, setPreviewDocId] = useState(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [previewMimeType, setPreviewMimeType] = useState('');

  const handlePreviewDoc = (record) => {
    setPreviewDocId(record.documentId);
    setPreviewFileName(record.fileName || '文档预览');
    setPreviewMimeType(record.mimeType || '');
    setPreviewOpen(true);
  };
  const [traceStage, setTraceStage] = useState('METADATA_EXTRACTION');

  const handleViewOcr = async (record) => {
    setOcrFileName(record.fileName);
    setOcrLoading(true);
    setOcrModalOpen(true);
    try {
      const res = await getOcrResult(record.documentId);
      if (res && res.data) {
        setOcrData(res.data);
      } else {
        message.warning('暂无 OCR 结果');
        setOcrModalOpen(false);
      }
    } catch (e) {
      message.error('获取 OCR 结果失败');
      setOcrModalOpen(false);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleReOcr = async (record) => {
    try {
      await reOcrDocument(record.documentId);
      message.success('已重新加入 OCR 识别队列');
      fetchStats();
    } catch (e) {
      message.error('重新识别失败');
    }
  };

  const handleViewMeta = (record) => {
    setTraceDocId(record.documentId);
    setTraceFileName(record.fileName);
    setTraceStage('METADATA_EXTRACTION');
    setTraceModalOpen(true);
  };

  const handleViewCrf = (record) => {
    setTraceDocId(record.documentId);
    setTraceFileName(record.fileName);
    setTraceStage('CRF_EXTRACTION');
    setTraceModalOpen(true);
  };

  // Poll backend monitor endpoint
  const fetchStats = async () => {
    try {
      const res = await getMonitorStats();
      if (res && res.data) {
        setWorkerNodes(res.data.workerNodes || []);
        setOcrTasks(res.data.ocrTasks || []);
        setExtractionTasks(res.data.extractionTasks || []);
        setCrfTasks(res.data.crfTasks || []);
      }
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchStats().finally(() => setLoading(false));
    
    // Auto-refresh every 3 seconds
    const interval = setInterval(fetchStats, 3000);
    return () => clearInterval(interval);
  }, []);

  // ============== Render Helpers ==============

  const renderStatusTag = (status) => {
    switch (status) {
      case 'PROGRESS': return <Tag color="processing" icon={<SyncOutlined spin />}>执行中</Tag>;
      case 'PENDING': return <Tag color="warning">排队等待</Tag>;
      case 'SUCCESS': return <Tag color="success" icon={<CheckCircleOutlined />}>执行成功</Tag>;
      case 'FAILURE': return <Tag color="error">执行失败</Tag>;
      default: return <Tag>{status}</Tag>;
    }
  };

  // 共享列（不含操作列）
  const baseColumns = [
    { title: 'Celery 唯一编号', dataIndex: 'id', key: 'id', width: 140, render: id => <span style={{ fontFamily: 'monospace', color: '#8c8c8c' }}>{id}</span> },
    { title: '关联载体', dataIndex: 'fileName', key: 'fileName', width: 200, ellipsis: true, render: t => <b>{t}</b> },
    { 
      title: '上传用户', dataIndex: 'uploaderName', key: 'uploaderName', width: 180, 
      render: name => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }} />
          <span style={{ fontSize: 13 }}>{name}</span>
        </span>
      ) 
    },
    { title: '当前工序阶段', dataIndex: 'step', key: 'step', width: 160 },
    { title: '运行状态', dataIndex: 'status', key: 'status', width: 130, render: renderStatusTag },
    { 
      title: '开始时间', dataIndex: 'createdAt', key: 'createdAt', width: 150, 
      render: t => t ? <span style={{ fontSize: 12, color: '#595959' }}>{new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span> : <span style={{ color: '#bfbfbf' }}>—</span>
    },
    { title: '排队耗时', dataIndex: 'queueTime', key: 'queueTime', width: 90 },
    { 
      title: '执行耗时', dataIndex: 'runtime', key: 'runtime', width: 110, 
      render: (val, record) => (
        <span style={{ fontFamily: 'monospace', color: record.status === 'PROGRESS' ? '#1677ff' : '#262626' }}>
          {record.status === 'PROGRESS' ? <><ClockCircleOutlined spin style={{ marginRight: 4 }} />{val}</> : val}
        </span>
      )
    },
  ];

  const ocrColumns = [...baseColumns, {
    title: '操作', key: 'action', width: 110,
    render: (_, record) => (
      record.status === 'SUCCESS' ? (
        <Button type="link" size="small" icon={<FileSearchOutlined />} onClick={() => handleViewOcr(record)}>OCR结果</Button>
      ) : record.status === 'FAILURE' ? (
        <Tag color="error">失败</Tag>
      ) : <span style={{ color: '#bfbfbf', fontSize: 12 }}>—</span>
    )
  }];

  const extractionColumns = [...baseColumns, {
    title: '操作', key: 'action', width: 110,
    render: (_, record) => (
      record.status === 'SUCCESS' ? (
        <Button type="link" size="small" icon={<FileSearchOutlined />} onClick={() => handleViewMeta(record)}>抽取结果</Button>
      ) : record.status === 'FAILURE' ? (
        <Tag color="error">失败</Tag>
      ) : <span style={{ color: '#bfbfbf', fontSize: 12 }}>—</span>
    )
  }];

  // CRF 专用列：插入项目名称列，关联载体可点击预览
  const crfColumns = [
    { title: 'Celery 唯一编号', dataIndex: 'id', key: 'id', width: 140, render: id => <span style={{ fontFamily: 'monospace', color: '#8c8c8c' }}>{id}</span> },
    {
      title: '所属项目', dataIndex: 'projectName', key: 'projectName', width: 160,
      render: (name, record) => {
        const pid = record.projectId;
        if (name) {
          return <Tooltip title={`ID: ${pid || '—'}`}><Tag color="purple" style={{ fontWeight: 500 }}>{name}</Tag></Tooltip>;
        }
        if (pid) {
          return <Tag color="default" style={{ fontFamily: 'monospace', fontSize: 11 }}>{pid.slice(0, 8)}...</Tag>;
        }
        return <span style={{ color: '#bfbfbf', fontSize: 12 }}>—</span>;
      }
    },
    {
      title: '关联载体', dataIndex: 'fileName', key: 'fileName', width: 200, ellipsis: true,
      render: (text, record) => (
        <a
          onClick={() => handlePreviewDoc(record)}
          style={{ color: '#1677ff', cursor: 'pointer', fontWeight: 500 }}
          title="点击预览文档"
        >
          <EyeOutlined style={{ marginRight: 4 }} />{text}
        </a>
      )
    },
    { 
      title: '上传用户', dataIndex: 'uploaderName', key: 'uploaderName', width: 180, 
      render: name => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }} />
          <span style={{ fontSize: 13 }}>{name}</span>
        </span>
      ) 
    },
    { title: '当前工序阶段', dataIndex: 'step', key: 'step', width: 160 },
    { title: '运行状态', dataIndex: 'status', key: 'status', width: 130, render: renderStatusTag },
    { 
      title: '开始时间', dataIndex: 'createdAt', key: 'createdAt', width: 150, 
      render: t => t ? <span style={{ fontSize: 12, color: '#595959' }}>{new Date(t).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span> : <span style={{ color: '#bfbfbf' }}>—</span>
    },
    { title: '排队耗时', dataIndex: 'queueTime', key: 'queueTime', width: 90 },
    { 
      title: '执行耗时', dataIndex: 'runtime', key: 'runtime', width: 110, 
      render: (val, record) => (
        <span style={{ fontFamily: 'monospace', color: record.status === 'PROGRESS' ? '#1677ff' : '#262626' }}>
          {record.status === 'PROGRESS' ? <><ClockCircleOutlined spin style={{ marginRight: 4 }} />{val}</> : val}
        </span>
      )
    },
    {
      title: '操作', key: 'action', width: 160,
      render: (_, record) => (
        record.status === 'SUCCESS' ? (
          <Button type="link" size="small" icon={<FileSearchOutlined />} onClick={() => handleViewCrf(record)}>ADK 链路</Button>
        ) : record.status === 'FAILURE' ? (
          <Tag color="error">失败</Tag>
        ) : <span style={{ color: '#bfbfbf', fontSize: 12 }}>—</span>
      )
    }
  ];

  return (
    <div style={{ padding: '24px', background: '#f5f7fa', minHeight: '100%', overflow: 'auto' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 600, color: '#1f1f1f' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              <NodeIndexOutlined style={{ color: '#1677ff' }} />系统调度监控平面
            </span>
          </h2>
          <p style={{ margin: '8px 0 0', color: '#595959' }}>
            实时观测底层 Celery 集群运算健康度、节点拓扑及大模型核心管道队列负荷
          </p>
        </div>
        <Button 
          icon={<SyncOutlined spin={loading} />} 
          type="primary" 
          onClick={fetchStats}
          loading={loading}
        >
          刷新拓扑流
        </Button>
      </div>

      {/* 顶部核心指标 + Worker 节点（紧凑横排） */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={5}>
          <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', height: '100%' }}>
            <Statistic 
               title="全局活跃节点" 
               value={workerNodes.filter(n => n.status === 'online').length} 
               suffix={`/ ${workerNodes.length}`} 
               styles={{ content: { color: '#52c41a', fontWeight: 'bold' } }} 
               prefix={<CodeSandboxOutlined />} 
            />
            <div style={{ marginTop: 8 }}>
              <Progress percent={workerNodes.length ? (workerNodes.filter(n => n.status === 'online').length / workerNodes.length) * 100 : 0} showInfo={false} strokeColor="#52c41a" size="small" />
            </div>
          </Card>
        </Col>
        <Col span={5}>
          <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', height: '100%' }}>
            <Statistic 
               title="活跃队列负荷" 
               value={workerNodes.reduce((acc, curr) => acc + (curr.active_tasks || 0), 0)} 
               styles={{ content: { color: '#1890ff', fontWeight: 'bold' } }} 
               prefix={<ThunderboltOutlined />} 
            />
            <p style={{ margin: 0, marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>正在运算的任务量</p>
          </Card>
        </Col>
        <Col span={5}>
          <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', height: '100%' }}>
            <Statistic 
              title="待处理排队文件" 
              value={ocrTasks.filter(m => m.status === 'PENDING').length} 
              styles={{ content: { color: '#faad14', fontWeight: 'bold' } }} 
              prefix={<Badge status="warning" />} 
            />
            <p style={{ margin: 0, marginTop: 8, fontSize: 12, color: '#8c8c8c' }}>等待 Worker 领取</p>
          </Card>
        </Col>
        <Col span={9}>
          <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', height: '100%' }}>
            <div style={{ fontWeight: 500, marginBottom: 12, color: '#262626' }}>
              <CodeSandboxOutlined style={{ marginRight: 6 }} />物理运算节点
            </div>
            {workerNodes.length === 0 ? (
              <div style={{ color: '#bfbfbf', textAlign: 'center', padding: 8 }}>暂无在线节点</div>
            ) : (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {workerNodes.map(node => (
                  <Tooltip key={node.id} title={`运行: ${node.uptime} | 内存: ${node.memory} | 并发: ${node.concurrency}`}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid #f0f0f0',
                      background: node.status === 'online' ? '#f6ffed' : '#fafafa',
                      opacity: node.status === 'online' ? 1 : 0.6,
                      fontSize: 13
                    }}>
                      <Badge status={node.status === 'online' ? 'success' : 'default'} />
                      <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{node.id}</span>
                      <Tag color={node.status === 'online' ? 'green' : 'default'} style={{ margin: 0 }}>
                        {node.concurrency}
                      </Tag>
                    </div>
                  </Tooltip>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* 管道任务队列 - 占满整个宽度 */}
      <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={[
            {
              key: 'ocr',
              label: <Badge count={ocrTasks.length} size="small" offset={[10, 0]}><span>⚕️ OCR 识别管道 (Stage 1)</span></Badge>,
              children: (
                <div style={{ marginTop: 16 }}>
                  <Table dataSource={ocrTasks} columns={ocrColumns} pagination={false} rowKey="id" size="middle" />
                </div>
              )
            },
            {
              key: 'extraction',
              label: <Badge count={extractionTasks.length} size="small" offset={[10, 0]}><span>📖 元数据提取管道 (Stage 2)</span></Badge>,
              children: (
                <div style={{ marginTop: 16 }}>
                  <Table dataSource={extractionTasks} columns={extractionColumns} pagination={false} rowKey="id" size="middle" />
                </div>
              )
            },
            {
              key: 'crf',
              label: <Badge dot offset={[5, 0]}><span>🔬 CRF自动推理填充管道 (Stage 3)</span></Badge>,
              children: (
                <div style={{ marginTop: 16 }}>
                  <Table dataSource={crfTasks} columns={crfColumns} pagination={false} rowKey="id" size="middle" />
                </div>
              )
            }
          ]}
        />
      </Card>

      {/* OCR 结果弹窗 */}
      <Modal
        title={<span><FileSearchOutlined style={{ marginRight: 8 }} />OCR 识别结果 — {ocrFileName}</span>}
        open={ocrModalOpen}
        onCancel={() => { setOcrModalOpen(false); setOcrData(null); }}
        footer={null}
        width="85%"
        styles={{ body: { maxHeight: '75vh', overflow: 'auto' } }}
      >
        {ocrLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" tip="加载中..." /></div>
        ) : ocrData ? (
          <div>
            <Descriptions size="small" column={4} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="OCR 引擎">{ocrData.provider || '—'}</Descriptions.Item>
              <Descriptions.Item label="总页数">{ocrData.total_pages || '—'}</Descriptions.Item>
              <Descriptions.Item label="平均置信度">
                {ocrData.confidence_avg ? `${(ocrData.confidence_avg * 100).toFixed(1)}%` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="耗时">
                {ocrData.duration_ms ? `${(ocrData.duration_ms / 1000).toFixed(1)}s` : '—'}
              </Descriptions.Item>
            </Descriptions>
            <Tabs
              activeKey={ocrViewTab}
              onChange={setOcrViewTab}
              items={[
                {
                  key: 'markdown',
                  label: '📄 Markdown 渲染',
                  children: (
                    <div style={{
                      background: '#fff',
                      border: '1px solid #f0f0f0',
                      borderRadius: 8,
                      padding: '20px 24px',
                      maxHeight: '55vh',
                      overflow: 'auto',
                      lineHeight: 1.8,
                      fontSize: 14
                    }}
                    className="ocr-markdown-preview"
                    >
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {ocrData.ocr_markdown || '（无识别文本）'}
                      </ReactMarkdown>
                    </div>
                  )
                },
                {
                  key: 'json',
                  label: '🔧 JSON 原始数据',
                  children: (
                    <div style={{
                      background: '#1e1e1e',
                      border: '1px solid #333',
                      borderRadius: 8,
                      padding: 20,
                      maxHeight: '55vh',
                      overflow: 'auto'
                    }}>
                      <pre style={{
                        margin: 0,
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        fontFamily: '"SF Mono", "Fira Code", monospace',
                        fontSize: 12,
                        lineHeight: 1.5,
                        color: '#d4d4d4'
                      }}>
                        {ocrData.ocr_raw_json ? JSON.stringify(ocrData.ocr_raw_json, null, 2) : '（无原始数据）'}
                      </pre>
                    </div>
                  )
                }
              ]}
            />
          </div>
        ) : null}
      </Modal>

      <style>{`
        .ocr-markdown-preview table {
          border-collapse: collapse;
          width: 100%;
          margin: 12px 0;
        }
        .ocr-markdown-preview th,
        .ocr-markdown-preview td {
          border: 1px solid #e8e8e8;
          padding: 8px 12px;
          text-align: left;
          font-size: 13px;
        }
        .ocr-markdown-preview th {
          background: #fafafa;
          font-weight: 600;
        }
        .ocr-markdown-preview h1, .ocr-markdown-preview h2, .ocr-markdown-preview h3 {
          margin-top: 16px;
          margin-bottom: 8px;
          color: #1f1f1f;
        }
        .ocr-markdown-preview img {
          max-width: 100%;
          border-radius: 4px;
        }
      `}</style>

      {traceStage === 'CRF_EXTRACTION' ? (
        <CrfTraceCanvas
          open={traceModalOpen}
          documentId={traceDocId}
          fileName={traceFileName}
          onClose={() => { setTraceModalOpen(false); setTraceDocId(null); }}
        />
      ) : (
        <PipelineTraceModal
          open={traceModalOpen}
          documentId={traceDocId}
          fileName={traceFileName}
          stage={traceStage}
          onClose={() => { setTraceModalOpen(false); setTraceDocId(null); }}
        />
      )}

      {/* 文档预览弹窗 */}
      <Modal
        title={<span><EyeOutlined style={{ marginRight: 8 }} />文档预览 — {previewFileName}</span>}
        open={previewOpen}
        onCancel={() => { setPreviewOpen(false); setPreviewDocId(null); }}
        footer={null}
        width="80%"
        styles={{ body: { height: '78vh', padding: 0, overflow: 'hidden' } }}
        destroyOnClose
      >
        {previewDocId && (
          previewMimeType?.startsWith('image/') ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
              <img
                src={`/api/documents/${previewDocId}/preview`}
                alt={previewFileName}
                style={{ maxWidth: '100%', maxHeight: '76vh', objectFit: 'contain', borderRadius: 4 }}
              />
            </div>
          ) : (
            <div style={{ width: '100%', height: '76vh', overflow: 'hidden' }}>
              <PdfViewer url={`/api/documents/${previewDocId}/preview`} scale={1.2} />
            </div>
          )
        )}
      </Modal>
    </div>
  );
};

export default MonitorDashboard;
