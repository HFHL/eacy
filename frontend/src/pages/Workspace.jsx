import React from 'react';
import { Typography, Card, Result } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';

const { Title, Paragraph } = Typography;

export default function Workspace() {
  return (
    <div style={{ padding: '24px' }}>
      <Title level={3}>工作台总览</Title>
      <Card style={{ borderRadius: 12, marginTop: 24 }}>
        <Result
          icon={<AppstoreOutlined style={{ color: '#6366f1' }} />}
          title="欢迎来到 EACY 自动结构化抽取平台"
          subTitle="在这里，您可以览阅全域统计数据，请从左侧导航栏的【文档上传】开始业务流转。"
        />
      </Card>
    </div>
  );
}
