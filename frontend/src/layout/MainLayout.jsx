import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Layout, Menu, Dropdown, Space, Avatar, Typography, Button, Breadcrumb, Input, Tag, Divider, Spin, Empty, theme, Badge } from 'antd';
import { 
  AppstoreOutlined, 
  FolderOpenOutlined, 
  UsergroupAddOutlined, 
  CloudUploadOutlined,
  SettingOutlined,
  UserOutlined,
  LogoutOutlined,
  DashboardOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
  CloseOutlined,
  TeamOutlined,
  FileOutlined,
  BellOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState({ pages: [], patients: [], documents: [] });
  const searchInputRef = useRef(null);

  const menuItems = [
    { key: '/dashboard', icon: <AppstoreOutlined />, label: '工作台' },
    { key: '/projects', icon: <FolderOpenOutlined />, label: '研究项目' },
    { key: '/patients', icon: <UsergroupAddOutlined />, label: '患者池' },
    { key: '/ai', icon: <CloudUploadOutlined />, label: '文档处理' },
    { type: 'divider' },
    { key: '/admin', icon: <DashboardOutlined />, label: '管理员' },
    { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
  ];

  const pageEntries = [
    { label: '工作台', path: '/dashboard', icon: <AppstoreOutlined />, keywords: '工作台 首页 dashboard home' },
    { label: '文档处理', path: '/ai', icon: <CloudUploadOutlined />, keywords: '文件 文档 列表 file document processing list' },
    { label: '患者池', path: '/patients', icon: <UsergroupAddOutlined />, keywords: '患者 数据池 patient pool' },
    { label: '研究项目', path: '/projects', icon: <FolderOpenOutlined />, keywords: '科研 项目 数据集 research project' },
    { label: '系统设置', path: '/settings', icon: <SettingOutlined />, keywords: '设置 系统 settings' },
    { label: '管理员', path: '/admin', icon: <DashboardOutlined />, keywords: '管理员 admin' },
  ];

  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    if (!value.trim()) {
      setSearchResults({ pages: [], patients: [], documents: [] });
      setSearchLoading(false);
      return;
    }
    const q = value.trim().toLowerCase();
    const matchedPages = pageEntries.filter(p => p.label.toLowerCase().includes(q) || p.keywords.toLowerCase().includes(q));
    setSearchResults({ pages: matchedPages, patients: [], documents: [] });
  }, []);

  const handleSearchResultClick = useCallback((type, item) => {
    setSearchVisible(false);
    setSearchQuery('');
    setSearchResults({ pages: [], patients: [], documents: [] });
    if (type === 'page') {
      navigate(item.path);
    }
  }, [navigate]);

  useEffect(() => {
    if (searchVisible) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery('');
      setSearchResults({ pages: [], patients: [], documents: [] });
    }
  }, [searchVisible]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchVisible(v => !v);
      }
      if (e.key === 'Escape' && searchVisible) {
        setSearchVisible(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchVisible]);

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
      key: 'settings',
      icon: <SettingOutlined />,
      label: '系统设置',
      onClick: () => navigate('/settings')
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
      onClick: () => {
        navigate('/login');
      }
    },
  ];

  // 计算面包屑
  let breadcrumbs = ['工作台'];
  const path = location.pathname;
  if (path.startsWith('/ai')) breadcrumbs = ['文档处理'];
  else if (path.startsWith('/patients')) breadcrumbs = path.includes('/detail') ? ['患者池', '患者详情'] : ['患者池'];
  else if (path.startsWith('/projects')) breadcrumbs = path.includes('/patient/') ? ['研究项目', '患者详情'] : path !== '/projects' ? ['研究项目', '项目详情'] : ['研究项目'];
  else if (path.startsWith('/settings')) breadcrumbs = ['系统设置'];
  else if (path.startsWith('/admin')) breadcrumbs = ['管理员'];
  else if (path.startsWith('/crf-designer')) breadcrumbs = ['CRF设计器'];

  return (
    <Layout className="main-layout" style={{ minHeight: '100vh' }}>
      <div
        onClick={() => navigate('/dashboard')}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          zIndex: 101,
          height: 64,
          width: collapsed ? 80 : 256,
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 10,
          background: '#fff',
          transition: 'width 0.2s',
          borderBottom: '1px solid #f0f0f0',
          padding: 0,
          paddingLeft: collapsed ? 8 : 16,
          paddingRight: collapsed ? 8 : 16,
          boxShadow: '2px 0 8px 0 rgba(29, 35, 41, 0.05)',
          borderRight: '1px solid #f0f0f0',
          cursor: 'pointer'
        }}
      >
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
          fontSize: 18,
          flexShrink: 0
        }}>E</div>
        {!collapsed && (
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'rgba(0,0,0,0.85)',
              whiteSpace: 'nowrap',
              flexShrink: 0
            }}
          >
            易悉 EACY
          </span>
        )}
      </div>

      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={256}
        theme="light"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          boxShadow: '2px 0 8px 0 rgba(29, 35, 41, 0.05)',
          borderRight: '1px solid #f0f0f0'
        }}
      >
        <div style={{ height: 64, flexShrink: 0 }} />
        <Menu
          mode="inline"
          theme="light"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0, marginTop: 16 }}
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 256, transition: 'margin-left 0.2s' }}>
        <Header style={{
          padding: '0 24px',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 1px 4px rgba(0,21,41,0.08)',
          position: 'sticky',
          top: 0,
          zIndex: 99,
          height: 64
        }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16, width: 46, height: 46, marginRight: 16 }}
            />
            <Breadcrumb
              items={breadcrumbs.map((crumb, index) => ({
                title: crumb,
                key: index
              }))}
            />
          </div>

          <Space size={24}>
            <SearchOutlined 
              style={{ fontSize: 18, cursor: 'pointer', color: token.colorTextSecondary }} 
              onClick={() => setSearchVisible(!searchVisible)}
            />
            <Badge count={0}>
              <BellOutlined style={{ fontSize: 18, cursor: 'pointer', color: token.colorTextSecondary }} />
            </Badge>

            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1890ff', marginRight: 8 }} />
                <Text>Admin</Text>
              </div>
            </Dropdown>
          </Space>
        </Header>

        {searchVisible && (
          <>
            <div
              onClick={() => setSearchVisible(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 999 }}
            />
            <div style={{
              position: 'fixed', top: '12%', left: '50%', transform: 'translateX(-50%)',
              width: 560, maxHeight: '68vh', background: '#fff', borderRadius: 12,
              boxShadow: '0 16px 48px rgba(0,0,0,0.2)', zIndex: 1000,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              animation: 'slideDown 0.15s ease-out'
            }}>
              <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 12 }}>
                <SearchOutlined style={{ fontSize: 18, color: '#bbb' }} />
                <Input
                  ref={searchInputRef}
                  placeholder="搜索页面… (Esc 关闭)"
                  variant="borderless"
                  size="large"
                  value={searchQuery}
                  onChange={e => handleSearchChange(e.target.value)}
                  style={{ flex: 1, fontSize: 16 }}
                />
                {searchQuery && <CloseOutlined style={{ cursor: 'pointer', color: '#999' }} onClick={() => { setSearchQuery(''); handleSearchChange(''); }} />}
                <Tag style={{ fontSize: 11, lineHeight: '20px' }}>ESC</Tag>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                {!searchQuery.trim() && (
                  <div style={{ padding: '12px 20px', color: '#999', fontSize: 13 }}>
                    <div style={{ marginBottom: 8, fontWeight: 500, color: '#666' }}>快速导航</div>
                    {pageEntries.map(p => (
                      <div
                        key={p.path}
                        onClick={() => handleSearchResultClick('page', p)}
                        style={{ padding: '8px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, color: '#333' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ color: '#1890ff' }}>{p.icon}</span>
                        <span>{p.label}</span>
                      </div>
                    ))}
                    <Divider style={{ margin: '8px 0' }} />
                    <div style={{ fontSize: 12, color: '#bbb', textAlign: 'center' }}>
                      提示：<Tag style={{ fontSize: 11 }}>Ctrl+K</Tag> 随时打开搜索
                    </div>
                  </div>
                )}
                {searchQuery.trim() && searchResults.pages.length > 0 && (
                  <div style={{ padding: '4px 20px' }}>
                    <div style={{ fontSize: 11, color: '#999', fontWeight: 500, marginBottom: 4 }}>页面</div>
                    {searchResults.pages.map(p => (
                      <div
                        key={p.path}
                        onClick={() => handleSearchResultClick('page', p)}
                        style={{ padding: '8px 12px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f5f5f5'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span style={{ color: '#1890ff' }}>{p.icon}</span>
                        <span>{p.label}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#bbb' }}>{p.path}</span>
                      </div>
                    ))}
                  </div>
                )}
                {searchQuery.trim() && searchResults.pages.length === 0 && (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span style={{ color: '#999' }}>未找到相关页面</span>} style={{ padding: 32 }} />
                )}
              </div>
            </div>
          </>
        )}

        <Content style={{
          margin: 24,
          minHeight: 280,
          background: 'transparent'
        }}>
          <Outlet />
        </Content>

        <div style={{ textAlign: 'center', padding: '0 0 24px 0', color: 'rgba(0,0,0,0.45)' }}>
          EACY Data Platform ©2024
        </div>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
