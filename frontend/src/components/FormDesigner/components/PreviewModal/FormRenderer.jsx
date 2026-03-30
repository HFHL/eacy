/**
 * FormRenderer - 表单渲染器
 * 在预览模式下渲染表单组和字段
 */

import React, { useState } from 'react';
import { Card, Collapse, Input, InputNumber, DatePicker, Checkbox, Radio, Select, Button, Space, Divider, Tag } from 'antd';
import {
  FileOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import { DISPLAY_TYPES, DISPLAY_TYPE_CONFIG } from '../../core/constants';

const { TextArea } = Input;
const { Panel } = Collapse;

/**
 * 字段渲染器
 */
const FieldRenderer = ({ field, value = {}, onChange }) => {
  const config = DISPLAY_TYPE_CONFIG[field.displayType] || {};

  // 渲染字段标签
  const renderLabel = () => {
    return (
      <Space>
        <span style={{ fontWeight: 500 }}>
          {field.name}
          {field.required && <span style={{ color: 'red', marginLeft: 4 }}>*</span>}
        </span>
        {field.sensitive && <Tag color="red" style={{ marginLeft: 8 }}>敏感</Tag>}
        {field.primary && <Tag color="blue" style={{ marginLeft: 8 }}>主键</Tag>}
        {field.unit && <span style={{ color: '#999', fontSize: 12 }}>({field.unit})</span>}
      </Space>
    );
  };

  // 渲染字段描述
  const renderDescription = () => {
    if (field.description) {
      return <div style={{ color: '#999', fontSize: 12, marginTop: 4, marginBottom: 8 }}>{field.description}</div>;
    }
    return null;
  };

  // 根据显示类型渲染不同的输入组件
  const renderInput = () => {
    const disabled = true; // 预览模式默认禁用编辑

    switch (field.displayType) {
      case DISPLAY_TYPES.TEXT:
        return (
          <Input
            placeholder={field.description || `请输入${field.name}`}
            disabled={disabled}
            value={value[field.id]}
          />
        );

      case DISPLAY_TYPES.TEXTAREA:
        return (
          <TextArea
            rows={4}
            placeholder={field.description || `请输入${field.name}`}
            disabled={disabled}
            value={value[field.id]}
          />
        );

      case DISPLAY_TYPES.NUMBER:
        return (
          <InputNumber
            placeholder={field.description || `请输入${field.name}`}
            disabled={disabled}
            value={value[field.id]}
            style={{ width: '100%' }}
          />
        );

      case DISPLAY_TYPES.DATE:
        return (
          <DatePicker
            placeholder={field.description || `请选择${field.name}`}
            disabled={disabled}
            style={{ width: '100%' }}
          />
        );

      case DISPLAY_TYPES.RADIO:
        return (
          <Radio.Group disabled={disabled} value={value[field.id]}>
            <Space direction="vertical">
              {field.options?.map((option, index) => (
                <Radio key={index} value={option.value}>
                  {option.label}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        );

      case DISPLAY_TYPES.CHECKBOX:
        return (
          <Checkbox.Group disabled={disabled} value={value[field.id]}>
            <Space direction="vertical">
              {field.options?.map((option, index) => (
                <Checkbox key={index} value={option.value}>
                  {option.label}
                </Checkbox>
              ))}
            </Space>
          </Checkbox.Group>
        );

      case DISPLAY_TYPES.SELECT:
        return (
          <Select
            placeholder={field.description || `请选择${field.name}`}
            disabled={disabled}
            value={value[field.id]}
            style={{ width: '100%' }}
            options={field.options}
          />
        );

      case DISPLAY_TYPES.MULTISELECT:
        return (
          <Select
            mode="multiple"
            placeholder={field.description || `请选择${field.name}`}
            disabled={disabled}
            value={value[field.id]}
            style={{ width: '100%' }}
            options={field.options}
          />
        );

      case DISPLAY_TYPES.FILE:
        return (
          <div style={{ padding: '20px', border: '1px dashed #d9d9d9', borderRadius: 4, textAlign: 'center' }}>
            <FileOutlined style={{ fontSize: 24, color: '#d9d9d9' }} />
            <div style={{ marginTop: 8, color: '#999' }}>
              点击或拖拽文件到此区域上传
            </div>
          </div>
        );

      case DISPLAY_TYPES.PARAGRAPH:
        return (
          <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: 4, lineHeight: 1.6 }}>
            {field.description}
          </div>
        );

      case DISPLAY_TYPES.DIVIDER:
        return <Divider />;

      default:
        return (
          <div style={{ padding: '12px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 4 }}>
            <Space>
              <Tag color="orange">{field.displayType}</Tag>
              <span>该字段类型暂不支持预览</span>
            </Space>
          </div>
        );
    }
  };

  // 特殊类型不渲染为常规字段
  if ([DISPLAY_TYPES.PARAGRAPH, DISPLAY_TYPES.DIVIDER].includes(field.displayType)) {
    return renderInput();
  }

  return (
    <div style={{ marginBottom: 16 }}>
      {renderLabel()}
      {renderDescription()}
      {renderInput()}
    </div>
  );
};

/**
 * 表单组渲染器
 */
const FormRenderer = ({
  group,
  folderId
}) => {
  const [formValues, setFormValues] = useState({});

  // 处理表单值变化
  const handleFieldChange = (fieldId, value) => {
    setFormValues(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  return (
    <Card
      title={
        <Space>
          <AppstoreOutlined />
          <span>{group.name}</span>
          {group.fields?.length > 0 && (
            <Tag color="blue">{group.fields.length} 个字段</Tag>
          )}
        </Space>
      }
      style={{
        marginBottom: 16,
        borderRadius: 8,
        boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
      }}
    >
      {group.description && (
        <div style={{ marginBottom: 16, color: '#666', fontSize: 13 }}>
          {group.description}
        </div>
      )}

      {group.fields && group.fields.length > 0 ? (
        group.fields.map(field => (
          <FieldRenderer
            key={field.id}
            field={field}
            value={formValues}
            onChange={handleFieldChange}
          />
        ))
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#999' }}>
          该表单下暂无字段
        </div>
      )}
    </Card>
  );
};

export default FormRenderer;
