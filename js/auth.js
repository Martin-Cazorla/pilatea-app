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

        // UI: Estado de carga
        const originalText = submitBtn.innerText;
        submitBtn.innerText = "Verificando...";
        submitBtn.disabled = true;

        try {
            const emailFinal = emailInput.value.toLowerCase().trim();
            const passFinal = passInput.value.trim(); 

            await setPersistence(auth, browserLocalPersistence);
            
            const userCredential = await signInWithEmailAndPassword(auth, emailFinal, passFinal);
            const user = userCredential.user;

            // Verificación en Firestore
            const userDocSnap = await getDoc(doc(db, "alumnos", user.uid));

            if (userDocSnap.exists()) {
                // INTEGRACIÓN DE PARÁMETROS URL
                const urlParams = new URLSearchParams(window.location.search);
                const claseIntentada = urlParams.get('clase');

                if (claseIntentada) {
                    window.location.href = `reserva.html?clase=${claseIntentada}`;
                } else {
                    window.location.href = "reserva.html";
                }
            } else {
                alert("Usuario autenticado pero no encontrado en la colección 'alumnos'.");
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
            }
            alert(message);
        }
    });
}