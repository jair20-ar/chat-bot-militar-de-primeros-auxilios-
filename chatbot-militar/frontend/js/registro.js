// Alternar visibilidad de contraseña
function togglePass(inputId) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
}

// Volver al login
document.getElementById('btn-volver').onclick = function() {
    window.location.href = 'medicos.html';
};

// Envío del formulario de registro
document.getElementById('registro-form').addEventListener('submit', async function(e) {
    e.preventDefault();

    const nombre = this.nombre.value.trim();
    const email = this.email.value.trim();
    const cedula = this.cedula.value.trim();
    const especializacion = this.especializacion.value;
    const codigo_registro = this.codigo_registro.value.trim();
    const password = this.password.value;
    const password2 = document.getElementById('pass-confirm').value;

    if (password.length < 6) {
        alert('La contraseña debe tener al menos 6 caracteres.');
        return;
    }
    if (password !== password2) {
        alert('Las contraseñas no coinciden.');
        return;
    }

    try {
        const res = await fetch('/medicos/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, cedula, especializacion, password, codigo_registro })
        });
        const data = await res.json();

        if (data.ok) {
            alert('¡Registro exitoso! Ahora puedes iniciar sesión.');
            window.location.href = 'medicos.html';
        } else {
            alert(data.error ? data.error : 'Error en el registro.');
        }
    } catch (err) {
        console.error('❌ Error de conexión:', err);
        alert('Error de conexión con el servidor.');
    }
});