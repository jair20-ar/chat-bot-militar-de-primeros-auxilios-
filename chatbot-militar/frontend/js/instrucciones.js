const API_URL = 'http://localhost:3001';
let instructionData = null;
let currentStep = 0;
let synth = window.speechSynthesis;
let isPlaying = false;
let isMuted = false;
let nextStepTimeout = null;

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

    cardHTML += `</div>`;

    // Reemplazar contenedor
    document.getElementById('contenedor-principal').innerHTML = cardHTML;

    // Generar botones de navegación
    generateStepButtons(pasos.length, stepIndex);

    // Actualizar vista de imagen si está activa
    const btnVista = document.querySelector('.view-toggle button.active');
    if (btnVista && btnVista.textContent.includes('Imagen') && paso.imagen) {
        document.getElementById('visual-content').innerHTML = `<img src="${paso.imagen}" alt="Paso ${stepIndex + 1}">`;
    }

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

    if (mode === '3d') {
        visualContent.innerHTML = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';
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
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onend = function() {
        if (isPlaying && !isMuted) {
            // Esperar 15 segundos y pasar al siguiente paso
            nextStepTimeout = setTimeout(() => {
                const pasos = typeof instructionData.pasos === 'string' ? 
                    JSON.parse(instructionData.pasos) : instructionData.pasos;
                
                if (currentStep < pasos.length - 1) {
                    showStep(currentStep + 1);
                } else {
                    // Finalizó todas las instrucciones
                    isPlaying = false;
                    document.getElementById('btn-pausa').classList.remove('paused');
                }
            }, 15000); // 15 segundos
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