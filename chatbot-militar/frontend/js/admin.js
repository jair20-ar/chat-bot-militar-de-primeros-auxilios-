const API_URL = '';

// Verificar sesión
if (localStorage.getItem('adminToken') !== 'true') {
  window.location.href = 'login_admin.html';
}

// Variables de estado
let allMedicos = [];
let allInstrucciones = [];
let allBusquedas = [];
let currentPeriodo = 'dia';

// Elementos del DOM
const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.tab-panel');

const statTotalInstrucciones = document.getElementById('statTotalInstrucciones');
const statCriticos = document.getElementById('statCriticos');
const statMedicos = document.getElementById('statMedicos');

const medicosList = document.getElementById('medicosList');
const emptyMedicos = document.getElementById('emptyMedicos');
const searchMedicosInput = document.getElementById('searchMedicos');

const instruccionesList = document.getElementById('instruccionesList');
const emptyInstrucciones = document.getElementById('emptyInstrucciones');
const searchInstruccionesInput = document.getElementById('searchInstrucciones');

const busquedasList = document.getElementById('busquedasList');
const emptyBusquedas = document.getElementById('emptyBusquedas');
const searchBusquedasInput = document.getElementById('searchBusquedas');
const periodoSelect = document.getElementById('periodoSelect');

const codeDisplay = document.getElementById('codeDisplay');
const newRegCodeInput = document.getElementById('newRegCode');
const btnSaveRegCode = document.getElementById('btnSaveRegCode');

const newAdminPassInput = document.getElementById('newAdminPass');
const confirmAdminPassInput = document.getElementById('confirmAdminPass');
const btnUpdateAdminPass = document.getElementById('btnUpdateAdminPass');

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadData();
  setupEventListeners();
});

// Inicialización de pestañas
function initTabs() {
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      document.getElementById(tab.dataset.target).classList.add('active');
    });
  });
}

// Cargar todos los datos (Estadísticas, Médicos, Instrucciones, Config, Búsquedas)
async function loadData() {
  await loadStatsAndConfig();
  await loadMedicos();
  await loadInstrucciones();
  loadBusquedas();
}

// Cargar estadísticas y configuraciones generales
async function loadStatsAndConfig() {
  try {
    const res = await fetch(`${API_URL}/api/admin/config`);
    const data = await res.json();
    if (data.success) {
      statTotalInstrucciones.textContent = data.stats.instrucciones;
      statCriticos.textContent = data.stats.criticos;
      statMedicos.textContent = data.stats.medicos;
      codeDisplay.textContent = data.config.registro_code;
    }
  } catch (err) {
    console.error('Error al cargar config/stats:', err);
  }
}

// Cargar médicos registrados
async function loadMedicos() {
  try {
    const res = await fetch(`${API_URL}/api/admin/medicos`);
    const data = await res.json();
    if (data.success) {
      allMedicos = data.data;
      renderMedicos(allMedicos);
    }
  } catch (err) {
    console.error('Error al cargar médicos:', err);
  }
}

// Renderizar lista de médicos
function renderMedicos(medicos) {
  medicosList.innerHTML = '';
  if (medicos.length === 0) {
    emptyMedicos.style.display = 'flex';
    return;
  }
  emptyMedicos.style.display = 'none';

  medicos.forEach(med => {
    const item = document.createElement('div');
    item.className = 'data-item';
    item.innerHTML = `
      <div class="data-info">
        <div class="data-title">Dr. ${med.nombre}</div>
        <div class="data-meta">
          <span class="badge-item green">${med.especializacion}</span>
          <span class="badge-item">C.I: ${med.cedula}</span>
          <span class="badge-item">${med.email}</span>
        </div>
      </div>
      <div class="data-actions">
        <button class="action-btn-admin delete-btn" title="Eliminar Médico" onclick="deleteMedico('${med.id_medico}')">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      </div>
    `;
    medicosList.appendChild(item);
  });
}

// Eliminar médico
async function deleteMedico(id_medico) {
  if (!confirm('¿Está seguro de que desea eliminar a este médico? Esto eliminará también todas sus instrucciones registradas de manera permanente.')) {
    return;
  }
  try {
    const res = await fetch(`${API_URL}/api/admin/medicos/${id_medico}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      alert('Médico e instrucciones eliminados con éxito.');
      loadData();
    } else {
      alert('Error al eliminar médico: ' + data.error);
    }
  } catch (err) {
    console.error(err);
    alert('Error al conectar con el servidor.');
  }
}

// Cargar instrucciones registradas
async function loadInstrucciones() {
  try {
    const res = await fetch(`${API_URL}/api/instrucciones`);
    const data = await res.json();
    if (data.success) {
      allInstrucciones = data.data;
      renderInstrucciones(allInstrucciones);
    }
  } catch (err) {
    console.error('Error al cargar instrucciones:', err);
  }
}

// Renderizar lista de instrucciones
function renderInstrucciones(instrucciones) {
  instruccionesList.innerHTML = '';
  if (instrucciones.length === 0) {
    emptyInstrucciones.style.display = 'flex';
    return;
  }
  emptyInstrucciones.style.display = 'none';

  instrucciones.forEach(inst => {
    const severidadClass = inst.severidad === 'critico' ? 'red' : inst.severidad === 'moderado' ? 'yellow' : 'cyan';
    const dateFormatted = inst.fecha ? new Date(inst.fecha).toLocaleDateString('es-VE') : 'N/A';
    
    const item = document.createElement('div');
    item.className = 'data-item';
    item.innerHTML = `
      <div class="data-info">
        <div class="data-title">${inst.titulo}</div>
        <div class="data-meta">
          <span class="badge-item ${severidadClass}">${inst.severidad ? inst.severidad.toUpperCase() : 'LEVE'}</span>
          <span class="badge-item cyan">${inst.categoria || 'GENERAL'}</span>
          <span class="badge-item">Cuerpo: ${inst.parte_cuerpo}</span>
          <span class="badge-item">Médico: ${inst.id_medico}</span>
          <span class="badge-item">Fecha: ${dateFormatted}</span>
        </div>
      </div>
      <div class="data-actions">
        <a href="/emergencia.html?edit=${inst.id}" class="action-btn-admin edit-btn" title="Editar Instrucción">
          <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
        </a>
        <button class="action-btn-admin preview-btn" title="Vista Soldado" onclick="previewSoldado(${inst.id})">
          <svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        </button>
        <button class="action-btn-admin delete-btn" title="Eliminar Instrucción" onclick="deleteInstruccion(${inst.id})">
          <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
        </button>
      </div>
    `;
    instruccionesList.appendChild(item);
  });
}

// Vista Soldado - previsualizar instrucción como la ve un soldado
function previewSoldado(id) {
    sessionStorage.setItem('previewMode', 'true');
    sessionStorage.setItem('selectedInstructionId', id);
    window.location.href = 'instrucciones.html';
}

// Eliminar instrucción
async function deleteInstruccion(id) {
  if (!confirm('¿Está seguro de que desea eliminar esta instrucción médica?')) {
    return;
  }
  try {
    const res = await fetch(`${API_URL}/api/instrucciones/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_medico: 'admin' })
    });
    const data = await res.json();
    if (data.success) {
      alert('Instrucción eliminada con éxito.');
      loadData();
    } else {
      alert('Error al eliminar instrucción: ' + data.error);
    }
  } catch (err) {
    console.error(err);
    alert('Error al conectar con el servidor.');
  }
}

// Cargar búsquedas registradas
function loadBusquedas() {
  const search = searchBusquedasInput.value.trim();
  const url = `${API_URL}/api/admin/busquedas?periodo=${currentPeriodo}${search ? '&search=' + encodeURIComponent(search) : ''}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        allBusquedas = data.data;
        renderBusquedas(allBusquedas);
      }
    })
    .catch(err => console.error('Error al cargar búsquedas:', err));
}

// Renderizar lista de búsquedas
function renderBusquedas(busquedas) {
  busquedasList.innerHTML = '';
  if (busquedas.length === 0) {
    emptyBusquedas.style.display = 'flex';
    return;
  }
  emptyBusquedas.style.display = 'none';

  busquedas.forEach(b => {
    const dateFormatted = new Date(b.fecha).toLocaleString('es-VE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });

    const item = document.createElement('div');
    item.className = 'data-item';
    item.innerHTML = `
      <div class="data-info">
        <div class="data-title">${b.titulo}</div>
        <div class="data-meta">
          <span class="badge-item green">${b.nombre_medico_creador}</span>
          <span class="badge-item">${dateFormatted}</span>
        </div>
      </div>
    `;
    busquedasList.appendChild(item);
  });
}

// Configurar Event Listeners para formularios y búsquedas
function setupEventListeners() {
  // Buscador de médicos
  searchMedicosInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const filtered = allMedicos.filter(med => 
      med.nombre.toLowerCase().includes(query) || 
      med.cedula.toLowerCase().includes(query) ||
      med.especializacion.toLowerCase().includes(query)
    );
    renderMedicos(filtered);
  });

  // Buscador de instrucciones
  searchInstruccionesInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    const filtered = allInstrucciones.filter(inst => 
      inst.titulo.toLowerCase().includes(query) || 
      (inst.categoria && inst.categoria.toLowerCase().includes(query)) ||
      inst.id_medico.toLowerCase().includes(query)
    );
    renderInstrucciones(filtered);
  });

  // Guardar código de registro
  btnSaveRegCode.addEventListener('click', async () => {
    const code = newRegCodeInput.value.trim();
    if (!code) {
      alert('Por favor, ingrese un código válido.');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/admin/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ registro_code: code })
      });
      const data = await res.json();
      if (data.success) {
        alert('Código de registro actualizado correctamente.');
        newRegCodeInput.value = '';
        loadData();
      } else {
        alert('Error al guardar código.');
      }
    } catch (err) {
      console.error(err);
      alert('Error al conectar con el servidor.');
    }
  });

  // Actualizar contraseña de administrador
  btnUpdateAdminPass.addEventListener('click', async () => {
    const pass = newAdminPassInput.value.trim();
    const confirmPass = confirmAdminPassInput.value.trim();

    if (!pass) {
      alert('Por favor, ingrese la nueva contraseña.');
      return;
    }
    if (pass.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (pass !== confirmPass) {
      alert('Las contraseñas no coinciden.');
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/admin/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_password: pass })
      });
      const data = await res.json();
      if (data.success) {
        alert('Contraseña de administrador actualizada con éxito.');
        newAdminPassInput.value = '';
        confirmAdminPassInput.value = '';
      } else {
        alert('Error al actualizar contraseña.');
      }
    } catch (err) {
      console.error(err);
      alert('Error al conectar con el servidor.');
    }
  });

  // Filtro de período para búsquedas (dropdown)
  periodoSelect.addEventListener('change', () => {
    currentPeriodo = periodoSelect.value;
    loadBusquedas();
  });

  // Buscador de búsquedas
  searchBusquedasInput.addEventListener('input', () => {
    loadBusquedas();
  });

  // Botón Volver (Cerrar sesión táctico)
  const backBtn = document.querySelector('.icon-btn[aria-label="Volver"]');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      localStorage.removeItem('adminToken');
      window.location.href = '/';
    });
  }}

// Exponer funciones para clics directos
window.deleteMedico = deleteMedico;
window.deleteInstruccion = deleteInstruccion;