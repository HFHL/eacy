/**
 * ComponentLibrary - 组件库面板
 * 左侧面板：显示可拖拽的表单组件库
 */

import React, { useState, useMemo } from 'react';
import { Empty, Input, Tag, Row, Col, Typography } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import {
  FontSizeOutlined,
  CalendarOutlined,
  FileTextOutlined,
  NumberOutlined,
  CheckCircleOutlined,
  CheckSquareOutlined,
  CaretDownOutlined,
  ControlOutlined,
  ApartmentOutlined,
  BorderOutlined,
  AppstoreOutlined,
  TableOutlined,
  PictureOutlined,
  FilePdfOutlined,
  FileOutlined,
  MedicineBoxOutlined,
  ExperimentOutlined,
  BranchesOutlined,
  InfoCircleOutlined,
  MinusOutlined,
  HolderOutlined
} from '@ant-design/icons';
import {
  COMPONENT_CATEGORIES,
  DISPLAY_TYPE_CONFIG
} from '../../core/constants';
import { getFieldTypeLabel } from '../../utils/schemaHelpers';

const { Text } = Typography;

// 组件图标映射
const COMPONENT_ICONS = {
  text: <FontSizeOutlined />,
  textarea: <FileTextOutlined />,
  number: <NumberOutlined />,
  date: <CalendarOutlined />,
  multi_text: <AppstoreOutlined />,
  radio: <CheckCircleOutlined />,
  checkbox: <CheckSquareOutlined />,
  select: <CaretDownOutlined />,
  multiselect: <AppstoreOutlined />,
  slider: <ControlOutlined />,
  cascader: <ApartmentOutlined />,
  matrix_radio: <BorderOutlined />,
  matrix_checkbox: <AppstoreOutlined />,
  file: <FileOutlined />,
  image: <PictureOutlined />,
  pdf: <FilePdfOutlined />,
  dicom: <MedicineBoxOutlined />,
  pathology: <ExperimentOutlined />,
  group: <AppstoreOutlined />,
  table: <TableOutlined />,
  paragraph: <InfoCircleOutlined />,
  divider: <MinusOutlined />,
  randomization: <BranchesOutlined />
};

// 扩展组件分类（带图标和更详细的信息）
const COMPONENT_LIBRARY_CATEGORIES = [
  {
    key: 'fill',
    label: '填空',
    components: [
      { type: 'text', label: '填空题', icon: <FontSizeOutlined /> },
      { type: 'date', label: '日期题', icon: <CalendarOutlined /> },
      { type: 'multi_text', label: '多项填空', icon: <AppstoreOutlined /> }
    ]
  },
  {
    key: 'select',
    label: '选择',
    components: [
      { type: 'radio', label: '单选题', icon: <CheckCircleOutlined /> },
      { type: 'checkbox', label: '多选题', icon: <CheckSquareOutlined /> },
      { type: 'select', label: '下拉题', icon: <CaretDownOutlined /> },
      { type: 'slider', label: '滑块评分', icon: <ControlOutlined /> },
      { type: 'cascader', label: '省-市-区', icon: <ApartmentOutlined /> }
    ]
  },
  {
    key: 'matrix',
    label: '矩阵',
    components: [
      { type: 'matrix_radio', label: '矩阵单选', icon: <BorderOutlined /> },
      { type: 'matrix_checkbox', label: '矩阵多选', icon: <AppstoreOutlined /> },
      { type: 'table', label: '固定表格', icon: <TableOutlined />, subType: 'fixed' },
      { type: 'table', label: '自增表格', icon: <TableOutlined />, subType: 'dynamic' }
    ]
  },
  {
    key: 'file',
    label: '文件',
    components: [
      { type: 'file', label: '图片', icon: <PictureOutlined />, subType: 'image' },
      { type: 'file', label: 'PDF文件', icon: <FilePdfOutlined />, subType: 'pdf' },
      { type: 'file', label: '文件题', icon: <FileOutlined />, subType: 'any' },
      { type: 'file', label: 'DICOM影像', icon: <MedicineBoxOutlined />, subType: 'dicom', comingSoon: true },
      { type: 'file', label: '病理切片', icon: <ExperimentOutlined />, subType: 'pathology', comingSoon: true }
    ]
  },
  {
    key: 'randomization',
    label: '随机化',
    components: [
      { type: 'randomization', label: '分组', icon: <BranchesOutlined /> }
    ]
  },
  {
    key: 'auxiliary',
    label: '辅助布局',
    components: [
      { type: 'paragraph', label: '段落说明', icon: <InfoCircleOutlined /> },
      { type: 'divider', label: '分割线', icon: <MinusOutlined /> }
    ]
  }
];

/**
 * 组件库面板
 */
const ComponentLibrary = ({
  onDragStart = null,
  draggable = true
}) => {
  const [searchText, setSearchText] = useState('');

  // 过滤组件分类
  const filteredCategories = useMemo(() => {
    if (!searchText) return COMPONENT_LIBRARY_CATEGORIES;

    return COMPONENT_LIBRARY_CATEGORIES
      .map(category => ({
        ...category,
        components: category.components.filter(comp =>
          comp.label.toLowerCase().includes(searchText.toLowerCase())
        )
      }))
      .filter(category => category.components.length > 0);
  }, [searchText]);

  // 处理拖拽开始
  const handleDragStart = (e, component) => {
    if (onDragStart) {
      onDragStart(e, component.type);
    }
    e.dataTransfer.setData('fieldType', component.type);
    if (component.subType) {
      e.dataTransfer.setData('fieldSubType', component.subType);
    }
    e.dataTransfer.effectAllowed = 'copy';
  };

  // 渲染组件卡片
  const renderComponentCard = (component, index) => {
    const isDraggable = draggable && !component.comingSoon;

    return (
      <Col span={12} key={`${component.type}-${component.subType || index}`}>
        <div
          className={`component-card ${component.comingSoon ? 'coming-soon' : ''}`}
          draggable={isDraggable}
          onDragStart={(e) => isDraggable && handleDragStart(e, component)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 10px',
            background: '#fff',
            border: '1px solid #e8e8e8',
            borderRadius: 6,
            cursor: isDraggable ? 'grab' : 'not-allowed',
            marginBottom: 8,
            transition: 'all 0.2s',
            opacity: component.comingSoon ? 0.6 : 1,
            position: 'relative'
          }}
          onMouseEnter={(e) => {
            if (isDraggable) {
              e.currentTarget.style.borderColor = '#1890ff';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(24,144,255,0.15)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e8e8e8';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <HolderOutlined style={{ color: '#bfbfbf', marginRight: 8, fontSize: 12 }} />
          <span style={{ 
            fontSize: 14, 
            color: '#666', 
            marginRight: 6,
            display: 'flex',
            alignItems: 'center'
          }}>
            {component.icon}
          </span>
          <span style={{ 
            fontSize: 13, 
            color: '#333',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {component.label}
          </span>
          {component.comingSoon && (
            <Tag 
              color="orange" 
              style={{ 
                fontSize: 10, 
                padding: '0 4px', 
                lineHeight: '16px',
                marginLeft: 4,
                position: 'absolute',
                right: 4,
                top: 4
              }}
            >
              待发布
            </Tag>
          )}
        </div>
      </Col>
    );
  };

  // 渲染分类
  const renderCategory = (category) => {
    if (!category.components || category.components.length === 0) return null;

    return (
      <div key={category.key} style={{ marginBottom: 16 }}>
        <Text 
          type="secondary" 
          style={{ 
            fontSize: 12, 
            display: 'block', 
            marginBottom: 8,
            color: '#8c8c8c'
          }}
        >
          {category.label}
        </Text>
        <Row gutter={[8, 0]}>
          {category.components.map((comp, index) => renderComponentCard(comp, index))}
        </Row>
      </div>
    );
  };

  const hasComponents = filteredCategories.length > 0;

  return (
    <div className="component-library" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Input
        placeholder="搜索组件..."
        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
        allowClear
        size="small"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ marginBottom: 12, flexShrink: 0 }}
      />

      {hasComponents ? (
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', paddingRight: 4 }}>
          {filteredCategories.map(renderCategory)}
        </div>
      ) : (
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          background: '#fff',
          borderRadius: 4
        }}>
          <Empty
            description="未找到匹配组件"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        </div>
      )}
    </div>
  );
};

export default ComponentLibrary;
