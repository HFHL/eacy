import api from './document'; // Reuse configured axios instance

export const getDashboardStats = async () => {
  return await api.get('/stats/dashboard');
};

export const getActiveTasks = async () => {
  return await api.get('/stats/tasks/active');
};
