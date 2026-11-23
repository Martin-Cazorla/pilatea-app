import { auth, db } from '../config/firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

/**
 * Devuelve true si el usuario tiene role 'admin' en alumnos/{uid}.
 */
export const isAdminUser = async (user) => {
    if (!user) return false;
    try {
        const snap = await getDoc(doc(db, "alumnos", user.uid));
        return snap.exists() && snap.data().role === 'admin';
    } catch (e) {
        console.error("Error verificando rol:", e);
        return false;
    }
};

/**
 * Protege las páginas de administración.
 * Resuelve con el usuario si es admin; si no hay sesión manda al login y si
 * es alumno lo manda a su página de reservas. La página queda oculta
 * (body con visibility:hidden) hasta confirmar el rol.
 * Ojo: esto es solo UX. La protección real de los datos está en firestore.rules.
 */
export const requireAdmin = ({ loginPath = "login.html", fallbackPath = "reserva.html" } = {}) =>
    new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();
            if (!user) {
                window.location.replace(loginPath);
                return;
            }
            if (!(await isAdminUser(user))) {
                console.warn("Acceso denegado: el usuario no es administrador.");
                window.location.replace(fallbackPath);
                return;
            }
            document.body.style.visibility = '';
            resolve(user);
        });
    });
