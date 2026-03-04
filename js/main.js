/**
 * Main Orchestrator - Pilatea App
 * Responsabilidad: Controlar el renderizado de UI y seguridad por roles.
 * Desarrollador: Héctor Martín Cazorla Sota
 */
import { AuthService } from './auth/auth-service.js';
import { StudentView } from './ui/student-view.js';
import { AdminView } from './ui/admin-view.js';

// Datos temporales (se mantendrán hasta que conectemos Firestore para las clases)
const clasesSimuladas = [
    { nombre: "Pilates Reformer", descripcion: "Trabajo integral con máquinas para mejorar postura y fuerza." },
    { nombre: "Hiit Barre", descripcion: "Clases intensas enfocadas en el control del core y respiración." },
    { nombre: "Yoga", descripcion: "Fusión de flexibilidad y equilibrio para el bienestar total." }
];

async function initApp() {
    // 1. Suscripción al estado de Auth: Firebase nos avisa si el usuario entra o sale
    AuthService.subscribeToAuthChanges(async (user) => {
        const staffButton = document.querySelector('.btn-staff');
        
        // Renderizamos las clases para todos (público, alumnos y profes)
        StudentView.renderClasses(clasesSimuladas);

        if (user) {
            // 2. Si hay sesión iniciada, validamos el ROL desde Firestore
            const userData = await AuthService.getUserData(user.uid);
            
            if (userData && userData.role === 'admin') {
                console.log("Acceso de Administrador: Héctor.");
                // Mostramos herramientas de gestión
                if (staffButton) staffButton.style.display = 'block';
                AdminView.initDashboard();
            } else {
                console.log("Acceso de Alumno.");
                // Protegemos la interfaz ocultando accesos administrativos
                if (staffButton) staffButton.style.display = 'none';
            }
        } else {
            // 3. Estado: Invitado (sin login)
            console.log("Navegando como invitado.");
            if (staffButton) staffButton.style.display = 'none';
        }
    });
}

// Inicialización segura del DOM
document.addEventListener('DOMContentLoaded', initApp);