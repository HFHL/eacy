import React, { useState } from 'react';
import { Layout, Menu, Dropdown, Space, Avatar } from 'antd';
import { 
  AppstoreOutlined, 
  FolderOpenOutlined, 
  UsergroupAddOutlined, 
  CloudUploadOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { key: '/dashboard', icon: <AppstoreOutlined />, label: '工作台' },
    { key: '/projects', icon: <FolderOpenOutlined />, label: '研究项目' },
    { key: '/patients', icon: <UsergroupAddOutlined />, label: '患者池' },
    { key: '/ai', icon: <CloudUploadOutlined />, label: '文档处理' },
    { type: 'divider' },
    { key: '/admin', icon: <DashboardOutlined />, label: '管理员' },
    { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
  ];

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人中心',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => {
        navigate('/login');
      }
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 顶部状态栏 */}
      <Header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        background: '#fff', 
        padding: '0 24px',
        boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
        zIndex: 10
      }}>
        {/* Logo 区域 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate('/dashboard')}>
          <div style={{ 
            width: 32, 
            height: 32, 
            background: '#1890ff', 
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: 18
          }}>E</div>
          <span style={{ fontSize: '20px', fontWeight: 600, color: '#000' }}>易悉 EACY</span>
        </div>

        {/* 右侧用户信息 */}
        <div>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar style={{ backgroundColor: '#1890ff' }} icon={<UserOutlined />} />
              <span style={{ color: 'rgba(0, 0, 0, 0.85)' }}>Admin</span>
            </Space>
          </Dropdown>
        </div>
      </Header>

      <Layout>
        {/* 左侧导航栏 */}
        <Sider 
          width={220} 
          theme="light" 
          collapsible 
          collapsed={collapsed} 
          onCollapse={(value) => setCollapsed(value)}
          style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}
        >
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            style={{ height: '100%', borderRight: 0, marginTop: 16 }}
            items={menuItems}
            onClick={handleMenuClick}
          />
        </Sider>

        {/* 主内容区域 */}
        <Layout style={{ padding: '24px' }}>
          <Content style={{
            background: '#fff',
            padding: 24,
            margin: 0,
            minHeight: 280,
            borderRadius: 8,
            boxShadow: '0 1px 2px 0 rgba(0,0,0,0.03)'
          }}>
            {/* 嵌套路由占位：具体的页面组件会渲染在这里 */}
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
