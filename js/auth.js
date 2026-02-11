import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCedurhdaLQfrSFHWn7J9ptN6mIq3HfJOY",
  authDomain: "pilatea-sistema.firebaseapp.com",
  projectId: "pilatea-sistema",
  storageBucket: "pilatea-sistema.firebasestorage.app",
  messagingSenderId: "478294720150",
  appId: "1:478294720150:web:9efe132aa23cad2db7ccb7"
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