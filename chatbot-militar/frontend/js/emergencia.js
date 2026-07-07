const API_URL = '';
let stepCount = 1;
let editingId = null;

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    editingId = urlParams.get('edit');

    if (editingId) {
        loadInstructionToEdit(editingId);
        document.getElementById('page-title').textContent = 'EDITAR INSTRUCCIÓN';
        document.getElementById('btn-save').textContent = '✏️ ACTUALIZAR INSTRUCCIÓN';
    }

    document.getElementById('add-step-btn').addEventListener('click', addStep);

    // Inicializar event listeners de imágenes al cargar
    addImageEventListeners();
});

// Cargar instrucción para editar
function loadInstructionToEdit(id) {
    fetch(`${API_URL}/api/instrucciones/${id}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const inst = data.data;
                document.getElementById('titulo').value = inst.titulo;
                document.getElementById('categoria').value = inst.categoria || '';
                document.getElementById('severidad').value = inst.severidad || 'leve';
                document.getElementById('parte_cuerpo').value = inst.parte_cuerpo || '';
                document.getElementById('tiempo_estimado').value = inst.tiempo_estimado || '';

                let pasos;
                try {
                    pasos = typeof inst.pasos === 'string' ? JSON.parse(inst.pasos) : inst.pasos;
                } catch (e) {
                    console.error('Error parsing pasos:', e);
                    pasos = [];
                }
                if (!Array.isArray(pasos)) pasos = [];
                const stepsContainer = document.getElementById('steps-container');
                stepsContainer.innerHTML = '';
                stepCount = 0;

                pasos.forEach((paso, index) => {
                    stepCount = index + 1;
                    const imagenHTML = paso.imagen ? `
                        <div class="image-preview-container" style="display: block;">
                            <img class="image-preview" src="${paso.imagen}" alt="Preview">
                            <button type="button" class="btn-remove-image">
                                <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                REMOVER IMAGEN
                            </button>
                        </div>
                    ` : `<div class="image-preview-container"></div>`;

                    const stepHTML = `
                        <section class="card step-card" id="step-${stepCount}">
                            <div class="step-header">
                                <div class="step-number">${stepCount}</div>
                                <h3>PASO ${stepCount}</h3>
                                ${stepCount > 1 ? `<button class="btn-remove-step" onclick="removeStep('step-${stepCount}')" title="Eliminar paso"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>` : ''}
                            </div>
                            <div class="form-group">
                                <label>Título del Paso *</label>
                                <input type="text" value="${paso.titulo}" placeholder="Ej: Siguiente paso del procedimiento">
                            </div>
                            <div class="form-group">
                                <label>Descripción Detallada *</label>
                                <textarea placeholder="Descripción detallada del procedimiento...">${paso.descripcion}</textarea>
                            </div>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>Duración (segundos)</label>
                                    <input type="number" value="${paso.duracion || 30}">
                                </div>
                                <div class="form-group">
                                    <label>Texto para Voz</label>
                                    <input type="text" value="${paso.texto_voz || ''}" placeholder="Texto simplificado para síntesis de voz">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>Imagen del Paso (opcional)</label>
                                <div class="file-input-wrapper">
                                    <input type="file" accept="image/*" class="image-input">
                                    <label class="file-input-label">
                                        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                        <span>Selecciona una imagen o arrastra aquí</span>
                                    </label>
                                </div>
                                ${imagenHTML}
                            </div>
                        </section>
                    `;
                    stepsContainer.innerHTML += stepHTML;
                });

                addImageEventListeners();
            }
        })
        .catch(err => {
            console.error(err);
            showToast('❌ Error al cargar instrucción', true);
        });
}

// Agregar paso
function addStep() {
    stepCount++;
    const stepHTML = `
        <section class="card step-card" id="step-${stepCount}">
            <div class="step-header">
                <div class="step-number">${stepCount}</div>
                <h3>PASO ${stepCount}</h3>
                <button class="btn-remove-step" onclick="removeStep('step-${stepCount}')" title="Eliminar paso">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="form-group">
                <label>Título del Paso *</label>
                <input type="text" placeholder="Ej: Siguiente paso del procedimiento">
            </div>
            <div class="form-group">
                <label>Descripción Detallada *</label>
                <textarea placeholder="Descripción detallada del procedimiento..."></textarea>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Duración (segundos)</label>
                    <input type="number" value="30">
                </div>
                <div class="form-group">
                    <label>Texto para Voz</label>
                    <input type="text" placeholder="Texto simplificado para síntesis de voz">
                </div>
            </div>
            <div class="form-group">
                <label>Imagen del Paso (opcional)</label>
                <div class="file-input-wrapper">
                    <input type="file" accept="image/*" class="image-input">
                    <label class="file-input-label">
                        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                        <span>Selecciona una imagen o arrastra aquí</span>
                    </label>
                </div>
                <div class="image-preview-container"></div>
            </div>
        </section>
    `;
    document.getElementById('steps-container').insertAdjacentHTML('beforeend', stepHTML);
    const newStep = document.getElementById(`step-${stepCount}`);
    newStep.scrollIntoView({ behavior: 'smooth', block: 'center' });
    addImageEventListener(newStep.querySelector('.image-input'));
}

// Eliminar paso
window.removeStep = function(stepId) {
    const stepElement = document.getElementById(stepId);
    if (stepElement) {
        stepElement.remove();
        recalculateSteps();
    }
};

// Renumerar pasos
function recalculateSteps() {
    const stepCards = document.querySelectorAll('.step-card');
    stepCount = 0;
    stepCards.forEach((card, index) => {
        stepCount = index + 1;
        card.id = `step-${stepCount}`;
        card.querySelector('.step-number').textContent = stepCount;
        card.querySelector('h3').textContent = `PASO ${stepCount}`;
        const removeBtn = card.querySelector('.btn-remove-step');
        if (removeBtn) {
            removeBtn.setAttribute('onclick', `removeStep('step-${stepCount}')`);
        }
    });
}

// Agregar event listeners de imágenes
function addImageEventListeners() {
    document.querySelectorAll('.image-input').forEach(input => {
        addImageEventListener(input);
    });
}

// Evento de imagen individual
function addImageEventListener(input) {
    if (!input) return;

    input.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                const previewContainer = input.closest('.file-input-wrapper').parentElement.querySelector('.image-preview-container');
                previewContainer.innerHTML = `
                    <img class="image-preview" src="${event.target.result}" alt="Preview">
                    <button type="button" class="btn-remove-image">
                        <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        REMOVER IMAGEN
                    </button>
                `;
                previewContainer.style.display = 'block';

                previewContainer.querySelector('.btn-remove-image').addEventListener('click', function(e) {
                    e.preventDefault();
                    input.value = '';
                    previewContainer.innerHTML = '';
                    previewContainer.style.display = 'none';
                });
            };
            reader.readAsDataURL(file);
        }
    });

    // Drag and drop
    const wrapper = input.closest('.file-input-wrapper');
    if (wrapper) {
        wrapper.addEventListener('dragover', (e) => {
            e.preventDefault();
            wrapper.style.opacity = '0.8';
        });

        wrapper.addEventListener('dragleave', () => {
            wrapper.style.opacity = '1';
        });

        wrapper.addEventListener('drop', (e) => {
            e.preventDefault();
            wrapper.style.opacity = '1';
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                input.files = files;
                const event = new Event('change', { bubbles: true });
                input.dispatchEvent(event);
            }
        });
    }
}

// Guardar instrucción
function saveInstruction() {
    const titulo = document.getElementById('titulo').value.trim();
    const categoria = document.getElementById('categoria').value.trim();
    const severidad = document.getElementById('severidad').value.trim();
    const parte_cuerpo = document.getElementById('parte_cuerpo').value.trim();
    const tiempo_estimado = document.getElementById('tiempo_estimado').value.trim();

    const medicoData = localStorage.getItem('medicoData');
    const isAdmin = localStorage.getItem('adminToken') === 'true';
    let id_medico = null;

    if (medicoData) {
        try {
            const userData = JSON.parse(medicoData);
            id_medico = userData.id_medico;
            console.log('✅ ID Médico obtenido:', id_medico);
        } catch (err) {
            console.error('❌ Error al parsear medicoData:', err);
        }
    } else if (isAdmin) {
        id_medico = 'admin';
        console.log('✅ Modo Administrador detectado para edición de instrucciones');
    }

    if (!titulo) { showToast('❌ El título es obligatorio', true); return; }
    if (!categoria) { showToast('❌ La categoría es obligatoria', true); return; }
    if (!severidad) { showToast('❌ Debes seleccionar un nivel de severidad', true); return; }
    if (!parte_cuerpo) { showToast('❌ Debes seleccionar una parte del cuerpo', true); return; }
    if (!tiempo_estimado) { showToast('❌ El tiempo estimado es obligatorio', true); return; }
    if (!id_medico) { showToast('❌ Debes iniciar sesión primero', true); return; }

    const btnSave = document.getElementById('btn-save');
    btnSave.disabled = true;
    btnSave.textContent = 'Guardando...';

    const pasos = [];
    const stepCards = document.querySelectorAll('.step-card');
    let processedSteps = 0;

    if (stepCards.length === 0) {
        showToast('❌ Debes agregar al menos un paso', true);
        resetSaveBtn(btnSave);
        return;
    }

    try {
        stepCards.forEach((card, cardIndex) => {
            const inputs = card.querySelectorAll('input[type="text"], input[type="number"], textarea');
            const imagePreview = card.querySelector('.image-preview');

            const paso = {
                titulo: inputs[0].value.trim(),
                descripcion: inputs[1].value.trim(),
                duracion: parseInt(inputs[2].value),
                texto_voz: inputs[3].value.trim(),
                imagen: imagePreview ? imagePreview.src : ''
            };

            if (!paso.titulo || !paso.descripcion) {
                showToast(`❌ El paso ${cardIndex + 1} está incompleto (falta título o descripción)`, true);
                resetSaveBtn(btnSave);
                throw new Error('Paso incompleto');
            }

            pasos.push(paso);
            processedSteps++;

            if (processedSteps === stepCards.length) {
                sendInstructionToServer(titulo, categoria, severidad, parte_cuerpo, tiempo_estimado, pasos, id_medico, btnSave);
            }
        });
    } catch (e) {
        // Error ya manejado arriba
    }
}

function resetSaveBtn(btnSave) {
    btnSave.disabled = false;
    btnSave.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>GUARDAR INSTRUCCIÓN`;
}

function sendInstructionToServer(titulo, categoria, severidad, parte_cuerpo, tiempo_estimado, pasos, id_medico, btnSave) {
    const method = editingId ? 'PUT' : 'POST';
    const url = editingId ? `${API_URL}/api/instrucciones/${editingId}` : `${API_URL}/api/instrucciones`;

    fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, categoria, severidad, parte_cuerpo, tiempo_estimado, pasos, id_medico })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const msg = editingId ? '✅ Instrucción actualizada correctamente' : '✅ Instrucción guardada correctamente';
            showToast(msg);
            setTimeout(() => window.location.href = '/panel.html', 1500);
        } else {
            showToast('❌ ' + (data.error || 'Error al guardar'), true);
            resetSaveBtn(btnSave);
        }
    })
    .catch(err => {
        console.error(err);
        showToast('❌ Error de conexión', true);
        resetSaveBtn(btnSave);
    });
}

// Notificaciones
function showToast(msg, isError = false) {
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}