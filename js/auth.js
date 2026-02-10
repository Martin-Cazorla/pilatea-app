import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAsV8J1doRrUiyOg-miAP2FGdcW6Cz0jmQ",
  authDomain: "pilatea-app.firebaseapp.com",
  projectId: "pilatea-app",
  storageBucket: "pilatea-app.firebasestorage.app",
  messagingSenderId: "132126534808",
  appId: "1:132126534808:web:405267a30d66cb413174ed"
};

// Inicializamos todo junto
const app = initializeApp(firebaseConfig);
const auth = getAuth(app); 

const loginForm = document.querySelector('form');

if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = loginForm.querySelector('input[type="email"]').value;
        const password = loginForm.querySelector('input[type="password"]').value;

        signInWithEmailAndPassword(auth, email, password)
            .then(() => {
                window.location.href = "reserva.html";
            })
            .catch((error) => {
                console.error("Error login:", error);
                alert("Error al ingresar: Verifique su email y contraseña.");
            });
    });
}