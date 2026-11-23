// Alta de alumnos desde el panel de admin.
//
// createUserWithEmailAndPassword deja logueado al usuario recién creado en la
// instancia de Auth que se use. Para que el admin NO pierda su sesión, el alta
// se hace en una app de Firebase secundaria, con sesión solo en memoria, que
// se cierra apenas termina. El doc alumnos/{uid} lo escribe el admin con su
// propia sesión (firestore.rules solo deja crear alumnos a un admin).
//
// No hay contraseña fija: se genera una aleatoria que nadie conoce y se le manda
// al alumno un mail para que elija la suya.
import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
    initializeAuth, inMemoryPersistence, createUserWithEmailAndPassword,
    sendPasswordResetEmail, signOut, deleteUser
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig } from '../config/firebase.js';

const NOMBRE_APP_ALTAS = 'pilatea-altas';
let authAltas = null;

function getAuthAltas() {
    if (!authAltas) {
        const app = getApps().find(a => a.name === NOMBRE_APP_ALTAS)
            || initializeApp(firebaseConfig, NOMBRE_APP_ALTAS);
        authAltas = initializeAuth(app, { persistence: inMemoryPersistence });
        authAltas.languageCode = 'es';
    }
    return authAltas;
}

function passwordAleatoria(largo = 32) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?';
    const bytes = crypto.getRandomValues(new Uint32Array(largo));
    return Array.from(bytes, b => chars[b % chars.length]).join('');
}

export const normalizarEmail = (email) => String(email || '').trim().toLowerCase();

/** Manda (o reenvía) el mail para que el alumno elija su contraseña. */
export async function enviarAcceso(email) {
    await sendPasswordResetEmail(getAuthAltas(), normalizarEmail(email));
}

/**
 * Crea el usuario de Auth y el doc alumnos/{uid}, y le manda el mail de acceso.
 * Devuelve { uid, mailEnviado }. Si el mail falla, el alumno queda creado igual
 * y se puede reenviar desde la tabla.
 * @param {import('firebase/firestore').Firestore} db Firestore de la sesión del admin.
 */
export async function crearAlumno(db, { nombre, email }) {
    nombre = String(nombre || '').trim();
    email = normalizarEmail(email);
    if (!nombre || !email) throw new Error('Faltan el nombre o el email.');

    const authSec = getAuthAltas();
    const cred = await createUserWithEmailAndPassword(authSec, email, passwordAleatoria());
    const uid = cred.user.uid;

    try {
        await setDoc(doc(db, "alumnos", uid), {
            nombre, email, creditos: 0, role: 'alumno', uid, fechaAlta: new Date()
        });
    } catch (err) {
        // Sin doc el alumno no puede entrar: borramos el usuario para no dejarlo
        // huérfano y que se pueda reintentar con el mismo email.
        await deleteUser(cred.user).catch(e => console.error("No se pudo deshacer el alta:", e));
        await signOut(authSec).catch(() => {});
        throw err;
    }

    let mailEnviado = true;
    try {
        await sendPasswordResetEmail(authSec, email);
    } catch (e) {
        console.error("No se pudo enviar el mail de acceso:", e);
        mailEnviado = false;
    }
    await signOut(authSec).catch(() => {});
    return { uid, mailEnviado };
}

/** Mensaje legible para los errores más comunes del alta. */
export function mensajeErrorAlta(err) {
    switch (err?.code) {
        case 'auth/email-already-in-use': return "Ya existe un usuario con ese email.";
        case 'auth/invalid-email': return "El email no es válido.";
        case 'auth/network-request-failed': return "Sin conexión. Probá de nuevo.";
        case 'auth/too-many-requests': return "Demasiados intentos. Esperá unos minutos y probá de nuevo.";
        case 'permission-denied': return "No tenés permisos para crear alumnos.";
        default: return err?.message || "No se pudo crear el alumno.";
    }
}
