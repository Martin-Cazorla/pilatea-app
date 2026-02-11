import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, onSnapshot, query, where, 
    doc, getDoc, deleteDoc, updateDoc, increment 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// Referencias DOM
const dateFilter = document.getElementById('filter-date');
const dashClases = document.getElementById('dash-clases-hoy');
const dashAlumnos = document.getElementById('dash-alumnos-totales');
const dashCupos = document.getElementById('dash-cupos-hoy');
const scheduleContainer = document.getElementById('daily-schedule-container');

// Inicializar fecha de hoy
const hoy = new Date().toISOString().split('T')[0];
dateFilter.value = hoy;

/**
 * Renderiza el cronograma agrupado por horas
 */
function renderSchedule(reservas, config) {
    scheduleContainer.innerHTML = ''; 

    const hInicio = parseInt(config.horaInicio);
    const hFin = parseInt(config.horaFin);
    const vacantesMax = config.vacantes;

    // Agrupar reservas por hora
    const agrupados = {};
    reservas.forEach(res => {
        if (!agrupados[res.hora]) agrupados[res.hora] = [];
        agrupados[res.hora].push(res);
    });

    // Generar bloques desde hora inicio a fin
    for (let h = hInicio; h <= hFin; h++) {
        const horaLabel = `${h.toString().padStart(2, '0')}:00`;
        const alumnosEnTurno = agrupados[horaLabel] || [];
        const ocupacion = alumnosEnTurno.length;

        const timeCard = document.createElement('div');
        timeCard.className = `time-block-card ${ocupacion >= vacantesMax ? 'full' : ''}`;
        
        timeCard.innerHTML = `
            <div class="time-header">
                <span class="time-badge">${horaLabel} hs</span>
                <span class="occupancy-info">
                    <i class="fa-solid fa-users"></i> ${ocupacion} / ${vacantesMax}
                </span>
            </div>
            <ul class="student-mini-list">
                ${alumnosEnTurno.map(res => `
                    <li>
                        <span class="student-name">${res.alumnoNombre}</span>
                        <button class="btn-cancel-mini" title="Cancelar" 
                            onclick="cancelarReserva('${res.id}', '${res.alumnoId}')">
                            &times;
                        </button>
                    </li>
                `).join('')}
                ${ocupacion === 0 ? '<li class="empty-slot">Sin alumnos</li>' : ''}
            </ul>
        `;
        scheduleContainer.appendChild(timeCard);
    }
}

/**
 * Escucha las reservas y la configuración simultáneamente
 */
async function initReservasListener(fecha) {
    try {
        // Obtener la configuración primero para tener los límites de horas
        const configSnap = await getDoc(doc(db, "configuracion", "clases"));
        const config = configSnap.exists() ? configSnap.data() : { horaInicio: 8, horaFin: 21, vacantes: 8 };

        // Escuchar cambios en las reservas de la fecha
        const q = query(collection(db, "reservas"), where("fecha", "==", fecha));
        onSnapshot(q, (snapshot) => {
            const reservas = [];
            snapshot.forEach(doc => reservas.push({ id: doc.id, ...doc.data() }));
            
            // Actualizar dashboard y cronograma
            dashClases.innerText = reservas.length;
            renderSchedule(reservas, config);
            
            // Cálculo de cupos totales del día
            const totalTurnos = (parseInt(config.horaFin) - parseInt(config.horaInicio)) + 1;
            const capacidadTotal = totalTurnos * config.vacantes;
            dashCupos.innerText = Math.max(0, capacidadTotal - reservas.length);
        });
    } catch (error) {
        console.error("Error al cargar datos:", error);
    }
}

// Escucha total de alumnos
onSnapshot(collection(db, "alumnos"), (snapshot) => {
    dashAlumnos.innerText = snapshot.size;
});

// Función global para cancelar (necesaria para el onclick del HTML dinámico)
window.cancelarReserva = async (reservaId, alumnoId) => {
    if (confirm("¿Seguro que desea cancelar este turno? Se devolverá 1 crédito.")) {
        try {
            await deleteDoc(doc(db, "reservas", reservaId));
            await updateDoc(doc(db, "alumnos", alumnoId), { creditos: increment(1) });
        } catch (error) {
            console.error("Error al cancelar:", error);
        }
    }
};

dateFilter.addEventListener('change', (e) => initReservasListener(e.target.value));
initReservasListener(hoy);