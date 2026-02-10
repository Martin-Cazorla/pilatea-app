import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

// Usa tu firebaseConfig aquí (el mismo de admin-firebase.js)
const firebaseConfig = {
  apiKey: "AIzaSyCedurhdaLQfrSFHWn7J9ptN6mIq3HfJOY",
  authDomain: "pilatea-sistema.firebaseapp.com",
  projectId: "pilatea-sistema",
  storageBucket: "pilatea-sistema.firebasestorage.app",
  messagingSenderId: "478294720150",
  appId: "1:478294720150:web:9efe132aa23cad2db7ccb7"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const grid = document.getElementById('time-slots-grid');

async function generateSlots() {
    // 1. Traemos la configuración global
    const configSnap = await getDoc(doc(db, "configuracion", "clases"));
    
    if (!configSnap.exists()) {
        grid.innerHTML = "<p>Error: Configura el horario en el panel de admin.</p>";
        return;
    }

    const { horaInicio, horaFin, vacantes } = configSnap.data();
    grid.innerHTML = ''; // Limpiar grilla

    // 2. Convertir horas a números para el bucle (Ej: "08:00" -> 8)
    const inicio = parseInt(horaInicio.split(':')[0]);
    const fin = parseInt(horaFin.split(':')[0]);

    for (let h = inicio; h <= fin; h++) {
        const timeLabel = `${h.toString().padStart(2, '0')}:00`;
        
        const slotBtn = document.createElement('button');
        slotBtn.className = 'btn-slot';
        slotBtn.innerHTML = `
            <span class="time">${timeLabel}hs</span>
            <span class="spots">Cupos: ${vacantes}</span>
        `;
        
        slotBtn.onclick = () => selectSlot(timeLabel);
        grid.appendChild(slotBtn);
    }
}

function selectSlot(time) {
    alert(`Has seleccionado el turno de las ${time}. ¡Asegúrate de tener créditos disponibles!`);
}

generateSlots();