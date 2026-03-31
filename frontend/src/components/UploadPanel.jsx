/**
 * 上传面板 + 悬浮球组件（新版 AIProcessing 使用）
 * 支持：文件选择、文件夹选择、拖拽上传、OSS 并发上传、进度跟踪
 */
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  Drawer,
  Upload,
  Button,
  Progress,
  Space,
  Typography,
  Tag,
  Tooltip,
  Badge,
  List,
  Empty,
  Tabs,
  Statistic,
  Row,
  Col,
  message,
  Divider,
} from 'antd';
import {
  CloudUploadOutlined,
  UploadOutlined,
  FolderOpenOutlined,
  InboxOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  DeleteOutlined,
  CloseOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  FileOutlined,
  WarningOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import OSS from 'ali-oss';
import { getUploadSignature, reportUploadCallback } from '../api/document';

const { Text, Title } = Typography;
const { Dragger } = Upload;

/* ─── 并发队列 ─── */
const uploadQueue = [];
let activeUploads = 0;
let MAX_CONCURRENT = 3;

const processQueue = () => {
  if (activeUploads >= MAX_CONCURRENT || uploadQueue.length === 0) return;
  activeUploads++;
  const { taskFn, resolve, reject } = uploadQueue.shift();
  taskFn()
    .then(resolve)
    .catch(reject)
    .finally(() => {
      activeUploads--;
      processQueue();
    });
};

const enqueueUpload = (taskFn) =>
  new Promise((resolve, reject) => {
    uploadQueue.push({ taskFn, resolve, reject });
    processQueue();
  });

/* ─── 工具函数 ─── */
const formatSize = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let s = bytes, i = 0;
  while (s >= 1024 && i < units.length - 1) { s /= 1024; i++; }
  return `${s.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
};

const getFileIcon = (mime) => {
  if (mime?.startsWith('image/')) return <FileImageOutlined style={{ color: '#52c41a' }} />;
  if (mime === 'application/pdf') return <FilePdfOutlined style={{ color: '#ff4d4f' }} />;
  return <FileOutlined style={{ color: '#1890ff' }} />;
};

/* ─── 上传核心逻辑 ─── */
const doOssUpload = async (file, onProgress) => {
  const signRes = await getUploadSignature();
  const payload = signRes.data || signRes;
  const { accessKeyId, accessKeySecret, stsToken, region, bucket, dir } = payload;

  if (!stsToken) throw new Error('未获取到 OSS STS 令牌');

  // region 可能带或不带 'oss-' 前缀，OSS SDK 要求不带
  const sdkRegion = region.startsWith('oss-') ? region : `oss-${region}`;
  // callback URL 使用完整的 region 字符串（带 oss-）
  const endpointRegion = region.startsWith('oss-') ? region : `oss-${region}`;

  const client = new OSS({
    region: sdkRegion,
    accessKeyId,
    accessKeySecret,
    stsToken,
    bucket,
    timeout: 60000,  // 60 秒超时
    refreshSTSToken: async () => {
      const r = await getUploadSignature();
      const rp = r.data || r;
      return { accessKeyId: rp.accessKeyId, accessKeySecret: rp.accessKeySecret, stsToken: rp.stsToken };
    },
  });

  const ossKey = `${dir}${Date.now()}_${file.name}`;
  const cpKey = `upload_cp_${file.name}_${file.size}`;
  const savedCp = localStorage.getItem(cpKey);
  const checkpoint = savedCp ? JSON.parse(savedCp) : undefined;

  await client.multipartUpload(ossKey, file, {
    parallel: 1,               // 串行上传，避免网络波动导致并发分片失败
    partSize: 1 * 1024 * 1024, // 1MB/片，小分片更容易重传
    progress: (p, cpt) => {
      if (cpt) localStorage.setItem(cpKey, JSON.stringify(cpt));
      onProgress(Math.round(p * 100));
    },
    checkpoint,
  });

  localStorage.removeItem(cpKey);

  // 构建正确的 OSS URL（bucket.endpoint/key 格式）
  const ossUrl = `${bucket}.${endpointRegion}.aliyuncs.com/${ossKey}`;
  await reportUploadCallback(
    ossUrl,
    file.name,
    file.type || 'application/octet-stream',
    file.size
  );
};

/* ─── 悬浮球组件 ─── */
const UploadFloatingButton = ({ tasks, onOpen }) => {
  const [minimized, setMinimized] = useState(false);
  const [pos, setPos] = useState({ x: null, y: null });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startPX: 0, startPY: 0, moved: false });
  const btnRef = useRef(null);

  const stats = useMemo(() => {
    const uploading = tasks.filter(t => t.status === 'uploading').length;
    const pending   = tasks.filter(t => t.status === 'pending').length;
    const success   = tasks.filter(t => t.status === 'success').length;
    const failed    = tasks.filter(t => t.status === 'failed').length;
    return { total: tasks.length, uploading, pending, success, failed };
  }, [tasks]);

  const totalProgress = useMemo(() => {
    if (stats.total === 0) return 0;
    const weighted = tasks.reduce((sum, t) => {
      if (t.status === 'success') return sum + 100;
      if (t.status === 'uploading') return sum + (t.progress || 0);
      if (t.status === 'failed') return sum + 100;
      return sum;
    }, 0);
    return Math.round(weighted / stats.total);
  }, [tasks, stats]);

  const activeCount = stats.uploading + stats.pending;
  const phase = useMemo(() => {
    if (stats.total === 0) return 'idle';
    if (activeCount > 0) return 'uploading';
    if (stats.failed > 0) return 'failed';
    if (stats.success === stats.total) return 'allDone';
    return 'idle';
  }, [stats, activeCount]);

  useEffect(() => {
    if (phase === 'allDone') {
      const t = setTimeout(() => setMinimized(true), 4000);
      return () => clearTimeout(t);
    }
    if (phase === 'uploading') setMinimized(false);
  }, [phase]);

  const phaseConfig = {
    uploading: { color: '#1677ff', tooltip: `正在上传 ${activeCount} 个文件...` },
    failed:    { color: '#ff4d4f', tooltip: `${stats.failed} 个文件上传失败` },
    allDone:   { color: '#52c41a', tooltip: '全部上传完成' },
    idle:      { color: '#8c8c8c', tooltip: '上传任务' },
  };
  const cfg = phaseConfig[phase] || phaseConfig.idle;

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    const rect = btnRef.current?.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX, startY: e.clientY,
      startPX: pos.x ?? rect?.left ?? 0,
      startPY: pos.y ?? rect?.top ?? 0,
      moved: false,
    };
    setDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragRef.current.moved = true;
      setPos({ x: dragRef.current.startPX + dx, y: dragRef.current.startPY + dy });
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging]);

  const handleClick = () => {
    if (dragRef.current.moved) { dragRef.current.moved = false; return; }
    onOpen();
  };

  const posStyle = pos.x != null ? { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } : {};
  const phaseClass = { uploading: 'upload-float-uploading', failed: 'upload-float-failed', allDone: 'upload-float-done', idle: '' }[phase] || '';

  return (
    <Tooltip title={cfg.tooltip} placement="left" open={dragging ? false : undefined}>
      <div
        ref={btnRef}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
        style={{
          position: 'fixed', right: 24, bottom: 24, zIndex: 1050,
          cursor: 'pointer', userSelect: 'none',
          ...posStyle,
        }}
      >
        <div style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#fff',
          borderRadius: minimized ? '50%' : 28,
          padding: minimized ? 4 : '6px 16px 6px 6px',
          boxShadow: phase === 'uploading'
            ? '0 4px 20px rgba(22,119,255,0.25), 0 2px 4px rgba(0,0,0,0.08)'
            : phase === 'failed'
            ? '0 4px 16px rgba(255,77,79,0.2)'
            : '0 4px 16px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)',
          transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          border: phase === 'failed' ? '1px solid #ffccc7' : phase === 'allDone' ? '1px solid #b7eb8f' : '1px solid transparent',
          animation: phase === 'uploading' ? 'uploadPulse 2s ease-in-out infinite' : undefined,
        }}>
          <style>{`
            @keyframes uploadPulse {
              0%,100% { box-shadow: 0 4px 20px rgba(22,119,255,0.25), 0 2px 4px rgba(0,0,0,0.08); }
              50% { box-shadow: 0 4px 28px rgba(22,119,255,0.45), 0 2px 8px rgba(22,119,255,0.2); }
            }
          `}</style>

          <Progress
            type="circle"
            percent={totalProgress}
            size={minimized ? 40 : 52}
            strokeColor={cfg.color}
            trailColor="rgba(0,0,0,0.06)"
            strokeWidth={6}
            format={() => null}
          />
          {/* Center icon overlay */}
          <div style={{
            position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)',
            width: minimized ? 40 : 52, height: minimized ? 40 : 52,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: minimized ? 16 : 20, color: cfg.color, pointerEvents: 'none',
          }}>
            <Badge count={activeCount > 0 ? activeCount : 0} size="small" offset={[4, -4]}>
              {phase === 'uploading' ? <LoadingOutlined spin />
               : phase === 'failed'  ? <WarningOutlined />
               : phase === 'allDone' ? <CheckCircleOutlined />
               : <CloudUploadOutlined />}
            </Badge>
          </div>

          {!minimized && (
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(0,0,0,0.85)' }}>
                {phase === 'uploading' && `${stats.success}/${stats.total}`}
                {phase === 'failed' && `${stats.failed} 失败`}
                {phase === 'allDone' && '完成'}
                {phase === 'idle' && (stats.total > 0 ? `${stats.total} 任务` : '上传')}
              </div>
            </div>
          )}
        </div>
      </div>
    </Tooltip>
  );
};

/* ─── 拖拽条（原生实现，高度完全可控）─── */
const DropZone = ({ onFiles }) => {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
      }}
      style={{
        height: 60,
        border: `1px dashed ${dragOver ? '#1677ff' : '#d9d9d9'}`,
        borderRadius: 6,
        background: dragOver ? '#e6f4ff' : '#fafafa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 12,
        transition: 'all 0.2s',
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      <InboxOutlined style={{ fontSize: 14, color: dragOver ? '#1677ff' : '#8c8c8c' }} />
      <span style={{ fontSize: 12, color: dragOver ? '#1677ff' : '#8c8c8c' }}>
        拖拽文件 / 文件夹到这里上传
      </span>
    </div>
  );
};

/* ─── 主面板 ─── */
const UploadPanel = ({ onUploadComplete, maxConcurrent = 3, externalOpen, onExternalOpenChange }) => {
  MAX_CONCURRENT = maxConcurrent;

  const [panelOpen, setPanelOpen] = useState(false);
  
  // 外部控制开关（顶部按鈕触发）
  useEffect(() => {
    if (externalOpen) {
      setPanelOpen(true);
      onExternalOpenChange?.(false);
    }
  }, [externalOpen]);

  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const updateTask = useCallback((id, patch) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t));
  }, []);

  const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];

  const enqueueFiles = useCallback((files) => {
    const validFiles = Array.from(files).filter(f => {
      const ok = ALLOWED_TYPES.includes(f.type) || f.name.match(/\.(pdf|jpg|jpeg|png|tiff)$/i);
      if (!ok) message.warning(`${f.name} 格式不支持，已跳过`);
      return ok;
    });

    if (validFiles.length === 0) return;

    const newTasks = validFiles.map(file => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      file,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      status: 'pending',   // pending | uploading | success | failed
      progress: 0,
      error: null,
    }));

    setTasks(prev => [...newTasks, ...prev]);
    setPanelOpen(true);

    // 立即开始上传
    newTasks.forEach(task => {
      enqueueUpload(() => {
        updateTask(task.id, { status: 'uploading' });
        return doOssUpload(task.file, (pct) => updateTask(task.id, { progress: pct }))
          .then(() => {
            updateTask(task.id, { status: 'success', progress: 100 });
            message.success(`${task.fileName} 上传成功`);
            onUploadComplete?.();
          })
          .catch((err) => {
            updateTask(task.id, { status: 'failed', error: err?.message || '上传失败' });
          });
      });
    });
  }, [updateTask, onUploadComplete]);

  // 文件 input change
  const handleFileChange = (e) => {
    if (e.target.files?.length) enqueueFiles(e.target.files);
    e.target.value = '';
  };

  // 文件夹 input change
  const handleFolderChange = (e) => {
    if (e.target.files?.length) enqueueFiles(e.target.files);
    e.target.value = '';
  };

  // antd Dragger 自定义请求（拖拽）
  const handleDraggerRequest = ({ file, onSuccess, onError, onProgress }) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const task = { id, file, fileName: file.name, fileSize: file.size, fileType: file.type, status: 'uploading', progress: 0, error: null };
    setTasks(prev => [task, ...prev]);
    setPanelOpen(true);

    enqueueUpload(() =>
      doOssUpload(file, (pct) => {
        updateTask(id, { progress: pct });
        onProgress({ percent: pct });
      })
        .then(() => {
          updateTask(id, { status: 'success', progress: 100 });
          onSuccess({}, file);
          onUploadComplete?.();
        })
        .catch((err) => {
          updateTask(id, { status: 'failed', error: err?.message });
          onError(err);
        })
    );
  };

  // beforeUpload 拦截每个文件（antd 每条文件调用一次，直接传入原始 File 对象）
  const handleBeforeUpload = useCallback((file) => {
    enqueueFiles([file]);
    return false; // 返回 false 露止 antd 自动上传
  }, [enqueueFiles]);

  const retryTask = useCallback((id) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    updateTask(id, { status: 'uploading', progress: 0, error: null });
    enqueueUpload(() =>
      doOssUpload(task.file, (pct) => updateTask(id, { progress: pct }))
        .then(() => { updateTask(id, { status: 'success', progress: 100 }); onUploadComplete?.(); })
        .catch((err) => updateTask(id, { status: 'failed', error: err?.message }))
    );
  }, [tasks, updateTask, onUploadComplete]);

  const removeTask  = useCallback((id) => setTasks(prev => prev.filter(t => t.id !== id)), []);
  const clearAll    = useCallback(() => setTasks([]), []);
  const clearDone   = useCallback(() => setTasks(prev => prev.filter(t => t.status !== 'success')), []);

  const stats = useMemo(() => ({
    total:     tasks.length,
    pending:   tasks.filter(t => t.status === 'pending').length,
    uploading: tasks.filter(t => t.status === 'uploading').length,
    success:   tasks.filter(t => t.status === 'success').length,
    failed:    tasks.filter(t => t.status === 'failed').length,
  }), [tasks]);

  const filteredTasks = useMemo(() => {
    if (activeTab === 'uploading') return tasks.filter(t => t.status === 'uploading' || t.status === 'pending');
    if (activeTab === 'success') return tasks.filter(t => t.status === 'success');
    if (activeTab === 'failed') return tasks.filter(t => t.status === 'failed');
    return tasks;
  }, [tasks, activeTab]);

  const totalProgress = useMemo(() => {
    if (stats.total === 0) return 0;
    const w = tasks.reduce((s, t) => s + (t.status === 'success' ? 100 : t.status === 'uploading' ? t.progress : t.status === 'failed' ? 100 : 0), 0);
    return Math.round(w / stats.total);
  }, [tasks, stats]);

  const tabItems = [
    { key: 'all',       label: <Badge count={stats.total} size="small" offset={[8,0]}>全部</Badge> },
    { key: 'uploading', label: <Badge count={stats.uploading + stats.pending} size="small" offset={[8,0]} color="blue">上传中</Badge> },
    { key: 'success',   label: <Badge count={stats.success} size="small" offset={[8,0]} color="green">已完成</Badge> },
    { key: 'failed',    label: <Badge count={stats.failed} size="small" offset={[8,0]} color="red">失败</Badge> },
  ];

  return (
    <>
      {/* 悬浮球 */}
      {(stats.total > 0) && (
        <UploadFloatingButton tasks={tasks} onOpen={() => setPanelOpen(true)} />
      )}

      {/* 上传 Drawer */}
      <Drawer
        title={
          <Space>
            <CloudUploadOutlined />
            <span>上传任务</span>
            {stats.uploading > 0 && <Tag color="processing" icon={<LoadingOutlined />}>上传中</Tag>}
          </Space>
        }
        placement="right"
        width={480}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        extra={
          <Space>
            {stats.success > 0 && (
              <Button size="small" icon={<ClearOutlined />} onClick={clearDone}>清除已完成</Button>
            )}
            <Button size="small" danger icon={<DeleteOutlined />} onClick={clearAll} disabled={stats.total === 0}>清空</Button>
          </Space>
        }
      >
        {/* 拖拽区（原生实现，高度可控） */}
        <DropZone onFiles={enqueueFiles} />

        {/* 按钮行：用 antd Upload 包裹，让浏览器原生处理文件选择弹窗 */}
        <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'center' }}>
          {/* 选择文件 */}
          <Upload
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.tiff"
            showUploadList={false}
            beforeUpload={handleBeforeUpload}
          >
            <Button type="primary" icon={<UploadOutlined />}>选择文件</Button>
          </Upload>

          {/* 选择文件夹 */}
          <Upload
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.tiff"
            showUploadList={false}
            beforeUpload={handleBeforeUpload}
            directory
          >
            <Button icon={<FolderOpenOutlined />}>选择文件夹</Button>
          </Upload>
        </Space>

        {/* 统计 */}
        {stats.total > 0 && (
          <div style={{ padding: 16, background: '#fafafa', borderRadius: 8, marginBottom: 12 }}>
            <Row gutter={16}>
              <Col span={6}><Statistic title="总计" value={stats.total} valueStyle={{ fontSize: 18 }} /></Col>
              <Col span={6}><Statistic title="成功" value={stats.success} valueStyle={{ fontSize: 18, color: '#52c41a' }} /></Col>
              <Col span={6}><Statistic title="失败" value={stats.failed} valueStyle={{ fontSize: 18, color: '#ff4d4f' }} /></Col>
              <Col span={6}><Statistic title="进度" value={totalProgress} suffix="%" valueStyle={{ fontSize: 18 }} /></Col>
            </Row>
            <Progress
              percent={totalProgress}
              status={stats.failed > 0 ? 'exception' : totalProgress === 100 ? 'success' : 'active'}
              style={{ marginTop: 10, marginBottom: 0 }}
            />
          </div>
        )}

        {/* Task List */}
        {stats.total > 0 && (
          <>
            <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="small" />
            {filteredTasks.length === 0
              ? <Empty description="暂无任务" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 32 }} />
              : (
                <List
                  dataSource={filteredTasks}
                  style={{ maxHeight: 'calc(100vh - 500px)', overflow: 'auto' }}
                  renderItem={(task) => {
                    const canRetry = task.status === 'failed';
                    const isDone = task.status === 'success' || task.status === 'failed';
                    return (
                      <List.Item
                        key={task.id}
                        style={{
                          padding: '10px 12px',
                          background: task.status === 'failed' ? '#fff2f0' : 'transparent',
                          borderRadius: 8, marginBottom: 6,
                          border: '1px solid #f0f0f0',
                        }}
                        actions={[
                          canRetry && (
                            <Tooltip title="重试">
                              <Button type="text" size="small" icon={<ReloadOutlined />} onClick={() => retryTask(task.id)} />
                            </Tooltip>
                          ),
                          isDone && (
                            <Tooltip title="移除">
                              <Button type="text" size="small" icon={<DeleteOutlined />} onClick={() => removeTask(task.id)} />
                            </Tooltip>
                          ),
                        ].filter(Boolean)}
                      >
                        <List.Item.Meta
                          avatar={getFileIcon(task.fileType)}
                          title={
                            <Space size="small">
                              <Text style={{ maxWidth: 180 }} ellipsis={{ tooltip: task.fileName }}>{task.fileName}</Text>
                              {{
                                pending:   <Tag color="default" icon={<ClockCircleOutlined />}>待上传</Tag>,
                                uploading: <Tag color="processing" icon={<LoadingOutlined />}>上传中</Tag>,
                                success:   <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>,
                                failed:    <Tag color="error" icon={<CloseCircleOutlined />}>失败</Tag>,
                              }[task.status]}
                            </Space>
                          }
                          description={
                            <div>
                              <Text type="secondary" style={{ fontSize: 12 }}>{formatSize(task.fileSize)}</Text>
                              {task.status === 'uploading' && (
                                <Progress percent={task.progress} size="small" style={{ marginTop: 4, marginBottom: 0 }}
                                  strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }} />
                              )}
                              {task.error && (
                                <div style={{ marginTop: 4 }}>
                                  <Text type="danger" style={{ fontSize: 12 }}>
                                    <WarningOutlined /> {task.error}
                                  </Text>
                                </div>
                              )}
                            </div>
                          }
                        />
                      </List.Item>
                    );
                  }}
                />
              )
            }
          </>
        )}

        {stats.total === 0 && (
          <Empty description="暂无上传任务" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 32 }} />
        )}
      </Drawer>
    </>
  );
};

export { UploadPanel as default, UploadFloatingButton };
