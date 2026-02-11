// Usamos la versión de CDN para que el navegador no dé error de "resolve module"
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, doc, getDoc, collection, query, where, getDocs, 
    updateDoc, increment, addDoc, onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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
const auth = getAuth(app);

const grid = document.getElementById('time-slots-grid');
const userWelcome = document.getElementById('user-welcome');
const dateInput = document.getElementById('reservation-date');

let currentUser = null;
let userCredits = 0;

// Configuración inicial de fecha: Hoy
const hoy = new Date().toISOString().split('T')[0];
if(dateInput) {
    dateInput.value = hoy;
    dateInput.min = hoy;
}

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        onSnapshot(doc(db, "alumnos", user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                userCredits = data.creditos || 0;
                if(userWelcome) userWelcome.innerHTML = `Hola, <strong>${data.nombre}</strong> (Créditos: ${userCredits})`;
            }
        });
        generateSlots();
    } else {
        window.location.href = "login.html";
    }
});

async function generateSlots() {
    if (!grid || !dateInput) return;
    const selectedDate = dateInput.value;
    grid.innerHTML = "<p>Cargando horarios disponibles...</p>"; 

    try {
        const configSnap = await getDoc(doc(db, "configuracion", "clases"));
        
        if (!configSnap.exists()) {
            grid.innerHTML = "<p>⚠️ Configura horarios en el Panel Admin.</p>";
            return;
        }

        const config = configSnap.data();
        const vacantesTotales = Number(config.vacantes);
        const hInicio = parseInt(String(config.horaInicio).split(':')[0]);
        const hFin = parseInt(String(config.horaFin).split(':')[0]);

        const q = query(collection(db, "reservas"), where("fecha", "==", selectedDate));
        const querySnapshot = await getDocs(q);
        
        const ocupacionPorHora = {};
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            ocupacionPorHora[data.hora] = (ocupacionPorHora[data.hora] || 0) + 1;
        });

        grid.innerHTML = ''; 

        for (let h = hInicio; h <= hFin; h++) {
            const timeLabel = `${h.toString().padStart(2, '0')}:00`;
            const anotados = ocupacionPorHora[timeLabel] || 0;
            const cuposLibres = vacantesTotales - anotados;
            
            const slotBtn = document.createElement('button');
            slotBtn.className = 'btn-slot';
            
            if (cuposLibres <= 0) {
                slotBtn.classList.add('btn-full');
                slotBtn.disabled = true;
                slotBtn.innerHTML = `<span>${timeLabel}hs</span><small>COMPLETO</small>`;
            } else {
                slotBtn.innerHTML = `<span>${timeLabel}hs</span><small>Cupos: ${cuposLibres}</small>`;
                slotBtn.onclick = () => handleReservation(timeLabel);
            }
            grid.appendChild(slotBtn);
        }
    } catch (error) {
        console.error("Error detallado:", error);
        grid.innerHTML = "<p>Error al cargar. Revisa la consola.</p>";
    }
}

async function handleReservation(time) {
    if (userCredits <= 0) return alert("No tenés créditos disponibles.");
    const selectedDate = dateInput.value;
    if (!confirm(`¿Reservar para el ${selectedDate} a las ${time}hs?`)) return;

    try {
        const userRef = doc(db, "alumnos", currentUser.uid);
        await updateDoc(userRef, { creditos: increment(-1) });

        await addDoc(collection(db, "reservas"), {
            alumnoId: currentUser.uid,
            alumnoNombre: userWelcome.innerText.split('(')[0].replace('Hola, ', '').trim(),
            fecha: selectedDate,
            hora: time,
            fechaCreacion: new Date()
        });

        alert("¡Reserva exitosa!");
        generateSlots(); 
    } catch (error) {
        console.error("Error reserva:", error);
        alert("Hubo un problema con la reserva.");
    }
}

if(dateInput) dateInput.addEventListener('change', generateSlots);