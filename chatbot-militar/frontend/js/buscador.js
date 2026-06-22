let mediaRecorder = null;
let audioChunks = [];

const voiceCard = document.getElementById('voice-card');

if (voiceCard) {
    voiceCard.addEventListener('click', async function(e) {
        e.preventDefault();

        if (this.classList.contains('recording')) {
            this.classList.remove('recording');
            mediaRecorder.stop();
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.classList.add('recording');
            showToast('🎤 Escuchando... Haz clic de nuevo para finalizar');

            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                stream.getTracks().forEach(track => track.stop());

                const formData = new FormData();
                formData.append('audio', audioBlob, 'busqueda.webm');

                try {
                    let socketId = null;
                    if (window.socket && window.socket.connected) {
                        socketId = window.socket.id;
                    }
                    if (socketId) {
                        formData.append('socketId', socketId);
                    }

                    const response = await fetch('http://localhost:3001/api/transcribir', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (response.status === 202) {
                        const data = await response.json();
                        showToast('⌛ Audio encolado para transcripción...');
                        
                        let socketReceived = false;
                        if (window.socket) {
                            const onResult = (resData) => {
                                if (resData.requestId === data.requestId) {
                                    socketReceived = true;
                                    window.socket.off('result', onResult);
                                    if (resData.text) {
                                        document.getElementById('search').value = resData.text;
                                        performSearch(resData.text);
                                    } else {
                                        showToast('❌ No se reconocieron palabras', true);
                                    }
                                }
                            };
                            window.socket.on('result', onResult);
                        }

                        pollStatus(data.requestId, () => socketReceived);
                    } else {
                        const data = await response.json();
                        if (data.text) {
                            document.getElementById('search').value = data.text;
                            performSearch(data.text);
                        } else {
                            showToast('❌ No se reconocieron palabras', true);
                        }
                    }
                } catch (error) {
                    showToast('❌ Error al conectar con el motor local', true);
                }
            };

            mediaRecorder.start();
        } catch (err) {
            showToast('❌ Permiso de acceso al microfono denegado', true);
        }
    });
}

function handleSearch() {
    const searchTerm = document.getElementById('search').value.trim();
    if (searchTerm === '') {
        showToast('❌ Por favor escribe o habla algo', true);
        return;
    }
    performSearch(searchTerm);
}

function handleEnter(event) {
    if (event.key === 'Enter') {
        handleSearch();
    }
}

function performSearch(searchTerm) {
    if (!searchTerm || searchTerm.trim() === '') {
        showToast('❌ Por favor escribe o habla algo', true);
        return;
    }
    sessionStorage.setItem('searchTerm', searchTerm);
    window.location.href = `resultados.html?q=${encodeURIComponent(searchTerm)}`;
}

function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function pollStatus(requestId, isDoneCheck) {
    const interval = setInterval(async () => {
        if (isDoneCheck && isDoneCheck()) {
            clearInterval(interval);
            return;
        }

        try {
            const res = await fetch(`http://localhost:3001/api/transcribir/status/${requestId}`);
            if (res.status === 200) {
                const data = await res.json();
                if (data.status === 'done') {
                    clearInterval(interval);
                    if (data.result) {
                        document.getElementById('search').value = data.result;
                        performSearch(data.result);
                    } else {
                        showToast('❌ No se reconocieron palabras', true);
                    }
                } else if (data.status === 'error') {
                    clearInterval(interval);
                    showToast('❌ Error en transcripción: ' + data.result, true);
                }
            }
        } catch (err) {
            console.error('Error polling status:', err);
        }
    }, 1000);
}