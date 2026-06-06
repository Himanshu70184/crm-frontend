import axios from 'axios';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' ? '/api' : 'http://127.0.0.1:5000/api');

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token on every request
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('crm_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally (skip login/register — failed login must not redirect)
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const url = error.config?.url || '';
    const isAuthAttempt = url.includes('/auth/login') || url.includes('/auth/register');
    if (
      error.response?.status === 401 &&
      typeof window !== 'undefined' &&
      !isAuthAttempt
    ) {
      localStorage.removeItem('crm_token');
      localStorage.removeItem('crm_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ───────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/updateprofile', data),
  changePassword: (data) => api.put('/auth/changepassword', data),
};

// ─── Users ──────────────────────────────────────────
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getOne: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  remove: (id) => api.delete(`/users/${id}`),
};

// ─── Projects ───────────────────────────────────────
export const projectsAPI = {
  getAll: (params) => api.get('/projects', { params }),
  getOne: (id) => api.get(`/projects/${id}`),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  remove: (id) => api.delete(`/projects/${id}`),
  updateMilestones: (id, milestones) => api.put(`/projects/${id}/milestones`, { milestones }),
  updateKanban: (id, kanbanConfig) => api.put(`/projects/${id}/kanban`, { kanbanConfig }),
  getStats: (id) => api.get(`/projects/${id}/stats`),
};

// ─── Tasks ──────────────────────────────────────────
export const tasksAPI = {
  getAll: (params) => api.get('/tasks', { params }),
  getOne: (id) => api.get(`/tasks/${id}`),
  create: (data) => api.post('/tasks', data),
  update: (id, data) => api.put(`/tasks/${id}`, data),
  updateStatus: (id, status) => api.put(`/tasks/${id}/status`, { status }),
  updateSubtasks: (id, subtasks) => api.put(`/tasks/${id}/subtasks`, { subtasks }),
  getActivities: (id) => api.get(`/tasks/${id}/activities`),
  getTimer: (id) => api.get(`/tasks/${id}/timer`),
  startTimer: (id) => api.post(`/tasks/${id}/timer/start`),
  pauseTimer: (id) => api.post(`/tasks/${id}/timer/pause`),
  resumeTimer: (id) => api.post(`/tasks/${id}/timer/resume`),
  stopTimer: (id, data) => api.post(`/tasks/${id}/timer/stop`, data),
  cancelTimer: (id) => api.post(`/tasks/${id}/timer/cancel`),
  adjustTimer: (id, data) => api.put(`/tasks/${id}/timer/adjust`, data),
  logTime: (id, data) => api.post(`/tasks/${id}/timer/log`, data),
  remove: (id) => api.delete(`/tasks/${id}`),
  uploadAttachment: (id, formData) =>
    api.post(`/tasks/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// ─── Comments ───────────────────────────────────────
export const commentsAPI = {
  getAll: (params) => api.get('/comments', { params }),
  create: (data) => api.post('/comments', data),
  update: (id, data) => api.put(`/comments/${id}`, data),
  remove: (id) => api.delete(`/comments/${id}`),
};

// ─── Time Logs ──────────────────────────────────────
export const timeLogsAPI = {
  getAll: (params) => api.get('/timelogs', { params }),
  getSummary: (params) => api.get('/timelogs/summary', { params }),
  create: (data) => api.post('/timelogs', data),
  update: (id, data) => api.put(`/timelogs/${id}`, data),
  remove: (id) => api.delete(`/timelogs/${id}`),
};

// ─── Attendance ────────────────────────────────────
export const attendanceAPI = {
  getAll: (params) => api.get('/attendance', { params }),
  getToday: (params) => api.get('/attendance/today', { params }),
  clockIn: (data) => api.post('/attendance/clock-in', data),
  clockOut: (data) => api.post('/attendance/clock-out', data),
  reconcile: (data) => api.post('/attendance/reconcile', data),
  getLeaves: (params) => api.get('/attendance/leaves', { params }),
  applyLeave: (data) => api.post('/attendance/leaves', data),
  reviewLeave: (id, data) => api.put(`/attendance/leaves/${id}/review`, data),
};

// ─── Dashboard ──────────────────────────────────────
export const dashboardAPI = {
  getStats: () => api.get('/dashboard'),
};

// ─── Notifications ──────────────────────────────────
export const notificationsAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
  remove: (id) => api.delete(`/notifications/${id}`),
};

export const reportsAPI = {
  getAll: (params) => api.get('/reports', { params }),
  exportTime: (params) => api.get('/reports/time-export', { params }),
};

export const settingsAPI = {
  getPublic: () => api.get('/settings/public'),
  get: () => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  getKanbanColumns: () => api.get('/settings/kanban-columns'),
  updateKanbanColumns: (columns) => api.put('/settings/kanban-columns', { columns }),
  emailStatus: () => api.get('/settings/email-status'),
  testEmail: (data) => api.post('/settings/test-email', data),
};

export const activitiesAPI = {
  getAll: (params) => api.get('/activities', { params }),
};

export const timerAPI = {
  getActive: () => api.get('/timer/active'),
};

export const setupAPI = {
  getStatus: () => api.get('/setup/status'),
  bootstrap: () => api.post('/setup/bootstrap'),
};

// ─── Roles & Permissions ─────────────────────────────────────────────────────
export const rolesAPI = {
  getAll: (params) => api.get('/roles', { params }),
  getOne: (id) => api.get(`/roles/${id}`),
  getMyPermissions: () => api.get('/roles/my-permissions'),
  create: (data) => api.post('/roles', data),
  update: (id, data) => api.put(`/roles/${id}`, data),
  remove: (id) => api.delete(`/roles/${id}`),
  clone: (id, data) => api.post(`/roles/${id}/clone`, data),
  getAuditLogs: (params) => api.get('/roles/audit-logs', { params }),
};

// ─── Chat ────────────────────────────────────────────────────────────────────
export const chatAPI = {
  getConversations: (params) => api.get('/chat/conversations', { params }),
  createConversation: (data) => api.post('/chat/conversations', data),
  getConversationMembers: (conversationId) => api.get(`/chat/conversations/${conversationId}/members`),
  leaveConversation: (conversationId) => api.post(`/chat/conversations/${conversationId}/leave`),
  getMessages: (conversationId, params) => api.get(`/chat/conversations/${conversationId}/messages`, { params }),
  sendMessage: (conversationId, data) => api.post(`/chat/conversations/${conversationId}/messages`, data),
  updateMessage: (messageId, data) => api.put(`/chat/messages/${messageId}`, data),
  deleteMessage: (messageId) => api.delete(`/chat/messages/${messageId}`),
};

export default api;
