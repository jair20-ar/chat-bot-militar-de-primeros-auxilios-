// === TOGGLE MOSTRAR / OCULTAR CONTRASEÑA ===
const pwInput = document.getElementById('adminPassword');
const eyeBtn  = document.getElementById('eyeToggle');
const eyeIcon = document.getElementById('eyeIcon');

const eyeOpen   = '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>';
const eyeClosed = '<path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';

eyeBtn.addEventListener('click', () => {
    const isPassword = pwInput.type === 'password';
    pwInput.type = isPassword ? 'text' : 'password';
    eyeIcon.innerHTML = isPassword ? eyeClosed : eyeOpen;
    eyeBtn.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
});

// === INICIO DE SESIÓN DE ADMINISTRADOR ===
const submitBtn = document.querySelector('.submit-btn');
const API_URL = '';

async function handleLogin() {
    const password = pwInput.value.trim();
    if (!password) {
        alert('Por favor, ingrese la contraseña.');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Verificando...';

    try {
        const res = await fetch(`${API_URL}/api/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const data = await res.json();

        if (data.success) {
            localStorage.setItem('adminToken', data.token);
            localStorage.removeItem('medicoData');
            window.location.href = 'admin.html';
        } else {
            alert(data.error || 'Acceso denegado.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Ingresar al Panel';
        }
    } catch (err) {
        console.error(err);
        alert('Error de conexión con el servidor.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Ingresar al Panel';
    }
}

submitBtn.addEventListener('click', handleLogin);

pwInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        handleLogin();
    }
});

// Botón Volver
const backBtn = document.querySelector('.icon-btn[aria-label="Volver"]') || document.querySelector('.icon-btn');
if (backBtn) {
    backBtn.addEventListener('click', () => {
        window.location.href = '/';
    });
}