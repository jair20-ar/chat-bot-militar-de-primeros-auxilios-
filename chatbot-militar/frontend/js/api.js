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

function getAdminHeaders() {
  const headers = { 'Content-Type': 'application/json' };
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

async function fetchOfflineFirst(url, options = {}) {
  const isMutation = options.method && ['POST', 'PUT', 'DELETE'].includes(options.method.toUpperCase());
  const isInstruccionesAPI = url.includes('/api/instrucciones') && !url.includes('/api/instrucciones/');

  if (isMutation && !navigator.onLine) {
    await LocalDB.agregarCambioPendiente({ url, method: options.method, body: options.body });
    return { success: true, offline: true };
  }

  if (!isMutation && !navigator.onLine && typeof LocalDB !== 'undefined') {
    const data = await LocalDB.obtenerInstrucciones();
    return { success: true, data, offline: true };
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();
    if (isInstruccionesAPI && data.success && data.data && typeof LocalDB !== 'undefined') {
      await LocalDB.guardarInstrucciones(data.data);
    }
    return data;
  } catch (err) {
    if (typeof LocalDB !== 'undefined') {
      const data = await LocalDB.obtenerInstrucciones();
      return { success: true, data, offline: true };
    }
    throw err;
  }
}