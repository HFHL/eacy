import React from 'react';
import { Typography, Empty } from 'antd';

const { Title, Paragraph } = Typography;

const Settings = () => {
  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Title level={3}>系统设置</Title>
      <Paragraph type="secondary">管理用户权限、字典配置与环境参数。</Paragraph>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="模块建设中..." />
      </div>
    </div>
  );
};

export default Settings;
