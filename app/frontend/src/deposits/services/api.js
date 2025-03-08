import axios from 'axios';

// Make sure axios is configured to include the CSRF token
axios.defaults.xsrfCookieName = 'csrftoken';
axios.defaults.xsrfHeaderName = 'X-CSRFToken';

// Create axios instance with CSRF token support
const api = axios.create({
  headers: {
    'X-CSRFToken': document.querySelector('[name=csrfmiddlewaretoken]')?.value
  }
});

export default {
  // Deposit endpoints
  getDeposits: () => api.get('/api/v1/deposits/'),
  getDeposit: (id) => api.get(`/api/v1/deposits/${id}/`),
  createDeposit: (data) => api.post('/api/v1/deposits/', data),
  updateDeposit: (id, data) => api.patch(`/api/v1/deposits/${id}/`, data),
  deleteDeposit: (id) => api.delete(`/api/v1/deposits/${id}/`),
  
  // State transitions
  transitionState: (id, state, comment) => 
    api.post(`/api/v1/deposits/${id}/transition/`, { state, comment }),
  
  // File endpoints
  uploadFile: (depositId, formData, config) => {
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]')?.value;
    return axios.post(`/api/v1/deposits/${depositId}/files/`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
            'X-CSRFToken': csrfToken
        },
        ...config
    });
  },
  getFiles: (depositId) => api.get(`/api/v1/deposits/${depositId}/files/`),
  deleteFile: (depositId, fileId) => api.delete(`/api/v1/deposits/${depositId}/files/${fileId}/`),
  markAsMetadata: (depositId, fileId) => api.post(`/api/v1/deposits/${depositId}/files/${fileId}/mark-as-metadata/`),
  
  // Notifications
  getNotifications: () => api.get('/api/v1/notifications/'),
  markNotificationRead: (id) => api.post(`/api/v1/notifications/${id}/mark-read/`),
  markAllNotificationsRead: () => api.post('/api/v1/notifications/mark-all-read/'),
  getUnreadCount: () => api.get('/api/v1/notifications/unread-count/'),
  
  // Reports
  getDepositStats: (params) => api.get('/api/v1/reports/deposit_stats/', { params }),
  getActivityTimeline: (params) => api.get('/api/v1/reports/activity_timeline/', { params }),
  getUserActivity: (params) => api.get('/api/v1/reports/user_activity/', { params })
}; 