import React, { useState, useEffect, useCallback } from 'react';
import OSS from 'ali-oss';
import {
  Typography,
  Button,
  Space,
  Table,
  Input,
  Tag,
  Tooltip,
  Modal,
  Badge,
  message,
  Dropdown,
  Select,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  UploadOutlined,
  FilePdfOutlined,
  FileImageOutlined,
  MoreOutlined,
  LoadingOutlined,
  DeleteOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  RobotOutlined,
  FolderAddOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  FileTextOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  UserAddOutlined,
  RightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api, { getDocumentList, getSystemConfig, deleteDocument, reOcrDocument, extractMetadata, archiveDocument, archiveDocumentNew } from '../api/document';
import { getPatients } from '../api/patient';
import UploadPanel from '../components/UploadPanel';
import DocumentDetailModal from '../components/DocumentDetailModal';
import GroupRowDisplay from '../components/GroupRowDisplay';
import PatientConflictDrawer from '../components/PatientConflictDrawer';



const { Text } = Typography;

// Formatting Utils
const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
};

const formatTime = (timeStr) => {
  if (!timeStr) return '--';
  return dayjs(timeStr).format('YYYY/MM/DD HH:mm');
};

const TaskStatusBadge = ({ status }) => {
  const map = {
    uploaded: { color: 'default', text: '待解析' },
    PENDING: { color: 'default', text: '等待分发' },
    METADATA_EXTRACTING: { color: 'processing', text: 'OCR 识别中', icon: <LoadingOutlined spin /> },
    parsing: { color: 'processing', text: '解析中', icon: <LoadingOutlined spin /> },
    parsed: { color: 'blue', text: '等待抽取' },
    extracted: { color: 'blue', text: '抽取完成' },
    ai_matching: { color: 'processing', text: '匹配中', icon: <LoadingOutlined spin /> },
    auto_archived: { color: 'cyan', text: '高置信引流' },
    pending_confirm_review: { color: 'orange', text: '有候选推荐' },
    COMPLETED: { color: 'success', text: 'OCR 完成' },
    EXTRACTING_METADATA: { color: 'processing', text: '元数据抽取中', icon: <LoadingOutlined spin /> },
    EXTRACT_DONE: { color: 'success', text: '抽取完成' },
    EXTRACT_FAILED: { color: 'error', text: '抽取失败' },
    archived: { color: 'success', text: '已归档' },
    ARCHIVED: { color: 'success', text: '已归档', icon: <CheckCircleOutlined /> },
    METADATA_FAILED: { color: 'error', text: 'OCR 失败' },
    parse_failed: { color: 'error', text: '解析失败' },
  };
  const conf = map[status] || { color: 'default', text: status };
  return (
    <Tag color={conf.color} style={{ borderRadius: 4, padding: '2px 8px' }}>
      {conf.icon && <span style={{ marginRight: 4 }}>{conf.icon}</span>}
      {conf.text}
    </Tag>
  );
};

// Simplified ProgressBar for Status
const STAGE_LABELS = ['上传', '识别', '抽取', '匹配', '归档'];
const StatusProgressBar = ({ status }) => {
  const map = {
    uploaded: { filled: 1 },
    PENDING: { filled: 0 },
    METADATA_EXTRACTING: { filled: 1, processing: true },
    parsing: { filled: 1, processing: true },
    parsed: { filled: 2 },
    COMPLETED: { filled: 2 },
    EXTRACTING_METADATA: { filled: 2, processing: true },
    EXTRACT_DONE: { filled: 3 },
    EXTRACT_FAILED: { filled: 2, failed: true },
    extracted: { filled: 3 },
    ai_matching: { filled: 3, processing: true },
    auto_archived: { filled: 4, pending: true },
    pending_confirm_review: { filled: 4, pending: true },
    archived: { filled: 5, done: true },
    ARCHIVED: { filled: 5, done: true },
    METADATA_FAILED: { filled: 1, failed: true },
    parse_failed: { filled: 1, failed: true },
  };
  const { filled = 0, processing, failed, pending, done } = map[status] || {};
  
  let filledColor = '#1677ff';
  let textColor = '#8c8c8c';
  if (done)          { filledColor = '#52c41a'; textColor = '#52c41a'; }
  else if (pending)  { filledColor = '#faad14'; textColor = '#fa8c16'; }
  else if (failed)   { textColor = '#ff4d4f'; }
  else if (processing) { textColor = '#1677ff'; }
  
  const getSegColor = (idx) => {
    if (failed && idx === filled) return '#ff4d4f';
    if (processing && idx === filled) return done ? filledColor : '#91caff';
    if (idx < filled) return filledColor;
    return '#f0f0f0';
  };

  const textMap = {
    uploaded: '解析中',
    PENDING: '等待分发',
    METADATA_EXTRACTING: 'OCR识别中',
    parsing: '解析中',
    parsed: '解析中',
    COMPLETED: 'OCR完成',
    EXTRACTING_METADATA: '正在抽取',
    EXTRACT_DONE: '等待归档',
    EXTRACT_FAILED: '抽取失败',
    extracted: '解折中',
    ai_matching: '解析中',
    auto_archived: '待归档',
    pending_confirm_review: '待归档',
    archived: '已归档',
    ARCHIVED: '已归档',
    METADATA_FAILED: '异常',
    parse_failed: '异常',
  };
  const textLabel = textMap[status] || (failed ? '异常' : done ? '已归档' : processing ? '进行中' : pending ? '待确认' : '解析中');
  
  return (
    <Tooltip title={STAGE_LABELS.join(' → ')}>
      <div style={{ width: '100%', minWidth: 90 }}>
        <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
          {STAGE_LABELS.map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1, height: 6, borderRadius: 3,
                background: getSegColor(i),
                transition: 'background 0.3s'
              }}
            />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {processing && <LoadingOutlined spin style={{ fontSize: 10, color: '#1677ff' }} />}
          <span style={{ fontSize: 11, color: textColor, lineHeight: 1, whiteSpace: 'nowrap' }}>
            {textLabel}
          </span>
        </div>
      </div>
    </Tooltip>
  );
};

const AIProcessing = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [uploadPanelOpen, setUploadPanelOpen] = useState(false);
  const [batchAssignModalOpen, setBatchAssignModalOpen] = useState(false);
  const [assignTargetPatientId, setAssignTargetPatientId] = useState(null);
  const [assigningDocs, setAssigningDocs] = useState([]);
  
  // 分组归档向导器状态 —— 缓存 key 绑定到当前用户 ID，防止不同用户间数据泄漏
  const currentUserId = (() => {
    try { return JSON.parse(localStorage.getItem('eacy_user') || '{}').id || 'anon'; } catch { return 'anon'; }
  })();
  const CLUSTERS_CACHE_KEY = `eacy_ai_archive_clusters_${currentUserId}`;

  const [clusters, setClusters] = useState(() => {
    try {
      const cached = localStorage.getItem(CLUSTERS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [patients, setPatients] = useState([]);
  const [committingId, setCommittingId] = useState(null);
  const [decisions, setDecisions] = useState({});
  const [pendingCommit, setPendingCommit] = useState(null);

  // 同步 clusters 到 localStorage
  useEffect(() => {
    try {
      if (clusters.length > 0) {
        localStorage.setItem(CLUSTERS_CACHE_KEY, JSON.stringify(clusters));
      } else {
        localStorage.removeItem(CLUSTERS_CACHE_KEY);
      }
    } catch {
      // 忽略存储错误（如无痕模式）
    }
  }, [clusters]);

  // 启动时清除旧格式（无用户 ID 后缀）的缓存 key，防止跨用户数据残留
  useEffect(() => {
    localStorage.removeItem('eacy_ai_archive_clusters');
  }, []);
  
  // 受控展开/折叠（患者文件夹 + 集群分组行）
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);

  // Document Detail Modal State
  const [detailDoc, setDetailDoc] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false); // Renamed from detailVisible
  
  const [fileList, setFileList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [tabsCount, setTabsCount] = useState({ all: 0, parse: 0, todo: 0, archived: 0 });

  // Tab → 后端 task_status 映射（按 Document 模型实际 status 常量）
  const TAB_STATUS_MAP = {
    all: null,
    // 待解析：上传后进入解析流程的各阶段（含失败）
    parse: 'PENDING,UPLOADING,UPLOAD_FAILED,METADATA_EXTRACTING,METADATA_FAILED,COMPLETED,EXTRACTING_METADATA,EXTRACT_FAILED',
    // 待归档：已完成抽取，等待人工确认归档
    todo: 'EXTRACT_DONE',
    // 已归档
    archived: 'ARCHIVED',
  };

  // Tabs config
  const tabs = [
    { key: 'all', label: '全部', count: tabsCount.all },
    { key: 'parse', label: '待解析', count: tabsCount.parse },
    { key: 'todo', label: '待归档', count: tabsCount.todo },
    { key: 'archived', label: '已归档', count: tabsCount.archived },
  ];

  const fetchDocuments = async (tabOverride) => {
    const tab = tabOverride !== undefined ? tabOverride : activeTab;
    setLoading(true);
    try {
      const taskStatus = TAB_STATUS_MAP[tab] || undefined;
      const res = await getDocumentList({ 
        task_status: taskStatus,
        keyword: searchText || undefined
      });
      // The backend returns { success: true, data: [{}, {}] }
      // Because we use an axios interceptor that returns response.data,
      // `res` itself is { success: true, data: [...] }
      if (res && Array.isArray(res.data)) {
        setFileList(res.data);
        setTotal(res.data.length);
      } else if (res && Array.isArray(res)) {
         // Fallback if the API returns a direct array
         setFileList(res);
         setTotal(res.length);
      }
    } catch (error) {
      console.error('Fetch documents failed', error);
      message.error('获取文档列表失败');
    } finally {
      setLoading(false);
    }
  };

  // 并行获取每个 Tab 的文档总数
  const fetchTabCounts = async () => {
    try {
      const [allRes, parseRes, todoRes, archivedRes] = await Promise.allSettled([
        getDocumentList({ keyword: searchText || undefined }),
        getDocumentList({ task_status: TAB_STATUS_MAP.parse, keyword: searchText || undefined }),
        getDocumentList({ task_status: TAB_STATUS_MAP.todo, keyword: searchText || undefined }),
        getDocumentList({ task_status: TAB_STATUS_MAP.archived, keyword: searchText || undefined }),
      ]);
      const getCount = (r) => {
        if (r.status !== 'fulfilled') return 0;
        const v = r.value;
        if (v && Array.isArray(v.data)) return v.data.length;
        if (v && Array.isArray(v)) return v.length;
        return 0;
      };
      setTabsCount({
        all: getCount(allRes),
        parse: getCount(parseRes),
        todo: getCount(todoRes),
        archived: getCount(archivedRes),
      });
    } catch (e) {
      // 计数失败不阻断主流程
    }
  };

  const handleOpenGlobalBatchWizard = async () => {
    // Both 'EXTRACT_DONE' and 'extracted' designate metadata extraction completion
    const extractedDocs = fileList.filter(doc => doc.status === 'EXTRACT_DONE' || doc.status === 'extracted');
    if (extractedDocs.length === 0) {
      message.info('当前列表中没有任何“抽取完成”等待去向归档的文档');
      return;
    }
    const ids = extractedDocs.map(doc => doc.id);
    
    setLoading(true);
    try {
      const pRes = await getPatients({ page: 1, size: 200 });
      if (pRes?.data?.list) setPatients(pRes.data.list);

      const res = await api.post('/batch/preflight', { document_ids: ids });
      if (res.data) {
        setClusters(res.data);
        message.success(`成功整理出 ${res.data.length} 个建议分组！`);
      }
    } catch (error) {
       message.error('预检分组请求失败');
    } finally {
       setLoading(false);
    }
  };

  const handlePrepareCommit = (cluster, action, patientOrId = null) => {
    const pId = (patientOrId && typeof patientOrId === 'object') ? patientOrId.id : patientOrId;
    setPendingCommit({ cluster, action, patientId: pId });
  };

  const handleDrawerCommit = async (payload) => {
    const cid = pendingCommit.cluster.cluster_id;
    setCommittingId(cid);
    try {
      await api.post('/batch/commit', { 
        ...payload, 
        source: pendingCommit.cluster.tier === 1 ? 'AUTO' : 'MANUAL_BATCH' 
      });
      message.success(`成功为 ${payload.document_ids.length} 份文件执行归档`);
      
      const newClusters = clusters.filter(c => c.cluster_id !== cid);
      setClusters(newClusters);
      setPendingCommit(null);
      setSelectedRowKeys([]);
      fetchDocuments();
    } catch (e) {
      message.error(e?.response?.data?.message || '归档提交失败');
    } finally {
      setCommittingId(null);
    }
  };

  const groupArchivedToPatientFolders = React.useCallback((docs, folderIdPrefix = 'patient_folder_') => {
    const patientMap = new Map();
    docs.forEach(doc => {
      const patientId = doc.patient_id || '__unlinked__';
      const patientName = doc.patient_name || '未关联患者';
      if (!patientMap.has(patientId)) {
        patientMap.set(patientId, {
          id: `${folderIdPrefix}${patientId}`,
          isPatientFolder: true,
          patientId,
          patientName,
          children: [],
        });
      }
      patientMap.get(patientId).children.push({ ...doc, isArchivedChild: true });
    });
    return Array.from(patientMap.values());
  }, []);

  // 已归档 Tab：按患者分组成文件夹结构（所有文档一次性取回，不存在分页丢失问题）
  const archivedGroupedData = React.useMemo(() => {
    if (activeTab !== 'archived') return null;
    return groupArchivedToPatientFolders(fileList);
  }, [activeTab, fileList, groupArchivedToPatientFolders]);

  const tableData = React.useMemo(() => {
    // 已归档 Tab：始终用患者文件夹分组，不显示 clusters
    if (activeTab === 'archived') {
      return archivedGroupedData || fileList;
    }

    // 全部 Tab：已归档文档也按患者文件夹显示；非归档文档平铺显示
    if (activeTab === 'all') {
      const archivedDocs = fileList.filter(d => d.status === 'ARCHIVED');
      const nonArchivedDocs = fileList.filter(d => d.status !== 'ARCHIVED');
      const archivedFoldersInAll = groupArchivedToPatientFolders(archivedDocs, 'all_patient_folder_');

      // 无 clusters 时：直接合并渲染
      if (clusters.length === 0) {
        return [...nonArchivedDocs, ...archivedFoldersInAll];
      }

      // 有 clusters 时：仅对非归档文档做 clusters 分组，归档文档仍按患者文件夹展示
      const clusteredDocIds = new Set();
      const groupRows = clusters.map(c => {
        c.documents.forEach(d => clusteredDocIds.add(d.id));
        return {
          id: 'group_' + c.cluster_id,
          isGroup: true,
          clusterData: c,
          children: c.documents.map(d => ({ ...d, isChild: true }))
        };
      });

      const freeDocs = nonArchivedDocs.filter(d => !clusteredDocIds.has(d.id));
      return [...groupRows, ...freeDocs, ...archivedFoldersInAll];
    }

    // 集群分组只在"待归档" Tab 显示，不能污染"待解析"等其他 Tab
    if (clusters.length === 0 || activeTab !== 'todo') {
      return fileList;
    }

    const clusteredDocIds = new Set();
    const groupRows = clusters.map(c => {
      c.documents.forEach(d => clusteredDocIds.add(d.id));
      return {
        id: 'group_' + c.cluster_id,
        isGroup: true,
        clusterData: c,
        children: c.documents.map(d => ({ ...d, isChild: true }))
      };
    });

    // Non-clustered root docs
    const freeDocs = fileList.filter(d => !clusteredDocIds.has(d.id));
    return [...groupRows, ...freeDocs];
  }, [activeTab, fileList, clusters, archivedGroupedData, groupArchivedToPatientFolders]);

  // 如果存在缓存分组，自动拉取患者列表以保证归档操作可用
  useEffect(() => {
    if (clusters.length > 0 && patients.length === 0) {
      getPatients({ page: 1, size: 200 })
        .then(pRes => { if (pRes?.data?.list) setPatients(pRes.data.list); })
        .catch(() => {});
    }
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    setExpandedRowKeys([]); // 切换 Tab 或关键词时收起所有分组
    fetchDocuments();
    fetchTabCounts();
    getSystemConfig().then(res => {
       if (res && res.data && res.data.max_concurrent_uploads) {
           window.MAX_CONCURRENT_UPLOADS = parseInt(res.data.max_concurrent_uploads, 10) || 3;
       }
    }).catch(e => console.error('Failed to load generic config', e));
    // eslint-disable-next-line
  }, [activeTab, searchText]);

  const handleDelete = (record) => {
    Modal.confirm({
      title: '确认删除文档',
      content: `将会把文档 "${record.filename}" 移入回收站，不可继续执行自动化数据抽取逻辑。`,
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const res = await deleteDocument(record.id);
          if (res.success) {
            message.success('已移入回收站');
            fetchDocuments();
          } else {
            message.error(res.message || '删除失败');
          }
        } catch (error) {
          message.error('请求异常或后端脱机');
        }
      }
    });
  };

  const baseOnCellForGroup = (record) => {
    if (record.isGroup || record.isPatientFolder) {
      return { colSpan: 0 };
    }
    return {};
  };

  const columns = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      width: 250,
      ellipsis: true,
      onCell: (record) => {
         if (record.isGroup) return { colSpan: 6, style: { padding: '8px 16px', background: '#fafafa' } };
         if (record.isPatientFolder) return { colSpan: 6, style: { padding: '10px 20px', background: '#f0f7ff', borderLeft: '3px solid #1677ff' } };
         return {};
      },
      render: (name, record) => {
        if (record.isGroup) {
          return (
             <GroupRowDisplay 
                cluster={record.clusterData}
                committingId={committingId}
                patients={patients}
                decision={decisions[record.clusterData.cluster_id]}
                onDecisionChange={(val) => setDecisions(p => ({...p, [record.clusterData.cluster_id]: val}))}
                executeGroupCommit={handlePrepareCommit}
             />
          );
        }

        // 患者文件夹行（已归档 / 全部 Tab）
        if (record.isPatientFolder) {
          const isExpanded = expandedRowKeys.includes(record.id);
          return (
            <Space size={10} style={{ userSelect: 'none' }}>
              <RightOutlined style={{
                fontSize: 11,
                color: '#8c8c8c',
                display: 'inline-block',
                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                flexShrink: 0,
              }} />
              {isExpanded
                ? <FolderOpenOutlined style={{ color: '#1677ff', fontSize: 18, flexShrink: 0 }} />
                : <FolderOutlined    style={{ color: '#1677ff', fontSize: 18, flexShrink: 0 }} />
              }
              <Text strong style={{ fontSize: 14, color: '#1f1f1f' }}>{record.patientName}</Text>
              <Tag color="blue" style={{ fontSize: 11, padding: '0 6px', marginLeft: 4 }}>
                {record.children?.length || 0} 份文档
              </Tag>
            </Space>
          );
        }

        const icon = record.mime_type && record.mime_type.includes('pdf')
          ? <FilePdfOutlined style={{ color: '#e74c3c', fontSize: 16 }} />
          : <FileImageOutlined style={{ color: '#3498db', fontSize: 16 }} />;
        return (
          <Space size={8} style={{ cursor: 'pointer' }} onClick={() => { setDetailDoc(record); setDetailModalOpen(true); }}>
            {icon}
            <div>
              <Tooltip title={name}>
                <Text strong ellipsis style={{ display: 'block', fontSize: 13, maxWidth: 200, color: '#1677ff' }}>{name}</Text>
              </Tooltip>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {formatFileSize(record.file_size)}
              </Text>
            </div>
          </Space>
        );
      },
    },
    {
      title: '文件类型',
      dataIndex: 'document_type',
      key: 'document_type',
      width: 120,
      onCell: baseOnCellForGroup,
      render: (type) => <Tag color="blue" variant="filled">{type || '未分类'}</Tag>,
    },
    {
      title: '处理进度',
      dataIndex: 'status',
      key: 'stage',
      width: 140,
      onCell: baseOnCellForGroup,
      render: (status) => <StatusProgressBar status={status} />,
    },
    {
      title: '状态',
      key: 'status_info',
      width: 130,
      onCell: baseOnCellForGroup,
      render: (_, record) => <TaskStatusBadge status={record.status} />,
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 140,
      onCell: baseOnCellForGroup,
      render: (time) => <Text style={{ fontSize: 13, color: '#595959' }}>{formatTime(time)}</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 60,
      fixed: 'right',
      onCell: baseOnCellForGroup,
      render: (_, record) => {
        const items = [
          { key: 'reparse', icon: <ReloadOutlined />, label: '重新识别' },
          { key: 'ai_match', icon: <RobotOutlined />, label: '元数据抽取' },
          { key: 'archive_new', icon: <UserAddOutlined />, label: '新建患者', disabled: record.status === 'ARCHIVED' },
          { key: 'archive', icon: <FolderAddOutlined />, label: '推荐归档', disabled: record.status === 'ARCHIVED' },
          { type: 'divider' },
          { key: 'download', icon: <DownloadOutlined />, label: '下载' },
          { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true },
        ];
        
        const handleMenuClick = (e) => {
          if (e.key === 'delete') {
            handleDelete(record);
          } else if (e.key === 'reparse') {
            Modal.confirm({
              title: '重新识别',
              content: `将对文档 "${record.filename}" 重新执行 OCR 识别，原有识别记录不会被覆盖。`,
              okText: '确定',
              cancelText: '取消',
              onOk: async () => {
                try {
                  await reOcrDocument(record.id);
                  message.success('已重新加入 OCR 识别队列');
                  fetchDocuments();
                } catch (err) {
                  message.error('重新识别请求失败');
                }
              }
            });
          } else if (e.key === 'ai_match') {
            Modal.confirm({
              title: '元数据抽取',
              content: `将对文档 "${record.filename}" 执行 LLM 元数据抽取（需已完成 OCR 识别）。`,
              okText: '确定',
              cancelText: '取消',
              onOk: async () => {
                try {
                  await extractMetadata(record.id);
                  message.success('已加入元数据抽取队列');
                  fetchDocuments();
                } catch (err) {
                  message.error('元数据抽取请求失败');
                }
              }
            });
          } else if (e.key === 'archive') {
            Modal.confirm({
              title: '推荐归档',
              content: `将文档 "${record.filename}" 归档到匹配的患者病历夹（需已完成元数据抽取）。`,
              okText: '确认归档',
              cancelText: '取消',
              onOk: async () => {
                try {
                  const res = await archiveDocument(record.id);
                  const data = res.data || res;
                  message.success(data.message || '归档成功');
                  fetchDocuments();
                } catch (err) {
                  const errMsg = err?.response?.data?.message || '归档失败';
                  message.error(errMsg);
                }
              }
            });
          } else if (e.key === 'archive_new') {
            Modal.confirm({
              title: '新建患者',
              content: `将从文档 "${record.filename}" 提取的信息强制新建为一位新患者并归档。`,
              okText: '确认新建',
              cancelText: '取消',
              onOk: async () => {
                try {
                  const res = await archiveDocumentNew(record.id);
                  const data = res.data || res;
                  message.success(data.message || '新建并归档成功');
                  fetchDocuments();
                } catch (err) {
                  const errMsg = err?.response?.data?.message || '新建患者归档失败';
                  message.error(errMsg);
                }
              }
            });
          }
        };

        return (
          <Dropdown menu={{ items, onClick: handleMenuClick }} trigger={['click']} placement="bottomRight">
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        );
      },
    },
  ];



  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>
      
      {/* Search & Action Bar */}
      <div style={{
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #f0f0f0',
      }}>
        {/* Left Tabs implemented as flat segmented controls */}
        <Space size={4}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <Button
                key={tab.key}
                type={isActive ? 'primary' : 'text'}
                style={{
                  borderRadius: 6,
                  padding: '4px 16px',
                  height: '32px',
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? '#fff' : '#595959',
                  background: isActive ? '#1677ff' : 'transparent',
                  border: 'none',
                  transition: 'background 0.3s'
                }}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
                <Badge
                  count={tab.count}
                  size="small"
                  overflowCount={999}
                  style={{
                    marginLeft: 6,
                    backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : '#f0f0f0',
                    color: isActive ? '#fff' : '#8c8c8c',
                    boxShadow: 'none',
                  }}
                />
              </Button>
            );
          })}
        </Space>

        {/* Right Actions */}
        <Space size={16}>
          <Input
            placeholder="搜索文件名、患者姓名..."
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onPressEnter={fetchDocuments}
            style={{ width: 280, borderRadius: 4 }}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchDocuments} style={{ borderRadius: 4 }}>
            刷新
          </Button>
          <Button 
            type="primary" 
            style={{ backgroundColor: '#52c41a' }} 
            icon={<FolderAddOutlined />} 
            onClick={handleOpenGlobalBatchWizard}
          >
            一键智能归档
          </Button>
          <Button 
            type="primary" 
            icon={<UploadOutlined />} 
            onClick={() => setUploadPanelOpen(true)}
            style={{ borderRadius: 4 }}
          >
            上传文档
          </Button>
        </Space>
      </div>

      {/* Main Content Area */}
      <div style={{ padding: '24px', flex: 1, overflow: 'auto' }}>
        
        {/* Batch Operations Toolbar */}
        {selectedRowKeys.length > 0 && (
          <div style={{ 
            padding: '12px 16px', 
            background: '#e6f4ff', 
            borderRadius: 4,
            marginBottom: 16, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between' 
          }}>
            <Text style={{ color: '#1677ff', fontWeight: 500 }}>
              {`已选定 ${selectedRowKeys.length} 项（文档/分组）`}
            </Text>
            <Space>
              <Button 
                size="small" 
                type="primary" 
                icon={<UserAddOutlined />} 
                onClick={() => {
                  const selectedDocs = fileList.filter(d => selectedRowKeys.includes(d.id));
                  if (selectedDocs.length === 0) {
                     message.warning('无法找到勾选的实体文档');
                     return;
                  }
                  setPendingCommit({
                    action: 'CREATE_PATIENT',
                    cluster: {
                      cluster_id: 'manual_' + Date.now(),
                      documents: selectedDocs,
                      aggregated_identifiers: []
                    }
                  });
                }}
              >
                新建患者(手动分组)
              </Button>
              <Button size="small" type="primary" ghost>批量解析</Button>
              <Button 
                size="small" 
                ghost 
                style={{ borderColor: '#faad14', color: '#faad14' }}
                onClick={async () => {
                  const selectedDocs = fileList.filter(d => selectedRowKeys.includes(d.id));
                  if (selectedDocs.length === 0) {
                     message.warning('无法找到勾选的实体文档');
                     return;
                  }
                  setAssigningDocs(selectedDocs);
                  setAssignTargetPatientId(null);
                  setBatchAssignModalOpen(true);
                  if (patients.length === 0) {
                      const pRes = await getPatients({ page: 1, size: 500 });
                      if (pRes?.data?.list) setPatients(pRes.data.list);
                  }
                }}
              >
                批量归档(指定患者)
              </Button>
              <Button size="small" danger ghost icon={<DeleteOutlined />}>批量删除</Button>
            </Space>
          </div>
        )}

        <Table
          key={activeTab}
          columns={columns}
          dataSource={tableData}
          rowKey="id"
          loading={loading}
          expandable={{
            // 受控展开：彻底隐藏默认 + 号列，由整行点击 + chevron 动画替代
            showExpandColumn: false,
            expandedRowKeys,
            onExpandedRowsChange: setExpandedRowKeys,
          }}
          onRow={(record) => {
            if (record.isPatientFolder || record.isGroup) {
              return {
                style: { cursor: 'pointer' },
                onClick: (e) => {
                  // 若点击的是按钮/链接等交互元素则不触发展开，避免误操作
                  if (e.target.closest('button, a, input, [role="button"]')) return;
                  setExpandedRowKeys(prev =>
                    prev.includes(record.id)
                      ? prev.filter(k => k !== record.id)
                      : [...prev, record.id]
                  );
                },
              };
            }
            return {};
          }}
          rowSelection={{
            checkStrictly: false,
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            getCheckboxProps: (record) => ({
              disabled: record.isPatientFolder,
            }),
          }}
          pagination={{
            // 归档/全部 Tab 使用聚合后的根行数分页，避免文件夹展开导致空页
            total: (activeTab === 'archived' || activeTab === 'all')
              ? tableData.length
              : total,
            defaultPageSize: 100,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100', '200'],
            showTotal: (t) => activeTab === 'archived'
              ? `共 ${t} 位患者 · ${total} 份文档`
              : activeTab === 'all'
              ? `共 ${t} 行（含 ${total} 份文档）`
              : `共 ${t} 份文档`,
          }}
          size="middle"
          bordered={false}
          rowClassName={(record) => {
            if (record.isGroup) return 'expanded-group-row';
            if (record.isPatientFolder) return 'patient-folder-row';
            return 'flat-table-row';
          }}
        />
      </div>

      {/* 新版上传面板（支持文件夹，带悬浮球和侧边 Drawer） */}
      <UploadPanel
        externalOpen={uploadPanelOpen}
        onExternalOpenChange={setUploadPanelOpen}
        onUploadComplete={() => {
          fetchDocuments();
          fetchTabCounts();
        }}
      />

      {/* Document Detail Modal */}
      <DocumentDetailModal
        open={detailModalOpen}
        document={detailDoc}
        onClose={() => { setDetailModalOpen(false); setDetailDoc(null); }}
        onRefresh={fetchDocuments}
      />

      {/* Batch Assign Modal */}
      <Modal
        title={`将 ${assigningDocs.length} 份文档归入现存档案`}
        open={batchAssignModalOpen}
        onCancel={() => setBatchAssignModalOpen(false)}
        onOk={async () => {
          if (!assignTargetPatientId) return message.warning('请选择目标患者');
          try {
            await api.post('/batch/commit', { 
              action: 'ASSIGN',
              patient_id: assignTargetPatientId,
              document_ids: assigningDocs.map(d => d.id),
              final_metadata: {},
              final_identifiers: [], 
              source: 'MANUAL_BATCH'
            });
            message.success(`成功为 ${assigningDocs.length} 份文件执行归档`);
            setBatchAssignModalOpen(false);
            setSelectedRowKeys([]);
            fetchDocuments();
          } catch (e) {
            message.error(e?.response?.data?.message || '归档提交失败');
          }
        }}
        okText="确认归档"
      >
        <div style={{ padding: '16px 0' }}>
           <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
             选择下方列表中的已有患者，将强行把勾选的文档挂载到该患者名下。此操作不会合并或修改目标患者的基础信息。
           </Typography.Text>
           <Select
             showSearch
             style={{ width: '100%' }}
             placeholder="搜索或选择患者姓名"
             optionFilterProp="label"
             value={assignTargetPatientId}
             onChange={setAssignTargetPatientId}
             filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
             options={patients.map(p => ({
               value: p.id,
               label: `${p.metadata_json?.['患者姓名'] || '未知姓名'} (${p.identifiers?.[0] || '无标识符'})`
             }))}
           />
        </div>
      </Modal>

      {/* Patient Conflict Drawer */}
      <PatientConflictDrawer
        open={!!pendingCommit}
        onClose={() => setPendingCommit(null)}
        pendingCommit={pendingCommit}
        targetPatient={patients.find(p => p.id === pendingCommit?.patientId) || pendingCommit?.cluster?.suggested_patients?.find(p => p.id === pendingCommit?.patientId)}
        onCommit={handleDrawerCommit}
      />
    </div>
  );
};

export default AIProcessing;
