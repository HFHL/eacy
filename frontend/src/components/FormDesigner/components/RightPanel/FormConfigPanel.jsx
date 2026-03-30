/**
 * FormConfigPanel - 表单配置面板
 * 右侧面板：配置表单/组的属性
 */

import React, { useEffect } from 'react';
import {
  Form,
  Input,
  Switch,
  InputNumber,
  Divider,
  Alert,
  Typography,
  Tooltip
} from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import DocTypeSelector from '../shared/DocTypeSelector';

const { TextArea } = Input;
const { Text } = Typography;

/**
 * 表单配置面板组件
 */
const FormConfigPanel = ({
  folder = null,
  group = null,
  onUpdate = null,
  readonly = false,
  docTypeOptions = [],
  version = 0
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (group) {
      form.setFieldsValue({
        name: group.name,
        description: group.description,
        repeated: group.repeatable || false,
        minItems: group.minItems,
        maxItems: group.maxItems,
        order: group.order || 0,
        // 数据来源配置
        primarySources: group.primarySources || group.sources?.primary || [],
        secondarySources: group.secondarySources || group.sources?.secondary || [],
        mergeBinding: group.mergeBinding || '',
        reuseMode: group.formTemplate?.reuse_mode || 'none',
        sourceForm: group.formTemplate?.source_form || ''
      });
    } else if (folder) {
      form.setFieldsValue({
        name: folder.name,
        description: folder.description,
        order: folder.order || 0
      });
    }
  }, [folder, group, form, version]);

  const handleValuesChange = (changedValues, allValues) => {
    if (!onUpdate) return;
    if (group) {
      const reuseMode = allValues.reuseMode && allValues.reuseMode !== 'none' ? allValues.reuseMode : undefined;
      const sourceForm = allValues.sourceForm || undefined;
      onUpdate({
        ...allValues,
        repeatable: allValues.repeated,
        primarySources: allValues.primarySources || [],
        secondarySources: allValues.secondarySources || [],
        sources: { primary: allValues.primarySources || [], secondary: allValues.secondarySources || [] },
        mergeBinding: allValues.mergeBinding || '',
        formTemplate: {
          reuse_mode: reuseMode,
          source_form: sourceForm
        }
      });
      return;
    }
    onUpdate(allValues);
  };

  if (!group && !folder) {
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
          message="未选中配置项"
          description="请从左侧选择表单或访视进行配置"
          type="info"
          showIcon
          style={{ width: '100%' }}
        />
      </div>
    );
  }

  return (
    <div className="form-config-panel">
      <Form
        form={form}
        layout="vertical"
        onValuesChange={handleValuesChange}
        disabled={readonly}
      >
        <Form.Item
          label="名称"
          name="name"
          rules={[{ required: true, message: '请输入名称' }]}
        >
          <Input placeholder="请输入名称" />
        </Form.Item>

        <Form.Item
          label="描述"
          name="description"
        >
          <TextArea rows={3} placeholder="请输入描述" />
        </Form.Item>

        {group && (
          <>
            <Divider orientation="left">重复配置</Divider>

            <Form.Item
              label="可重复表单"
              name="repeated"
              valuePropName="checked"
              tooltip="启用后该表单可以添加多条记录"
            >
              <Switch checkedChildren="是" unCheckedChildren="否" />
            </Form.Item>

            <Form.Item
              label="最少记录数"
              name="minItems"
              tooltip="限制最少添加的记录数量，0表示不限制"
            >
              <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
            </Form.Item>

            <Form.Item
              label="最多记录数"
              name="maxItems"
              tooltip="限制最多添加的记录数量，留空表示不限制"
            >
              <InputNumber min={1} style={{ width: '100%' }} placeholder="不限制" />
            </Form.Item>

            <Divider orientation="left">
              数据来源
              <Tooltip title="配置该表单字段的数据抽取来源文档类型，系统将优先从主要来源抽取数据">
                <QuestionCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
              </Tooltip>
            </Divider>

            <Form.Item
              label={
                <span>
                  主要来源
                  <Tooltip title="优先从这些文档类型中抽取字段数据">
                    <QuestionCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
                  </Tooltip>
                </span>
              }
              name="primarySources"
            >
              <DocTypeSelector placeholder="选择主要来源文档类型（可多选）" options={docTypeOptions} />
            </Form.Item>

            <Form.Item
              label={
                <span>
                  次要来源
                  <Tooltip title="当主要来源无法抽取到数据时，作为补充数据来源">
                    <QuestionCircleOutlined style={{ marginLeft: 4, color: '#999' }} />
                  </Tooltip>
                </span>
              }
              name="secondarySources"
            >
              <DocTypeSelector placeholder="选择次要来源文档类型（可多选）" options={docTypeOptions} />

            <Divider orientation="left">抽取与复用</Divider>
            <Form.Item label="时间绑定 (x-merge-binding)" name="mergeBinding">
              <Input placeholder="anchor=报告日期;granularity=day" />
            </Form.Item>
            <Form.Item label="复用模式 (x-form-template)" name="reuseMode">
              <Input placeholder="full_reuse / original / copied_modified" />
            </Form.Item>
            <Form.Item label="来源表单 (source_form)" name="sourceForm">
              <Input placeholder="可选" />
            </Form.Item>
            </Form.Item>
          </>
        )}

        {(folder || group) && (
          <Alert
            message={
              folder
                ? `访视ID: ${folder.id}`
                : `组ID: ${group.id}`
            }
            description="ID用于系统内部标识，编辑时保持不变"
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Form>
    </div>
  );
};

export default FormConfigPanel;
