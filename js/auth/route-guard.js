/**
 * Route Guard - Pilatea App
 * Responsabilidad: Proteger rutas privadas y manejar la visibilidad inicial.
 */
import { AuthService } from './auth-service.js';

export async function protectAdminRoute() {
    // Ocultamos el body inmediatamente para evitar que un alumno vea el panel un segundo
    document.body.style.display = 'none';

    AuthService.subscribeToAuthChanges(async (user) => {
        if (!user) {
            window.location.href = '../index.html';
            return;
        }

        try {
            const userData = await AuthService.getUserData(user.uid);
            
            if (userData && userData.role === 'admin') {
                // EXCLUSIVO PROFESOR: Si es admin, mostramos la página
                document.body.style.display = 'block';
                console.log("Acceso autorizado.");
            } else {
                // ALUMNO: Lo expulsamos al index
                window.location.href = '../index.html';
            }
        } catch (error) {
            console.error("Error de validación:", error);
            window.location.href = '../index.html';
        }
    });
}