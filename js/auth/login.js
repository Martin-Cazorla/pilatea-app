/**
 * Login Controller
 * Responsabilidad: Capturar datos del form y autenticar con Firebase.
 */
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import firebaseConfig from "../services/firebase-config.js";

// Inicializamos para este módulo
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const loginForm = document.getElementById('login-form');
const errorDisplay = document.getElementById('login-error');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Evita que la página se refresque
    
    // Captura de valores (DOM)
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    // Limpiar errores previos
    errorDisplay.style.display = 'none';
    errorDisplay.textContent = '';

    try {
        // Intento de login
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log("Login exitoso:", userCredential.user.email);
        
        // Redirigir al inicio: el main.js detectará el login y mostrará el botón de staff si corresponde
        window.location.href = '../index.html';
        
    } catch (error) {
        console.error("Error de login:", error.code);
        errorDisplay.style.display = 'block';
        
        // Manejo de errores amigable
        switch (error.code) {
            case 'auth/invalid-credential':
                errorDisplay.textContent = "Email o contraseña incorrectos.";
                break;
            case 'auth/user-not-found':
                errorDisplay.textContent = "El usuario no existe.";
                break;
            case 'auth/wrong-password':
                errorDisplay.textContent = "Contraseña incorrecta.";
                break;
            default:
                errorDisplay.textContent = "Ocurrió un error. Intentá más tarde.";
        }
    }
});