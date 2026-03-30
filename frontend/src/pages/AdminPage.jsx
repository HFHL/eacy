import React, { useState } from 'react';
import { Tabs } from 'antd';
import { DashboardOutlined, FormOutlined } from '@ant-design/icons';
import MonitorDashboard from './MonitorDashboard';
import MetadataConfig from './MetadataConfig';

const AdminPage = () => {
  const [activeKey, setActiveKey] = useState('monitor');

  const items = [
    {
      key: 'monitor',
      label: (
        <span><DashboardOutlined style={{ marginRight: 6 }} />系统监控</span>
      ),
      children: <MonitorDashboard />,
    },
    {
      key: 'metadata',
      label: (
        <span><FormOutlined style={{ marginRight: 6 }} />元数据配置</span>
      ),
      children: <MetadataConfig />,
    },
  ];

  return (
    <div style={{ height: '100%' }}>
      <Tabs
        activeKey={activeKey}
        onChange={setActiveKey}
        items={items}
        type="card"
        style={{ height: '100%' }}
        tabBarStyle={{ marginBottom: 0, paddingLeft: 8 }}
      />
    </div>
  );
};

export default AdminPage;
