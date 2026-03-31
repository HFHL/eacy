import React from 'react';
import { Space, Typography, Tag, Button, Select, Divider } from 'antd';
import { CheckCircleOutlined, ExclamationCircleOutlined, PlusCircleOutlined, QuestionCircleOutlined, UserOutlined } from '@ant-design/icons';

const { Text } = Typography;

const GroupRowDisplay = ({ cluster, committingId, executeGroupCommit, patients, decision, onDecisionChange }) => {
  const patient = cluster.suggested_patients?.[0];

  const renderTierIcon = (tier) => {
    switch (tier) {
      case 1: return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 2: return <ExclamationCircleOutlined style={{ color: '#faad14' }} />;
      case 3: return <PlusCircleOutlined style={{ color: '#1677ff' }} />;
      case 4: return <QuestionCircleOutlined style={{ color: '#ff4d4f' }} />;
      default: return null;
    }
  };

  const basicInfo = (
    <Space size={12}>
      {renderTierIcon(cluster.tier)}
      <Text strong style={{ fontSize: 14 }}>{cluster.aggregated_names.join(', ') || '未知姓名'}</Text>
      <Tag color="cyan">{cluster.documents.length} 份文件</Tag>
      {cluster.aggregated_identifiers.length > 0 && (
        <Text type="secondary" style={{ fontSize: 12 }}>ID: {cluster.aggregated_identifiers.join(', ')}</Text>
      )}
    </Space>
  );

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 16 }}>
      <div>{basicInfo}</div>
      
      <div>
        {/* TIER 1 */}
        {cluster.tier === 1 && (
          <Space>
            <Text type="secondary" style={{ fontSize: 13 }}>
              匹配目标: <Text strong>{patient?.metadata_json?.['患者姓名']}</Text> (ID: {patient?.identifiers?.[0] || '默认'})
            </Text>
            <Button 
              type="primary" 
              size="small"
              style={{ backgroundColor: '#52c41a' }}
              loading={committingId === cluster.cluster_id}
              onClick={(e) => { e.stopPropagation(); executeGroupCommit(cluster, 'ASSIGN', patient?.id); }}
            >
              归入此档
            </Button>
          </Space>
        )}

        {/* TIER 2 */}
        {cluster.tier === 2 && (
          <Space>
            <Text style={{ fontSize: 12, color: '#d48806' }}>存在多个匹配项: </Text>
            <Select
              size="small"
              placeholder="选择并入"
              style={{ width: 140 }}
              value={decision}
              onClick={(e) => e.stopPropagation()}
              onChange={onDecisionChange}
              options={cluster.suggested_patients?.map(sp => ({
                value: sp.id,
                label: `${sp.metadata_json?.['患者姓名']} (${sp.identifiers?.[0] || '无'})`
              }))}
            />
            <Button 
              size="small" 
              type="primary"
              disabled={!decision}
              loading={committingId === cluster.cluster_id}
              onClick={(e) => { e.stopPropagation(); executeGroupCommit(cluster, 'ASSIGN', decision); }}
            >
              确认并入
            </Button>
            <span style={{ margin: '0 8px', color: '#f0f0f0' }}>|</span>
            <Button 
              size="small"
              loading={committingId === cluster.cluster_id}
              onClick={(e) => { e.stopPropagation(); executeGroupCommit(cluster, 'CREATE_PATIENT'); }}
            >
              或新建档案
            </Button>
          </Space>
        )}

        {/* TIER 3 */}
        {cluster.tier === 3 && (
          <Space>
            <Text type="secondary" style={{ fontSize: 13 }}>未找到匹配记录，建议：</Text>
            <Button 
              size="small"
              type="primary" 
              loading={committingId === cluster.cluster_id}
              onClick={(e) => { e.stopPropagation(); executeGroupCommit(cluster, 'CREATE_PATIENT'); }}
            >
              新建患者并归档
            </Button>
          </Space>
        )}

        {/* TIER 4 */}
        {cluster.tier === 4 && null}
      </div>
    </div>
  );
};

export default GroupRowDisplay;
