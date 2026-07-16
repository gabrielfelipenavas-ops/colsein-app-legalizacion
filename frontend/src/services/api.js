import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  // Si el servidor no responde en 60s, la petición falla con error (en vez de
  // dejar la pantalla "congelada" para siempre sin avisar al usuario).
  timeout: 60000,
});

// Inject token on every request
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('colsein_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 globally
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      sessionStorage.removeItem('colsein_token');
      sessionStorage.removeItem('colsein_user');
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

// ── RECORRIDOS GPS (Trips) ──
export const tripAPI = {
  list: (params) => api.get('/trips', { params }),
  start: (data) => api.post('/trips', data),            // { medio, fecha, punto:{lat,lng,label} }
  addPoint: (id, punto) => api.post(`/trips/${id}/points`, punto),
  undoLast: (id) => api.delete(`/trips/${id}/points/last`),
  finish: (id, punto) => api.post(`/trips/${id}/finish`, punto ? { punto } : {}),
  confirm: (id, total_km) => api.post(`/trips/${id}/confirm`, { total_km }),
  remove: (id) => api.delete(`/trips/${id}`),
  discardUnconfirmed: () => api.delete('/trips/unconfirmed'),
  estimate: (puntos) => api.post('/trips/estimate', { puntos }),
};

// ── CONTABILIDAD (mapeo + auditoría + archivo plano NetSuite) ──
export const accountingAPI = {
  mappings: () => api.get('/accounting/mappings'),
  updateMapping: (id, data) => api.put(`/accounting/mappings/${id}`, data),
  monthAudit: (year, month, todas) => api.get(`/accounting/legalizations/${year}/${month}`, { params: todas ? { todas: 'true' } : {} }),
  downloadFlat: (year, month) => api.get(`/accounting/netsuite/${year}/${month}`, { responseType: 'blob' }),
};

// ── ESTABLECIMIENTOS (catálogo para autocompletar) ──
export const establishmentAPI = {
  search: (search) => api.get('/establishments', { params: { search, limit: 8 } }),
};

// ── AUTORIZACIONES (taxis/apps y gastos especiales) ──
export const authorizationAPI = {
  list: () => api.get('/authorizations'),
  pending: () => api.get('/authorizations/pending'),
  request: (data) => api.post('/authorizations', data),
  decide: (id, action, comentarios) => api.post(`/authorizations/${id}/decide`, { action, comentarios }),
};

// ── ANTICIPOS ──
export const anticipoAPI = {
  list: () => api.get('/anticipos'),
  pending: () => api.get('/anticipos/pending'),
  create: (data) => api.post('/anticipos', data),
  approve: (id, action, comentarios) => api.post(`/anticipos/${id}/approve`, { action, comentarios }),
};

// ── EXPENSES ──
export const expenseAPI = {
  list: (params) => api.get('/expenses', { params }),
  get: (id) => api.get(`/expenses/${id}`),
  create: (data) => {
    if (data instanceof FormData) return api.post('/expenses', data, { headers: { 'Content-Type': 'multipart/form-data' } });
    return api.post('/expenses', data);
  },
  update: (id, data) => {
    if (data instanceof FormData) return api.put(`/expenses/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
    return api.put(`/expenses/${id}`, data);
  },
  ocr: (file) => {
    const fd = new FormData();
    fd.append('imagen', file);
    // El OCR puede tardar más (lectura de la imagen): se le da un timeout mayor.
    return api.post('/expenses/ocr', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 });
  },
  delete: (id) => api.delete(`/expenses/${id}`),
  validate: (id, validado, observaciones) => api.put(`/expenses/${id}/validate`, observaciones !== undefined ? { validado, observaciones } : { validado }),
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
  pending: () => api.get('/legalizations/pending'),
  get: (id) => api.get(`/legalizations/${id}`),
  create: (data) => api.post('/legalizations', data),
  update: (id, data) => api.put(`/legalizations/${id}`, data),
  updateExpenses: (id, expense_ids) => api.put(`/legalizations/${id}/expenses`, { expense_ids }),
  submit: (id) => api.post(`/legalizations/${id}/submit`),
  approve: (id, action, comentarios) => api.post(`/legalizations/${id}/approve`, { action, comentarios }),
  review: (id, action, comentarios) => api.post(`/legalizations/${id}/review`, { action, comentarios }),
};

// ── NOTIFICATIONS ──
export const notificationAPI = {
  list: (params) => api.get('/notifications', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

// ── EMAIL ──
export const emailAPI = {
  search: (params) => api.get('/email/search', { params }),
  match: () => api.post('/email/match'),
  downloadAttachment: (uid, filename) => api.get(`/email/attachment/${uid}/${filename}`, { responseType: 'blob' }),
  getMatches: (params) => api.get('/email/matches', { params }),
  saveMatch: (data) => api.post('/email/save-match', data),
  deleteMatch: (id) => api.delete(`/email/match/${id}`),
};

// ── REPORTS ──
export const reportAPI = {
  dashboard: () => api.get('/reports/dashboard'),
  downloadKmExcel: (reportId) => api.get(`/reports/kilometraje/${reportId}/excel`, { responseType: 'blob' }),
  downloadLegalizacionExcel: (legId) => api.get(`/reports/legalizacion/${legId}/excel`, { responseType: 'blob' }),
  downloadLegalizacionFacturas: (legId) => api.get(`/reports/legalizacion/${legId}/facturas`, { responseType: 'blob' }),
  downloadAnticipoExcel: (id) => api.get(`/reports/anticipo/${id}/excel`, { responseType: 'blob' }),
  downloadMonthlyPack: (year, month) => api.get(`/reports/monthly-pack/${year}/${month}`, { responseType: 'blob' }),
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
