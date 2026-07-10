
const zonaDisplayNames = {
    cabeza: 'Cabeza',
    cuello: 'Cuello',
    torax: 'Tórax',
    abdomen: 'Abdomen',
    brazos: 'Brazos',
    manos: 'Manos',
    piernas: 'Piernas',
    pies: 'Pies'
};

function matchesZona(parteCuerpo, zona) {
    const p = parteCuerpo.toLowerCase().replace(/[ó]/g, 'o');
    const aliases = {
        torax: ['torax', 'torax/abdomen'],
        abdomen: ['abdomen', 'torax/abdomen'],
        brazos: ['brazos', 'extremidades'],
        piernas: ['piernas', 'extremidades']
    };
    const matches = aliases[zona] || [zona];
    return matches.some(a => p.includes(a));
}

document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    const zona = params.get('zona');

    if (zona) {
        const displayName = zonaDisplayNames[zona] || zona;
        const pill = document.getElementById('zona-pill');
        pill.textContent = `Zona anatómica: ${displayName}`;
        pill.style.display = 'inline-block';
        document.getElementById('search-term-display').style.display = 'none';
        searchByZone(zona);
    } else if (query) {
        document.getElementById('search-term-display').textContent = `"${query}"`;
        searchInstructions(query);
    } else {
        showNoResults("No se especificó término de búsqueda");
    }
});

async function searchByZone(zona) {
    const container = document.getElementById('results-container');
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Buscando instrucciones...</p></div>';

    try {
        const response = await fetch(`${API_URL}/api/instrucciones`);
        const data = await response.json();

        if (data.success && Array.isArray(data.data)) {
            const filteredResults = data.data.filter(inst =>
                inst.parte_cuerpo && matchesZona(inst.parte_cuerpo, zona)
            );

            if (filteredResults.length > 0) {
                displayResults(filteredResults);
            } else {
                showNoResults(`No se encontraron protocolos para la zona "${zonaDisplayNames[zona] || zona}"`);
            }
        } else {
            showNoResults("Error al buscar instrucciones");
        }
    } catch (error) {
        console.error('Error:', error);
        showNoResults("Error de conexión con el servidor");
    }
}

async function searchInstructions(searchTerm) {
    const container = document.getElementById('results-container');
    container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Buscando instrucciones...</p></div>';

    try {
        const response = await fetch(`${API_URL}/api/instrucciones`);
        const data = await response.json();

        if (data.success && Array.isArray(data.data)) {
            const searchLower = searchTerm.toLowerCase();
const filteredResults = data.data.filter(inst => {
    if (inst.titulo.toLowerCase().includes(searchLower)) return true;
    if (inst.categoria && inst.categoria.toLowerCase().includes(searchLower)) return true;
    if (inst.severidad && inst.severidad.toLowerCase().includes(searchLower)) return true;
    if (inst.descripcion) {
        const lines = inst.descripcion.split('\n');
        for (const line of lines) {
            if (line.trim().toLowerCase().includes(searchLower)) return true;
        }
    }
    return false;
});

            if (filteredResults.length > 0) {
                displayResults(filteredResults);
            } else {
                showNoResults(`No se encontraron resultados para "${searchTerm}"`);
            }
        } else {
            showNoResults("Error al buscar instrucciones");
        }
    } catch (error) {
        console.error('Error:', error);
        showNoResults("Error de conexión con el servidor");
    }
}

function displayResults(results) {
    const container = document.getElementById('results-container');
    const numberElement = document.getElementById('results-number');
    numberElement.textContent = results.length;

    container.innerHTML = results.map((inst) => {
        const severidadBadge = getSeverityBadge(inst.severidad);

        return `
            <div class="result-card" onclick="openInstruction(${inst.id})">
                <div class="card-glow"></div>

                <div class="card-content">
                    <div class="card-badges">
                        <span class="${severidadBadge.class}">${severidadBadge.text}</span>
                        <span class="badge-time">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                            ${inst.tiempo_estimado}
                        </span>
                    </div>
                    <h3 class="card-title">${inst.titulo}</h3>
                    <div class="card-subtitle">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00d2ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                        ${inst.categoria}
                    </div>
                    ${inst.descripcion ? `<div class="card-desc">${inst.descripcion.split('\n')[0]}</div>` : ''}
                </div>

                <div class="action-btn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </div>
            </div>
        `;
    }).join('');
}

function getSeverityBadge(severity) {
    const severityMap = {
        'critico':  { class: 'badge-critical', text: 'CRÍTICO' },
        'moderado': { class: 'badge-moderate', text: 'MODERADO' },
        'leve':     { class: 'badge-mild',     text: 'LEVE' }
    };
    return severityMap[severity?.toLowerCase()] || { class: 'badge-mild', text: 'NORMAL' };
}

function openInstruction(id) {
    sessionStorage.setItem('selectedInstructionId', id);
    window.location.href = 'instrucciones.html';
}

function showNoResults(message) {
    const container = document.getElementById('results-container');
    container.innerHTML = `
        <div class="no-results">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
            </svg>
            <h3>Sin Resultados</h3>
            <p>${message}</p>
        </div>
    `;
}