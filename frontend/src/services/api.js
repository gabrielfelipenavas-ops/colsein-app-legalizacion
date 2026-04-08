import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Inject token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('colsein_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('colsein_token');
      localStorage.removeItem('colsein_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── AUTH ──
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  changePassword: (current_password, new_password) => api.put('/auth/password', { current_password, new_password }),
};

// ── KILOMETRAJE ──
export const kmAPI = {
  getReports: (params) => api.get('/kilometraje/reports', { params }),
  getReport: (id) => api.get(`/kilometraje/reports/${id}`),
  addEntry: (data) => api.post('/kilometraje/entries', data),
  updateEntry: (id, data) => api.put(`/kilometraje/entries/${id}`, data),
  deleteEntry: (id) => api.delete(`/kilometraje/entries/${id}`),
  uploadPhoto: (entryId, field, file) => {
    const formData = new FormData();
    formData.append('foto', file);
    return api.post(`/kilometraje/entries/${entryId}/upload/${field}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  submitReport: (id) => api.post(`/kilometraje/reports/${id}/submit`),
  approveReport: (id, action, comentarios) => api.post(`/kilometraje/reports/${id}/approve`, { action, comentarios }),
  getPending: () => api.get('/kilometraje/pending'),
};

// ── ANTICIPOS ──
export const anticipoAPI = {
  list: () => api.get('/anticipos'),
  create: (data) => api.post('/anticipos', data),
  approve: (id, action, comentarios) => api.post(`/anticipos/${id}/approve`, { action, comentarios }),
};

// ── EXPENSES ──
export const expenseAPI = {
  list: (params) => api.get('/expenses', { params }),
  create: (data) => {
    if (data instanceof FormData) return api.post('/expenses', data, { headers: { 'Content-Type': 'multipart/form-data' } });
    return api.post('/expenses', data);
  },
  ocr: (file) => {
    const fd = new FormData();
    fd.append('imagen', file);
    return api.post('/expenses/ocr', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  delete: (id) => api.delete(`/expenses/${id}`),
};

// ── CLIENTS ──
export const clientAPI = {
  list: (params) => api.get('/clients', { params }),
  create: (data) => api.post('/clients', data),
  import: (file) => {
    const fd = new FormData();
    fd.append('archivo', file);
    return api.post('/clients/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};

// ── LEGALIZATIONS ──
export const legalizationAPI = {
  list: () => api.get('/legalizations'),
  get: (id) => api.get(`/legalizations/${id}`),
  create: (data) => api.post('/legalizations', data),
  updateExpenses: (id, expense_ids) => api.put(`/legalizations/${id}/expenses`, { expense_ids }),
  submit: (id) => api.post(`/legalizations/${id}/submit`),
  approve: (id, action, comentarios) => api.post(`/legalizations/${id}/approve`, { action, comentarios }),
};

// ── EMAIL ──
export const emailAPI = {
  search: (params) => api.get('/email/search', { params }),
  match: () => api.post('/email/match'),
  downloadAttachment: (uid, filename) => api.get(`/email/attachment/${uid}/${filename}`, { responseType: 'blob' }),
};

// ── REPORTS ──
export const reportAPI = {
  dashboard: () => api.get('/reports/dashboard'),
  downloadKmExcel: (reportId) => api.get(`/reports/kilometraje/${reportId}/excel`, { responseType: 'blob' }),
  downloadLegalizacionExcel: (legId) => api.get(`/reports/legalizacion/${legId}/excel`, { responseType: 'blob' }),
};

// ── CONFIG ──
export const configAPI = {
  get: () => api.get('/config'),
  update: (clave, valor) => api.put(`/config/${clave}`, { valor }),
};

// ── USERS ──
export const userAPI = {
  list: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
};

export default api;
