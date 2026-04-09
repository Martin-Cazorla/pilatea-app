import { auth, db } from './config/firebase.js';
import { 
    signInWithEmailAndPassword, 
    setPersistence, 
    browserLocalPersistence 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    doc, 
    getDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const loginForm = document.querySelector('.login-form') || document.querySelector('form');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const emailInput = loginForm.querySelector('input[type="email"]');
        const passInput = loginForm.querySelector('input[type="password"]');
        const submitBtn = loginForm.querySelector('button[type="submit"]');

        const emailValue = emailInput.value.trim();
        const passValue = passInput.value;

        // UI: Estado de carga
        const originalText = submitBtn.innerText;
        submitBtn.innerText = "Verificando...";
        submitBtn.disabled = true;

try {
            // Limpieza profunda de valores
            const emailFinal = emailValue.toLowerCase().trim();
            const passFinal = passValue.trim(); 

            await setPersistence(auth, browserLocalPersistence);
            
            console.log("Intentando ingresar con:", emailFinal); // Para que verifiques en consola
            
            const userCredential = await signInWithEmailAndPassword(auth, emailFinal, passFinal);
            const user = userCredential.user;

            // Verificación en Firestore
            const userDocSnap = await getDoc(doc(db, "alumnos", user.uid));

            if (userDocSnap.exists()) {
                window.location.href = "reserva.html";
            } else {
                alert("Usuario autenticado pero no encontrado en la colección 'alumnos'. Revisa el UID.");
                await auth.signOut();
                submitBtn.innerText = originalText;
                submitBtn.disabled = false;
            }

        } catch (error) {
            submitBtn.innerText = originalText;
            submitBtn.disabled = false;

            console.error("Error de login:", error.code);

            let message = "Error al ingresar. Verifique sus datos.";
            
            if (error.code === 'auth/invalid-credential') {
                message = "Email o contraseña incorrectos.";
            } else if (error.code === 'auth/user-not-found') {
                message = "El usuario no existe.";
            } else if (error.code === 'auth/wrong-password') {
                message = "Contraseña incorrecta.";
            }

            alert(message);
        }
    });
}