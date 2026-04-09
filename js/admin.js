import { db } from './config/firebase.js'; // Importamos la conexión real
import { 
    collection, onSnapshot, query, where, 
    doc, getDoc, deleteDoc, updateDoc, increment 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Referencias DOM
const dateFilter = document.getElementById('filter-date');
const dashClases = document.getElementById('dash-clases-hoy');
const dashAlumnos = document.getElementById('dash-alumnos-totales');
const dashCupos = document.getElementById('dash-cupos-hoy');
const scheduleContainer = document.getElementById('daily-schedule-container');

// Inicializar fecha de hoy
const hoy = new Date().toISOString().split('T')[0];
if(dateFilter) dateFilter.value = hoy;

function renderSchedule(reservas, config) {
    if(!scheduleContainer) return;
    scheduleContainer.innerHTML = ''; 

    // Ajustamos los nombres de campos para que coincidan con tu admin-firebase.js
    const hInicio = parseInt(config.reformer?.inicio || "08:00");
    const hFin = parseInt(config.reformer?.fin || "21:00");
    const vacantesMax = config.reformer?.vacantes || 5;

    const agrupados = {};
    reservas.forEach(res => {
        if (!agrupados[res.hora]) agrupados[res.hora] = [];
        agrupados[res.hora].push(res);
    });

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
                        <span class="student-name">${res.alumnoNombre || 'Alumno'}</span>
                        <button class="btn-cancel-mini" data-reserva="${res.id}" data-alumno="${res.alumnoId}">
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

async function initReservasListener(fecha) {
    try {
        const configSnap = await getDoc(doc(db, "configuracion", "clases"));
        const config = configSnap.exists() ? configSnap.data() : {};

        const q = query(collection(db, "reservas"), where("fecha", "==", fecha));
        onSnapshot(q, (snapshot) => {
            const reservas = [];
            snapshot.forEach(doc => reservas.push({ id: doc.id, ...doc.data() }));
            
            if(dashClases) dashClases.innerText = reservas.length;
            renderSchedule(reservas, config);
        });
    } catch (error) {
        console.error("Error en el dashboard:", error);
    }
}

// Delegación de eventos para cancelar (más limpio que onclick)
if(scheduleContainer) {
    scheduleContainer.addEventListener('click', async (e) => {
        if(e.target.classList.contains('btn-cancel-mini')) {
            const { reserva, alumno } = e.target.dataset;
            if (confirm("¿Cancelar turno? Se devolverá 1 crédito.")) {
                try {
                    await deleteDoc(doc(db, "reservas", reserva));
                    await updateDoc(doc(db, "alumnos", alumno), { creditos: increment(1) });
                } catch (e) { console.error(e); }
            }
        }
    });
}

onSnapshot(collection(db, "alumnos"), (snapshot) => {
    if(dashAlumnos) dashAlumnos.innerText = snapshot.size;
});

if(dateFilter) {
    dateFilter.addEventListener('change', (e) => initReservasListener(e.target.value));
}
initReservasListener(hoy);