/**
 * UI Profesor (Admin)
 * Responsabilidad: Construcción dinámica de elementos para el staff.
 */
export const AdminView = {
    /**
     * Inicializa los componentes visuales del Dashboard
     */
    initDashboard: () => {
        console.log("Construyendo interfaz administrativa...");
        
        const headerActions = document.querySelector('.header-actions');
        
        // Verificamos si ya existe el botón para no duplicarlo si hay re-renders
        if (!document.querySelector('.btn-add-class')) {
            const btnAdd = document.createElement('button');
            btnAdd.textContent = "Añadir Horario";
            btnAdd.className = "btn-staff btn-add-class"; // Clases múltiples para estilo
            
            // Ejemplo de evento (lo que estás estudiando de DOM y Eventos)
            btnAdd.onclick = () => alert("Abriendo formulario de nueva clase...");
            
            headerActions.appendChild(btnAdd);
        }
    }
};