import React from 'react';
import { Form, Input, Button, message } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';

const Register = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const handleRegister = async (values) => {
    try {
      const res = await axios.post('/api/auth/register', {
        email: values.email,
        password: values.password,
        name: values.name,
      });
      if (res.data.success) {
        message.success('注册成功，请登录');
        navigate('/login');
      } else {
        message.error(res.data.message || '注册失败');
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
            <div style={styles.promoFeature}>
              <span style={styles.featureDot}></span>
              高效的临床数据采集
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

      {/* 右侧注册面板 */}
      <div style={styles.registerPanel}>
        <div style={styles.registerHeader}>
          <div style={styles.headerTitle}>创建账号</div>
          <div style={styles.headerSubtitle}>加入易悉医疗数据平台</div>
        </div>

        <Form
          form={form}
          name="register"
          onFinish={handleRegister}
          size="large"
          layout="vertical"
        >
          <Form.Item
            name="name"
            label={<span style={styles.label}>姓名</span>}
            rules={[{ required: true, message: '请输入您的姓名' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="请输入您的姓名"
              style={styles.input}
            />
          </Form.Item>

          <Form.Item
            name="email"
            label={<span style={styles.label}>邮箱</span>}
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input
              prefix={<MailOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="请输入邮箱地址"
              style={styles.input}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span style={styles.label}>密码</span>}
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6位' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="请设置密码（至少6位）"
              style={styles.input}
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label={<span style={styles.label}>确认密码</span>}
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="请再次输入密码"
              style={styles.input}
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 8 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              style={styles.registerButton}
            >
              立即注册
            </Button>
          </Form.Item>
        </Form>

        <div style={styles.loginLink}>
          已有账号？
          <Link to="/login" style={styles.link}>
            立即登录
          </Link>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    width: '100%',
    minHeight: '100vh',
    fontFamily: 'sans-serif',
    background: '#f5f5f5',
  },
  promoPanel: {
    flex: 1,
    background: 'linear-gradient(135deg, #1890ff 0%, #0050b3 100%)',
    position: 'relative',
    overflow: 'hidden',
    padding: 60,
    display: 'flex',
    flexDirection: 'column',
    color: 'white',
  },
  promoContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  promoLogo: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 12,
    marginBottom: 40,
  },
  logoText: { fontSize: 42, fontWeight: 600, letterSpacing: 2 },
  logoSubtext: { fontSize: 24, paddingBottom: 6, opacity: 0.8 },
  promoTitle: { fontSize: 48, fontWeight: 700, marginBottom: 30 },
  promoSubtitle: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    marginBottom: 50,
  },
  promoFeature: {
    fontSize: 18,
    opacity: 0.9,
    display: 'flex',
    alignItems: 'center',
  },
  featureDot: {
    width: 8,
    height: 8,
    background: '#4ade80',
    borderRadius: '50%',
    marginRight: 12,
    display: 'inline-block',
  },
  promoButton: {
    background: 'rgba(255, 255, 255, 0.2)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    color: 'white',
    padding: '12px 28px',
    borderRadius: 24,
    fontSize: 16,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  copyright: { fontSize: 14, opacity: 0.6 },
  registerPanel: {
    width: 480,
    background: 'white',
    padding: '50px 50px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    boxShadow: '-2px 0 20px rgba(0,0,0,0.06)',
    overflowY: 'auto',
  },
  registerHeader: {
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 700,
    color: '#1a1a1a',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8c8c8c',
  },
  label: {
    fontSize: 14,
    color: '#333',
    fontWeight: 500,
  },
  input: { padding: '10px 14px' },
  registerButton: {
    height: 44,
    fontSize: 16,
    background: '#1890ff',
  },
  loginLink: {
    textAlign: 'center',
    fontSize: 14,
    color: '#8c8c8c',
    marginTop: 16,
  },
  link: {
    color: '#1890ff',
    marginLeft: 4,
    fontWeight: 500,
  },
};

export default Register;
