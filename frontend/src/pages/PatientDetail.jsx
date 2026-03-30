import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tag, Button, Spin, Empty, message, Select, DatePicker, Popconfirm } from 'antd';
import {
  ArrowLeftOutlined, EyeOutlined, DeleteOutlined,
  FileTextOutlined, FilePdfOutlined, FileImageOutlined, FileOutlined,
  DownOutlined, RightOutlined,
} from '@ant-design/icons';
import { getPatientDetail, getPatientDocuments, removePatientDocument } from '../api/patient';
import DocumentDetailModal from '../components/DocumentDetailModal';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

/* ─── 文档类型 → 图标 + 颜色 ─── */
const DOC_TYPE_CONFIG = {
  '实验室检查': { icon: <FileTextOutlined />, iconColor: '#10b981', tagBg: '#d1fae5', tagColor: '#065f46' },
  '影像检查':   { icon: <FileImageOutlined />, iconColor: '#f59e0b', tagBg: '#fef3c7', tagColor: '#92400e' },
  '病理报告':   { icon: <FilePdfOutlined />,  iconColor: '#ef4444', tagBg: '#fee2e2', tagColor: '#991b1b' },
  '基因检测':   { icon: <FileTextOutlined />, iconColor: '#8b5cf6', tagBg: '#ede9fe', tagColor: '#6d28d9' },
  '病历记录':   { icon: <FileTextOutlined />, iconColor: '#3b82f6', tagBg: '#dbeafe', tagColor: '#1d4ed8' },
  '手术记录':   { icon: <FileTextOutlined />, iconColor: '#ec4899', tagBg: '#fce7f3', tagColor: '#be185d' },
};
const getDocTypeConfig = (type) =>
  DOC_TYPE_CONFIG[type] || { icon: <FileOutlined />, iconColor: '#6b7280', tagBg: '#f3f4f6', tagColor: '#374151' };

/* ─── 单张文档卡片 ─── */
const DocumentCard = ({ doc, onView, onRemove }) => {
  const cfg = getDocTypeConfig(doc.doc_type);
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={() => onView(doc)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '13px 16px',
        border: `1px solid ${hovered ? 'rgba(99,102,241,0.25)' : '#f0f0f0'}`,
        borderRadius: 8,
        background: hovered ? '#fafbff' : '#fff',
        boxShadow: hovered ? '0 4px 12px rgba(99,102,241,0.10)' : '0 1px 2px rgba(0,0,0,0.03)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'all 0.18s ease',
        cursor: 'pointer',
        width: '100%',
      }}
    >
      {/* 左侧图标 */}
      <div style={{
        width: 44, height: 44, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#f8fafc', border: '1px solid #f0f0f0', borderRadius: 6,
        fontSize: 22, color: cfg.iconColor,
      }}>
        {cfg.icon}
      </div>

      {/* 中间主信息 */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* 第一行：类型标题 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{
            fontSize: 15, fontWeight: 600, color: '#111827',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {doc.doc_type || doc.doc_title || '未知类型'}
          </span>
          {doc.doc_sub_type && (
            <Tag style={{
              margin: 0, border: 'none', fontSize: 11,
              padding: '1px 7px', borderRadius: 4, flexShrink: 0,
              background: cfg.tagBg, color: cfg.tagColor, fontWeight: 500,
              lineHeight: '18px',
            }}>
              {doc.doc_sub_type}
            </Tag>
          )}
        </div>
        {/* 第二行：文件名 */}
        <div style={{
          fontSize: 12.5, color: '#6b7280',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginBottom: 5,
        }}>
          {doc.filename || doc.doc_title || '未知文件'}
        </div>
        {/* 第三行：元数据小片段 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {doc.institution_name && (
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{doc.institution_name}</span>
          )}
          {doc.institution_name && doc.doc_date && (
            <span style={{ color: '#e5e7eb', fontSize: 11 }}>|</span>
          )}
          {doc.doc_date && (
            <span style={{ fontSize: 11, color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>
              {doc.doc_date}
            </span>
          )}
        </div>
      </div>

      {/* 右侧操作 */}
      <div
        style={{ flexShrink: 0, display: 'flex', gap: 6 }}
        onClick={e => e.stopPropagation()}
      >
        <Button
          type="default"
          size="small"
          icon={<EyeOutlined />}
          style={{ borderRadius: 6, fontSize: 12, color: '#6b7280', border: '1px solid #e5e7eb', padding: '0 12px' }}
          onClick={() => onView(doc)}
        >
          查看
        </Button>
        <Popconfirm
          title="移除文档"
          description="确定要将该文档从该患者病历夹中移除吗？"
          onConfirm={() => onRemove(doc.id)}
        >
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            style={{ borderRadius: 6, fontSize: 12, padding: '0 8px' }}
          >
            移除
          </Button>
        </Popconfirm>
      </div>
    </div>
  );
};

/* ─── 带时间轴节点的分组块 ─── */
const TimelineGroup = ({ label, docs, groupType, onView, onRemove }) => {
  const [expanded, setExpanded] = useState(true);
  const groupColor = groupType === 'type' ? '#10b981' : '#6366f1';
  return (
    <div style={{ marginBottom: 4 }}>
      {/* Group header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: expanded ? 12 : 0 }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
          background: groupColor,
        }} />
        <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{label}</span>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>{docs.length} 个文档</span>
        <Button
          type="text"
          size="small"
          icon={expanded ? <DownOutlined /> : <RightOutlined />}
          onClick={() => setExpanded(v => !v)}
          style={{ padding: '0 4px', color: '#9ca3af', marginLeft: 2 }}
        />
      </div>

      {/* Group content with left rail */}
      {expanded && (
        <div style={{ display: 'flex', gap: 0 }}>
          {/* Left rail */}
          <div style={{ width: 28, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: 2, flex: 1, background: `${groupColor}40`, borderRadius: 2 }} />
          </div>
          {/* Cards */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 16 }}>
            {docs.map(doc => (
              <div key={doc.patient_document_id || doc.id} style={{ display: 'flex', gap: 0, alignItems: 'flex-start' }}>
                <div style={{ width: 0, flexShrink: 0, marginTop: 20, position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: -23, top: 0,
                    width: 8, height: 8, borderRadius: '50%',
                    border: `2px solid ${groupColor}`,
                    background: '#fff',
                  }} />
                </div>
                <div style={{ flex: 1 }}>
                  <DocumentCard doc={doc} onView={onView} onRemove={onRemove} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── 主页面 ─── */
const PatientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allDocs, setAllDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  // Group & Sort — two independent dimensions
  const [groupBy, setGroupBy] = useState('type');     // 'type' | 'date'
  const [sortOrder, setSortOrder] = useState('desc');  // date sort: 'desc'=由近到远, 'asc'=由远到近
  const [typeFilter, setTypeFilter] = useState('全部');
  const [dateRange, setDateRange] = useState(null);

  useEffect(() => {
    fetchPatient();
    fetchAllDocuments();
  }, [id]);

  const fetchPatient = async () => {
    try {
      setLoading(true);
      const res = await getPatientDetail(id);
      const payload = res.data?.data || res.data;
      if (payload) setPatient(payload);
    } catch (err) {
      message.error('获取患者信息失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllDocuments = async () => {
    try {
      setDocsLoading(true);
      const res = await getPatientDocuments(id, { page: 1, size: 500 });
      const payload = res.data?.data || res.data;
      if (payload) setAllDocs(payload.list || []);
    } catch (err) {
      console.error(err);
    } finally {
      setDocsLoading(false);
    }
  };

  const handleRemoveDoc = async (docId) => {
    try {
      await removePatientDocument(id, docId);
      message.success('文档已从当前患者病历夹中移除');
      fetchPatient();
      fetchAllDocuments();
    } catch (err) {
      message.error(err.response?.data?.message || '移除文档失败');
    }
  };

  // Unique doc_type values for filter tabs
  const typeOptions = useMemo(() => {
    const types = new Set();
    allDocs.forEach(d => { if (d.doc_type) types.add(d.doc_type); });
    return ['全部', ...Array.from(types)];
  }, [allDocs]);

  // Filtered + sorted + grouped
  const timelineGroups = useMemo(() => {
    let docs = [...allDocs];

    if (typeFilter !== '全部') {
      docs = docs.filter(d => d.doc_type === typeFilter);
    }
    if (dateRange && dateRange[0] && dateRange[1]) {
      const start = dateRange[0].format('YYYY-MM-DD');
      const end = dateRange[1].format('YYYY-MM-DD');
      docs = docs.filter(d => {
        const dd = d.doc_date || '';
        return dd >= start && dd <= end;
      });
    }

    docs.sort((a, b) => {
      const da = a.doc_date || '';
      const db = b.doc_date || '';
      return sortOrder === 'desc' ? db.localeCompare(da) : da.localeCompare(db);
    });

    const map = new Map();
    docs.forEach(doc => {
      const key = groupBy === 'type'
        ? (doc.doc_type || '未分类')
        : (doc.doc_date || '日期未知');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(doc);
    });

    return Array.from(map.entries()).map(([label, docs]) => ({ label, docs }));
  }, [allDocs, typeFilter, dateRange, groupBy, sortOrder]);

  const dateRangeBounds = useMemo(() => {
    if (!allDocs.length) return null;
    const dates = allDocs.map(d => d.doc_date).filter(Boolean).sort();
    if (!dates.length) return null;
    return [dates[0], dates[dates.length - 1]];
  }, [allDocs]);

  if (loading && !patient) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div style={{ padding: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/patients')}>返回资源池</Button>
        <Empty description="找不到该患者信息" style={{ marginTop: 40 }} />
      </div>
    );
  }

  const meta = patient.metadata_json || {};

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#fff' }}>
      <div style={{ padding: '28px 40px 40px' }}>

        {/* Back + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/patients')}
            style={{ color: '#6b7280', fontSize: 13, padding: '4px 8px' }}
          />
          <h1 style={{
            fontSize: 22, fontWeight: 700, margin: 0, color: '#111827',
            letterSpacing: '-0.02em',
          }}>
            临床文档时间轴视图
          </h1>
        </div>

        {/* Patient Info Bar */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 0,
          padding: '16px 20px',
          background: '#fafbfc', border: '1px solid #f0f0f0', borderRadius: 10,
          marginBottom: 24,
        }}>
          {[
            ['姓名', meta['患者姓名'] || '-'],
            ['系统唯一标识', (patient.identifiers || []).join(', ') || '-'],
            ['性别', meta['患者性别'] || '-'],
            ['年龄', meta['患者年龄'] ? `${meta['患者年龄']}` : '-'],
            ['出生日期', meta['出生日期'] || '-'],
            ['联系电话', (Array.isArray(meta['联系电话']) ? meta['联系电话'].join(', ') : meta['联系电话']) || '-'],
            ['就诊机构', meta['机构名称'] || '-'],
            ['科室', meta['科室信息'] || '-'],
          ].map(([label, value], i, arr) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'baseline', gap: 6,
              padding: '5px 16px',
              borderRight: i < arr.length - 1 ? '1px solid #e5e7eb' : 'none',
              fontSize: 13,
            }}>
              <span style={{ color: '#9ca3af', whiteSpace: 'nowrap' }}>{label}：</span>
              <span style={{ color: '#374151', fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {value}
              </span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 16px', fontSize: 13 }}>
            <Tag style={{ color: '#4f46e5', border: 'none', fontWeight: 600, fontSize: 12, padding: '2px 10px', borderRadius: 4, background: '#e0e7ff' }}>
              归档文档总数：{patient.document_count || allDocs.length} 份
            </Tag>
          </div>
        </div>

        {/* Sort / Filter Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          padding: '12px 0', marginBottom: 16,
          borderBottom: '1px solid #f0f0f0',
        }}>
          <Select
            value={groupBy}
            onChange={v => setGroupBy(v)}
            size="small"
            variant="outlined"
            style={{ width: 140 }}
            options={[
              { value: 'type', label: '📂 按文档类型分组' },
              { value: 'date', label: '📅 按生效日期分组' },
            ]}
          />
          <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />
          <Select
            value={sortOrder}
            onChange={v => setSortOrder(v)}
            size="small"
            variant="outlined"
            style={{ width: 130 }}
            options={[
              { value: 'desc', label: '日期由近到远' },
              { value: 'asc', label: '日期由远到近' },
            ]}
          />
          <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />
          {/* Type filter tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#9ca3af', whiteSpace: 'nowrap' }}>筛选类型</span>
            {typeOptions.map(type => (
              <div
                key={type}
                onClick={() => setTypeFilter(type)}
                style={{
                  padding: '3px 12px', borderRadius: 4, fontSize: 13, cursor: 'pointer',
                  fontWeight: typeFilter === type ? 600 : 400,
                  color: typeFilter === type ? '#4f46e5' : '#6b7280',
                  background: typeFilter === type ? '#eef2ff' : 'transparent',
                  border: typeFilter === type ? '1px solid #c7d2fe' : '1px solid transparent',
                  transition: 'all 0.15s', whiteSpace: 'nowrap', userSelect: 'none',
                }}
              >
                {type}
              </div>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <RangePicker
              size="small"
              value={dateRange}
              onChange={v => setDateRange(v)}
              allowClear
              placeholder={
                dateRangeBounds
                  ? [dateRangeBounds[0], dateRangeBounds[1]]
                  : ['开始日期', '结束日期']
              }
              style={{ width: 240 }}
            />
          </div>
        </div>

        {/* Document list */}
        {docsLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : timelineGroups.length === 0 ? (
          <Empty description="暂无匹配的归档文档" style={{ padding: 60 }} />
        ) : (
          <div style={{ paddingTop: 8 }}>
            {timelineGroups.map(group => (
              <TimelineGroup
                key={group.label}
                label={group.label}
                docs={group.docs}
                groupType={groupBy}
                onView={(doc) => { setSelectedDoc(doc); setModalOpen(true); }}
                onRemove={handleRemoveDoc}
              />
            ))}
          </div>
        )}
      </div>

      <DocumentDetailModal
        open={modalOpen}
        document={selectedDoc}
        onClose={() => { setModalOpen(false); setSelectedDoc(null); }}
        onRefresh={() => fetchAllDocuments()}
      />
    </div>
  );
};

export default PatientDetail;
