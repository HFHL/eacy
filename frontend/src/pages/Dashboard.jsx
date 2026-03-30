import React from 'react';
import { Typography, Empty } from 'antd';

const { Title, Paragraph } = Typography;

const Dashboard = () => {
  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Title level={3}>工作台</Title>
      <Paragraph type="secondary">欢迎使用易悉科研数据处理平台。在这里查看任务概览和近期项目。</Paragraph>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="模块建设中..." />
      </div>
    </div>
  );
};

export default Dashboard;
