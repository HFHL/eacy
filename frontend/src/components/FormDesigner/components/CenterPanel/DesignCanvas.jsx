/**
 * DesignCanvas - 设计画布组件
 * 中间面板：主要的表单设计区域，显示所有组和字段
 */

import React, { useCallback, useState, useEffect } from 'react';
import { Empty, Button, Space, Card, Row, Col, Typography } from 'antd';
import {
  PlusOutlined,
  AppstoreAddOutlined,
  FormOutlined,
  TableOutlined,
  UnorderedListOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
  ExperimentOutlined,
  HeartOutlined,
  TeamOutlined,
  SolutionOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import GroupCard from './GroupCard';

const { Text, Title } = Typography;

/**
 * 表单模板配置
 */
const FORM_TEMPLATES = [
  {
    id: 'custom',
    name: '自定义表单',
    description: '从空白开始创建表单',
    icon: <FormOutlined style={{ fontSize: 32, color: '#1890ff' }} />,
    color: '#e6f7ff',
    fields: []
  },
  {
    id: 'blood_routine',
    name: '18项血常规',
    description: '常用血常规检验指标',
    icon: <ExperimentOutlined style={{ fontSize: 32, color: '#eb2f96' }} />,
    color: '#fff0f6',
    fieldsCount: 18,
    fields: [
      { name: '送检日期', displayType: 'date' },
      { name: '白细胞计数(WBC)', displayType: 'text', unit: '×10^9/L' },
      { name: '红细胞计数(RBC)', displayType: 'text', unit: '×10^12/L' },
      { name: '血红蛋白(HGB)', displayType: 'text', unit: 'g/L' },
      { name: '血小板计数(PLT)', displayType: 'text', unit: '×10^9/L' },
      { name: '红细胞压积(HCT)', displayType: 'text', unit: '%' },
      { name: '平均红细胞体积(MCV)', displayType: 'text', unit: 'fL' },
      { name: '平均红细胞血红蛋白含量(MCH)', displayType: 'text', unit: 'pg' },
      { name: '平均红细胞血红蛋白浓度(MCHC)', displayType: 'text', unit: 'g/L' },
      { name: '红细胞分布宽度(RDW)', displayType: 'text', unit: '%' },
      { name: '淋巴细胞百分比(LY%)', displayType: 'text', unit: '%' },
      { name: '单核细胞百分比(MO%)', displayType: 'text', unit: '%' },
      { name: '中性粒细胞百分比(NE%)', displayType: 'text', unit: '%' },
      { name: '嗜酸性粒细胞百分比(EO%)', displayType: 'text', unit: '%' },
      { name: '嗜碱性粒细胞百分比(BA%)', displayType: 'text', unit: '%' },
      { name: '淋巴细胞计数(LY#)', displayType: 'text', unit: '×10^9/L' },
      { name: '中性粒细胞计数(NE#)', displayType: 'text', unit: '×10^9/L' },
      { name: '备注', displayType: 'textarea' }
    ]
  },
  {
    id: 'blood_routine_21',
    name: '21项血常规',
    description: '扩展血常规检验指标',
    icon: <ExperimentOutlined style={{ fontSize: 32, color: '#722ed1' }} />,
    color: '#f9f0ff',
    fieldsCount: 21
  },
  {
    id: 'blood_routine_32',
    name: '32项血常规',
    description: '完整血常规检验指标',
    icon: <ExperimentOutlined style={{ fontSize: 32, color: '#13c2c2' }} />,
    color: '#e6fffb',
    fieldsCount: 32
  },
  {
    id: 'biochemistry',
    name: '生化',
    description: '常用生化检验指标',
    icon: <MedicineBoxOutlined style={{ fontSize: 32, color: '#fa8c16' }} />,
    color: '#fff7e6',
    fieldsCount: 36
  },
  {
    id: 'urinalysis',
    name: '尿常规',
    description: '尿液分析指标',
    icon: <SafetyOutlined style={{ fontSize: 32, color: '#52c41a' }} />,
    color: '#f6ffed',
    fieldsCount: 24
  }
];

/**
 * 设计画布组件
 */
const DesignCanvas = ({
  folders = [],
  selectedFolderId = null,
  selectedGroupId = null,
  selectedFieldId = null,
  selectionPath = [],
  onSelect = null,
  onAddFolder = null,
  onAddGroup = null,
  onAddField = null,
  onEditGroup = null,
  onEditField = null,
  onDeleteField = null,
  onCopyField = null,
  onFieldReorder = null,
  onFieldNameChange = null,
  onOptionsChange = null,
  onGroupNameChange = null,
  onChildSelect = null,
  onAddTableChild = null,
  onAddTableRow = null,
  onEditRowPrefix = null,
  onAddMatrixRow = null,
  onAddMatrixCol = null,
  onCopyMatrixRow = null,
  onDeleteMatrixRow = null,
  onDeleteMatrixCol = null,
  onDeleteTableChild = null,
  onMatrixConfigChange = null,
  onTableChildNameChange = null,
  onReorderTableChildren = null,
  onDrop = null,
  onLoadExample = null,
  onApplyTemplate = null,
  readonly = false,
  version = 0 // 接收版本号
}) => {
  // 跟踪是否已选择自定义表单模式（跳过模板选择）
  const [customModeStarted, setCustomModeStarted] = useState(false);

  // 获取当前选中的文件夹
  const currentFolder = folders.find(f => f.id === selectedFolderId);
  // 获取当前选中的表单
  const currentGroup = currentFolder?.groups?.find(g => g.id === selectedGroupId);

  // 当选中的表单变化时，重置自定义模式状态
  useEffect(() => {
    setCustomModeStarted(false);
  }, [selectedGroupId]);

  // 处理拖拽
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    if (!onDrop) return;

    const fieldType = e.dataTransfer.getData('fieldType');
    const fieldSubType = e.dataTransfer.getData('fieldSubType');
    if (fieldType) {
      onDrop(fieldType, selectedFolderId, selectedGroupId, fieldSubType);
    }
  }, [onDrop, selectedFolderId, selectedGroupId]);

  // 处理选择变化
  const handleSelect = useCallback((groupId, fieldId) => {
    if (onSelect) {
      onSelect({
        folderId: selectedFolderId,
        groupId,
        fieldId
      });
    }
  }, [onSelect, selectedFolderId]);

  // 处理添加字段
  const handleAddField = useCallback((groupId) => {
    if (onAddField) {
      onAddField(selectedFolderId, groupId);
    }
  }, [onAddField, selectedFolderId]);

  // 处理编辑字段
  const handleEditField = useCallback((groupId, fieldId) => {
    if (onEditField) {
      onEditField(selectedFolderId, groupId, fieldId);
    }
  }, [onEditField, selectedFolderId]);

  // 处理删除字段
  const handleDeleteField = useCallback((groupId, fieldId) => {
    if (onDeleteField) {
      onDeleteField(selectedFolderId, groupId, fieldId);
    }
  }, [onDeleteField, selectedFolderId]);

  // 处理复制字段
  const handleCopyField = useCallback((groupId, fieldId) => {
    if (onCopyField) {
      onCopyField(selectedFolderId, groupId, fieldId);
    }
  }, [onCopyField, selectedFolderId]);

  // 处理编辑组
  const handleEditGroup = useCallback((groupId) => {
    if (onEditGroup) {
      onEditGroup(selectedFolderId, groupId);
    }
  }, [onEditGroup, selectedFolderId]);

  // 处理字段重新排序
  const handleFieldReorder = useCallback((groupId, newFields) => {
    if (onFieldReorder) {
      onFieldReorder(selectedFolderId, groupId, newFields);
    }
  }, [onFieldReorder, selectedFolderId]);

  // 应用模板
  const handleApplyTemplate = useCallback((template) => {
    if (template.id === 'custom') {
      // 自定义表单 - 设置自定义模式，显示空白表单设计页面
      // 用户可以从左侧组件库拖拽添加字段
      setCustomModeStarted(true);
      return;
    } else if (onApplyTemplate) {
      onApplyTemplate(selectedFolderId, selectedGroupId, template);
    } else if (onAddField && template.fields) {
      // 如果没有专门的模板应用函数，则逐个添加字段
      template.fields.forEach(field => {
        if (onDrop) {
          // 通过拖拽方式添加
          onDrop(field.displayType || 'text', selectedFolderId, selectedGroupId);
        }
      });
    }
  }, [onApplyTemplate, onAddField, onDrop, selectedFolderId, selectedGroupId]);

  // 空状态 - 没有选中访视
  if (!currentFolder) {
    const hasNoData = folders.length === 0;

    return (
      <div 
        className="design-canvas" 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          height: '100%',
          background: '#fafafa'
        }}
      >
        <Empty
          description={
            <div style={{ textAlign: 'center' }}>
              <p style={{ marginBottom: 16, color: '#666' }}>
                {hasNoData ? '暂无数据，开始创建您的CRF模版' : '请从左侧选择一个访视'}
              </p>
              <Space>
                {!readonly && hasNoData && onLoadExample && (
                  <Button type="primary" icon={<PlusOutlined />} onClick={onLoadExample}>
                    加载示例数据
                  </Button>
                )}
                {!readonly && onAddFolder && (
                  <Button icon={<PlusOutlined />} onClick={onAddFolder}>
                    创建访视
                  </Button>
                )}
              </Space>
            </div>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      </div>
    );
  }

  const groups = currentFolder.groups || [];

  // 如果选中了表单但表单为空，且未进入自定义模式，显示模板卡片
  if (currentGroup && (!currentGroup.fields || currentGroup.fields.length === 0) && !customModeStarted) {
    return (
      <div
        className="design-canvas"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ padding: 16 }}
      >
        {/* 表单标题 */}
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 8 }}>{currentGroup.name}</Title>
          <Text type="secondary">该表单暂无字段，请选择模板快速创建或从组件库拖拽添加</Text>
        </div>

        {/* 模板卡片区域 */}
        <div style={{ marginBottom: 32 }}>
          <Row gutter={[16, 16]}>
            {FORM_TEMPLATES.map(template => (
              <Col xs={12} sm={8} md={6} lg={6} xl={4} key={template.id}>
                <Card
                  hoverable
                  style={{ 
                    textAlign: 'center',
                    border: template.id === 'custom' ? '2px dashed #1890ff' : '1px solid #f0f0f0',
                    background: template.color || '#fff',
                    height: '100%'
                  }}
                  bodyStyle={{ padding: '16px 12px' }}
                  onClick={() => handleApplyTemplate(template)}
                >
                  <div style={{ marginBottom: 8 }}>
                    {template.icon}
                  </div>
                  <div style={{ 
                    fontWeight: 500, 
                    marginBottom: 4,
                    fontSize: 13,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {template.name}
                  </div>
                  {template.fieldsCount && (
                    <div style={{ fontSize: 11, color: '#999' }}>
                      {template.fieldsCount}项指标
                    </div>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        </div>

        {/* 提示文字 */}
        <div style={{ 
          textAlign: 'center', 
          padding: '24px',
          background: '#fafafa',
          borderRadius: 8,
          border: '1px dashed #d9d9d9'
        }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            或者从左侧组件库拖拽组件到此处添加字段
          </Text>
        </div>
      </div>
    );
  }

  // 如果选中了表单，表单为空，且已进入自定义模式，显示空白设计区域
  if (currentGroup && (!currentGroup.fields || currentGroup.fields.length === 0) && customModeStarted) {
    return (
      <div
        className="design-canvas"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ padding: 16 }}
      >
        {/* 表单组件 - 空白状态 */}
        <GroupCard
          key={currentGroup.id}
          folderId={selectedFolderId}
          group={currentGroup}
          selected={true}
          selectedFieldId={selectedFieldId}
          onSelect={(fieldId) => handleSelect(currentGroup.id, fieldId)}
          onAddField={() => handleAddField(currentGroup.id)}
          onEditGroup={() => handleEditGroup(currentGroup.id)}
          onEditField={(fieldId) => handleEditField(currentGroup.id, fieldId)}
          onDeleteField={(fieldId) => handleDeleteField(currentGroup.id, fieldId)}
          onCopyField={(fieldId) => handleCopyField(currentGroup.id, fieldId)}
          onFieldReorder={(newFields) => handleFieldReorder(currentGroup.id, newFields)}
          onFieldNameChange={(fieldId, newName) => onFieldNameChange?.(selectedFolderId, currentGroup.id, fieldId, newName)}
          onOptionsChange={(fieldId, newOptions) => onOptionsChange?.(selectedFolderId, currentGroup.id, fieldId, newOptions)}
          onGroupNameChange={(groupId, newName) => onGroupNameChange?.(selectedFolderId, groupId, newName)}
          onChildSelect={onChildSelect}
          onAddTableChild={onAddTableChild}
          onAddTableRow={onAddTableRow}
          onEditRowPrefix={onEditRowPrefix}
          onAddMatrixRow={onAddMatrixRow}
          onAddMatrixCol={onAddMatrixCol}
          onCopyMatrixRow={(fieldId, rowIdx) => onCopyMatrixRow?.(fieldId, rowIdx)}
          onDeleteMatrixRow={(fieldId, rowIdx) => onDeleteMatrixRow?.(fieldId, rowIdx)}
          onDeleteMatrixCol={(fieldId, colIdx) => onDeleteMatrixCol?.(fieldId, colIdx)}
          onDeleteTableChild={(fieldId, childIndex) => onDeleteTableChild?.(fieldId, childIndex)}
          onMatrixConfigChange={(fieldId, newConfig) => onMatrixConfigChange?.(selectedFolderId, currentGroup.id, fieldId, newConfig)}
          onTableChildNameChange={(fieldId, childIndex, newName) => onTableChildNameChange?.(selectedFolderId, currentGroup.id, fieldId, childIndex, newName)}
          onReorderTableChildren={(fieldId, newChildren) => onReorderTableChildren?.(selectedFolderId, currentGroup.id, fieldId, newChildren)}
          readonly={readonly}
          version={version} // 传递 version
        />
      </div>
    );
  }

  // 如果选中了表单，只显示该表单的字段
  if (currentGroup) {
    return (
      <div
        className="design-canvas"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="group-list">
          <GroupCard
            key={currentGroup.id}
            folderId={selectedFolderId}
            group={currentGroup}
            selected={true}
            selectedFieldId={selectedFieldId}
            onSelect={(fieldId) => handleSelect(currentGroup.id, fieldId)}
            onAddField={() => handleAddField(currentGroup.id)}
            onEditGroup={() => handleEditGroup(currentGroup.id)}
            onEditField={(fieldId) => handleEditField(currentGroup.id, fieldId)}
            onDeleteField={(fieldId) => handleDeleteField(currentGroup.id, fieldId)}
            onCopyField={(fieldId) => handleCopyField(currentGroup.id, fieldId)}
            onFieldReorder={(newFields) => handleFieldReorder(currentGroup.id, newFields)}
            onFieldNameChange={(fieldId, newName) => onFieldNameChange?.(selectedFolderId, currentGroup.id, fieldId, newName)}
            onOptionsChange={(fieldId, newOptions) => onOptionsChange?.(selectedFolderId, currentGroup.id, fieldId, newOptions)}
            onGroupNameChange={(groupId, newName) => onGroupNameChange?.(selectedFolderId, groupId, newName)}
            onChildSelect={onChildSelect}
            onAddTableChild={onAddTableChild}
            onAddTableRow={onAddTableRow}
            onEditRowPrefix={onEditRowPrefix}
            onAddMatrixRow={onAddMatrixRow}
            onAddMatrixCol={onAddMatrixCol}
            onCopyMatrixRow={(fieldId, rowIdx) => onCopyMatrixRow?.(fieldId, rowIdx)}
            onDeleteMatrixRow={(fieldId, rowIdx) => onDeleteMatrixRow?.(fieldId, rowIdx)}
            onDeleteMatrixCol={(fieldId, colIdx) => onDeleteMatrixCol?.(fieldId, colIdx)}
            onDeleteTableChild={(fieldId, childIndex) => onDeleteTableChild?.(fieldId, childIndex)}
            onMatrixConfigChange={(fieldId, newConfig) => onMatrixConfigChange?.(selectedFolderId, currentGroup.id, fieldId, newConfig)}
            onTableChildNameChange={(fieldId, childIndex, newName) => onTableChildNameChange?.(selectedFolderId, currentGroup.id, fieldId, childIndex, newName)}
            onReorderTableChildren={(fieldId, newChildren) => onReorderTableChildren?.(selectedFolderId, currentGroup.id, fieldId, newChildren)}
            readonly={readonly}
            version={version} // 传递 version
          />
        </div>
      </div>
    );
  }

  // 选中了访视但未选中表单时，显示提示
  return (
    <div
      className="design-canvas"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        height: '100%',
        background: '#fafafa'
      }}
    >
      {groups.length === 0 ? (
        <Empty
          description={
            <div style={{ textAlign: 'center' }}>
              <p style={{ marginBottom: 16, color: '#666' }}>该访视下暂无表单</p>
              {!readonly && onAddGroup && (
                <Button type="primary" icon={<AppstoreAddOutlined />} onClick={() => onAddGroup(selectedFolderId)}>
                  添加表单
                </Button>
              )}
            </div>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <Empty
          description={
            <div style={{ textAlign: 'center' }}>
              <p style={{ marginBottom: 8, color: '#666' }}>请从左侧目录树选择一个表单</p>
              <p style={{ color: '#999', fontSize: 12 }}>
                {currentFolder.name} · {groups.length} 个表单
              </p>
            </div>
          }
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      )}
    </div>
  );
};

export default DesignCanvas;
