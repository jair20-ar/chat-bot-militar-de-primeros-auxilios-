// main.js
const BASE_URL = 'http://localhost:3001'; // Cambia al puerto real si tu backend usa otro

console.log("main.js cargado correctamente"); // Para debug

document.addEventListener('DOMContentLoaded', () => {
    // NAVEGACIÓN ENTRE PÁGINAS
    // index.html ➔ buscador.html
    const btnBuscador = document.getElementById('btn-buscador');
    if (btnBuscador) {
        btnBuscador.addEventListener('click', () => {
            window.location.href = "buscador.html";
        });
    }

    // buscador.html ➔ resultados.html
    const btnResultados = document.getElementById('btn-resultados');
    if (btnResultados) {
        btnResultados.addEventListener('click', () => {
            window.location.href = "resultados.html";
        });
    }

    // buscador.html ➔ asistencia.html (voz)
    const voiceCard = document.getElementById('voice-card');
    if (voiceCard) {
        voiceCard.addEventListener('click', () => {
            window.location.href = "asistencia.html";
        });
    }

    // resultados.html ➔ asistencia.html (selección de card)
    const cardAsistencia = document.getElementById('card-asistencia');
    if (cardAsistencia) {
        cardAsistencia.addEventListener('click', () => {
            window.location.href = "asistencia.html";
        });
    }

    // resultados.html ➔ buscador.html (volver)
    const btnVolver = document.getElementById('btn-volver');
    if (btnVolver) {
        btnVolver.addEventListener('click', () => {
            window.location.href = "buscador.html";
        });
    }

    // asistencia.html ➔ index.html (abortar)
    const btnIndex = document.getElementById('btn-index');
    if (btnIndex) {
        btnIndex.addEventListener('click', () => {
            window.location.href = "index.html";
        });
    }

    //-----------------------------------------------
    // Puedes dejar aquí o eliminar tu lógica de protocolos/demo, según lo uses:
    const protocolList = document.getElementById('protocol-list');
    const searchInput = document.getElementById('search-input');
    const voiceBtn = document.getElementById('voice-btn');
    const themeBtn = document.getElementById('theme-btn');

    let todosLosProtocolos = [];

    function renderProtocols(protocols) {
        if (!protocolList) return;
        protocolList.innerHTML = '';

        if (!protocols.length) {
            protocolList.innerHTML = `<div class="card" style="text-align:center;margin-top:20px;">No hay protocolos disponibles.</div>`;
            return;
        }

        protocols.forEach(protocol => {
            const el = document.createElement('div');
            el.className = 'card';
            el.setAttribute('data-title', protocol.title.toLowerCase());
            el.style.display = 'flex';
            el.style.justifyContent = 'space-between';
            el.style.alignItems = 'center';
            el.style.cursor = 'pointer';
            el.style.marginBottom = '12px';

            el.innerHTML = `
                <div style="text-align:left;">
                    <h3 class="protocol-name" style="color:var(--electric-blue);margin-bottom:10px;">${protocol.title}</h3>
                    <div class="protocol-meta" style="color:var(--electric-blue);font-size:0.9rem;">
                        <span class="badge-urgent" style="margin-right:14px;">URGENTE</span>
                        <span class="step-count">${protocol.steps ? "[" + protocol.steps + " PASOS]" : ""}</span>
                    </div>
                </div>
                <div>
                    <i class="fa-solid ${getIcon(protocol)}" style="font-size:32px;color:var(--electric-blue);"></i>
                </div>
            `;

            protocolList.appendChild(el);

            el.addEventListener('click', () => {
                alert(`Abriendo protocolo: ${protocol.title}`);
                el.style.opacity = '0.5';
                setTimeout(() => { el.style.opacity = '1'; }, 150);
            });
        });
    }

    function getIcon(protocol) {
        if (protocol.title && protocol.title.toLowerCase().includes('rcp'))       return 'fa-heart';
        if (protocol.title && protocol.title.toLowerCase().includes('hemorragia')) return 'fa-droplet';
        if (protocol.title && protocol.title.toLowerCase().includes('torniquete')) return 'fa-circle';
        return 'fa-briefcase-medical';
    }

    function filtrarProtocolos(protocols, searchTerm) {
        return protocols.filter(p => p.title.toLowerCase().includes(searchTerm));
    }

    function cargarProtocolos() {
        fetch(BASE_URL + '/instructions')
            .then(res => res.json())
            .then(data => {
                todosLosProtocolos = data.map(item => ({
                    title: item.title,
                    steps: item.steps || "",
                }));
                renderProtocols(todosLosProtocolos);
            })
            .catch(() => {
                todosLosProtocolos = [
                    { title: "RCP - Reanimación Cardiopulmonar", steps: 8 },
                    { title: "Control de Hemorragia Severa", steps: 6 },
                    { title: "Aplicación de Torniquete", steps: 6 }
                ];
                renderProtocols(todosLosProtocolos);
            });
    }

    if (protocolList) {
        cargarProtocolos();
    }

    if (searchInput && protocolList) {
        searchInput.addEventListener('input', (event) => {
            const term = event.target.value.trim().toLowerCase();
            renderProtocols(
                filtrarProtocolos(todosLosProtocolos, term)
            );
        });
    }

    if (voiceBtn) {
        voiceBtn.addEventListener('click', () => {
            alert('🎤 Reconocimiento de voz demo. (Pendiente integrar SpeechRecognition)');
        });
    }

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            alert('⚡ El sistema ya está en modo táctico/nocturno.');
        });
    }
});