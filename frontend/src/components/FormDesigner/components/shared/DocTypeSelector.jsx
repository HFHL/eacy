/**
 * DocTypeSelector - 文档类型选择器
 * 支持二级分类菜单的多选组件
 * 用于配置表单的数据来源（主要来源/次要来源）
 */

import React, { useMemo } from 'react';
import { TreeSelect, Tag, Space, Typography, Tooltip } from 'antd';
import { FileTextOutlined, FolderOutlined } from '@ant-design/icons';
import { DOC_TYPE_CATEGORIES, getCategoryByDocType } from '../../core/docTypes';

const { Text } = Typography;

/**
 * 生成 TreeSelect 的树形数据
 */
const normalizeOptions = (options = []) => {
  if (!Array.isArray(options) || options.length === 0) {
    return DOC_TYPE_CATEGORIES;
  }
  const categories = {};
  options.forEach((opt) => {
    if (!opt || !opt.value) return;
    const category = opt.category || '其他材料';
    if (!categories[category]) {
      categories[category] = { label: category, children: [] };
    }
    categories[category].children.push(opt.value);
  });
  return categories;
};

const generateTreeData = (options) => {
  const categories = normalizeOptions(options);
  return Object.entries(categories).map(([key, category]) => ({
    title: (
      <Space size={4}>
        <FolderOutlined style={{ color: '#1890ff' }} />
        <span>{category.label}</span>
        <Text type="secondary" style={{ fontSize: 12 }}>
          ({category.children.length})
        </Text>
      </Space>
    ),
    value: `category_${key}`, // 分类前缀，避免与子项冲突
    key: `category_${key}`,
    selectable: false, // 一级分类不可直接选择
    checkable: false,
    children: category.children.map(child => ({
      title: (
        <Space size={4}>
          <FileTextOutlined style={{ color: '#52c41a' }} />
          <span>{child}</span>
        </Space>
      ),
      value: child,
      key: `${key}_${child}`
    }))
  }));
};

/**
 * 自定义 Tag 渲染
 */
const tagRender = (props) => {
  const { label, value, closable, onClose } = props;
  const category = getCategoryByDocType(value);
  
  // 根据分类设置不同颜色
  const colorMap = {
    '病理报告': 'red',
    '实验室检查': 'blue',
    '基因检测': 'purple',
    '影像检查': 'cyan',
    '内镜检查': 'orange',
    '生理功能检查': 'green',
    '专科检查': 'gold',
    '病历记录': 'volcano',
    '治疗记录': 'magenta',
    '其他材料': 'default'
  };
  
  const color = colorMap[category] || 'default';
  
  return (
    <Tooltip title={category}>
      <Tag
        color={color}
        closable={closable}
        onClose={onClose}
        style={{ marginRight: 3, marginBottom: 2 }}
      >
        {value}
      </Tag>
    </Tooltip>
  );
};

/**
 * 文档类型选择器组件
 * @param {Object} props
 * @param {Array} props.value - 已选择的文档类型数组
 * @param {Function} props.onChange - 选择变化回调
 * @param {string} props.placeholder - 占位文本
 * @param {boolean} props.disabled - 是否禁用
 * @param {string} props.style - 自定义样式
 */
const DocTypeSelector = ({
  value = [],
  onChange,
  placeholder = '请选择文档类型',
  disabled = false,
  style = {},
  options = []
}) => {
  const treeData = useMemo(() => generateTreeData(options), [options]);

  const handleChange = (selectedValues) => {
    // 过滤掉分类前缀的值，只保留实际的文档类型
    const filteredValues = selectedValues.filter(v => !v.startsWith('category_'));
    if (onChange) {
      onChange(filteredValues);
    }
  };

  return (
    <TreeSelect
      value={value}
      onChange={handleChange}
      treeData={treeData}
      treeCheckable
      showCheckedStrategy={TreeSelect.SHOW_CHILD}
      placeholder={placeholder}
      disabled={disabled}
      style={{ width: '100%', ...style }}
      maxTagCount="responsive"
      tagRender={tagRender}
      treeDefaultExpandAll={false}
      dropdownStyle={{ maxHeight: 400, overflow: 'auto' }}
      allowClear
      showSearch
      treeNodeFilterProp="title"
      filterTreeNode={(inputValue, treeNode) => {
        // 搜索时匹配文档类型名称
        const nodeValue = treeNode.value || '';
        return nodeValue.toLowerCase().includes(inputValue.toLowerCase());
      }}
    />
  );
};

export default DocTypeSelector;


