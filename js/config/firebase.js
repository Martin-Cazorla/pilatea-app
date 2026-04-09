// js/config/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ESTA ES LA CONFIGURACIÓN CORRECTA DE TU PROYECTO V2
const firebaseConfig = {
  apiKey: "AIzaSyD-YJPMYUaTgwVFWGe1Zh1BHhxAxu3Bkwo",
  authDomain: "pilatea-app-v2.firebaseapp.com",
  projectId: "pilatea-app-v2",
  storageBucket: "pilatea-app-v2.firebasestorage.app",
  messagingSenderId: "708162358237",
  appId: "1:708162358237:web:615fc002223e58c4f9c434"
};

// Instancias exportadas
export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);