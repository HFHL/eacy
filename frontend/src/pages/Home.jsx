import React from 'react';
import { Button } from 'antd';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  return (
    <div style={{ padding: 50, textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>欢迎来到易悉医疗平台</h1>
      <p style={{ color: '#666', marginTop: 20 }}>这是重构后的新版空框架主页。</p>
      
      <Button 
        type="primary" 
        style={{ marginTop: 30 }}
        onClick={() => {
            navigate('/login');
        }}
      >
        退出登录
      </Button>
    </div>
  );
};

export default Home;
