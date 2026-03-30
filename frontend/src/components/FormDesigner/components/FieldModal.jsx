/**
 * FieldModal - 字段编辑弹窗
 */

import React, { useEffect } from 'react';
import {
  Modal,
  Form,
  Row,
  Col,
  Input,
  Select,
  InputNumber,
  Switch,
  Radio,
  Space,
  Divider,
  Alert
} from 'antd';
import { DISPLAY_TYPES, CONFLICT_POLICIES, CONFLICT_POLICY_LABELS, COMPARE_TYPES } from '../core/constants';
import { getFieldTypeLabel } from '../utils/schemaHelpers';

const { TextArea } = Input;

/**
 * 字段编辑弹窗组件
 */
const FieldModal = ({
  visible,
  field,
  onCancel,
  onOk,
  mode = 'edit' // 'edit' | 'create'
}) => {
  const [form] = Form.useForm();

  const displayType = Form.useWatch('displayType', form);
  const isOptionType = [DISPLAY_TYPES.RADIO, DISPLAY_TYPES.CHECKBOX,
    DISPLAY_TYPES.SELECT, DISPLAY_TYPES.MULTISELECT].includes(displayType);

  useEffect(() => {
    if (visible && field) {
      form.setFieldsValue({
        ...field,
        isSensitive: field.sensitive || false,
        isPrimary: field.primary || false,
        isEditable: field.editable !== false,
        isRequired: field.required || false,
        isNullable: field.nullable !== false
      });
    }
  }, [visible, field, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      onOk({
        ...field,
        ...values,
        sensitive: values.isSensitive,
        primary: values.isPrimary,
        editable: values.isEditable,
        required: values.isRequired,
        nullable: values.isNullable
      });
    } catch (error) {
      console.error('表单验证失败:', error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={mode === 'create' ? '添加字段' : '编辑字段'}
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      width={700}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          dataType: 'string',
          isNullable: true,
          isEditable: true,
          isSensitive: false,
          isPrimary: false,
          isRequired: false
        }}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="字段名称"
              name="name"
              rules={[{ required: true, message: '请输入字段名称' }]}
            >
              <Input placeholder="请输入字段名称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="显示名称" name="displayName">
              <Input placeholder="用于界面展示" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              label="展示类型"
              name="displayType"
              rules={[{ required: true, message: '请选择展示类型' }]}
            >
              <Select placeholder="请选择展示类型">
                {Object.entries(DISPLAY_TYPES).map(([key, value]) => (
                  <Select.Option key={key} value={value}>
                    {getFieldTypeLabel(value)}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="字段ID (x-field-id)" name="fieldId">
              <Input placeholder="用于复用一致性校验" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="数据类型" name="dataType">
              <Select>
                <Select.Option value="string">文本</Select.Option>
                <Select.Option value="number">数字</Select.Option>
                <Select.Option value="boolean">布尔值</Select.Option>
                <Select.Option value="array">数组</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="数据单位" name="unit">
              <Input placeholder="例如：岁、kg、元" />
            </Form.Item>
          </Col>
        </Row>

        {displayType === DISPLAY_TYPES.FILE && (
          <Form.Item label="文件类型 (x-file-type)" name="fileType">
            <Input placeholder="如: pdf,image" />
          </Form.Item>
        )}

        {isOptionType && (
          <Form.Item
            label="选项值"
            name="options"
            rules={[{ required: true, message: '请配置选项值' }]}
            tooltip="多个选项用逗号分隔"
          >
            <Select
              mode="tags"
              placeholder="输入选项，按回车添加"
              style={{ width: '100%' }}
            />
          </Form.Item>
        )}

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label="必填"
              name="isRequired"
              valuePropName="checked"
            >
              <Switch checkedChildren="必填" unCheckedChildren="可选" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="可为空"
              name="isNullable"
              valuePropName="checked"
            >
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="敏感字段"
              name="isSensitive"
              valuePropName="checked"
              tooltip="敏感字段将进行脱敏处理"
            >
              <Switch checkedChildren="敏感" unCheckedChildren="普通" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item
              label="主键字段"
              name="isPrimary"
              valuePropName="checked"
              tooltip="主键字段用于数据去重"
            >
              <Switch checkedChildren="主键" unCheckedChildren="普通" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              label="可编辑"
              name="isEditable"
              valuePropName="checked"
            >
              <Switch checkedChildren="可编辑" unCheckedChildren="只读" />
            </Form.Item>
          </Col>
        </Row>

        <Divider orientation="left">字段说明</Divider>

        <Form.Item
          label="字段说明"
          name="description"
          tooltip="字段的业务含义说明，用于前端tooltip显示"
        >
          <TextArea rows={2} placeholder="请输入字段说明" />
        </Form.Item>

        <Form.Item
          label="抽取提示词"
          name="extractionPrompt"
          tooltip="LLM抽取该字段时的指导提示词"
        >
          <TextArea rows={3} placeholder="请输入抽取提示词" />
        </Form.Item>

        <Divider orientation="left">高级配置</Divider>

        <Form.Item
          label="冲突策略"
          name="conflictPolicy"
        >
          <Select placeholder="请选择冲突策略" allowClear>
            {Object.entries(CONFLICT_POLICY_LABELS).map(([key, label]) => (
              <Select.Option key={key} value={key}>
                {label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        {field && field.uid && (
          <Alert
            message={`字段UID: ${field.uid}`}
            description="UID用于版本管理，确保数据兼容性。编辑时UID将保持不变。"
            type="info"
            showIcon
          />
        )}
      </Form>
    </Modal>
  );
};

export default FieldModal;
