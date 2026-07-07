const API_URL = '';
let instructionData = null;
let currentStep = 0;
let synth = window.speechSynthesis;
let isPlaying = false;
let isMuted = false;
let nextStepTimeout = null;
let voices = [];

function populateVoices() {
    if (synth) {
        voices = synth.getVoices();
    }
}
populateVoices();
if (synth && synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = populateVoices;
}

function getBestNurseVoice() {
    // Si la lista local está vacía, intentar obtenerlas de nuevo
    let allVoices = voices.length > 0 ? voices : (synth ? synth.getVoices() : []);
    const spanishVoices = allVoices.filter(v => v.lang.toLowerCase().startsWith('es'));
    
    if (spanishVoices.length === 0) return null;
    
    // 1. Buscar voces "Natural" femeninas online de Microsoft/Google (excelente calidad)
    const naturalFemaleNames = ['elvira', 'dalia', 'esther', 'monica', 'paulina'];
    for (const name of naturalFemaleNames) {
        const voice = spanishVoices.find(v => 
            v.name.toLowerCase().includes(name) && v.name.toLowerCase().includes('natural')
        );
        if (voice) return voice;
    }
    
    // 2. Buscar cualquier voz "Natural" en español
    const naturalVoice = spanishVoices.find(v => v.name.toLowerCase().includes('natural'));
    if (naturalVoice) return naturalVoice;
    
    // 3. Buscar voces estándar de alta calidad por nombre femenino
    const standardFemaleNames = ['helena', 'sabina', 'monica', 'paulina', 'lucia', 'laura', 'maria', 'dalia', 'elvira', 'esther'];
    for (const name of standardFemaleNames) {
        const voice = spanishVoices.find(v => v.name.toLowerCase().includes(name));
        if (voice) return voice;
    }
    
    // 4. Buscar por palabra clave "female" o "mujer"
    const femaleKeywordVoice = spanishVoices.find(v => 
        v.name.toLowerCase().includes('female') || 
        v.name.toLowerCase().includes('mujer') || 
        v.name.toLowerCase().includes('chica')
    );
    if (femaleKeywordVoice) return femaleKeywordVoice;
    
    // 5. Fallback a Google o Microsoft en español
    const googleOrMicrosoft = spanishVoices.find(v => 
        v.name.toLowerCase().includes('google') || 
        v.name.toLowerCase().includes('microsoft')
    );
    if (googleOrMicrosoft) return googleOrMicrosoft;
    
    // 6. Primer voz en español disponible
    return spanishVoices[0];
}

document.addEventListener('DOMContentLoaded', () => {
    loadInstruction();
    setupEventListeners();
});

function setupEventListeners() {
    document.getElementById('btn-retroceder').addEventListener('click', previousStep);
}

function loadInstruction() {
    const instructionId = sessionStorage.getItem('selectedInstructionId');
    
    if (!instructionId) {
        showError('No se especificó instrucción');
        return;
    }

    fetch(`${API_URL}/api/instrucciones/${instructionId}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                instructionData = data.data;
                displayInstruction();
                if (sessionStorage.getItem('previewMode') !== 'true') {
                    fetch('/api/log-busqueda', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ instruccion_id: instructionId })
                    }).catch(() => {});
                }
            } else {
                showError('No se encontró la instrucción');
            }
        })
        .catch(err => {
            console.error('Error:', err);
            showError('Error al cargar la instrucción');
        });
}

function displayInstruction() {
    if (!instructionData) return;

    // Actualizar título
    document.getElementById('titulo-instruccion').textContent = instructionData.titulo;
    document.getElementById('titulo-tipo').textContent = instructionData.categoria.toUpperCase();

    // Parsear pasos
    const pasos = typeof instructionData.pasos === 'string' ? 
        JSON.parse(instructionData.pasos) : instructionData.pasos;

    // Actualizar total de pasos
    document.getElementById('total-pasos').textContent = pasos.length;

    // Mostrar primer paso
    currentStep = 0;
    showStep(0);

    // Generar botones de navegación
    generateStepButtons(pasos.length);
}

function showStep(stepIndex) {
    const pasos = typeof instructionData.pasos === 'string' ? 
        JSON.parse(instructionData.pasos) : instructionData.pasos;

    if (stepIndex < 0 || stepIndex >= pasos.length) return;

    currentStep = stepIndex;
    const paso = pasos[stepIndex];

    // Actualizar número de paso
    document.getElementById('paso-actual').textContent = stepIndex + 1;

    // Actualizar barra de progreso
    const percentage = ((stepIndex + 1) / pasos.length) * 100;
    document.getElementById('progress-bar').style.width = percentage + '%';

    // Crear contenido de la tarjeta
    let cardHTML = `
        <div class="instruction-card">
            <div class="instruction-header">
                <div class="step-badge">${stepIndex + 1}</div>
                <h3>${paso.titulo}</h3>
            </div>
            <p id="texto-instruccion">${paso.descripcion}</p>
    `;

    // Agregar imagen si existe
    if (paso.imagen && paso.imagen.trim() !== '') {
        cardHTML += `
            <div class="step-image">
                <img src="${paso.imagen}" alt="Imagen paso ${stepIndex + 1}">
            </div>
        `;
    }

    // Si es el último paso, agregar botón de finalizar
    if (stepIndex === pasos.length - 1) {
        cardHTML += `
            <div class="finish-btn-wrapper" style="margin-top: 25px; display: flex; justify-content: center; width: 100%;">
                <button class="btn-finish" onclick="openEndModal()">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-right: 8px;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    FINALIZAR PROTOCOLO
                </button>
            </div>
        `;
    }

    cardHTML += `</div>`;

    // Reemplazar contenedor
    document.getElementById('contenedor-principal').innerHTML = cardHTML;

    // Generar botones de navegación
    generateStepButtons(pasos.length, stepIndex);

    // Actualizar vista de imagen si está activa
    const btnVista = document.querySelector('.view-toggle button.active');
    if (btnVista && btnVista.id === 'btn-vista-img' && paso.imagen) {
        document.getElementById('visual-content').innerHTML = `<img src="${paso.imagen}" alt="Paso ${stepIndex + 1}">`;
    }

    updateViewToggleText();

    // Si está reproduciendo, dictar el nuevo paso
    if (isPlaying && !isMuted) {
        dictarPasoActual();
    }
}

function generateStepButtons(totalSteps, activeStep = 0) {
    let buttonsHTML = '<div class="step-navigation">';
    for (let i = 0; i < totalSteps; i++) {
        buttonsHTML += `
            <button class="step-nav-btn ${i === activeStep ? 'active' : ''}" 
                    onclick="showStep(${i})">${i + 1}</button>
        `;
    }
    buttonsHTML += '</div>';

    // Agregar después de la tarjeta
    const cardElement = document.querySelector('.instruction-card');
    if (cardElement && !cardElement.nextElementSibling?.classList.contains('step-navigation')) {
        cardElement.insertAdjacentHTML('afterend', buttonsHTML);
    }
}

function toggleView(mode, btnElement) {
    let buttons = btnElement.parentElement.querySelectorAll('button');
    buttons.forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');

    const visualContent = document.getElementById('visual-content');
    const pasos = typeof instructionData.pasos === 'string' ? 
        JSON.parse(instructionData.pasos) : instructionData.pasos;
    const paso = pasos[currentStep];

    if (mode === '3d') { //AQUI SE CARGA EL MODELO 3D
        visualContent.innerHTML = '<spline-viewer url="https://prod.spline.design/y4qP8PeEqQ3hrY-D/scene.splinecode"></spline-viewer>'; //MODELO 3D
        visualContent.style.borderColor = "rgba(0, 229, 255, 0.3)";
        visualContent.style.background = "radial-gradient(circle, #1A3644 0%, #0F1D2B 100%)";
    } else {
        if (paso.imagen && paso.imagen.trim() !== '') {
            visualContent.innerHTML = `<img src="${paso.imagen}" alt="Paso ${currentStep + 1}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
            visualContent.style.borderColor = "var(--text-muted)";
            visualContent.style.background = "transparent";
        } else {
            visualContent.innerHTML = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#8B9BB4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>';
        }
    }
    
    updateViewToggleText();
}

function previousStep() {
    const pasos = typeof instructionData.pasos === 'string' ? 
        JSON.parse(instructionData.pasos) : instructionData.pasos;
    
    if (currentStep > 0) {
        showStep(currentStep - 1);
    }
}

function togglePlayPause() {
    const btnPausa = document.getElementById('btn-pausa');
    
    if (isPlaying) {
        // Pausar
        synth.pause();
        isPlaying = false;
        btnPausa.classList.remove('paused');
        if (nextStepTimeout) clearTimeout(nextStepTimeout);
    } else {
        // Reproducir
        isPlaying = true;
        btnPausa.classList.add('paused');
        
        if (synth.paused) {
            synth.resume();
        } else {
            dictarPasoActual();
        }
    }
}

function toggleMute() {
    const btnVoz = document.getElementById('btn-voz');
    
    isMuted = !isMuted;
    
    if (isMuted) {
        synth.cancel();
        btnVoz.classList.add('muted');
        isPlaying = false;
        document.getElementById('btn-pausa').classList.remove('paused');
    } else {
        btnVoz.classList.remove('muted');
    }
}

function dictarPasoActual() {
    if (isMuted) return;

    const pasos = typeof instructionData.pasos === 'string' ? 
        JSON.parse(instructionData.pasos) : instructionData.pasos;
    const paso = pasos[currentStep];
    const textoADictar = paso.texto_voz || paso.descripcion;

    if (!textoADictar) return;

    synth.cancel();

    let utterance = new SpeechSynthesisUtterance(textoADictar);
    utterance.lang = 'es-ES';
    
    // Obtener e iniciar la mejor voz de enfermera
    const nurseVoice = getBestNurseVoice();
    if (nurseVoice) {
        utterance.voice = nurseVoice;
        console.log('Utilizando voz para dictado:', nurseVoice.name);
    }
    
    // Ritmo pausado y profesional de enfermera
    utterance.rate = 0.88;
    
    // Tono ligeramente más alto para voces estándar para sonar dulce y femenina
    if (nurseVoice && nurseVoice.name.toLowerCase().includes('natural')) {
        utterance.pitch = 1.0;
    } else {
        utterance.pitch = 1.08;
    }
    utterance.volume = 1;

    utterance.onend = function() {
        const pasos = typeof instructionData.pasos === 'string' ? 
            JSON.parse(instructionData.pasos) : instructionData.pasos;
            
        if (currentStep < pasos.length - 1) {
            if (isPlaying && !isMuted) {
                // Esperar 15 segundos y pasar al siguiente paso
                nextStepTimeout = setTimeout(() => {
                    showStep(currentStep + 1);
                }, 15000); // 15 segundos
            }
        } else {
            // Finalizó todas las instrucciones
            isPlaying = false;
            const btnPausa = document.getElementById('btn-pausa');
            if (btnPausa) btnPausa.classList.remove('paused');
            
            // Abrir el modal táctico automáticamente cuando finaliza el dictado
            setTimeout(() => {
                openEndModal();
            }, 1500);
        }
    };

    utterance.onerror = function(event) {
        console.error('Error en síntesis de voz:', event.error);
    };

    synth.speak(utterance);
}

function showError(message) {
    document.getElementById('contenedor-principal').innerHTML = `
        <div class="error-message">${message}</div>
    `;
}

function updateViewToggleText() {
    const btnVista3d = document.getElementById('btn-vista-3d');
    const btnVistaImg = document.getElementById('btn-vista-img');
    const stepLabel = `Paso ${currentStep + 1}`;
    
    if (btnVista3d) {
        if (btnVista3d.classList.contains('active')) {
            btnVista3d.innerHTML = `Modelo 3D <span class="step-suffix">- ${stepLabel}</span>`;
        } else {
            btnVista3d.innerHTML = 'Modelo 3D';
        }
    }
    
    if (btnVistaImg) {
        if (btnVistaImg.classList.contains('active')) {
            btnVistaImg.innerHTML = `Imagen <span class="step-suffix">- ${stepLabel}</span>`;
        } else {
            btnVistaImg.innerHTML = 'Imagen';
        }
    }
}

function openEndModal() {
    if (synth) {
        synth.cancel();
    }
    if (nextStepTimeout) {
        clearTimeout(nextStepTimeout);
    }
    isPlaying = false;
    const btnPausa = document.getElementById('btn-pausa');
    if (btnPausa) {
        btnPausa.classList.remove('paused');
    }
    
    const modal = document.getElementById('end-protocol-modal');
    if (modal) {
        modal.classList.add('active');
        // Dictar el aviso del modal con la voz de la enfermera
        dictarAvisoModal();
    }
}

function dictarAvisoModal() {
    if (isMuted) return;
    
    const textoAviso = "¡Atención soldado! El protocolo de asistencia médica ha finalizado. ¿Cuáles son sus órdenes a continuación?";
    
    let utterance = new SpeechSynthesisUtterance(textoAviso);
    utterance.lang = 'es-ES';
    
    const nurseVoice = getBestNurseVoice();
    if (nurseVoice) {
        utterance.voice = nurseVoice;
    }
    
    utterance.rate = 0.88;
    
    if (nurseVoice && nurseVoice.name.toLowerCase().includes('natural')) {
        utterance.pitch = 1.0;
    } else {
        utterance.pitch = 1.08;
    }
    utterance.volume = 1;
    
    synth.speak(utterance);
}

function closeEndModal() {
    const modal = document.getElementById('end-protocol-modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function restartProtocol() {
    closeEndModal();
    currentStep = 0;
    showStep(0);
    
    // Auto-reproducir dictado de nuevo al reiniciar
    isPlaying = true;
    const btnPausa = document.getElementById('btn-pausa');
    if (btnPausa) {
        btnPausa.classList.add('paused');
    }
    dictarPasoActual();
}

function exitProtocol() {
    closeEndModal();
    window.location.href = 'index.html';
}

