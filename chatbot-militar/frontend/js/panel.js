const API_URL = 'http://localhost:3001';
let currentUserId = null;
let currentUserNombre = null;

// Verificar autenticación y cargar datos al iniciar
document.addEventListener('DOMContentLoaded', () => {
    checkAuthentication();
    loadMyInstructions();
    updateStats();
});

// Verificar autenticación desde medicoData
function checkAuthentication() {
    console.log('🔍 Verificando autenticación...');

    const medicoData = localStorage.getItem('medicoData');

    if (!medicoData) {
        console.error('❌ No hay medicoData en localStorage');
        showToast('❌ Debes iniciar sesión primero', true);
        setTimeout(() => window.location.href = '/', 2000);
        return;
    }

    try {
        const userData = JSON.parse(medicoData);
        console.log('✅ medicoData encontrado:', userData);

        if (!userData.id_medico || !userData.nombre) {
            throw new Error('Datos incompletos en medicoData');
        }

        currentUserId = userData.id_medico;
        currentUserNombre = userData.nombre;

        document.getElementById('user-name-display').textContent = `Dr. ${userData.nombre}`;
        document.getElementById('user-status').textContent = userData.nombre;

        console.log('✅ Usuario autenticado:', currentUserNombre);
    } catch (err) {
        console.error('❌ Error al parsear medicoData:', err);
        showToast('❌ Error de sesión, vuelve a iniciar sesión', true);
        setTimeout(() => {
            localStorage.removeItem('medicoData');
            window.location.href = '/';
        }, 2000);
    }
}

// Cargar instrucciones del médico actual
function loadMyInstructions() {
    if (!currentUserId) {
        console.warn('⚠️ No se pudo obtener el ID del médico');
        return;
    }

    console.log('📥 Cargando instrucciones para médico:', currentUserId);

    fetch(`${API_URL}/api/instrucciones`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                console.log('📊 Total instrucciones en BD:', data.data.length);

                const myInstructions = data.data.filter(inst =>
                    String(inst.id_medico) === String(currentUserId)
                );

                console.log('✅ Instrucciones del médico actual:', myInstructions.length);
                displayInstructions(myInstructions);
            }
        })
        .catch(err => {
            console.error('❌ Error al cargar instrucciones:', err);
            showToast('❌ Error al cargar instrucciones', true);
        });
}

// Mostrar instrucciones en el grid
function displayInstructions(instructions) {
    const container = document.getElementById('instructions-container');
    container.innerHTML = '';

    if (instructions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">
                    <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                </div>
                <h3>No hay instrucciones registradas aún.</h3>
                <p>Cree su primera instrucción médica usando el botón de arriba.</p>
            </div>
        `;
        return;
    }

    instructions.forEach(inst => {
        const badgeClass = inst.severidad === 'critico' ? 'danger' : inst.severidad === 'moderado' ? 'warning' : '';
        const card = document.createElement('div');
        card.className = 'instruction-card';
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start;">
                <h3 class="instruction-title">${inst.titulo}</h3>
            </div>
            <div class="instruction-meta">
                <span class="badge ${badgeClass}">${inst.severidad.toUpperCase()}</span>
                <span class="badge">${inst.parte_cuerpo || 'General'}</span>
                <span class="badge">${inst.tiempo_estimado}</span>
            </div>
            <div class="instruction-desc">
                <strong>Categoría:</strong> ${inst.categoria}
            </div>
            <div class="instruction-actions">
                <a href="/emergencia.html?edit=${inst.id}" class="btn-edit">✏️ Editar</a>
                <button onclick="deleteInstruction(${inst.id})" class="btn-delete">🗑️ Eliminar</button>
            </div>
        `;
        container.appendChild(card);
    });
}

// Eliminar instrucción
function deleteInstruction(id) {
    if (!currentUserId) {
        showToast('❌ Debes iniciar sesión primero', true);
        return;
    }

    if (confirm('¿Estás seguro que deseas eliminar esta instrucción?')) {
        fetch(`${API_URL}/api/instrucciones/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_medico: currentUserId })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                showToast('✅ Instrucción eliminada');
                setTimeout(() => location.reload(), 1000);
            } else {
                showToast('❌ ' + (data.error || 'Error al eliminar'), true);
            }
        })
        .catch(err => {
            console.error(err);
            showToast('❌ Error de conexión', true);
        });
    }
}

// Actualizar estadísticas
function updateStats() {
    if (!currentUserId) return;

    fetch(`${API_URL}/api/instrucciones`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const myInstructions = data.data.filter(inst =>
                    String(inst.id_medico) === String(currentUserId)
                );
                const criticalCount = myInstructions.filter(inst => inst.severidad === 'critico').length;

                document.getElementById('total-count').textContent = myInstructions.length;
                document.getElementById('critical-count').textContent = criticalCount;
            }
        })
        .catch(err => console.error('❌ Error al actualizar stats:', err));
}

// Volver a médicos
function goBackToMedicos() {
    window.location.href = '/';
}

// Mostrar ayuda
function showHelp() {
    alert('📋 PANEL MÉDICO\n\n✅ Ver todas tus instrucciones\n✏️ Editar instrucciones existentes\n🗑️ Eliminar instrucciones\n➕ Crear nuevas instrucciones\n\n¡Mantén tus protocolos actualizados!');
}

// Mostrar notificaciones
function showToast(msg, isError = false) {
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}