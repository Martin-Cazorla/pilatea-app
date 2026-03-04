/**
 * UI Alumnos
 * Responsabilidad: Renderizar la lista de clases y manejar reservas.
 */
export const StudentView = {
    renderClasses: (classes) => {
        const container = document.getElementById('class-grid');
        container.innerHTML = ''; // Limpiamos para evitar duplicados

        classes.forEach(clase => {
            const card = document.createElement('div');
            card.className = 'class-card';
            // Aplicamos accesibilidad con aria-label dinámico
            card.innerHTML = `
                <div class="card-body">
                    <h3>${clase.nombre}</h3>
                    <p>${clase.descripcion}</p>
                    <button class="btn-primary" aria-label="Reservar ${clase.nombre}">
                        Reservar Clase
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    }
};