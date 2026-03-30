import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tag, Button, Spin, Empty, message, Select, DatePicker, Popconfirm } from 'antd';
import { ArrowLeftOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { getPatientDetail, getPatientDocuments, removePatientDocument } from '../api/patient';
import DocumentDetailModal from '../components/DocumentDetailModal';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

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
      fetchPatient();      // refresh patient document count
      fetchAllDocuments(); // refresh document list
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

    // Type filter
    if (typeFilter !== '全部') {
      docs = docs.filter(d => d.doc_type === typeFilter);
    }

    // Date range filter
    if (dateRange && dateRange[0] && dateRange[1]) {
      const start = dateRange[0].format('YYYY-MM-DD');
      const end = dateRange[1].format('YYYY-MM-DD');
      docs = docs.filter(d => {
        const dd = d.doc_date || '';
        return dd >= start && dd <= end;
      });
    }

    // Always sort by doc_date within each group
    docs.sort((a, b) => {
      const da = a.doc_date || '';
      const db = b.doc_date || '';
      return sortOrder === 'desc' ? db.localeCompare(da) : da.localeCompare(db);
    });

    // Group
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

  // Date range bounds
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
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 16px',
            fontSize: 13,
          }}>
            <Tag color="#e0e7ff" style={{
              color: '#4f46e5', border: 'none', fontWeight: 600, fontSize: 12,
              padding: '2px 10px', borderRadius: 4,
            }}>
              归档文档总数：{patient.document_count || allDocs.length} 份
            </Tag>
          </div>
        </div>

        {/* Sort / Filter Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          padding: '12px 0', marginBottom: 8,
          borderBottom: '1px solid #f0f0f0',
        }}>
          {/* Group by */}
          <Select
            value={groupBy}
            onChange={v => setGroupBy(v)}
            size="small"
            variant="outlined"
            style={{ width: 140 }}
            options={[
              { value: 'type', label: '按文档类型分组' },
              { value: 'date', label: '按生效日期分组' },
            ]}
          />

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />

          {/* Sort order (always by date) */}
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

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />

          {/* Type filter tabs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#9ca3af', whiteSpace: 'nowrap' }}>筛选类型</span>
            {typeOptions.map(type => (
              <div
                key={type}
                onClick={() => setTypeFilter(type)}
                style={{
                  padding: '3px 12px',
                  borderRadius: 4,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontWeight: typeFilter === type ? 600 : 400,
                  color: typeFilter === type ? '#4f46e5' : '#6b7280',
                  background: typeFilter === type ? '#eef2ff' : 'transparent',
                  border: typeFilter === type ? '1px solid #c7d2fe' : '1px solid transparent',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                }}
              >
                {type}
              </div>
            ))}
          </div>

          {/* Date range */}
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

        {/* Timeline */}
        {docsLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
        ) : timelineGroups.length === 0 ? (
          <Empty description="暂无匹配的归档文档" style={{ padding: 60 }} />
        ) : (
          <div style={{ paddingTop: 16 }}>
            {timelineGroups.map((group, gi) => (
              <div key={group.label} style={{ display: 'flex', gap: 0 }}>
                {/* Group label column */}
                <div style={{
                  width: 130, flexShrink: 0,
                  paddingTop: 14, paddingRight: 16,
                  textAlign: 'right',
                }}>
                  {/* Only show label on first doc of the group */}
                  <span style={{
                    fontSize: 14, fontWeight: 600, color: '#374151',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {group.label}
                  </span>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    {group.docs.length} 份
                  </div>
                </div>

                {/* Timeline rail */}
                <div style={{
                  width: 28, flexShrink: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  position: 'relative',
                }}>
                  {group.docs.map((_, di) => (
                    <React.Fragment key={di}>
                      {/* Connector line above dot */}
                      {(gi > 0 || di > 0) && (
                        <div style={{
                          width: 1.5, height: di === 0 ? 18 : 12,
                          background: '#d1d5db',
                        }} />
                      )}
                      {di === 0 && gi === 0 && <div style={{ height: 18 }} />}
                      {/* Dot */}
                      <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: '#fff',
                        border: '2px solid #94a3b8',
                        flexShrink: 0,
                      }} />
                      {/* Connector line below dot */}
                      {(di < group.docs.length - 1 || gi < timelineGroups.length - 1) && (
                        <div style={{
                          width: 1.5, flex: 1, minHeight: 12,
                          background: '#d1d5db',
                        }} />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Document rows */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {group.docs.map((doc, di) => {
                    const typeColorMap = {
                      '病历记录': { bg: '#dbeafe', color: '#1d4ed8' },
                      '检查结果': { bg: '#d1fae5', color: '#047857' },
                      '检验报告': { bg: '#fef3c7', color: '#92400e' },
                      '影像报告': { bg: '#ede9fe', color: '#6d28d9' },
                      '手术记录': { bg: '#fce7f3', color: '#be185d' },
                    };
                    const tc = typeColorMap[doc.doc_type] || { bg: '#f3f4f6', color: '#4b5563' };

                    return (
                      <div
                        key={doc.patient_document_id || doc.id || di}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 16,
                          padding: '12px 16px',
                          borderBottom: '1px solid #f5f5f5',
                          transition: 'background 0.15s',
                          cursor: 'pointer',
                          borderRadius: 6,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        onClick={() => { setSelectedDoc(doc); setModalOpen(true); }}
                      >
                        {/* Title + type */}
                        <div style={{ flex: '0 0 280px', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                          <span style={{
                            fontSize: 14, fontWeight: 600, color: '#111827',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {doc.doc_title || doc.filename || '未知文档'}
                          </span>
                          {doc.doc_type && (
                            <Tag style={{
                              margin: 0, border: 'none', fontSize: 11,
                              padding: '1px 8px', borderRadius: 4,
                              background: tc.bg, color: tc.color,
                              fontWeight: 500, flexShrink: 0,
                              lineHeight: '20px',
                            }}>
                              {doc.doc_type}
                            </Tag>
                          )}
                        </div>

                        {/* Effective date */}
                        <div style={{
                          flex: '0 0 170px',
                          fontSize: 13, color: '#6b7280',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {doc.doc_date ? `${doc.doc_date} 14:00:00` : '-'}
                        </div>

                        {/* Archive date */}
                        <div style={{
                          flex: '0 0 170px',
                          fontSize: 13, color: '#6b7280',
                          fontVariantNumeric: 'tabular-nums',
                        }}>
                          {doc.created_at ? new Date(doc.created_at).toLocaleString('zh-CN', {
                            year: 'numeric', month: '2-digit', day: '2-digit',
                            hour: '2-digit', minute: '2-digit', second: '2-digit',
                          }) : '-'}
                        </div>

                        {/* View button */}
                        <div style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', gap: 6 }}>
                          <Button
                            type="default"
                            size="small"
                            icon={<EyeOutlined />}
                            style={{
                              borderRadius: 6, fontSize: 12, color: '#6b7280',
                              border: '1px solid #e5e7eb', padding: '0 12px',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDoc(doc);
                              setModalOpen(true);
                            }}
                          >
                            查看
                          </Button>
                          <Popconfirm
                            title="移除文档"
                            description="确定要将该文档从该患者病历夹中移除吗？"
                            onConfirm={(e) => {
                              e.stopPropagation();
                              handleRemoveDoc(doc.id);
                            }}
                            onCancel={(e) => {
                              e.stopPropagation();
                            }}
                          >
                            <Button
                              type="text"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              style={{ borderRadius: 6, fontSize: 12, padding: '0 8px' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              移除
                            </Button>
                          </Popconfirm>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
