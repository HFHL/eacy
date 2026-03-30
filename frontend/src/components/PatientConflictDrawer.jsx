import React, { useState, useEffect, useMemo } from 'react';
import { Drawer, Form, Input, Select, Button, Space, Alert, Typography, Divider, Tag, AutoComplete, DatePicker } from 'antd';
import { CheckCircleOutlined, WarningOutlined, UserAddOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const PATIENT_DEMOGRAPHIC_FIELDS = [
  '患者姓名',
  '患者性别',
  '患者年龄',
  '出生日期',
  '机构名称',
  '科室信息',
  '联系电话'
];

const FIELD_ALIASES = {
  '患者姓名': ['患者姓名', '姓名', 'patient_name', 'name'],
  '患者性别': ['患者性别', '性别', 'gender', 'sex'],
  '患者年龄': ['患者年龄', '年龄', 'age'],
  '出生日期': ['出生日期', '生日', 'dob', 'birth_date', 'birthdate'],
  '机构名称': ['机构名称', '医院名称', '医院', 'hospital', '诊断机构'],
  '科室信息': ['科室信息', '科室', 'department', 'ward', '科别'],
  '联系电话': ['联系电话', '电话', 'phone', 'telephone', 'mobile', '联系人电话']
};

const { Text, Title } = Typography;
const { Option } = Select;

const PatientConflictDrawer = ({ open, onClose, pendingCommit, targetPatient, onCommit }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const { cluster, action } = pendingCommit || {};
  const isNewPatient = action === 'CREATE_PATIENT';

  // Analyze metadata
  const { unifiedMetadata, fieldOptions, hasConflicts, allIdentifiers } = useMemo(() => {
    if (!cluster) return { unifiedMetadata: {}, fieldOptions: {}, hasConflicts: false, allIdentifiers: [] };
    
    const sources = [];
    if (targetPatient?.metadata_json) {
      sources.push(targetPatient.metadata_json);
    }
    cluster.documents.forEach(doc => {
      if (doc.result_json) {
        sources.push(doc.result_json);
      }
    });

    const fMap = {};
    sources.forEach(src => {
      Object.keys(src).forEach(rawKey => {
        let canonicalKey = null;
        for (const [canon, aliases] of Object.entries(FIELD_ALIASES)) {
          if (aliases.includes(rawKey.toLowerCase())) {
            canonicalKey = canon;
            break;
          }
        }
        if (!canonicalKey) return;
        
        const val = src[rawKey];
        // Handle scalar values (treat array of phones later)
        if (val !== null && val !== undefined && val !== '') {
          // Special handling for phone arrays, don't drop them
          if (canonicalKey === '联系电话' && Array.isArray(val)) {
             if (!fMap[canonicalKey]) fMap[canonicalKey] = new Set();
             val.forEach(p => p && fMap[canonicalKey].add(String(p).trim()));
             return;
          }
          if (typeof val !== 'object') {
            if (!fMap[canonicalKey]) fMap[canonicalKey] = new Set();
            let cleanVal = String(val).trim();
            if (canonicalKey === '患者年龄') {
               cleanVal = cleanVal.replace('岁', '').replace('Y', '').trim();
            }
            if (canonicalKey === '患者性别' && (cleanVal === 'M' || cleanVal === 'Male')) cleanVal = '男';
            if (canonicalKey === '患者性别' && (cleanVal === 'F' || cleanVal === 'Female')) cleanVal = '女';
            fMap[canonicalKey].add(cleanVal);
          }
        }
      });
    });

    const unified = {};
    const options = {};
    let conflictsFound = false;

    Object.keys(fMap).forEach(key => {
      if (key === '联系电话') return; // Handled below
      const vals = Array.from(fMap[key]);
      if (vals.length === 1) {
        unified[key] = vals[0];
      } else if (vals.length > 1) {
        options[key] = vals;
        conflictsFound = true;
        // Leave undefined in unified so it forces user to choose
      }
    });

    // Identifiers
    const idSet = new Set();
    if (Array.isArray(targetPatient?.identifiers)) {
      targetPatient?.identifiers.forEach(id => idSet.add(id));
    }
    if (Array.isArray(cluster.aggregated_identifiers)) {
      cluster.aggregated_identifiers.forEach(id => idSet.add(id));
    }

    // Phones (Pooled as Array)
    const phoneSet = new Set();
    const addPhone = (val) => {
      if (!val) return;
      if (Array.isArray(val)) {
        val.forEach(p => p && phoneSet.add(String(p).trim()));
      } else {
        String(val).split(/[,，/|]/).forEach(p => {
          if (p.trim()) phoneSet.add(p.trim());
        });
      }
    };
    if (targetPatient?.metadata_json?.['联系电话']) addPhone(targetPatient.metadata_json['联系电话']);
    cluster.documents.forEach(doc => {
      if (doc.result_json?.['联系电话']) addPhone(doc.result_json['联系电话']);
    });
    
    // Inject phones into unified so it mounts in the form
    unified['联系电话'] = Array.from(phoneSet);

    // Convert date fields to dayjs for Antd DatePicker
    if (unified['出生日期'] && typeof unified['出生日期'] === 'string') {
      const d = dayjs(unified['出生日期']);
      unified['出生日期'] = d.isValid() ? d : null;
    }

    return { unifiedMetadata: unified, fieldOptions: options, hasConflicts: conflictsFound, allIdentifiers: Array.from(idSet) };
  }, [cluster, targetPatient]);

  useEffect(() => {
    if (open && pendingCommit) {
      form.resetFields();
      // For existing-patient merge, pre-fill what we know
      // For new patient creation, pre-fill what AI extracted but leave blanks for user
      form.setFieldsValue(unifiedMetadata);
    }
  }, [open, pendingCommit, unifiedMetadata, form]);

  const handleFinish = async (values) => {
    setLoading(true);
    try {
      // First inherit everything the AI successfully extracted
      const final_metadata = { ...unifiedMetadata };
      
      // Override with user's final input from the form UI
      Object.keys(values).forEach(k => {
        // Skip the hidden new_patient_* helper fields
        if (k.startsWith('__')) return;
        if (values[k] !== null && values[k] !== undefined && values[k] !== '') {
          final_metadata[k] = values[k];
        } else if (values[k] === null || values[k] === '') {
           delete final_metadata[k];
        }
      });

      // Handle DatePicker value for 出生日期
      if (values['出生日期'] && values['出生日期']?.format) {
        final_metadata['出生日期'] = values['出生日期'].format('YYYY-MM-DD');
      } else if (final_metadata['出生日期'] && typeof final_metadata['出生日期'] === 'object' && final_metadata['出生日期'].format) {
        final_metadata['出生日期'] = final_metadata['出生日期'].format('YYYY-MM-DD');
      }

      await onCommit({
        action: action,
        patient_id: targetPatient?.id,
        document_ids: cluster.documents.map(d => d.id),
        final_metadata,
        final_identifiers: allIdentifiers
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  if (!cluster) return null;

  const drawerTitle = isNewPatient ? '新建患者档案并归档' : '确认患者档案统一合模';

  // For a new patient, figure out which fields were already extracted (non-empty) vs empty
  const extractedName = unifiedMetadata['患者姓名'];
  const nameIsUnknown = !extractedName || extractedName === '未知' || extractedName === '未知姓名';

  return (
    <Drawer
      title={
        <Space>
          {isNewPatient && <UserAddOutlined style={{ color: '#1677ff' }} />}
          {drawerTitle}
        </Space>
      }
      size="large"
      placement="right"
      onClose={onClose}
      open={open}
      maskClosable={false}
      footer={
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={onClose} disabled={loading}>取消退出</Button>
            <Button type="primary" onClick={() => form.submit()} loading={loading}>
              {isNewPatient ? '新建并归档' : '确认并写入档案'}
            </Button>
          </Space>
        </div>
      }
    >
      <div style={{ marginBottom: 24 }}>
        <Title level={5}>
          {isNewPatient
            ? `为 ${cluster.documents.length} 份文档创建新患者档案`
            : `将 ${cluster.documents.length} 份文档归入档案`}
        </Title>
        <Text type="secondary">
          {isNewPatient
            ? '系统未能在现有档案中找到匹配患者。请填写新患者的基本信息，系统将自动创建档案并完成归档。'
            : '系统已自动提取文档特征。对于没有冲突的新字段（例如补充了新电话），系统已自动合并。'}
        </Text>
      </div>

      {/* 顶部总体状态提示 */}
      <div style={{ marginBottom: 24 }}>
        {isNewPatient ? (
          <Alert
            type="info"
            showIcon
            message="新建患者"
            description={
              nameIsUnknown
                ? '文档中未能识别到患者姓名，请手动填写下方带 * 的必填信息后再提交。'
                : `系统从文档中提取到患者姓名：「${extractedName}」，请核实并补充完整信息。`
            }
          />
        ) : hasConflicts ? (
          <Alert 
            type="error" 
            showIcon 
            message="发现属性冲突"
            description="该批次文档涉及到了矛盾的患者属性（已标红），请手动选择或输入正确的值以固化档案。"
          />
        ) : (
          <Alert 
            type="success" 
            showIcon 
            message="数据高度一致"
            description="文档中提取的标量属性与目标档案完美吻合或形成了不冲突的补充。确认无误后可直接提交。"
          />
        )}
      </div>

      <Form form={form} layout="vertical" onFinish={handleFinish}>

        {/* ────────────── 新建患者专属区 ────────────── */}
        {isNewPatient && (
          <>
            <Divider titlePlacement="left">
              <Text type="danger">新患者必填信息</Text>
            </Divider>
            <div style={{ padding: '16px', backgroundColor: '#f0f5ff', border: '1px solid #adc6ff', borderRadius: 8, marginBottom: 24 }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16, fontSize: 12 }}>
                带 <Text type="danger">*</Text> 的字段为必填项
              </Text>

              <Form.Item
                label="患者姓名"
                name="患者姓名"
                rules={[{ required: true, message: '请输入患者姓名' }]}
              >
                <Input placeholder="请输入患者全名" allowClear />
              </Form.Item>

              <Form.Item
                label="患者性别"
                name="患者性别"
                rules={[{ required: true, message: '请选择患者性别' }]}
              >
                <Select placeholder="请选择">
                  <Option value="男">男</Option>
                  <Option value="女">女</Option>
                  <Option value="未知">未知</Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="患者年龄"
                name="患者年龄"
              >
                <Input placeholder="例如：42" allowClear />
              </Form.Item>

              <Form.Item
                label="出生日期"
                name="出生日期"
              >
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="请选择出生日期"
                  format="YYYY-MM-DD"
                  disabledDate={(d) => d && d.isAfter(dayjs())}
                />
              </Form.Item>

              <Form.Item label="机构名称" name="机构名称">
                <Input placeholder="所属医院或机构（可选）" allowClear />
              </Form.Item>

              <Form.Item label="科室信息" name="科室信息">
                <Input placeholder="所属科室（可选）" allowClear />
              </Form.Item>

              <Form.Item label="联系电话 (可多个)" name="联系电话">
                <Select
                  mode="tags"
                  style={{ width: '100%' }}
                  placeholder="输入电话号码后按回车添加"
                  tokenSeparators={[',', '，', ' ']}
                />
              </Form.Item>
            </div>
          </>
        )}

        {/* ────────────── 合并归档区（非新建患者场景）────────────── */}
        {!isNewPatient && (
          <>
            <Divider titlePlacement="left">基本属性</Divider>

            {/* Render Conflicting Fields First */}
            {Object.keys(fieldOptions).length > 0 && (
              <div style={{ padding: '16px', backgroundColor: '#fff2f0', border: '1px solid #ffccc7', borderRadius: 8, marginBottom: 24 }}>
                <Text type="danger" strong style={{ display: 'block', marginBottom: 16 }}>需您决定的项：</Text>
                {Object.keys(fieldOptions).map(key => (
                  <Form.Item
                    key={key}
                    label={<Text type="danger">{key} (发生冲突)</Text>}
                    name={key}
                    rules={[{ required: true, message: `请明确此患者的 ${key}` }]}
                  >
                    <AutoComplete
                      options={fieldOptions[key].map(v => ({ value: v }))}
                      placeholder="请选择或输入正确的值"
                      status="error"
                      allowClear
                    />
                  </Form.Item>
                ))}
              </div>
            )}

            {/* Render Non-Conflicting auto-filled scalar fields */}
            {Object.keys(unifiedMetadata).filter(k => k !== '联系电话').map(key => (
              <Form.Item key={key} label={key} name={key}>
                <Input />
              </Form.Item>
            ))}

            {/* Render Phones as a multiple-tag input */}
            <Form.Item label="联系电话 (合并多个)" name="联系电话">
               <Select 
                 mode="tags" 
                 style={{ width: '100%' }} 
                 placeholder="可输入新号码并回车"
                 tokenSeparators={[',', '，', ' ']}
               />
            </Form.Item>
          </>
        )}

        <Divider titlePlacement="left">池化标识符聚合 (自动)</Divider>
        <div style={{ marginBottom: 24 }}>
          {allIdentifiers.length > 0 ? (
            <Space size={[0, 8]} wrap>
              {allIdentifiers.map(id => (
                <Tag color="geekblue" key={id}>{id}</Tag>
              ))}
            </Space>
          ) : (
            <Text type="secondary">无明确标识符</Text>
          )}
        </div>
      </Form>
    </Drawer>
  );
};

export default PatientConflictDrawer;
