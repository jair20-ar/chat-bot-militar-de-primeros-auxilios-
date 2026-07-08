function togglePassword() {
    const input = document.getElementById('password');
    if (input.type === "password") {
        input.type = "text";
    } else {
        input.type = "password";
    }
}

function showAlert(message, type) {
    const alertDiv = document.getElementById('alertMessage');
    alertDiv.textContent = message;
    alertDiv.className = `alert-message show ${type}`;
    setTimeout(() => {
        alertDiv.classList.remove('show');
    }, 5000);
}

function showWelcomeModal(nombre) {
    const modal = document.getElementById('welcomeModal');
    const welcomeName = document.getElementById('welcomeName');
    welcomeName.textContent = nombre.toUpperCase();
    modal.classList.add('show');

    // Redirigir después de 3 segundos
    setTimeout(() => {
        window.location.href = '/panel.html';
    }, 3000);
}

document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const id_medico = document.getElementById('id_medico').value.trim();
    const password = document.getElementById('password').value;
    const submitBtn = document.getElementById('submitBtn');
    const originalText = submitBtn.innerHTML;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Verificando...';

    try {
        const response = await fetch('/medicos/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id_medico: id_medico,
                password: password
            })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('medicoData', JSON.stringify({
                id_medico: data.id_medico,
                nombre: data.nombre,
                token: data.token
            }));

            localStorage.removeItem('adminToken');
            
            // Mostrar modal de bienvenida
            showWelcomeModal(data.nombre);
        } else {
            showAlert(data.error || 'Credenciales incorrectas', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    } catch (error) {
        console.error('Error:', error);
        showAlert('Error de conexión. Verifique que el servidor esté funcionando.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});