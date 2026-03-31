import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Inject Authentication Context
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('eacy_token');
  const userStr = localStorage.getItem('eacy_user');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (userStr) {
    try {
      const u = JSON.parse(userStr);
      config.headers['X-User-Id'] = u.id;
    } catch(e) {
      return Promise.reject(e);
    }
  }
  
  // 强制禁用缓存，防止删除后刷新列表时拿到旧数据
  if (config.method && config.method.toLowerCase() === 'get') {
    config.params = { ...config.params, _t: Date.now() };
  }
  
  return config;
});
export const getPatients = async (params) => {
  return await api.get('/patients/', { params });
};

export const getPatientDetail = async (patientId) => {
  return await api.get(`/patients/${patientId}`);
};

export const getPatientDocuments = async (patientId, params) => {
  return await api.get(`/patients/${patientId}/documents`, { params });
};

export const deletePatient = async (patientId) => {
  return await api.delete(`/patients/${patientId}`);
};

export const removePatientDocument = async (patientId, documentId) => {
  return await api.delete(`/patients/${patientId}/documents/${documentId}`);
};
