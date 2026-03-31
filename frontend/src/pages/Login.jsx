import React from 'react';
import { Form, Input, Button, Checkbox, message } from 'antd';
import { MailOutlined, LockOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';

import axios from 'axios';

const Login = () => {
  const navigate = useNavigate();

  const handleEmailLogin = async (values) => {
    try {
      const res = await axios.post('/api/auth/login', values);
      if (res.data.success) {
        localStorage.setItem('eacy_token', res.data.data.access_token);
        localStorage.setItem('eacy_user', JSON.stringify(res.data.data.user));
        message.success('登录成功，欢迎访问易悉医疗平台');
        navigate('/dashboard');
      } else {
        message.error(res.data.message);
      }
    } catch (err) {
      if (err.response && err.response.data && err.response.data.message) {
         message.error(err.response.data.message);
      } else {
         message.error('网络请求失败，请检查后端服务是否启动');
      }
    }
  };

  return (
    <div style={styles.container}>
      {/* 左侧宣传区域 */}
      <div style={styles.promoPanel}>
        <div style={styles.promoContent}>
          <div style={styles.promoLogo}>
            <span style={styles.logoText}>易悉</span>
            <span style={styles.logoSubtext}>EACY</span>
          </div>
          <h1 style={styles.promoTitle}>智能医疗数据平台</h1>
          <div style={styles.promoSubtitle}>
            <div style={styles.promoFeature}>
              <span style={styles.featureDot}></span>
              AI驱动的科研数据管理
            </div>
            <div style={styles.promoFeature}>
              <span style={styles.featureDot}></span>
              智能文档识别与结构化
            </div>
          </div>
          <button style={styles.promoButton}>
            了解更多
            <ArrowRightOutlined style={{ marginLeft: 8 }} />
          </button>
        </div>
        <div style={styles.copyright}>
          © 2026 易悉EACY. All rights reserved.
        </div>
      </div>

      {/* 右侧登录面板 */}
      <div style={styles.loginPanel}>
        <div style={styles.loginHeader}>
          <div style={styles.loginTabs}>
            <div style={{ ...styles.tab, ...styles.tabActive }}>
              <MailOutlined style={{ marginRight: 6 }} />
              邮箱登录
            </div>
          </div>
        </div>

        <div style={styles.emailSection}>
          <Form
            name="login"
            onFinish={handleEmailLogin}
            size="large"
            initialValues={{
              email: '',
              password: '',
              remember: true
            }}
          >
            <Form.Item
              name="email"
              rules={[{ required: true, message: '请输入邮箱' }]}
            >
              <Input 
                prefix={<MailOutlined style={{ color: '#bfbfbf' }} />} 
                placeholder="请输入邮箱" 
                style={styles.input}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password 
                prefix={<LockOutlined style={{ color: '#bfbfbf' }} />} 
                placeholder="请输入密码"
                style={styles.input}
              />
            </Form.Item>

            <Form.Item>
              <div style={styles.formOptions}>
                <Form.Item name="remember" valuePropName="checked" noStyle>
                  <Checkbox>记住登录</Checkbox>
                </Form.Item>
                <a href="#" style={styles.forgotLink}>
                  忘记密码？
                </a>
              </div>
            </Form.Item>

            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                block
                style={styles.loginButton}
              >
                登 录
              </Button>
            </Form.Item>
          </Form>
        </div>

        <div style={styles.registerPrompt}>
          还没有账号？
          <Link to="/register" style={styles.registerLink}>
            立即注册
          </Link>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: { display: 'flex', width: '100%', minHeight: '100vh', fontFamily: "sans-serif", background: '#f5f5f5' },
  promoPanel: { flex: 1, background: 'linear-gradient(135deg, #1890ff 0%, #0050b3 100%)', position: 'relative', overflow: 'hidden', padding: 60, display: 'flex', flexDirection: 'column', color: 'white' },
  promoContent: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  promoLogo: { display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 40 },
  logoText: { fontSize: 42, fontWeight: 600, letterSpacing: 2 },
  logoSubtext: { fontSize: 24, paddingBottom: 6, opacity: 0.8 },
  promoTitle: { fontSize: 48, fontWeight: 700, marginBottom: 30 },
  promoSubtitle: { display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 50 },
  promoFeature: { fontSize: 18, opacity: 0.9, display: 'flex', alignItems: 'center' },
  featureDot: { width: 8, height: 8, background: '#4ade80', borderRadius: '50%', marginRight: 12 },
  promoButton: { background: 'rgba(255, 255, 255, 0.2)', border: '1px solid rgba(255, 255, 255, 0.4)', color: 'white', padding: '12px 28px', borderRadius: 24, fontSize: 16, cursor: 'pointer', alignSelf: 'flex-start' },
  copyright: { fontSize: 14, opacity: 0.6 },
  
  loginPanel: { width: 440, background: 'white', padding: '60px 50px', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '-2px 0 20px rgba(0,0,0,0.06)' },
  loginHeader: { marginBottom: 40 },
  loginTabs: { display: 'flex', borderBottom: '1px solid #f0f0f0' },
  tab: { padding: '12px 24px', cursor: 'pointer', fontSize: 16, color: '#8c8c8c' },
  tabActive: { color: '#1890ff', borderBottom: '2px solid #1890ff', fontWeight: 500 },
  input: { padding: '10px 14px' },
  formOptions: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  forgotLink: { color: '#1890ff' },
  loginButton: { height: 44, fontSize: 16, background: '#1890ff' },
  registerPrompt: { textAlign: 'center', fontSize: 14, color: '#8c8c8c', marginTop: 20 },
  registerLink: { color: '#1890ff', marginLeft: 4, fontWeight: 500 },
};

export default Login;
