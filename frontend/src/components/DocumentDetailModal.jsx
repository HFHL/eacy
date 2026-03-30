import React, { useState, useEffect, useCallback } from 'react';
import { Modal, Tabs, Spin, Tag, Button, Typography, Input, message, Empty, Alert, Space, Select } from 'antd';
import { ReloadOutlined, LoadingOutlined, FileTextOutlined, DatabaseOutlined, SaveOutlined, EditOutlined, UserOutlined } from '@ant-design/icons';
import { getOcrResult, getMetadataResult, updateMetadataResult, reOcrDocument, batchArchiveCommit, extractMetadata } from '../api/document';
import { getPatients } from '../api/patient';
import PdfViewer from './PdfViewer';

const { Text } = Typography;

const DocumentDetailModal = ({ open, document, onClose, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('ocr');
  const [ocrData, setOcrData] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [metaData, setMetaData] = useState(null);
  const [metaLoading, setMetaLoading] = useState(false);
  const [ocrTriggering, setOcrTriggering] = useState(false);
  const [metaTriggering, setMetaTriggering] = useState(false);
  const [editedMeta, setEditedMeta] = useState({});
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [patients, setPatients] = useState([]);
  const [fetchingPatients, setFetchingPatients] = useState(false);
  const [assigning, setAssigning] = useState(false);

  const docId = document?.id;
  const status = document?.status;

  // Status checks
  const isOcrProcessing = ['PENDING', 'METADATA_EXTRACTING'].includes(status);
  const isMetaProcessing = ['EXTRACTING_METADATA'].includes(status);

  const fetchOcr = useCallback(async () => {
    if (!docId) return;
    setOcrLoading(true);
    try {
      const res = await getOcrResult(docId);
      setOcrData(res?.data || null);
    } catch {
      setOcrData(null);
    } finally {
      setOcrLoading(false);
    }
  }, [docId]);

  const fetchMeta = useCallback(async () => {
    if (!docId) return;
    setMetaLoading(true);
    try {
      const res = await getMetadataResult(docId);
      setMetaData(res?.data || null);
      setEditedMeta(res?.data?.result_json || {});
      setIsEditing(false);
    } catch {
      setMetaData(null);
    } finally {
      setMetaLoading(false);
    }
  }, [docId]);

  const fetchPatientList = useCallback(async () => {
    setFetchingPatients(true);
    try {
      const res = await getPatients({ page: 1, size: 200 });
      const payload = res?.data?.data || res?.data;
      const list = payload?.list || payload || [];
      setPatients(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('获取患者列表失败:', e);
    } finally {
      setFetchingPatients(false);
    }
  }, []);

  const handleAssignPatient = (patientId) => {
    if (!docId || !patientId) return;
    // If same patient as current, ignore
    if (patientId === document?.patient_id) return;
    const targetPatient = patients.find(p => p.id === patientId);
    const targetName = targetPatient?.metadata_json?.['患者姓名']
      || (targetPatient?.identifiers?.length ? targetPatient.identifiers[0] : null)
      || `患者 ${patientId.slice(0, 8)}`;
    Modal.confirm({
      title: '确认重新归档',
      content: `确定将此文档归档到「${targetName}」的病历夹吗？`,
      okText: '确认归档',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        setAssigning(true);
        try {
          await batchArchiveCommit([{
            document_id: docId,
            action: 'ASSIGN',
            patient_id: patientId,
            source: 'MANUAL_MODAL'
          }]);
          message.success(`已归档到「${targetName}」的病历夹`);
          if (onRefresh) onRefresh();
        } catch {
          message.error('归档指派失败');
        } finally {
          setAssigning(false);
        }
      },
    });
  };

  useEffect(() => {
    if (open && docId) {
      fetchOcr();
      fetchMeta();
      fetchPatientList();
    }
    if (!open) {
      setOcrData(null);
      setMetaData(null);
      setEditedMeta({});
      setIsEditing(false);
      setActiveTab('ocr');
    }
  }, [open, docId, fetchOcr, fetchMeta]);

  const handleReOcr = async () => {
    setOcrTriggering(true);
    try {
      await reOcrDocument(docId);
      message.success('已重新加入 OCR 队列');
      onRefresh?.();
    } catch {
      message.error('重新 OCR 失败');
    } finally {
      setOcrTriggering(false);
    }
  };

  const handleReExtract = async () => {
    setMetaTriggering(true);
    try {
      await extractMetadata(docId);
      message.success('已重新加入抽取队列');
      onRefresh?.();
    } catch {
      message.error('重新抽取失败');
    } finally {
      setMetaTriggering(false);
    }
  };

  const handleSaveMeta = async () => {
    setSaving(true);
    try {
      await updateMetadataResult(docId, editedMeta);
      message.success('元数据已保存');
      setIsEditing(false);
      fetchMeta();
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleFieldChange = (key, rawValue) => {
    setEditedMeta(prev => ({ ...prev, [key]: rawValue }));
  };

  // ─── OCR Tab ──────────────────────────────────
  const OcrPanel = () => {
    if (isOcrProcessing) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <LoadingOutlined style={{ fontSize: 32, color: '#1677ff' }} spin />
          <div style={{ marginTop: 16, color: '#8c8c8c', fontSize: 14 }}>OCR 识别中，请稍后刷新...</div>
        </div>
      );
    }
    if (ocrLoading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>;
    if (!ocrData) {
      return (
        <Empty description="暂无 OCR 结果" style={{ padding: '40px 0' }}>
          <Button type="primary" icon={<ReloadOutlined />} onClick={handleReOcr} loading={ocrTriggering}>
            触发 OCR 识别
          </Button>
        </Empty>
      );
    }
    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Tag color={ocrData.status === 'SUCCESS' ? 'success' : ocrData.status === 'FAILED' ? 'error' : 'processing'}>
              {ocrData.status === 'SUCCESS' ? '识别成功' : ocrData.status === 'FAILED' ? '识别失败' : '处理中'}
            </Tag>
            {ocrData.total_pages && <Text type="secondary" style={{ fontSize: 12 }}>共 {ocrData.total_pages} 页</Text>}
            {ocrData.duration_ms && <Text type="secondary" style={{ fontSize: 12 }}>耗时 {(ocrData.duration_ms / 1000).toFixed(1)}s</Text>}
            {ocrData.provider && <Tag style={{ fontSize: 11 }}>{ocrData.provider}</Tag>}
          </div>
          <Button size="small" icon={<ReloadOutlined />} onClick={handleReOcr} loading={ocrTriggering}>重新 OCR</Button>
        </div>
        {ocrData.error_msg && (
          <Alert type="error" showIcon message={ocrData.error_msg} style={{ marginBottom: 12 }} />
        )}
        <div style={{
          background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8,
          padding: '16px 20px', maxHeight: 500, overflow: 'auto',
        }}>
          <pre style={{
            margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
            fontFamily: '"SF Mono", "Fira Code", "Consolas", monospace',
            fontSize: 12, lineHeight: 1.7, color: '#333',
          }}>
            {ocrData.ocr_markdown || '（无文本内容）'}
          </pre>
        </div>
      </div>
    );
  };

  // ─── Metadata Tab ─────────────────────────────
  const MetaPanel = () => {
    if (isMetaProcessing) {
      return (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <LoadingOutlined style={{ fontSize: 32, color: '#1677ff' }} spin />
          <div style={{ marginTop: 16, color: '#8c8c8c', fontSize: 14 }}>元数据抽取中，请稍后刷新...</div>
        </div>
      );
    }
    if (metaLoading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin /></div>;
    if (!metaData) {
      return (
        <Empty description="暂无元数据结果" style={{ padding: '40px 0' }}>
          <Button type="primary" icon={<ReloadOutlined />} onClick={handleReExtract} loading={metaTriggering}>
            触发元数据抽取
          </Button>
        </Empty>
      );
    }

    const result = metaData.result_json || {};
    const entries = Object.entries(result);

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Tag color={metaData.status === 'SUCCESS' ? 'success' : metaData.status === 'FAILED' ? 'error' : 'processing'}>
              {metaData.status === 'SUCCESS' ? '抽取成功' : metaData.status === 'FAILED' ? '抽取失败' : '处理中'}
            </Tag>
            {metaData.llm_model && <Tag style={{ fontSize: 11 }}>{metaData.llm_model}</Tag>}
            {metaData.duration_ms && <Text type="secondary" style={{ fontSize: 12 }}>耗时 {(metaData.duration_ms / 1000).toFixed(1)}s</Text>}
          </div>
          <Space size={6}>
            {isEditing ? (
              <>
                <Button size="small" onClick={() => { setEditedMeta(result); setIsEditing(false); }}>取消</Button>
                <Button size="small" type="primary" icon={<SaveOutlined />} onClick={handleSaveMeta} loading={saving}>保存</Button>
              </>
            ) : (
              <Button size="small" icon={<EditOutlined />} onClick={() => setIsEditing(true)}>编辑</Button>
            )}
            <Button size="small" icon={<ReloadOutlined />} onClick={handleReExtract} loading={metaTriggering}>重新抽取</Button>
          </Space>
        </div>
        {metaData.error_msg && (
          <Alert type="error" showIcon message={metaData.error_msg} style={{ marginBottom: 12 }} />
        )}
        {entries.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {entries.map(([key]) => {
              const currentValue = isEditing ? editedMeta[key] : result[key];
              const displayValue = currentValue === null || currentValue === undefined
                ? '' : typeof currentValue === 'object'
                ? JSON.stringify(currentValue, null, 2) : String(currentValue);
              const isComplex = typeof result[key] === 'object' && result[key] !== null;

              return (
                <div key={key} style={{
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                  padding: '6px 10px', background: '#fafafa', borderRadius: 6,
                  border: '1px solid #f0f0f0',
                }}>
                  <div style={{
                    width: 120, minWidth: 120, paddingTop: 4,
                    fontWeight: 500, fontSize: 12, color: '#595959',
                    wordBreak: 'break-all',
                  }}>
                    {key}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isEditing ? (
                      isComplex ? (
                        <Input.TextArea
                          value={displayValue}
                          onChange={e => {
                            try { handleFieldChange(key, JSON.parse(e.target.value)); }
                            catch { handleFieldChange(key, e.target.value); }
                          }}
                          autoSize={{ minRows: 2, maxRows: 6 }}
                          style={{ fontSize: 12, fontFamily: 'monospace' }}
                        />
                      ) : (
                        <Input
                          value={displayValue}
                          onChange={e => handleFieldChange(key, e.target.value || null)}
                          size="small"
                          style={{ fontSize: 12 }}
                          placeholder="null"
                          allowClear
                        />
                      )
                    ) : (
                      <div style={{ fontSize: 12, paddingTop: 4, color: currentValue === null ? '#bbb' : '#333', fontStyle: currentValue === null ? 'italic' : 'normal', wordBreak: 'break-all' }}>
                        {currentValue === null || currentValue === undefined ? 'null' : isComplex ? (
                          <pre style={{ margin: 0, fontSize: 11, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{JSON.stringify(currentValue, null, 2)}</pre>
                        ) : String(currentValue)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty description="抽取结果为空" />
        )}
      </div>
    );
  };

  // ─── Document Preview (Left Panel) ────────────
  const DocumentPreview = () => {
    if (!document) return null;
    const isPdf = document.mime_type?.includes('pdf');
    const isImage = document.mime_type?.startsWith('image/');

    // 通过后端代理访问 OSS，绕过 Referer 防盗链
    const proxyUrl = `/api/documents/${docId}/preview`;

    if (!document.oss_url) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8c8c8c' }}>
          <Empty description="文档预览不可用" />
        </div>
      );
    }

    if (isPdf) {
      return (
        <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
          <PdfViewer url={proxyUrl} scale={1.2} />
        </div>
      );
    }

    if (isImage) {
      return (
        <div style={{ width: '100%', height: '100%', overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16 }}>
          <img src={proxyUrl} alt={document.filename} style={{ maxWidth: '100%', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }} />
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8c8c8c' }}>
        <Empty description="暂不支持预览此类型文件" />
      </div>
    );
  };

  const tabItems = [
    {
      key: 'ocr',
      label: <span><FileTextOutlined style={{ marginRight: 4 }} />OCR 识别结果</span>,
      children: <OcrPanel />,
    },
    {
      key: 'meta',
      label: <span><DatabaseOutlined style={{ marginRight: 4 }} />元数据</span>,
      children: <MetaPanel />,
    },
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text strong style={{ fontSize: 15 }}>文档详情</Text>
            <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>{document?.filename}</Text>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>归档到病历夹:</Text>
            <Select
              showSearch
              placeholder="选择归档患者"
              value={document?.patient_id || undefined}
              loading={fetchingPatients || assigning}
              onChange={handleAssignPatient}
              style={{ width: 220 }}
              size="small"
              popupMatchSelectWidth={300}
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              notFoundContent={fetchingPatients ? <Spin size="small" /> : '无匹配患者'}
              options={patients.map(p => {
                const name = p.metadata_json?.['患者姓名'];
                const idStr = p.identifiers?.length ? p.identifiers[0] : '';
                const displayName = name || idStr || `患者 ${p.id.slice(0, 8)}`;
                return {
                  value: p.id,
                  label: name && idStr ? `${name} (${idStr})` : displayName,
                };
              })}
              suffixIcon={<UserOutlined />}
            />
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width="90vw"
      style={{ top: 30 }}
      styles={{ body: { padding: 0 } }}
      destroyOnHidden
    >
      <div style={{ display: 'flex', height: 'calc(85vh - 60px)', minHeight: 500 }}>
        {/* Left: Document Preview */}
        <div style={{
          flex: 1, borderRight: '1px solid #f0f0f0', background: '#f8f9fa',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
            <Text strong style={{ fontSize: 13, color: '#595959' }}>📄 文档原文</Text>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <DocumentPreview />
          </div>
        </div>

        {/* Right: OCR + Metadata Tabs */}
        <div style={{ width: 520, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 20px' }}>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={tabItems}
              size="small"
              style={{ height: '100%' }}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DocumentDetailModal;
