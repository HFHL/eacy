/**
 * 管道溯源画布弹窗
 * 展示 4 个节点：OCR 数据 → 元数据配置 → LLM 调用 → 入库结果
 */
import React, { useState, useEffect } from 'react';
import { Modal, Spin, Tag, Collapse, Descriptions, Table, message, Badge, Tooltip } from 'antd';
import {
  FileSearchOutlined,
  DatabaseOutlined,
  RobotOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons';
import api from '../api/document';

// ─── Node Card Wrapper ─────────────────────────────────
const NodeCard = ({ icon, title, color, badge, children, defaultOpen = false }) => {
  const [expanded, setExpanded] = useState(defaultOpen);
  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      border: `2px solid ${color}22`,
      boxShadow: `0 2px 12px ${color}15`,
      overflow: 'hidden',
      transition: 'all 0.3s ease',
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 20px',
          background: `linear-gradient(135deg, ${color}08, ${color}04)`,
          cursor: 'pointer',
          borderBottom: expanded ? `1px solid ${color}15` : 'none',
          userSelect: 'none',
        }}
      >
        <span style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${color}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, color,
        }}>
          {icon}
        </span>
        <span style={{ fontWeight: 600, fontSize: 15, color: '#1f1f1f', flex: 1 }}>{title}</span>
        {badge && <span style={{ fontSize: 12, color: '#8c8c8c' }}>{badge}</span>}
        <span style={{
          transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s', color: '#bfbfbf', fontSize: 12,
        }}>▶</span>
      </div>
      {expanded && (
        <div style={{ padding: '16px 20px', maxHeight: 400, overflow: 'auto' }}>
          {children}
        </div>
      )}
    </div>
  );
};

// ─── Connector Arrow ─────────────────────────────────
const ConnectorArrow = () => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '4px 0', color: '#d9d9d9',
  }}>
    <div style={{ width: 2, height: 20, background: 'linear-gradient(to bottom, #d9d9d9, #1677ff)' }} />
    <ArrowRightOutlined style={{ transform: 'rotate(90deg)', fontSize: 14, color: '#1677ff' }} />
    <div style={{ width: 2, height: 8, background: 'linear-gradient(to bottom, #1677ff, #d9d9d9)' }} />
  </div>
);

// ─── Code Block ─────────────────────────────────────
const CodeBlock = ({ content, maxHeight = 300, label }) => (
  <div>
    {label && <div style={{ fontSize: 12, fontWeight: 600, color: '#595959', marginBottom: 6 }}>{label}</div>}
    <div style={{
      background: '#1a1a2e',
      borderRadius: 8,
      padding: '14px 16px',
      maxHeight,
      overflow: 'auto',
      border: '1px solid #2d2d44',
    }}>
      <pre style={{
        margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
        fontFamily: '"SF Mono", "Fira Code", "Consolas", monospace',
        fontSize: 12, lineHeight: 1.6, color: '#e4e4e7',
      }}>
        {content || '（无数据）'}
      </pre>
    </div>
  </div>
);

// ─── Main Component ─────────────────────────────────
const PipelineTraceModal = ({ open, documentId, fileName, stage = 'METADATA_EXTRACTION', onClose }) => {
  const [loading, setLoading] = useState(false);
  const [traceData, setTraceData] = useState(null);

  useEffect(() => {
    if (open && documentId) {
      setLoading(true);
      api.get(`/documents/${documentId}/trace`, { params: { stage } })
        .then(res => {
          if (res?.data) setTraceData(res.data);
          else { message.warning('暂无溯源数据'); onClose(); }
        })
        .catch(() => { message.error('获取溯源数据失败'); onClose(); })
        .finally(() => setLoading(false));
    }
  }, [open, documentId, stage]);

  const handleClose = () => {
    setTraceData(null);
    onClose();
  };

  // ─── Node 1: OCR Data ──────────────────────────
  const renderOcrNode = () => {
    const ocr = traceData?.ocr;
    if (!ocr) return <div style={{ color: '#bfbfbf', textAlign: 'center' }}>无 OCR 数据</div>;
    return (
      <div>
        <Descriptions size="small" column={4} style={{ marginBottom: 12 }}>
          <Descriptions.Item label="引擎">{ocr.provider || '—'}</Descriptions.Item>
          <Descriptions.Item label="页数">{ocr.total_pages || '—'}</Descriptions.Item>
          <Descriptions.Item label="置信度">{ocr.confidence_avg ? `${(ocr.confidence_avg * 100).toFixed(1)}%` : '—'}</Descriptions.Item>
          <Descriptions.Item label="字符数">{ocr.text_length?.toLocaleString() || '—'}</Descriptions.Item>
        </Descriptions>
        <CodeBlock content={ocr.ocr_text?.substring(0, 3000) + (ocr.ocr_text?.length > 3000 ? '\n\n... (截断显示)' : '')} maxHeight={250} />
      </div>
    );
  };

  // ─── Node 2: Metadata Config ───────────────────
  const renderConfigNode = () => {
    const config = traceData?.config;
    if (!config) return <div style={{ color: '#bfbfbf', textAlign: 'center' }}>无配置数据</div>;

    return (
      <div>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>📋 抽取字段 ({config.fields?.length || 0} 个)</div>
        <Table
          dataSource={config.fields || []}
          columns={[
            { title: '字段名', dataIndex: 'field_name', key: 'name', width: 130, render: v => <code style={{ fontSize: 12 }}>{v}</code> },
            { title: '类型', dataIndex: 'field_type', key: 'type', width: 80, render: v => <Tag>{v}</Tag> },
            { title: '必填', dataIndex: 'required', key: 'req', width: 60, render: v => v ? <Tag color="red">是</Tag> : <Tag>否</Tag> },
            { title: '说明', dataIndex: 'description', key: 'desc', ellipsis: true },
          ]}
          pagination={false}
          size="small"
          rowKey="field_name"
          style={{ marginBottom: 16 }}
        />
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>📂 文档分类体系 ({config.categories?.length || 0} 个主类型)</div>
        <Collapse
          size="small"
          items={(config.categories || []).map((cat, i) => ({
            key: i,
            label: <span style={{ fontWeight: 500 }}>{cat.name} <Tag>{cat.subtypes?.length || 0} 子类型</Tag></span>,
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(cat.subtypes || []).map((st, j) => (
                  <div key={j} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: 13 }}>
                    <Badge status="processing" />
                    <span style={{ fontWeight: 500, minWidth: 100 }}>{st.name}</span>
                    <span style={{ color: '#8c8c8c', fontSize: 12 }}>{st.prompt?.substring(0, 80)}{st.prompt?.length > 80 ? '...' : ''}</span>
                  </div>
                ))}
              </div>
            ),
          }))}
        />
      </div>
    );
  };

  // ─── Node 3: LLM Call ──────────────────────────
  const renderLlmNode = () => {
    const llm = traceData?.llm_call;
    if (!llm) return <div style={{ color: '#bfbfbf', textAlign: 'center' }}>无 LLM 调用数据</div>;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Descriptions size="small" column={4}>
          <Descriptions.Item label="模型"><Tag color="blue">{llm.model || '—'}</Tag></Descriptions.Item>
          <Descriptions.Item label="Prompt Tokens">{llm.prompt_tokens?.toLocaleString() || '—'}</Descriptions.Item>
          <Descriptions.Item label="Completion Tokens">{llm.completion_tokens?.toLocaleString() || '—'}</Descriptions.Item>
          <Descriptions.Item label="耗时">{llm.duration_ms ? `${(llm.duration_ms / 1000).toFixed(1)}s` : '—'}</Descriptions.Item>
        </Descriptions>
        <CodeBlock label="🔧 System Prompt" content={llm.system_prompt || '（该记录未保存 Prompt，需重新触发抽取）'} maxHeight={200} />
        <CodeBlock label="💬 User Prompt" content={llm.user_prompt ? (llm.user_prompt.substring(0, 2000) + (llm.user_prompt.length > 2000 ? '\n\n... (截断显示)' : '')) : '（该记录未保存 Prompt，需重新触发抽取）'} maxHeight={200} />
        <CodeBlock label="📤 LLM Response" content={llm.raw_response || '（无数据）'} maxHeight={200} />
      </div>
    );
  };

  // ─── Node 4: Extracted Result ──────────────────
  const renderResultNode = () => {
    const result = traceData?.result;
    if (!result) return <div style={{ color: '#bfbfbf', textAlign: 'center' }}>无抽取结果</div>;

    if (Array.isArray(result)) {
      // ADK CRF Array Result
      return (
        <div>
          <div style={{ marginBottom: 12 }}>成功提取了以下 {result.length} 张独立子表单：</div>
          {result.map((formName, idx) => <Tag color="success" key={idx}>{formName}</Tag>)}
        </div>
      );
    }

    const entries = Object.entries(result);
    return (
      <div>
        <Table
          dataSource={entries.map(([k, v]) => ({ key: k, field: k, value: v }))}
          columns={[
            {
              title: '字段', dataIndex: 'field', key: 'field', width: 160,
              render: v => <code style={{ fontSize: 12, fontWeight: 600 }}>{v}</code>
            },
            {
              title: '抽取值', dataIndex: 'value', key: 'value',
              render: v => {
                if (v === null || v === undefined) return <span style={{ color: '#bfbfbf', fontStyle: 'italic' }}>null</span>;
                if (Array.isArray(v)) return <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{JSON.stringify(v)}</span>;
                if (typeof v === 'object') return <pre style={{ margin: 0, fontSize: 12, fontFamily: 'monospace' }}>{JSON.stringify(v, null, 2)}</pre>;
                return <span style={{ fontSize: 13 }}>{String(v)}</span>;
              }
            },
          ]}
          pagination={false}
          size="small"
          rowKey="key"
        />
      </div>
    );
  };

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14,
          }}>⚡</span>
          <span>抽取管道溯源 — {fileName}</span>
          {traceData?.status && <Tag color={traceData.status === 'SUCCESS' ? 'success' : 'error'}>{traceData.status}</Tag>}
        </span>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width="80%"
      styles={{ body: { maxHeight: '82vh', overflow: 'auto', background: '#f8f9fc', padding: '20px 24px' } }}
      destroyOnHidden
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" tip="加载溯源数据..." /></div>
      ) : traceData ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Node 1 */}
          <NodeCard
            icon={<FileSearchOutlined />}
            title="Stage 1 · OCR 识别数据"
            color="#1677ff"
            badge={traceData.ocr ? `${traceData.ocr.text_length?.toLocaleString()} 字符 · ${traceData.ocr.total_pages} 页` : ''}
          >
            {renderOcrNode()}
          </NodeCard>

          <ConnectorArrow />

          {/* Node 2 */}
          <NodeCard
            icon={<DatabaseOutlined />}
            title="元数据配置（字段 & 分类体系）"
            color="#722ed1"
            badge={`${traceData.config?.fields?.length || 0} 字段 · ${traceData.config?.categories?.length || 0} 主类型`}
          >
            {renderConfigNode()}
          </NodeCard>

          <ConnectorArrow />

          {/* Node 3 */}
          <NodeCard
            icon={<RobotOutlined />}
            title="Stage 2 · LLM 元数据抽取调用"
            color="#eb2f96"
            badge={traceData.llm_call?.model || ''}
            defaultOpen={true}
          >
            {renderLlmNode()}
          </NodeCard>

          <ConnectorArrow />

          {/* Node 4 */}
          <NodeCard
            icon={<CheckCircleOutlined />}
            title="抽取结果 · 入库字段"
            color="#52c41a"
            badge={`${traceData.result ? Object.keys(traceData.result).length : 0} 字段`}
            defaultOpen={true}
          >
            {renderResultNode()}
          </NodeCard>
        </div>
      ) : null}
    </Modal>
  );
};

export default PipelineTraceModal;
