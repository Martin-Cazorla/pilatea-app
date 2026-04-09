import { auth } from '../config/firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/**
 * Protege las páginas privadas. 
 * @param {string} redirectPath - A dónde enviar si no hay sesión.
 */
export const checkAuth = (redirectPath = "../index.html") => {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            console.warn("Acceso denegado: Usuario no autenticado.");
            window.location.href = redirectPath;
        }
    });
};