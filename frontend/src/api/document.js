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
      const user = JSON.parse(userStr);
      if (user.id) config.headers['X-User-Id'] = user.id;
    } catch(e) {}
  }
  
  // 强制禁用缓存，防止浏览器记住之前因端口冲突导致的 403 错误
  config.params = { ...config.params, _t: Date.now() };
  
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response.data,
  error => {
    return Promise.reject(error);
  }
);

export const getDocumentList = async (params) => {
  return await api.get('/documents/', { params });
};

export const deleteDocument = async (id) => {
  return await api.delete(`/documents/${id}`);
};

export const getSystemConfig = async () => {
  return await api.get('/system/config');
};

export const getMonitorStats = async () => {
  return await api.get('/system/monitor');
};

export const getUploadSignature = async () => {
  return await api.get('/oss/upload-signature');
};

export const reportUploadCallback = async (ossUrl, filename, mimeType, fileSize) => {
  return await api.post('/documents/callback', {
    oss_url: ossUrl,
    filename: filename,
    mime_type: mimeType,
    file_size: fileSize,
  });
};

export const uploadForFormExtract = async (projectId, patientId, formName, ossUrl, filename, mimeType, fileSize) => {
  return await api.post(`/projects/${projectId}/patients/${patientId}/crf-form/upload-extract`, {
    form_name: formName,
    oss_url: ossUrl,
    filename: filename,
    mime_type: mimeType,
    file_size: fileSize,
  });
};

export const extractFromDocument = async (projectId, patientId, formName, documentId) => {
  return await api.post(`/projects/${projectId}/patients/${patientId}/crf-form/extract-from-doc`, {
    form_name: formName,
    document_id: documentId,
  });
};

export const getOcrResult = async (documentId) => {
  return await api.get(`/documents/${documentId}/ocr`);
};

export const reOcrDocument = async (documentId) => {
  return await api.post(`/documents/${documentId}/reocr`);
};

// ─── 元数据配置 API ──────────────────────────────────
export const getMetadataFields = async () => {
  return await api.get('/metadata/fields');
};

export const createMetadataField = async (data) => {
  return await api.post('/metadata/fields', data);
};

export const updateMetadataField = async (id, data) => {
  return await api.put(`/metadata/fields/${id}`, data);
};

export const deleteMetadataField = async (id) => {
  return await api.delete(`/metadata/fields/${id}`);
};

export const getDocTypeCategories = async () => {
  return await api.get('/metadata/doc-types');
};

export const createDocTypeCategory = async (data) => {
  return await api.post('/metadata/doc-types', data);
};

export const updateDocTypeCategory = async (id, data) => {
  return await api.put(`/metadata/doc-types/${id}`, data);
};

export const deleteDocTypeCategory = async (id) => {
  return await api.delete(`/metadata/doc-types/${id}`);
};

export const createSubtype = async (categoryId, data) => {
  return await api.post(`/metadata/doc-types/${categoryId}/subtypes`, data);
};

export const updateSubtype = async (subtypeId, data) => {
  return await api.put(`/metadata/subtypes/${subtypeId}`, data);
};

export const deleteSubtype = async (subtypeId) => {
  return await api.delete(`/metadata/subtypes/${subtypeId}`);
};

export const extractMetadata = async (documentId) => {
  return await api.post(`/documents/${documentId}/extract-metadata`);
};

export const getMetadataResult = async (documentId) => {
  return await api.get(`/documents/${documentId}/metadata`);
};

export const updateMetadataResult = async (documentId, resultJson) => {
  return await api.put(`/documents/${documentId}/metadata`, { result_json: resultJson });
};

export const archiveDocument = async (documentId) => {
  return await api.post(`/documents/${documentId}/archive`);
};

export const archiveDocumentNew = async (documentId) => {
  return await api.post(`/documents/${documentId}/archive-new`);
};

export const getDocumentPreviewUrl = async (documentId) => {
  return await api.get(`/documents/${documentId}/preview-url`);
};

export const batchArchiveCommit = async (assignments) => {
  return await api.post('/batch/commit', { assignments });
};

export default api;
