/**
 * FieldConfigPanel - 字段配置面板
 * 右侧面板：配置选中字段的详细属性
 */

import React, { useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  Space,
  Divider,
  Alert,
  Typography,
  Tag
} from 'antd';
import {
  CONFLICT_POLICIES,
  CONFLICT_POLICY_LABELS,
  COMPARE_TYPES,
  DISPLAY_TYPES
} from '../../core/constants';
import { getFieldTypeLabel } from '../../utils/schemaHelpers';

const { TextArea } = Input;
const { Text, Paragraph } = Typography;

/**
 * 字段配置面板组件
 */
const FieldConfigPanel = ({
  field = null,
  onUpdate = null,
  readonly = false,
  version = 0
}) => {
  const [form] = Form.useForm();

  const displayType = Form.useWatch('displayType', form);
  const isOptionType = [DISPLAY_TYPES.RADIO, DISPLAY_TYPES.CHECKBOX,
    DISPLAY_TYPES.SELECT, DISPLAY_TYPES.MULTISELECT].includes(displayType);

  useEffect(() => {
    if (field) {
      form.setFieldsValue({
        ...field,
        isSensitive: field.sensitive || false,
        isPrimary: field.primary || false,
        isEditable: field.editable !== false,
        isRequired: field.required || false,
        isNullable: field.nullable !== false,
        warnOnConflict: field.warnOnConflict !== false,
        reuseMode: field.formTemplate?.reuse_mode || 'none',
        sourceForm: field.formTemplate?.source_form || ''
      });
    } else {
      form.resetFields();
    }
  }, [field, form, version]);

  const handleValuesChange = (changedValues, allValues) => {
    if (!onUpdate) return;
    const reuseMode = allValues.reuseMode && allValues.reuseMode !== 'none' ? allValues.reuseMode : undefined;
    const sourceForm = allValues.sourceForm || undefined;

    // 修改字段名称时同步更新显示名称
    let displayName = allValues.displayName;
    if ('name' in changedValues) {
      displayName = changedValues.name;
    }

    onUpdate({
      sensitive: allValues.isSensitive,
      primary: allValues.isPrimary,
      editable: allValues.isEditable,
      required: allValues.isRequired,
      nullable: allValues.isNullable,
      warnOnConflict: allValues.warnOnConflict !== false,
      formTemplate: {
        reuse_mode: reuseMode,
        source_form: sourceForm
      },
      fileType: allValues.fileType || '',
      fieldId: allValues.fieldId,
      ...allValues,
      displayName
    });
  };

  if (!field) {
    return (
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#fff',
        borderRadius: 4,
        padding: 16
      }}>
        <Alert
          message="未选中字段"
          description="请从左侧选择字段进行配置"
          type="info"
          showIcon
          style={{ width: '100%' }}
        />
      </div>
    );
  }

  return (
    <div className="field-config-panel">
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
        disabled={readonly}
      >
        <Divider orientation="left">基础属性</Divider>

        <Form.Item
          label="字段名称"
          name="name"
          rules={[{ required: true, message: '请输入字段名称' }]}
        >
          <Input placeholder="请输入字段名称" />
        </Form.Item>

        <Form.Item label="显示名称 (x-display-name)" name="displayName">
          <Input placeholder="用于界面展示" />
        </Form.Item>

        <Form.Item label="字段 UID (x-field-uid)" name="uid">
          <Input disabled placeholder="系统生成" />
        </Form.Item>

        <Form.Item label="字段 ID (x-field-id)" name="fieldId">
          <Input placeholder="用于复用一致性校验" />
        </Form.Item>

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

        <Form.Item label="数据类型" name="dataType">
          <Select>
            <Select.Option value="string">文本</Select.Option>
            <Select.Option value="number">数字</Select.Option>
            <Select.Option value="boolean">布尔值</Select.Option>
            <Select.Option value="array">数组</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item label="数据单位" name="unit">
          <Input placeholder="例如：岁、kg、元" />
        </Form.Item>

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

        <Divider orientation="left">验证规则</Divider>

        <Form.Item
          label="必填"
          name="isRequired"
          valuePropName="checked"
        >
          <Switch checkedChildren="必填" unCheckedChildren="可选" />
        </Form.Item>

        <Form.Item
          label="可为空"
          name="isNullable"
          valuePropName="checked"
        >
          <Switch checkedChildren="是" unCheckedChildren="否" />
        </Form.Item>

        <Form.Item label="最小值/长度" name="minimum">
          <InputNumber placeholder="不限制" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label="最大值/长度" name="maximum">
          <InputNumber placeholder="不限制" style={{ width: '100%' }} />
        </Form.Item>

        <Form.Item label="正则表达式" name="pattern">
          <Input placeholder="请输入正则表达式" />
        </Form.Item>

        <Divider orientation="left">高级属性</Divider>

        <Form.Item
          label="敏感字段"
          name="isSensitive"
          valuePropName="checked"
          tooltip="敏感字段将进行脱敏处理"
        >
          <Switch checkedChildren="敏感" unCheckedChildren="普通" />
        </Form.Item>

        <Form.Item
          label="主键字段"
          name="isPrimary"
          valuePropName="checked"
          tooltip="主键字段用于数据去重"
        >
          <Switch checkedChildren="主键" unCheckedChildren="普通" />
        </Form.Item>

        <Form.Item
          label="可编辑"
          name="isEditable"
          valuePropName="checked"
        >
          <Switch checkedChildren="可编辑" unCheckedChildren="只读" />
        </Form.Item>

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

        <Divider orientation="left">字段复用</Divider>
        <Form.Item label="复用模式 (x-form-template)" name="reuseMode">
          <Input placeholder="full_reuse / original / copied_modified" />
        </Form.Item>
        <Form.Item label="来源表单 (source_form)" name="sourceForm">
          <Input placeholder="可选" />
        </Form.Item>

        <Divider orientation="left">数据合并</Divider>

        <Form.Item
          label="冲突策略"
          name="conflictPolicy"
          tooltip="当数据冲突时的处理策略"
        >
          <Select placeholder="请选择冲突策略" allowClear>
            {Object.entries(CONFLICT_POLICY_LABELS).map(([key, label]) => (
              <Select.Option key={key} value={key}>
                {label}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item label="冲突警告 (x-warn-on-conflict)" name="warnOnConflict" valuePropName="checked">
          <Switch checkedChildren="警告" unCheckedChildren="不警告" />
        </Form.Item>

        <Form.Item
          label="比较类型"
          name="compareType"
          tooltip="字段值比较时的类型判定方式"
        >
          <Select placeholder="请选择比较类型" allowClear>
            {Object.entries(COMPARE_TYPES).map(([key, value]) => (
              <Select.Option key={key} value={value}>
                {value}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="默认值"
          name="defaultValue"
          tooltip="字段的默认值"
        >
          <Input placeholder="请输入默认值" />
        </Form.Item>

        <Form.Item
          label="格式化"
          name="format"
          tooltip="日期或字符串的格式化规则"
        >
          <Input placeholder="例如：yyyy-MM-dd、手机号、邮箱等" />
        </Form.Item>

        <Divider orientation="left">数据来源与合并</Divider>

        <Form.Item
          label="数据来源"
          name="dataSources"
          tooltip="指定该字段的数据来源系统或表"
        >
          <Select
            mode="tags"
            placeholder="输入数据来源，按回车添加"
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          label="合并绑定"
          name="mergeBindings"
          tooltip="配置字段合并时的绑定关系"
        >
          <Select
            mode="tags"
            placeholder="输入绑定字段，按回车添加"
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item
          label="枚举引用"
          name="enumRef"
          tooltip="引用全局枚举定义"
        >
          <Input placeholder="请输入枚举名称" />
        </Form.Item>

        <Divider orientation="left">扩展属性</Divider>

        <Form.Item
          label="扩展属性"
          name="xProperties"
          tooltip="自定义扩展属性（JSON格式）"
        >
          <TextArea
            rows={4}
            placeholder='{"key": "value"}'
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>

        <Divider orientation="left">字段信息</Divider>

        {field.uid && (
          <Alert
            message={
              <Space direction="vertical" size={0}>
                <Text><strong>字段UID:</strong> {field.uid}</Text>
                {field.id && (
                  <Text type="secondary"><strong>字段ID:</strong> {field.id}</Text>
                )}
              </Space>
            }
            description="UID用于版本管理，确保数据兼容性。编辑时UID将保持不变。"
            type="info"
            showIcon
          />
        )}
      </Form>
    </div>
  );
};

export default FieldConfigPanel;
