import { db } from './config/firebase.js';
import { 
    collection, onSnapshot, query, where, 
    doc, getDoc, deleteDoc, updateDoc, increment 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Referencias DOM
const dateFilter = document.getElementById('filter-date');
const classFilter = document.getElementById('filter-class');
const dashClases = document.getElementById('dash-clases-hoy');
const dashAlumnos = document.getElementById('dash-alumnos-totales');
const dashCupos = document.getElementById('dash-cupos-hoy');
const scheduleContainer = document.getElementById('daily-schedule-container');

const hoy = new Date().toISOString().split('T')[0];
if(dateFilter) dateFilter.value = hoy;

/**
 * CALCULA CUPOS LIBRES CONTEXTUALES
 * @param {Array} reservasTotales - Todas las reservas de la fecha (sin filtrar por clase)
 * @param {Object} config - Configuración de todas las disciplinas
 * @param {String} filtro - Disciplina seleccionada ('all', 'reformer', etc.)
 */
function actualizarDashboards(reservasTotales, config, filtro) {
    let capacidadCalculada = 0;
    let reservasEnFiltro = 0;

    if (filtro === 'all') {
        // Modo Global: Sumamos capacidad de todas las disciplinas configuradas
        Object.keys(config).forEach(key => {
            const c = config[key];
            const hIn = parseInt(c.inicio.split(':')[0]);
            const hFi = parseInt(c.fin.split(':')[0]);
            const horasTotales = (hFi - hIn) + 1;
            capacidadCalculada += (horasTotales * c.vacantes);
        });
        reservasEnFiltro = reservasTotales.length;
    } else {
        // Modo Específico: Solo capacidad y reservas de la disciplina seleccionada
        const c = config[filtro];
        if (c) {
            const hIn = parseInt(c.inicio.split(':')[0]);
            const hFi = parseInt(c.fin.split(':')[0]);
            const horasTotales = (hFi - hIn) + 1;
            capacidadCalculada = horasTotales * c.vacantes;
        }
        // Filtramos las reservas totales para contar solo las de esta disciplina
        reservasEnFiltro = reservasTotales.filter(r => r.disciplinaId === filtro).length;
    }

    // Actualizamos los números en el Dashboard
    if(dashClases) dashClases.innerText = reservasEnFiltro;
    if(dashCupos) dashCupos.innerText = Math.max(0, capacidadCalculada - reservasEnFiltro);
}

function renderSchedule(reservasMostradas, config, filtro) {
    if(!scheduleContainer) return;
    scheduleContainer.innerHTML = ''; 

    // Para la grilla horaria, si es 'all' usamos 'reformer' por defecto, sino la clase elegida
    const configTurnos = (filtro !== 'all') ? config[filtro] : config['reformer'];
    
    if (!configTurnos) {
        scheduleContainer.innerHTML = '<p class="empty-msg">No hay turnos configurados para esta selección.</p>';
        return;
    }

    const hInicio = parseInt(configTurnos.inicio.split(':')[0]);
    const hFin = parseInt(configTurnos.fin.split(':')[0]);
    const vacantesMax = configTurnos.vacantes;

    const agrupados = {};
    reservasMostradas.forEach(res => {
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
                        ${filtro === 'all' ? `<small style="color:#888;">(${res.disciplina || ''})</small>` : ''}
                        <button class="btn-cancel-mini" data-reserva="${res.id}" data-alumno="${res.alumnoId}">&times;</button>
                    </li>
                `).join('')}
                ${ocupacion === 0 ? '<li class="empty-slot">Sin alumnos</li>' : ''}
            </ul>
        `;
        scheduleContainer.appendChild(timeCard);
    }
}

async function initAdminDashboard() {
    const fecha = dateFilter.value;
    const filtro = classFilter.value;

    try {
        const configSnap = await getDoc(doc(db, "configuracion", "clases"));
        if (!configSnap.exists()) return;
        const config = configSnap.data();

        // IMPORTANTE: Escuchamos TODAS las reservas del día para poder calcular cupos globales y específicos
        const q = query(collection(db, "reservas"), where("fecha", "==", fecha));

        onSnapshot(q, (snapshot) => {
            const todasLasReservas = [];
            snapshot.forEach(doc => todasLasReservas.push({ id: doc.id, ...doc.data() }));
            
            // 1. Actualizamos contadores (Dashboards) según el filtro
            actualizarDashboards(todasLasReservas, config, filtro);
            
            // 2. Filtramos qué reservas mostrar en la lista visual
            const reservasParaMostrar = (filtro === 'all') 
                ? todasLasReservas 
                : todasLasReservas.filter(r => r.disciplinaId === filtro);
            
            renderSchedule(reservasParaMostrar, config, filtro);
        });

    } catch (error) { console.error(error); }
}

// Listeners
if(dateFilter) dateFilter.addEventListener('change', initAdminDashboard);
if(classFilter) classFilter.addEventListener('change', initAdminDashboard);

onSnapshot(collection(db, "alumnos"), (snapshot) => {
    if(dashAlumnos) dashAlumnos.innerText = snapshot.size;
});

// Event Delegation para cancelar
if(scheduleContainer) {
    scheduleContainer.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-cancel-mini');
        if(btn) {
            const { reserva, alumno } = btn.dataset;
            if (confirm("¿Cancelar reserva?")) {
                try {
                    await deleteDoc(doc(db, "reservas", reserva));
                    await updateDoc(doc(db, "alumnos", alumno), { creditos: increment(1) });
                } catch (e) { console.error(e); }
            }
        }
    });
}

initAdminDashboard();