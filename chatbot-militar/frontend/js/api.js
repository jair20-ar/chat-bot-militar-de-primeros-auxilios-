const API_URL = '';

function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const medicoData = localStorage.getItem('medicoData');
  if (medicoData) {
    try {
      const userData = JSON.parse(medicoData);
      if (userData.token) {
        headers['Authorization'] = 'Bearer ' + userData.token;
        return headers;
      }
    } catch (e) {}
  }
  const adminToken = localStorage.getItem('adminToken');
  if (adminToken && adminToken.length > 10) {
    headers['Authorization'] = 'Bearer ' + adminToken;
  }
  return headers;
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isAuthenticated() {
  const medicoData = localStorage.getItem('medicoData');
  if (medicoData) return true;
  const adminToken = localStorage.getItem('adminToken');
  return adminToken !== null;
}