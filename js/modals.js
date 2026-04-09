function openModal(modalId) {
    // Ajustamos el ID para que coincida con el HTML
    const id = modalId === 'add-student' ? 'modal-student' : 'modal-credits';
    document.getElementById(id).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Cerrar al hacer clic fuera del cuadro blanco
window.onclick = function(event) {
    if (event.target.className === 'modal-overlay') {
        event.target.style.display = 'none';
    }
}