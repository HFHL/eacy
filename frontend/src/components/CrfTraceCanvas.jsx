/**
 * CRF 抽取链路追踪画布 — Coze 风格横向节点可视化
 * 展示: OCR 输入 → Triage Agent → 并行抽取 ×N → 合并入库
 */
import React, { useState, useEffect } from 'react';
import { Modal, Spin, Tag, Tooltip, message } from 'antd';
import {
  FileSearchOutlined,
  BranchesOutlined,
  ThunderboltOutlined,
  DatabaseOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import api from '../api/document';

/* ─── Color Palette ─────────────────────────── */
const COLORS = {
  ocr: '#3b82f6',
  triage: '#8b5cf6',
  extract: '#f59e0b',
  merge: '#10b981',
  inject: '#06b6d4',
  bg: '#0f1117',
  card: '#1a1d2e',
  cardBorder: '#2a2d3e',
  text: '#e4e4e7',
  textDim: '#71717a',
  codeBg: '#111318',
};

/* ─── Connector (horizontal arrow) ──────────── */
const HConnector = ({ color = '#3b82f6' }) => (
  <div style={{ display: 'flex', alignItems: 'center', minWidth: 40, flexShrink: 0 }}>
    <div style={{ height: 2, flex: 1, background: `linear-gradient(90deg, ${color}66, ${color})` }} />
    <div style={{
      width: 0, height: 0,
      borderTop: '6px solid transparent', borderBottom: '6px solid transparent',
      borderLeft: `8px solid ${color}`,
    }} />
  </div>
);

/* ─── Code Block ───────────────────────────── */
const CodeBlock = ({ content, maxHeight = 200, label }) => (
  <div style={{ marginBottom: 8 }}>
    {label && <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>}
    <div style={{
      background: COLORS.codeBg,
      borderRadius: 6, padding: '10px 12px',
      maxHeight, overflow: 'auto',
      border: `1px solid ${COLORS.cardBorder}`,
      fontSize: 11.5, lineHeight: 1.5,
      fontFamily: '"SF Mono", "Fira Code", "Consolas", monospace',
      color: COLORS.text, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    }}>
      {content || '（无数据）'}
    </div>
  </div>
);

/* ─── Pipeline Node Card ───────────────────── */
const NodeCard = ({ icon, title, subtitle, color, badge, children, width = 280 }) => (
  <div style={{
    width, minWidth: width, flexShrink: 0,
    background: COLORS.card,
    borderRadius: 12,
    border: `1px solid ${color}33`,
    boxShadow: `0 0 20px ${color}10, 0 4px 12px rgba(0,0,0,0.3)`,
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  }}>
    {/* Header */}
    <div style={{
      padding: '12px 16px',
      background: `linear-gradient(135deg, ${color}15, ${color}08)`,
      borderBottom: `1px solid ${color}22`,
      display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{
        width: 32, height: 32, borderRadius: 8,
        background: `${color}20`, color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16,
      }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: COLORS.text }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: COLORS.textDim, marginTop: 1 }}>{subtitle}</div>}
      </div>
      {badge}
    </div>
    {/* Body */}
    <div style={{ padding: '12px 16px', flex: 1, overflow: 'auto', maxHeight: 420 }}>
      {children}
    </div>
  </div>
);

/* ─── Merge Log Table ──────────────────────── */
const MergeLogTable = ({ log }) => {
  if (!log || log.length === 0) return <div style={{ color: COLORS.textDim, fontSize: 12 }}>暂无合并记录</div>;

  const stats = { filled: 0, same: 0, conflict: 0 };
  log.forEach(l => { if (stats[l.action] !== undefined) stats[l.action]++; });

  const actionStyle = {
    filled: { color: '#10b981', bg: '#10b98118', label: '✅ 填入' },
    same: { color: '#71717a', bg: '#71717a18', label: '⬜ 一致' },
    conflict: { color: '#f59e0b', bg: '#f59e0b18', label: '⚠️ 冲突' },
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
        <Tag color="success" style={{ borderRadius: 4 }}>填入 {stats.filled}</Tag>
        <Tag style={{ borderRadius: 4 }}>一致 {stats.same}</Tag>
        {stats.conflict > 0 && <Tag color="warning" style={{ borderRadius: 4 }}>冲突 {stats.conflict}</Tag>}
      </div>
      <div style={{ maxHeight: 280, overflow: 'auto' }}>
        {log.map((item, idx) => {
          const s = actionStyle[item.action] || actionStyle.same;
          return (
            <div key={idx} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 10px', marginBottom: 2,
              background: s.bg, borderRadius: 6,
              fontSize: 12,
            }}>
              <span style={{ color: s.color, fontWeight: 600, minWidth: 60 }}>{s.label}</span>
              <span style={{ color: COLORS.textDim, minWidth: 80 }}>{item.form}</span>
              <code style={{ color: COLORS.text, fontWeight: 500, flex: 1, fontSize: 11 }}>{item.field}</code>
              {item.action === 'filled' && (
                <span style={{ color: '#10b981', fontSize: 11 }}>← {item.new_value}</span>
              )}
              {item.action === 'conflict' && (
                <Tooltip title={`旧值: ${item.old_value}\n新值: ${item.new_value}`}>
                  <span style={{ color: '#f59e0b', fontSize: 11, cursor: 'help' }}>
                    {item.old_value} ≠ {item.new_value}
                  </span>
                </Tooltip>
              )}
              {item.action === 'same' && (
                <span style={{ color: '#71717a', fontSize: 11 }}>= {item.value || item.new_value || item.old_value}</span>
              )}
              
              {/* Document ID and Block ID Tracking */}
              {item.source_blocks && item.source_blocks.length > 0 && (
                <div style={{ display: 'flex', gap: 4, marginLeft: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 160 }}>
                  {item.source_blocks.map((sb, sbi) => {
                    const isFake = sb.block_id && sb.bbox === null;
                    return (
                      <Tooltip key={sbi} title={`文档ID: ${sb.document_id || '未知'}\n块ID: ${sb.block_id || '未绑定'}${isFake ? '\n(模型幻觉，原文无此块)' : ''}`}>
                        <Tag 
                          color={isFake ? "error" : "default"}
                          style={{ margin: 0, fontSize: 10, lineHeight: '18px', padding: '0 4px' }}
                        >
                          {sb.document_id?.slice(0, 4)} : {sb.block_id || '无'}
                        </Tag>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─── Extraction Agent Card (stacked) ──────── */
const ExtractionCards = ({ agentTrace }) => {
  const extractAgents = (agentTrace || []).filter(a => a.parallel || a.form_name);
  if (extractAgents.length === 0) return <div style={{ color: COLORS.textDim, fontSize: 12 }}>无并行子任务</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {extractAgents.map((agent, idx) => (
        <div key={idx} style={{
          background: COLORS.codeBg,
          borderRadius: 8,
          border: `1px solid ${COLORS.extract}22`,
          padding: '10px 14px',
          overflow: 'hidden',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <ThunderboltOutlined style={{ color: COLORS.extract, fontSize: 13 }} />
            <span style={{ fontWeight: 600, fontSize: 12, color: COLORS.text }}>
              {agent.form_name || agent.agent}
            </span>
            <Tag color="gold" style={{ fontSize: 10, lineHeight: '16px', borderRadius: 4, marginLeft: 'auto' }}>并行</Tag>
          </div>
          {agent.system_prompt && (
            <CodeBlock content={agent.system_prompt} maxHeight={120} label="🔧 System Prompt" />
          )}
          {agent.user_prompt && (
            <CodeBlock content={agent.user_prompt} maxHeight={60} label="💬 User Prompt" />
          )}
          {agent.parsed_output && (
            <CodeBlock
              content={JSON.stringify(agent.parsed_output, null, 2)}
              maxHeight={160}
              label="✅ 提取结果"
            />
          )}
          {!agent.parsed_output && agent.output_raw && (
            <CodeBlock content={agent.output_raw} maxHeight={120} label="原始输出" />
          )}
        </div>
      ))}
    </div>
  );
};

/* ═══════════ Main Component ═══════════════════ */
const CrfTraceCanvas = ({ open, documentId, fileName, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (open && documentId) {
      setLoading(true);
      api.get(`/documents/${documentId}/trace`, { params: { stage: 'CRF_EXTRACTION' } })
        .then(res => {
          if (res?.data) setData(res.data);
          else { message.warning('暂无 CRF 抽取记录'); onClose(); }
        })
        .catch(() => { message.error('获取溯源数据失败'); onClose(); })
        .finally(() => setLoading(false));
    }
  }, [open, documentId]);

  const handleClose = () => { setData(null); onClose(); };

  // Finding triage from agentTrace
  const triageTrace = (data?.agent_trace || []).find(a => a.agent === 'triage_agent');

  return (
    <Modal
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: COLORS.text }}>
          <span style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg, #8b5cf6, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: 13,
          }}>⚡</span>
          <span>CRF 抽取链路追踪</span>
          <span style={{ color: COLORS.textDim, fontWeight: 400, fontSize: 13 }}>— {fileName}</span>
          {data?.status && (
            <Tag
              color={data.status === 'SUCCESS' ? 'success' : data.status === 'RUNNING' ? 'processing' : 'error'}
              icon={data.status === 'SUCCESS' ? <CheckCircleOutlined /> : data.status === 'RUNNING' ? <ClockCircleOutlined /> : <WarningOutlined />}
              style={{ marginLeft: 'auto' }}
            >
              {data.status}
            </Tag>
          )}
          {data?.duration_ms && (
            <span style={{ color: COLORS.textDim, fontSize: 12, fontWeight: 400 }}>
              {(data.duration_ms / 1000).toFixed(1)}s
            </span>
          )}
        </span>
      }
      open={open}
      onCancel={handleClose}
      footer={null}
      width="92%"
      styles={{
        content: { background: COLORS.bg, border: `1px solid ${COLORS.cardBorder}` },
        header: { background: COLORS.bg, borderBottom: `1px solid ${COLORS.cardBorder}` },
        body: { background: COLORS.bg, padding: '24px', overflow: 'auto' },
      }}
      destroyOnHidden
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : data ? (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 0,
          overflowX: 'auto', paddingBottom: 12,
          minHeight: 360,
        }}>
          {/* ── Node 1: LLM 输入 (实际喂入的结构化 JSON) ── */}
          <NodeCard
            icon={<FileSearchOutlined />}
            title="LLM 实际输入"
            subtitle={data.ocr ? `${data.ocr.total_pages} 页 · 结构化 JSON Blocks` : 'OCR 结构化块'}
            color={COLORS.ocr}
            width={280}
          >
            {data.input_prompt ? (
              <CodeBlock
                content={data.input_prompt.substring(0, 1200) + (data.input_prompt.length > 1200 ? '\n\n... (截断)' : '')}
                maxHeight={320}
                label="📋 发送给 ADK Runner 的完整 Prompt"
              />
            ) : data.ocr?.ocr_text ? (
              <CodeBlock
                content={data.ocr.ocr_text.substring(0, 800) + (data.ocr.ocr_text.length > 800 ? '\n\n... (截断)' : '')}
                maxHeight={320}
                label="⚠️ 回退: OCR Markdown (无 input_prompt 记录)"
              />
            ) : (
              <div style={{ color: COLORS.textDim, fontSize: 12 }}>无输入数据</div>
            )}
            {data.ocr && (
              <div style={{ marginTop: 8, fontSize: 11, color: COLORS.textDim }}>
                引擎: {data.ocr.provider || '—'} · 置信度: {data.ocr.confidence_avg ? `${(data.ocr.confidence_avg * 100).toFixed(1)}%` : '—'}
              </div>
            )}
          </NodeCard>

          <HConnector color={COLORS.ocr} />

          {/* ── Node 2: Triage Agent ── */}
          <NodeCard
            icon={<BranchesOutlined />}
            title="Triage Agent"
            subtitle="摘要 + 表单路由分发"
            color={COLORS.triage}
            badge={
              data.pipeline === 'form_centric'
                ? (data.docs_processed?.length > 0 ? <Tag color="purple" style={{ borderRadius: 4 }}>{data.docs_processed.length} 命中</Tag> : null)
                : (data.routing_result?.matched_forms?.length > 0 ? <Tag color="purple" style={{ borderRadius: 4 }}>{data.routing_result.matched_forms.length} 命中</Tag> : null)
            }
            width={360}
          >
            {triageTrace?.system_prompt && (
              <CodeBlock content={triageTrace.system_prompt} maxHeight={140} label="🔧 System Prompt" />
            )}
            {triageTrace?.user_prompt && (
              <CodeBlock content={triageTrace.user_prompt} maxHeight={100} label="💬 User Prompt (OCR + 表单目录)" />
            )}
            {triageTrace?.output_raw && (
              <CodeBlock content={triageTrace.output_raw} maxHeight={120} label="📤 LLM 原始输出" />
            )}
            {data.routing_result && (
              <>
                <CodeBlock
                  content={data.routing_result.summary || ''}
                  maxHeight={100}
                  label="📝 文档摘要"
                />
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.textDim, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {data.pipeline === 'form_centric' ? '🎯 命中文档' : '🎯 命中表单'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {data.pipeline === 'form_centric' ? (
                      (data.docs_processed || []).map((d, i) => (
                        <Tag key={i} color="purple" style={{ borderRadius: 4, fontSize: 11 }}>{d}</Tag>
                      ))
                    ) : (
                      (data.routing_result?.matched_forms || []).map((f, i) => (
                        <Tag key={i} color="purple" style={{ borderRadius: 4, fontSize: 11 }}>{f}</Tag>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </NodeCard>

          <HConnector color={COLORS.triage} />

          {/* ── Node 3: 并行抽取 ── */}
          <NodeCard
            icon={<ThunderboltOutlined />}
            title="并行抽取"
            subtitle={`${data.extracted_forms?.length || 0} 个子任务`}
            color={COLORS.extract}
            badge={<Tag color="gold" style={{ borderRadius: 4 }}>{data.extracted_forms?.length || 0} 表单</Tag>}
            width={340}
          >
            <ExtractionCards agentTrace={data.agent_trace} />
          </NodeCard>

          <HConnector color={COLORS.extract} />

          {/* ── Node 3.5: 坐标注入（硬规则） ── */}
          <NodeCard
            icon={<LinkOutlined />}
            title="坐标注入"
            subtitle="硬规则 · block_id → bbox + document_id"
            color={COLORS.inject}
            width={300}
          >
            <CodeBlock
              content={data.document_id || '—'}
              maxHeight={60}
              label="📎 注入 document_id"
            />
          </NodeCard>

          <HConnector color={COLORS.inject} />

          {/* ── Node 4: 合并入库 (按表单分多节点) ── */}
          {(() => {
            const logsByForm = {};
            (data.merge_log || []).forEach(log => {
              if (!logsByForm[log.form]) logsByForm[log.form] = [];
              logsByForm[log.form].push(log);
            });

            const forms = Object.keys(logsByForm);
            
            if (forms.length === 0) {
              return (
                <NodeCard
                  icon={<DatabaseOutlined />}
                  title="合并入库"
                  subtitle="未产生任何合并记录"
                  color={COLORS.merge}
                  width={340}
                >
                  <MergeLogTable log={[]} />
                </NodeCard>
              );
            }

            return (
              <div style={{ display: 'flex', gap: 20 }}>
                {forms.map((formName, idx) => {
                  const formLogs = logsByForm[formName];
                  const conflictCount = formLogs.filter(l => l.action === 'conflict').length;
                  
                  return (
                    <NodeCard
                      key={idx}
                      icon={<DatabaseOutlined />}
                      title={`合并入库 · ${formName}`}
                      subtitle="fill_blank 策略 · 冲突检测"
                      color={COLORS.merge}
                      width={340}
                      badge={
                        conflictCount > 0
                          ? <Tag color="warning" style={{ borderRadius: 4 }}><WarningOutlined /> {conflictCount} 冲突</Tag>
                          : <Tag color="success" style={{ borderRadius: 4 }}>无冲突</Tag>
                      }
                    >
                      <MergeLogTable log={formLogs} />
                    </NodeCard>
                  );
                })}
              </div>
            );
          })()}
        </div>
      ) : null}
    </Modal>
  );
};

export default CrfTraceCanvas;
